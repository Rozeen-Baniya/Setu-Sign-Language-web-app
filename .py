import cv2
import mediapipe as mp
import torch
import torch.nn as nn
import numpy as np
from collections import deque

# ================================
# Model and Class Definition
# ================================
# Define the model architecture exactly as you trained it
INPUT_SIZE = 258
HIDDEN_SIZE = 256
NUM_LAYERS = 2
NUM_CLASSES = 18
DROPOUT = 0.4

class SignGRU(nn.Module):
    def __init__(self, input_size, hidden_size, num_layers, num_classes, dropout=0.4):
        super(SignGRU, self).__init__()
        self.gru = nn.GRU(input_size, hidden_size, num_layers, batch_first=True, dropout=dropout)
        self.fc1 = nn.Linear(hidden_size, 128)
        self.fc2 = nn.Linear(128, num_classes)
        
    def forward(self, x):
        out, _ = self.gru(x)
        out = out[:, -1, :]  # Take the last time step
        out = torch.relu(self.fc1(out))
        out = self.fc2(out)
        return out

# Define the class names to match your model's output
class_names = [
    "aaja", "aitabar", "bal", "bhat",
    "bholi", "hami", "hijo", "janu", "khanu",
    "khelnu", "ma", "manglabar", "sanibar", "sombar",
    "sukrabar", "timi", "uni", "image"
]

# Load the trained model
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
model = SignGRU(INPUT_SIZE, HIDDEN_SIZE, NUM_LAYERS, NUM_CLASSES, DROPOUT)
model.load_state_dict(torch.load('nepali_slr_model_finalv4.pth', map_location=device))
model = model.to(device)
model.eval()

# ================================
# Real-time Prediction
# ================================
def extract_features(hand_landmarks_list, prev_landmarks):
    """Extract optimized features with motion vectors from MediaPipe landmarks."""
    features = []
    if hand_landmarks_list:
        # Extract raw landmarks
        for hand_landmarks in hand_landmarks_list:
            hand_coords = []
            for lm in hand_landmarks.landmark:
                hand_coords.extend([lm.x, lm.y, lm.z])
            features.extend(hand_coords)
    
    # Pad to 126 features (2 hands * 21 landmarks * 3 coords)
    while len(features) < 126:
        features.extend([0.0] * 63)
    features = features[:126]
    
    # Calculate motion features
    motion_features = [0.0] * 126
    if prev_landmarks is not None:
        for i in range(min(len(features), len(prev_landmarks))):
            motion_features[i] = features[i] - prev_landmarks[i]
    
    current_landmarks = features.copy()
    
    # Combine raw landmarks and motion features
    combined_features = features + motion_features
    
    # Pad to 258 features for model input
    while len(combined_features) < 258:
        combined_features.append(0.0)
    
    return np.array(combined_features, dtype=np.float32), current_landmarks

def main():
    # Initialize MediaPipe Hands model
    mp_hands = mp.solutions.hands
    hands = mp_hands.Hands(
        static_image_mode=False,
        max_num_hands=2,
        min_detection_confidence=0.7,
        min_tracking_confidence=0.5
    )
    mp_draw = mp.solutions.drawing_utils

    # Open the default camera
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not open video stream.")
        return

    print("Camera feed is active. Press 'q' to exit.")

    # Feature buffer for a sequence of frames
    feature_buffer = deque(maxlen=30)
    prev_landmarks = None
    
    # Variables for displaying prediction
    predicted_sign = "Waiting..."
    confidence_score = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: Failed to capture frame.")
            break

        frame = cv2.flip(frame, 1)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = hands.process(rgb_frame)

        # Draw hand landmarks
        if results.multi_hand_landmarks:
            for hand_landmarks in results.multi_hand_landmarks:
                mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)
        
        # Get hand landmarks and extract features
        hand_landmarks_list = results.multi_hand_landmarks if results.multi_hand_landmarks else []
        features, prev_landmarks = extract_features(hand_landmarks_list, prev_landmarks)
        
        # Add the features to the buffer
        feature_buffer.append(features)
        
        # Make a prediction when the buffer is full
        if len(feature_buffer) == 30:
            sequence = np.array(list(feature_buffer))
            seq_tensor = torch.tensor(sequence, dtype=torch.float32).unsqueeze(0).to(device)
            
            with torch.no_grad():
                outputs = model(seq_tensor)
                probabilities = torch.softmax(outputs, dim=1)
                confidence, predicted = torch.max(probabilities, 1)
                
                predicted_sign = class_names[predicted.item()]
                confidence_score = confidence.item()

            # Print prediction to the terminal
            print(f"Predicted Sign: {predicted_sign} | Confidence: {confidence_score:.2f}")

        # Display the prediction on the frame
        cv2.putText(frame, f'Sign: {predicted_sign}', (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        cv2.putText(frame, f'Confidence: {confidence_score:.2f}', (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        cv2.imshow('Sign Language Detector', frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()