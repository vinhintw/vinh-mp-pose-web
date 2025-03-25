// Enhanced script with more robust error handling and library loading

const videoElement = document.getElementById("video");
videoElement.muted = true;
videoElement.playsInline = true;
const canvasElement = document.getElementById("canvas");
const canvasCtx = canvasElement.getContext("2d");

// Log initialization started
console.log("MediaPipe BlazePose initialization started");

// Use the global config object defined in index.html
const globalConfig = window.globalConfig;

// Function to check if libraries are loaded and load them if not
async function ensureLibraryLoaded(libraryName, globalObj, url) {
  return new Promise((resolve, reject) => {
    if (window[globalObj]) {
      console.log(`${libraryName} already loaded`);
      resolve(true);
      return;
    }

    console.log(`Loading ${libraryName} from ${url}`);
    const script = document.createElement("script");
    script.src = url;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      console.log(`${libraryName} loaded successfully`);
      resolve(true);
    };
    script.onerror = (err) => {
      console.error(`Failed to load ${libraryName}:`, err);
      reject(err);
    };
    document.body.appendChild(script);
  });
}

// Load all required libraries
async function loadRequiredLibraries() {
  try {
    await ensureLibraryLoaded(
      "Camera Utils",
      "Camera",
      "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3/camera_utils.js"
    );

    await ensureLibraryLoaded(
      "Drawing Utils",
      "drawConnectors",
      "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils@0.3/drawing_utils.js"
    );

    await ensureLibraryLoaded(
      "Pose",
      "Pose",
      "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5/pose.js"
    );

    return true;
  } catch (error) {
    console.error("Failed to load libraries:", error);
    return false;
  }
}

// Add polyfill and permission handling for getUserMedia
if (navigator.mediaDevices === undefined) {
  navigator.mediaDevices = {};
  console.log("Polyfilling mediaDevices object");
}

// Some browsers partially implement mediaDevices. We can't just assign an object
// with getUserMedia as it would overwrite existing properties.
if (navigator.mediaDevices.getUserMedia === undefined) {
  const oldGetUserMedia =
    navigator.webkitGetUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.msGetUserMedia;

  if (oldGetUserMedia) {
    console.log("Using legacy getUserMedia");
    navigator.mediaDevices.getUserMedia = function (constraints) {
      return new Promise(function (resolve, reject) {
        oldGetUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  } else {
    console.error("No getUserMedia implementation available");
  }
}

// Update canvas dimensions based on config
if (globalConfig.isFullScreen) {
  canvasElement.style.width = "100vw";
  canvasElement.style.height = "100vh";
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
}

function onWindowResized() {
  if (globalConfig.isFullScreen) {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
  }
}

window.addEventListener("resize", onWindowResized);

// Define draw connections for pose skeleton
const POSE_CONNECTIONS = [
  [8, 5],
  [5, 0],
  [0, 2],
  [2, 7],
  [10, 9],
  [20, 18],
  [20, 16],
  [18, 16],
  [16, 22],
  [16, 14],
  [14, 12],
  [12, 11],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [19, 17],
  [12, 24],
  [11, 23],
  [24, 23],
  [24, 26],
  [23, 25],
  [26, 28],
  [25, 27],
  [28, 32],
  [28, 30],
  [32, 30],
  [27, 31],
  [27, 29],
  [29, 31],
];

// Add this mapping after POSE_CONNECTIONS definition
const POSE_LANDMARK_IDS = {
  0: 0, // nose
  1: 1, // left_eye_inner
  2: 2, // left_eye
  3: 3, // left_eye_outer
  4: 4, // right_eye_inner
  5: 5, // right_eye
  6: 6, // right_eye_outer
  7: 7, // left_ear
  8: 8, // right_ear
  9: 9, // mouth_left
  10: 10, // mouth_right
  11: 11, // left_shoulder
  12: 12, // right_shoulder
  13: 13, // left_elbow
  14: 14, // right_elbow
  15: 15, // left_wrist
  16: 16, // right_wrist
  17: 17, // left_pinky
  18: 18, // right_pinky
  19: 19, // left_index
  20: 20, // right_index
  21: 21, // left_thumb
  22: 22, // right_thumb
  23: 23, // left_hip
  24: 24, // right_hip
  25: 25, // left_knee
  26: 26, // right_knee
  27: 27, // left_ankle
  28: 28, // right_ankle
  29: 29, // left_heel
  30: 30, // right_heel
  31: 31, // left_foot_index
  32: 32, // right_foot_index
};

// Then modify your drawing code to use this mapping
// Replace landmarkId = index with:
function onResults(results) {
  // Log results occasionally for debugging
  if (Math.random() < 0.01) {
    console.log("Pose detection active with config:", globalConfig);
    console.log(
      "Custom sizes:",
      Object.keys(globalConfig.customLandmarkSizes).length,
      "landmarks configured"
    );
    console.log(
      "Custom colors:",
      Object.keys(globalConfig.customLandmarkColors).length,
      "landmarks colored"
    );
  }

  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // Apply horizontal flip if needed
  if (!globalConfig.isBackCamera && globalConfig.flipHorizontal) {
    canvasCtx.translate(canvasElement.width, 0);
    canvasCtx.scale(-1, 1);
  }

  // Draw camera feed
  canvasCtx.drawImage(
    results.image,
    0,
    0,
    canvasElement.width,
    canvasElement.height
  );

  if (results.poseLandmarks) {
    // Make sure we have the drawConnectors and drawLandmarks functions available
    if (
      typeof drawConnectors === "function" &&
      typeof drawLandmarks === "function"
    ) {
      // Draw skeleton if enabled
      if (globalConfig.enableSkeleton) {
        // Parse color string for RGB values
        let colorStr = globalConfig.color;
        let color;

        if (typeof colorStr === "string" && colorStr.includes(",")) {
          // If it's an RGB string like "255, 0, 0"
          const [r, g, b] = colorStr.split(",").map((c) => parseInt(c.trim()));
          color = `rgb(${r}, ${g}, ${b})`;
        } else {
          // Default color
          color = colorStr;
        }

        drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS, {
          color: color,
          lineWidth: 4, // Make lines thicker for better visibility
        });
      }

      // Draw keypoints if enabled
      if (globalConfig.enableKeyPoints) {
        // Default size from config
        const defaultSize = globalConfig.defaultLandmarkSize || 1;

        // For debugging
        console.log("Drawing landmarks with config:", {
          defaultSize,
          customSizes: globalConfig.customLandmarkSizes,
          customColors: globalConfig.customLandmarkColors,
        });

        // Draw each landmark separately to apply custom styles
        results.poseLandmarks.forEach((landmark, index) => {
          // Skip if visibility is below threshold
          if (landmark.visibility < globalConfig.scoreThreshold) {
            return;
          }

          // Here is where you need to get the landmarkId
          const landmarkId =
            POSE_LANDMARK_IDS[index] !== undefined
              ? POSE_LANDMARK_IDS[index]
              : index;

          // Get size for this landmark (use custom size or default)
          const size =
            globalConfig.customLandmarkSizes[landmarkId] || defaultSize;

          // Get color for this landmark
          let color =
            globalConfig.customLandmarkColors[landmarkId] || globalConfig.color;

          // Draw the landmark
          drawLandmarks(canvasCtx, [landmark], {
            color: color,
            fillColor: color,
            radius: size,
          });
        });
      }
    } else {
      console.error(
        "Drawing functions not available. Check MediaPipe imports."
      );
    }

    // Send pose data to React Native
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          pose: JSON.stringify(results.poseLandmarks),
        })
      );
    }
  }

  canvasCtx.restore();
}

// Initialize everything asynchronously
async function initializePose() {
  // First ensure all libraries are loaded
  const librariesLoaded = await loadRequiredLibraries();

  if (!librariesLoaded) {
    console.error(
      "Failed to load required libraries. Pose detection won't work."
    );
    return;
  }

  // Ensure config is up to date
  if (window.POSE_CONFIG && typeof window.updateConfig === "function") {
    window.updateConfig();
  }

  // Create the Pose object with proper error handling
  let pose;
  try {
    pose = new Pose({
      locateFile: (file) => {
        console.log(`Loading MediaPipe file: ${file}`);
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      },
    });

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    pose.onResults(onResults);

    console.log("MediaPipe Pose object created successfully");
  } catch (error) {
    console.error("Error creating MediaPipe Pose object:", error);
    return;
  }

  // Create camera with error handling
  try {
    // Make sure Camera class is available
    if (typeof Camera !== "function") {
      console.error("Camera class not available. Check MediaPipe imports.");
      return;
    }

    const camera = new Camera(videoElement, {
      onFrame: async () => {
        if (pose) {
          await pose.send({ image: videoElement });
        }
      },
      width: 1080,
      height: 720,
      facingMode: globalConfig.isBackCamera ? "environment" : "user",
    });

    console.log(
      "Starting camera with facing mode:",
      globalConfig.isBackCamera ? "environment" : "user"
    );

    camera
      .start()
      .then(() => {
        console.log("Camera started successfully");
        videoElement
          .play()
          .then(() => console.log("Video playback started"))
          .catch((err) => console.error("Video play failed:", err));
      })
      .catch((error) => {
        console.error("Error starting camera:", error);
        // Try to show permission button
        document.getElementById("permission-button").style.display = "block";
      });
  } catch (error) {
    console.error("Error setting up camera:", error);
    // Try to show permission button
    document.getElementById("permission-button").style.display = "block";
  }
}

// Start everything
initializePose();

// Add a debug function to manually test custom landmarks
window.testCustomConfig = function () {
  console.log("Testing custom configuration...");
  globalConfig.customLandmarkSizes = {
    11: 15, // Shoulder
    13: 20, // Elbow
    15: 25, // Wrist
  };

  globalConfig.customLandmarkColors = {
    11: "rgb(255, 0, 0)", // Red
    13: "rgb(0, 255, 0)", // Green
    15: "rgb(0, 0, 255)", // Blue
  };

  console.log("Test configuration applied:", globalConfig);
  return globalConfig;
};
