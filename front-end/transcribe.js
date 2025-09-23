let videoElement = null;
let timerInterval = null;
let isTranscribing = false;
let captureInterval = null;
let isProcessing = false; // Prevent frame processing backlog
let countdownInterval = null;
let isCountingDown = false;
let detectionComplete = false;

// Audio mapping for sign language classes - exact backend class names
const audioMap = {
    nepali: {
        'धन्यबाद': '../audio/dhanyabad.m4a',
        'घर': '../audio/ghar.m4a',
        'म': '../audio/ma.m4a',
        'नमस्कार': '../audio/namaskar.m4a'
    },
    english: {
        'धन्यबाद': '../audio/Thank you.m4a',
        'घर': '../audio/Home.m4a',
        'म': '../audio/Me.m4a',
        'नमस्कार': '../audio/Namaste.m4a'
    }
};

// Audio element for playback
let audioElement = null;

// Translation mapping
const translations = {
    'नमस्कार': 'Namaste',
    'घर': 'Home',
    'म': 'Me',
    'धन्यबाद': 'Thank you'
};

// Current language state
let currentLanguage = 'nepali';

document.addEventListener('DOMContentLoaded', function() {
    console.log('Transcribe page loaded');
    
    // Test output panel accessibility
    const outputPanel = document.querySelector('.output-placeholder p');
    if (outputPanel) {
        console.log('✅ Output panel found and accessible');
        outputPanel.textContent = 'Ready to translate sign language';
    } else {
        console.error('❌ Output panel not found!');
    }
    
    setupCameraButton();
    setupDemoImages();
    preloadAudioFiles();
    setupLanguageToggle();
});

function setupLanguageToggle() {
    const nepaliBtn = document.getElementById('nepaliBtn');
    const englishBtn = document.getElementById('englishBtn');
    
    if (nepaliBtn && englishBtn) {
        nepaliBtn.addEventListener('click', function() {
            currentLanguage = 'nepali';
            nepaliBtn.classList.add('active');
            englishBtn.classList.remove('active');
        });
        
        englishBtn.addEventListener('click', function() {
            currentLanguage = 'english';
            englishBtn.classList.add('active');
            nepaliBtn.classList.remove('active');
        });
    }
}

function preloadAudioFiles() {
    console.log('Preloading audio files...');
    Object.entries(audioMap).forEach(([className, audioPath]) => {
        const audio = new Audio(audioPath);
        audio.preload = 'auto';
        audio.addEventListener('canplaythrough', () => {
            console.log(`Audio preloaded: ${className}`);
        });
        audio.addEventListener('error', (e) => {
            console.error(`Failed to preload audio for ${className}:`, e);
        });
        audio.load();
    });
}

function setupDemoImages() {
    const signs = [
        { image: '../demo/dhanyabad.png', name: 'धन्यबाद' },
        { image: '../demo/ghar.png', name: 'घर' },
        { image: '../demo/ma.png', name: 'म' },
        { image: '../demo/namaskar.png', name: 'नमस्कार' }
    ];
    let currentIndex = 0;
    
    const demoImage = document.getElementById('demoImage');
    const signName = document.getElementById('signName');
    const nextBtn = document.getElementById('nextBtn');
    const prevBtn = document.getElementById('prevBtn');
    
    if (nextBtn && demoImage && signName) {
        nextBtn.addEventListener('click', function() {
            currentIndex = (currentIndex + 1) % signs.length;
            demoImage.src = signs[currentIndex].image;
            signName.textContent = signs[currentIndex].name;
        });
    }
    
    if (prevBtn && demoImage && signName) {
        prevBtn.addEventListener('click', function() {
            currentIndex = (currentIndex - 1 + signs.length) % signs.length;
            demoImage.src = signs[currentIndex].image;
            signName.textContent = signs[currentIndex].name;
        });
    }
}

function setupCameraButton() {
    const cameraBtn = document.querySelector('.camera-btn');
    if (cameraBtn) {
        console.log('Camera button found');
        cameraBtn.addEventListener('click', handleCameraClick);
    } else {
        console.log('Camera button not found');
    }
}

function handleCameraClick(e) {
    e.preventDefault();
    console.log('Camera button clicked, isTranscribing:', isTranscribing);
    
    if (!isTranscribing && !isCountingDown) {
        startCountdownFlow();
    } else {
        stopCamera();
    }
}

function startCountdownFlow() {
    const cameraBtn = document.querySelector('.camera-btn');
    if (!cameraBtn) return;
    
    isCountingDown = true;
    detectionComplete = false;
    let countdown = 3;
    
    // Update button to show countdown
    cameraBtn.textContent = `Get Ready... ${countdown}`;
    cameraBtn.disabled = true;
    
    countdownInterval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            cameraBtn.textContent = `Get Ready... ${countdown}`;
        } else {
            clearInterval(countdownInterval);
            cameraBtn.textContent = 'Detecting...';
            startCamera();
        }
    }, 1000);
}

async function startCamera() {
    console.log('Starting camera...');
    const cameraBtn = document.querySelector('.camera-btn');
    const translationArea = document.querySelector('.translation-area');
    
    try {
        // Reset sequence on backend
        await fetch('http://localhost:8000/reset_sequence', { method: 'POST' });
        
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera API not supported in this browser');
        }
        
        // Try different video constraints
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: { 
                    width: { ideal: 640 }, 
                    height: { ideal: 480 },
                    facingMode: 'user'
                } 
            });
        } catch (e) {
            stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
        
        // Create video element
        videoElement = document.createElement('video');
        videoElement.autoplay = true;
        videoElement.playsinline = true;
        videoElement.srcObject = stream;
        videoElement.style.width = '100%';
        videoElement.style.height = 'auto';
        
        // Create canvas for hand tracking overlay
        const canvas = document.createElement('canvas');
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '10';
        
        // Create container
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.appendChild(videoElement);
        container.appendChild(canvas);
        
        // Replace content
        translationArea.innerHTML = '';
        translationArea.appendChild(container);
        
        // Setup canvas after video loads
        videoElement.addEventListener('loadedmetadata', () => {
            canvas.width = videoElement.videoWidth;
            canvas.height = videoElement.videoHeight;
            canvas.style.width = videoElement.offsetWidth + 'px';
            canvas.style.height = videoElement.offsetHeight + 'px';
        });
        
        // Update state
        isTranscribing = true;
        isCountingDown = false;
        cameraBtn.textContent = 'Stop Translating';
        cameraBtn.disabled = false;
        
        // Start timer
        let startTime = Date.now();
        timerInterval = setInterval(() => {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const hours = Math.floor(elapsed / 3600);
            const minutes = Math.floor((elapsed % 3600) / 60);
            const seconds = elapsed % 60;
            const timerElement = document.getElementById('timer');
            if (timerElement) {
                timerElement.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            }
        }, 1000);
        
        // Start capturing frames for transcription
        captureInterval = setInterval(() => {
            captureFrame();
        }, 500);
        
        console.log('Camera started successfully');
        
    } catch (error) {
        console.error('Error accessing camera:', error);
        resetToInitialState();
        alert('Could not access camera. Please check permissions and try again.');
    }
}

function stopCamera() {
    console.log('Stopping camera...');
    
    // Stop video stream
    if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach(track => track.stop());
    }
    
    // Clear all intervals
    if (timerInterval) clearInterval(timerInterval);
    if (captureInterval) clearInterval(captureInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    
    resetToInitialState();
    console.log('Camera stopped');
}

function resetToInitialState() {
    // Reset backend state
    fetch('http://localhost:8000/reset_sequence', { method: 'POST' }).catch(console.error);
    
    // Reset state
    isTranscribing = false;
    isCountingDown = false;
    detectionComplete = false;
    videoElement = null;
    
    // Reset UI
    const cameraBtn = document.querySelector('.camera-btn');
    const translationArea = document.querySelector('.translation-area');
    const outputPanel = document.querySelector('.output-placeholder p');
    
    if (cameraBtn) {
        cameraBtn.textContent = 'Start Translating';
        cameraBtn.disabled = false;
    }
    
    if (outputPanel) {
        outputPanel.textContent = detectionComplete ? 'Detection completed! Click to start again' : 'Translation will appear here';
    }
    
    if (translationArea) {
        translationArea.innerHTML = `
            <div class="camera-placeholder">
                <video id="cameraFeed" autoplay playsinline></video>
                <p>Camera feed will appear here</p>
                <div class="camera-controls">
                    <button type="button" class="camera-btn">Start Translating</button>
                </div>
            </div>
        `;
        setupCameraButton();
    }
}



function captureFrame() {
    if (!videoElement || !isTranscribing || isProcessing || detectionComplete) return;
    
    isProcessing = true;
    
    const canvas = document.createElement('canvas');
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoElement, 0, 0);
    
    canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const formData = new FormData();
        formData.append('file', blob, 'frame.jpg');
        
        try {
            const response = await fetch('http://localhost:8000/transcribe', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('=== BACKEND RESPONSE ===');
                console.log('Full result:', JSON.stringify(result, null, 2));
                
                if (result.status === 'success') {
                    console.log('SUCCESS - Class:', result.predicted_class, 'Confidence:', result.confidence, 'Status:', result.processing_status);
                    
                    // Always update the display with current status
                    updateTranslationOutput(result.predicted_class, result.processing_status, result.landmarks);
                    
                    // Check if detection is complete and play audio
                    if (result.processing_status === 'detection_complete' && result.predicted_class && 
                        result.predicted_class !== 'no_prediction' && result.predicted_class !== 'uncertain') {
                        console.log('DETECTION COMPLETE! Playing audio for:', result.predicted_class);
                        playAudioForClass(result.predicted_class);
                        detectionComplete = true;
                        
                        // Stop camera and require manual restart
                        setTimeout(() => {
                            stopCamera();
                        }, 2000);
                    }
                } else if (result.status === 'error') {
                    console.error('Backend error:', result.message);
                    updateTranslationOutput('backend_error', 'error', null);
                } else {
                    console.warn('Unknown response status:', result.status);
                    updateTranslationOutput('unknown_response', 'error', null);
                }
            } else {
                console.error('HTTP error:', response.status, response.statusText);
                updateTranslationOutput('http_error', 'error', null);
            }
        } catch (error) {
            console.error('Transcription error:', error);
        } finally {
            isProcessing = false;
        }
    }, 'image/jpeg', 0.8);
}





function drawHandTracking(landmarks) {
    // Remove all green line drawing - keep function for compatibility but don't draw anything
    return;
}

function playAudioForClass(className) {
    console.log('Playing audio for class:', className, 'in language:', currentLanguage);
    const audioPath = audioMap[currentLanguage][className];
    
    if (audioPath) {
        console.log('Audio path:', audioPath);
        
        // Stop any currently playing audio
        if (audioElement) {
            audioElement.pause();
            audioElement.currentTime = 0;
        }
        
        // Create new audio element
        audioElement = new Audio(audioPath);
        audioElement.volume = 0.8;
        
        // Add event listeners for debugging
        audioElement.addEventListener('loadstart', () => console.log('Audio loading started'));
        audioElement.addEventListener('canplay', () => console.log('Audio can play'));
        audioElement.addEventListener('play', () => console.log('Audio started playing'));
        audioElement.addEventListener('ended', () => console.log('Audio finished playing'));
        audioElement.addEventListener('error', (e) => console.error('Audio error:', e));
        
        // Play audio
        audioElement.play().then(() => {
            console.log('Audio playback started successfully');
        }).catch(error => {
            console.error('Audio playback failed:', error);
            // Try alternative approach
            setTimeout(() => {
                audioElement.play().catch(e => console.error('Retry failed:', e));
            }, 100);
        });
    } else {
        console.error('No audio path found for class:', className, 'in language:', currentLanguage);
    }
}

function updateTranslationOutput(predictedClass, processingStatus, landmarks) {
    console.log('Updating display:', { predictedClass, processingStatus });
    
    let outputPanel = document.querySelector('.output-placeholder p');
    if (!outputPanel) {
        outputPanel = document.querySelector('.output-placeholder');
        if (outputPanel && !outputPanel.querySelector('p')) {
            const p = document.createElement('p');
            outputPanel.appendChild(p);
            outputPanel = p;
        }
    }
    
    if (outputPanel) {
        let displayText = '';
        
        if (processingStatus === 'detection_complete') {
            if (predictedClass && predictedClass !== 'no_prediction' && predictedClass !== 'uncertain') {
                const displayWord = currentLanguage === 'english' ? translations[predictedClass] || predictedClass : predictedClass;
                displayText = `✅ Detected: <strong>${displayWord}</strong> <span class="audio-icon">🔊</span>`;
            } else {
                displayText = '❓ No clear sign detected';
            }
        } else if (predictedClass === 'no_prediction' || !predictedClass) {
            displayText = '🖐 Show your hands to camera';
        } else if (predictedClass === 'backend_error') {
            displayText = '❌ Backend error occurred';
        }
        
        outputPanel.innerHTML = displayText;
        console.log('Display updated to:', displayText);
    } else {
        console.error('Output panel not found!');
    }
    
    if (landmarks) {
        drawHandTracking(landmarks);
    }
}