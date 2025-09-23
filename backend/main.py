import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'  # Suppress TF warnings

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import torch
import torch.nn as nn
import cv2
import mediapipe as mp
import numpy as np
from datetime import datetime
import os
from collections import Counter, deque
import asyncio
import json
import base64

# ================================
# Initialize FastAPI app
# ================================
app = FastAPI(
    title="Setu Hand Landmark Detection API",
    description="Real-time Nepali Sign Language Hand Landmark Detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Setu Hand Landmark Detection API is running!"}

@app.get("/about")
async def get_about():
    return {
        "title": "About Setu",
        "mission_statement": "At Setu, our mission is to bridge communication gaps through Nepali Sign Language translation.",
        "team": [
            {"name": "Rojin Baniya", "role": "Machine Learning", "linkedin": "https://linkedin.com/in/rojin-baniya"},
            {"name": "Aaryan Sharma", "role": "MLOps", "linkedin": "https://linkedin.com/in/aaryan-sharma"},
            {"name": "Prakriti Devkota", "role": "Frontend Developer", "linkedin": "https://linkedin.com/in/prakriti-devkota"},
            {"name": "Rejina Budhathoki", "role": "Backend Developer", "linkedin": "https://linkedin.com/in/rejina-budhathoki"},
        ]
    }

@app.get("/model_info")
async def get_model_info():
    return {
        "model_config": {
            "input_size": INPUT_SIZE,
            "hidden_size": HIDDEN_SIZE,
            "num_layers": NUM_LAYERS,
            "num_classes": NUM_CLASSES,
            "device": str(device)
        },
        "classes": class_names,
        "confidence_threshold": predictor.confidence_threshold,
        "window_size": predictor.window_size
    }

# ================================
# Load trained GRU model (fixed: consistent class_names, flexible path)
# ================================
device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
print(f"Using device: {device}")

# These must match training settings
INPUT_SIZE = 258   # hand landmarks features
HIDDEN_SIZE = 256
NUM_LAYERS = 2
NUM_CLASSES = 4    # Updated to match model
DROPOUT = 0.4

print(f"Model configuration: INPUT_SIZE={INPUT_SIZE}, HIDDEN_SIZE={HIDDEN_SIZE}, NUM_LAYERS={NUM_LAYERS}, NUM_CLASSES={NUM_CLASSES}")

# Load EfficientNet model with efficientnet_pytorch
try:
    from efficientnet_pytorch import EfficientNet
    model = EfficientNet.from_pretrained('efficientnet-b0', num_classes=NUM_CLASSES)
except ImportError:
    print("Installing efficientnet_pytorch...")
    import subprocess
    subprocess.check_call(["pip", "install", "efficientnet_pytorch"])
    from efficientnet_pytorch import EfficientNet
    model = EfficientNet.from_pretrained('efficientnet-b0', num_classes=NUM_CLASSES)

model_path = os.getenv('MODEL_PATH', 'snl.pth')  # Set env var for custom path
model.load_state_dict(torch.load(model_path, map_location=device))
model = model.to(device)
model.eval()

class_names = [  # Updated for new model with 4 classes
    "धन्यबाद", "घर", "म", "नमस्कार"
]

# ================================
# Real-time tracking optimization
# ================================
class RealTimePredictor:
    def __init__(self, window_size=15, confidence_threshold=0.8):
        self.window_size = window_size
        self.confidence_threshold = confidence_threshold
        self.prediction_buffer = deque(maxlen=15)  # Larger buffer for stability
        
        # Timer system
        self.detection_start_time = None
        self.detection_duration = 3.0  # 3 seconds
        self.is_detecting = False
        self.detection_complete = False
        
        # MediaPipe Pose for full arm and hand detection
        self.mp_pose = mp.solutions.pose
        self.pose = self.mp_pose.Pose(
            static_image_mode=False,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5,
            model_complexity=0
        )
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.7,
            min_tracking_confidence=0.5,
            model_complexity=0
        )
        self.mp_draw = mp.solutions.drawing_utils
    
    def preprocess_image(self, frame):
        """Preprocess image for EfficientNet model"""
        # Resize to 224x224 for EfficientNet
        image = cv2.resize(frame, (224, 224))
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        
        # Normalize to [0, 1] and convert to tensor
        image = image.astype(np.float32) / 255.0
        image = torch.tensor(image).permute(2, 0, 1).unsqueeze(0)  # (1, 3, 224, 224)
        
        return image
    
    def predict_frame(self, frame):
        """Process frame with 3-second timer system"""
        import time
        current_time = time.time()
        
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pose_results = self.pose.process(image)
        hand_results = self.hands.process(image)
        
        landmarks_data = {"pose": None, "hands": []}
        
        # Extract landmarks
        if pose_results.pose_landmarks:
            pose_data = []
            for lm in pose_results.pose_landmarks.landmark:
                pose_data.append([lm.x, lm.y, lm.z])
            landmarks_data["pose"] = pose_data
        
        if hand_results.multi_hand_landmarks:
            for hand_landmarks in hand_results.multi_hand_landmarks:
                hand_data = []
                for lm in hand_landmarks.landmark:
                    hand_data.append([lm.x, lm.y, lm.z])
                landmarks_data["hands"].append(hand_data)
        
        # Check if we have hand landmarks for prediction
        if not hand_results.multi_hand_landmarks:
            return None, 0.0, "no_prediction", landmarks_data
        
        # Timer logic
        if not self.is_detecting and hand_results.multi_hand_landmarks:
            # Start detection timer
            self.detection_start_time = current_time
            self.is_detecting = True
            self.detection_complete = False
            return None, 0.0, "detection_started", landmarks_data
        
        if self.is_detecting:
            elapsed_time = current_time - self.detection_start_time
            
            if elapsed_time >= self.detection_duration:
                # Detection period complete, return final result (no auto-reset)
                self.detection_complete = True
                final_result = self._get_final_prediction()
                return final_result[0], final_result[1], "detection_complete", landmarks_data
            
            # Continue detection within 3-second window
            remaining_time = self.detection_duration - elapsed_time
            
            # Process image with EfficientNet
            image_tensor = self.preprocess_image(frame).to(device)
            
            with torch.no_grad():
                outputs = model(image_tensor)
                probabilities = torch.softmax(outputs, dim=1)
                confidence, predicted = torch.max(probabilities, 1)
                
                pred_class = class_names[predicted.item()]
                conf_score = confidence.item()
                
                # Backend logging
                print(f"Backend Detection: {pred_class} (confidence: {conf_score:.3f})")
                
                # Add predictions with lower threshold for more diversity
                if conf_score > 0.5:
                    self.prediction_buffer.append((pred_class, conf_score))
                
                # Don't return predictions during detection window
                return None, 0.0, f"detecting_{remaining_time:.1f}s", landmarks_data
        
        return None, 0.0, "waiting", landmarks_data
    
    def _get_final_prediction(self):
        """Get the most confident prediction from the detection window"""
        if len(self.prediction_buffer) >= 5:
            recent_preds = [p[0] for p in list(self.prediction_buffer)[-10:]]
            recent_confs = [p[1] for p in list(self.prediction_buffer)[-10:]]
            
            # Filter out low confidence predictions (lowered threshold)
            high_conf_preds = [(p, c) for p, c in zip(recent_preds, recent_confs) if c > 0.6]
            
            if len(high_conf_preds) >= 3:
                pred_counts = Counter([p for p, c in high_conf_preds])
                final_pred = pred_counts.most_common(1)[0][0]
                avg_conf = np.mean([c for p, c in high_conf_preds if p == final_pred])
                
                # More lenient consistency check
                if pred_counts[final_pred] >= 2 and avg_conf > 0.65:
                    print(f"Backend Final Prediction: {final_pred} (avg confidence: {avg_conf:.3f})")
                    return final_pred, avg_conf
            
            # Fallback to highest confidence prediction
            if self.prediction_buffer:
                best_pred = max(self.prediction_buffer, key=lambda x: x[1])
                if best_pred[1] > 0.6:
                    print(f"Backend Fallback Prediction: {best_pred[0]} (confidence: {best_pred[1]:.3f})")
                    return best_pred[0], best_pred[1]
            
            print("Backend: No confident prediction found")
            return "uncertain", 0.0
        elif self.prediction_buffer:
            return self.prediction_buffer[-1]
        else:
            return "no_prediction", 0.0
    
    def get_hand_bbox(self, hand_landmarks, frame_shape):
        """Calculate bounding box for hand landmarks"""
        h, w = frame_shape[:2]
        x_coords = [lm.x * w for lm in hand_landmarks.landmark]
        y_coords = [lm.y * h for lm in hand_landmarks.landmark]
        
        x_min, x_max = int(min(x_coords)), int(max(x_coords))
        y_min, y_max = int(min(y_coords)), int(max(y_coords))
        
        # Add padding
        padding = 20
        x_min = max(0, x_min - padding)
        y_min = max(0, y_min - padding)
        x_max = min(w, x_max + padding)
        y_max = min(h, y_max + padding)
        
        return (x_min, y_min, x_max, y_max)
    
    def get_pose_bbox(self, pose_landmarks, frame_shape):
        """Calculate bounding box for upper body pose landmarks"""
        h, w = frame_shape[:2]
        
        # Focus on upper body landmarks (shoulders, arms)
        upper_body_indices = [11, 12, 13, 14, 15, 16]  # shoulders and arms
        
        x_coords = [pose_landmarks.landmark[i].x * w for i in upper_body_indices if pose_landmarks.landmark[i].visibility > 0.5]
        y_coords = [pose_landmarks.landmark[i].y * h for i in upper_body_indices if pose_landmarks.landmark[i].visibility > 0.5]
        
        if not x_coords or not y_coords:
            return None
        
        x_min, x_max = int(min(x_coords)), int(max(x_coords))
        y_min, y_max = int(min(y_coords)), int(max(y_coords))
        
        # Add padding
        padding = 30
        x_min = max(0, x_min - padding)
        y_min = max(0, y_min - padding)
        x_max = min(w, x_max + padding)
        y_max = min(h, y_max + padding)
        
        return (x_min, y_min, x_max, y_max)
    
    def draw_roi_boxes(self, frame, pose_results, hand_results, prediction=None, confidence=0.0):
        """Draw comprehensive ROI boxes for shoulders, arms, hands, and fingers"""
        annotated_frame = frame.copy()
        h, w = frame.shape[:2]
        
        # Draw pose landmarks and connections
        if pose_results.pose_landmarks:
            # Draw shoulder ROI
            shoulders = [11, 12]  # Left and right shoulder
            shoulder_points = []
            for idx in shoulders:
                lm = pose_results.pose_landmarks.landmark[idx]
                if lm.visibility > 0.5:
                    x, y = int(lm.x * w), int(lm.y * h)
                    shoulder_points.append((x, y))
                    cv2.circle(annotated_frame, (x, y), 8, (255, 0, 0), -1)
            
            if len(shoulder_points) == 2:
                cv2.rectangle(annotated_frame, 
                            (min(shoulder_points, key=lambda p: p[0])[0] - 30, 
                             min(shoulder_points, key=lambda p: p[1])[1] - 30),
                            (max(shoulder_points, key=lambda p: p[0])[0] + 30, 
                             max(shoulder_points, key=lambda p: p[1])[1] + 30),
                            (255, 0, 0), 2)
                cv2.putText(annotated_frame, "Shoulders", 
                           (shoulder_points[0][0] - 30, shoulder_points[0][1] - 40), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
            
            # Draw arm connections and ROIs
            arm_connections = [(11, 13), (13, 15), (12, 14), (14, 16)]  # Shoulder to elbow to wrist
            for start_idx, end_idx in arm_connections:
                start_lm = pose_results.pose_landmarks.landmark[start_idx]
                end_lm = pose_results.pose_landmarks.landmark[end_idx]
                if start_lm.visibility > 0.5 and end_lm.visibility > 0.5:
                    start_point = (int(start_lm.x * w), int(start_lm.y * h))
                    end_point = (int(end_lm.x * w), int(end_lm.y * h))
                    cv2.line(annotated_frame, start_point, end_point, (0, 255, 0), 3)
                    
                    # Draw joint circles
                    cv2.circle(annotated_frame, start_point, 6, (0, 255, 0), -1)
                    cv2.circle(annotated_frame, end_point, 6, (0, 255, 0), -1)
        
        # Draw detailed hand ROIs with finger tracking
        if hand_results.multi_hand_landmarks:
            for i, hand_landmarks in enumerate(hand_results.multi_hand_landmarks):
                # Different colors for left/right hands
                color = (0, 255, 255) if i == 0 else (255, 0, 255)
                
                # Draw finger connections
                finger_connections = [
                    [0, 1, 2, 3, 4],      # Thumb
                    [0, 5, 6, 7, 8],      # Index
                    [0, 9, 10, 11, 12],   # Middle
                    [0, 13, 14, 15, 16],  # Ring
                    [0, 17, 18, 19, 20]   # Pinky
                ]
                
                # Draw finger lines and joints
                for finger in finger_connections:
                    for j in range(len(finger) - 1):
                        start_lm = hand_landmarks.landmark[finger[j]]
                        end_lm = hand_landmarks.landmark[finger[j + 1]]
                        start_point = (int(start_lm.x * w), int(start_lm.y * h))
                        end_point = (int(end_lm.x * w), int(end_lm.y * h))
                        cv2.line(annotated_frame, start_point, end_point, color, 2)
                
                # Draw all landmark points
                for idx, lm in enumerate(hand_landmarks.landmark):
                    x, y = int(lm.x * w), int(lm.y * h)
                    # Different sizes for different landmark types
                    if idx == 0:  # Wrist
                        cv2.circle(annotated_frame, (x, y), 8, color, -1)
                    elif idx in [4, 8, 12, 16, 20]:  # Fingertips
                        cv2.circle(annotated_frame, (x, y), 6, (0, 0, 255), -1)
                    else:  # Other joints
                        cv2.circle(annotated_frame, (x, y), 4, color, -1)
                
                # Draw hand bounding box
                hand_bbox = self.get_hand_bbox(hand_landmarks, frame.shape)
                x_min, y_min, x_max, y_max = hand_bbox
                cv2.rectangle(annotated_frame, (x_min, y_min), (x_max, y_max), color, 2)
                
                hand_label = f"Hand {i+1}"
                cv2.putText(annotated_frame, hand_label, (x_min, y_min - 10), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, color, 2)
        
        # Draw prediction info
        if prediction and confidence > 0.4:
            text = f"Prediction: {prediction} ({confidence:.2f})"
            cv2.putText(annotated_frame, text, (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
        
        return annotated_frame
    
    def reset(self):
        """Reset buffers and timer for new session"""
        self.prediction_buffer.clear()
        self.detection_start_time = None
        self.is_detecting = False
        self.detection_complete = False

# Global predictor instance
predictor = RealTimePredictor()

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"status": "error", "message": "Invalid image file"}
        
        pred_class, confidence, status, landmarks = predictor.predict_frame(frame)
        
        # Always return consistent format with processing_status
        return {
            "status": "success",
            "predicted_class": pred_class if pred_class else "no_prediction",
            "confidence": confidence,
            "processing_status": status,
            "landmarks": landmarks
        }
            
    except Exception as e:
        print(f"Error: {e}")
        return {"status": "error", "message": str(e)}

@app.post("/reset_sequence")
async def reset_sequence():
    predictor.reset()
    return {"status": "success", "message": "Sequence reset"}

@app.post("/transcribe_with_roi")
async def transcribe_with_roi(file: UploadFile = File(...)):
    """Process frame and return annotated image with ROI boxes"""
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return {"status": "error", "message": "Invalid image file"}
        
        # Get prediction and landmarks
        pred_class, confidence, status, landmarks = predictor.predict_frame(frame)
        
        # Process frame for ROI visualization
        image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pose_results = predictor.pose.process(image)
        hand_results = predictor.hands.process(image)
        
        # Draw ROI boxes
        annotated_frame = predictor.draw_roi_boxes(frame, pose_results, hand_results, pred_class, confidence)
        
        # Encode annotated frame to base64
        _, buffer = cv2.imencode('.jpg', annotated_frame)
        annotated_image_b64 = base64.b64encode(buffer).decode('utf-8')
        
        response = {
            "status": "success",
            "predicted_class": pred_class if pred_class else "no_prediction",
            "confidence": confidence,
            "processing_status": status,
            "annotated_image": annotated_image_b64,
            "landmarks": landmarks
        }
        
        return response
            
    except Exception as e:
        print(f"Error: {e}")
        return {"status": "error", "message": str(e)}



@app.websocket("/ws/realtime")
async def websocket_realtime(websocket: WebSocket):
    """WebSocket endpoint for real-time video stream processing"""
    await websocket.accept()
    session_predictor = RealTimePredictor()
    
    try:
        while True:
            # Receive frame data
            data = await websocket.receive_text()
            frame_data = json.loads(data)
            
            # Decode base64 image
            image_data = base64.b64decode(frame_data['image'])
            nparr = np.frombuffer(image_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is not None:
                # Process frame with landmarks
                pred_class, confidence, status, landmarks = session_predictor.predict_frame(frame)
                
                # Process frame for ROI visualization
                image = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pose_results = session_predictor.pose.process(image)
                hand_results = session_predictor.hands.process(image)
                
                # Draw ROI boxes
                annotated_frame = session_predictor.draw_roi_boxes(frame, pose_results, hand_results, pred_class, confidence)
                
                # Encode annotated frame to base64
                _, buffer = cv2.imencode('.jpg', annotated_frame)
                annotated_image_b64 = base64.b64encode(buffer).decode('utf-8')
                
                # Send prediction, landmarks, and annotated frame back
                response = {
                    "status": status,
                    "predicted_class": pred_class if pred_class else "no_prediction",
                    "confidence": confidence,
                    "landmarks": landmarks,
                    "annotated_image": annotated_image_b64,
                    "timestamp": datetime.now().isoformat()
                }
                
                await websocket.send_text(json.dumps(response))
            
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        await websocket.close()



# ================================
# Run server (expose to network)
# ================================
if __name__ == "__main__":
    uvicorn.run(app, host="localhost", port=8000)