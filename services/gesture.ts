
import { FilesetResolver, GestureRecognizer, GestureRecognizerResult } from '@mediapipe/tasks-vision';
import { GestureType } from "../types";

let gestureRecognizer: GestureRecognizer | null = null;
let runningMode: "IMAGE" | "VIDEO" = "VIDEO";

export const initializeHandDetection = async (): Promise<boolean> => {
  try {
    console.log("Initializing MediaPipe Hand Detection...");
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    );
    
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "CPU", 
      },
      runningMode: runningMode,
      numHands: 1,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3
    });
    console.log("MediaPipe Hand Detection Initialized Successfully");
    return true;
  } catch (error) {
    console.error("Failed to initialize hand detection:", error);
    return false;
  }
};

export const detectHands = (video: HTMLVideoElement): { x: number; gesture: GestureType } | null => {
  if (!gestureRecognizer) return null;
  if (!video.videoWidth || !video.videoHeight) return null;

  // Use Date.now() for a safe, increasing timestamp
  const startTimeMs = Date.now();
  let result: GestureRecognizerResult;
  
  try {
      result = gestureRecognizer.recognizeForVideo(video, startTimeMs);
  } catch(e) {
      console.error("Gesture recognition error:", e);
      return null;
  }

  if (result.gestures.length > 0) {
    const categoryName = result.gestures[0][0].categoryName;
    const score = result.gestures[0][0].score;
    const landmarks = result.landmarks[0];
    
    // Calculate rough center X (0 to 1)
    let x = 0;
    if (landmarks) {
        x = (landmarks[0].x + landmarks[9].x) / 2;
        x = 1 - x; // Mirror
    }

    let gesture: GestureType = 'None';
    
    // Map MediaPipe categories to our types
    if (categoryName === 'Open_Palm') gesture = 'Open_Palm';
    else if (categoryName === 'Victory') gesture = 'Victory';
    else if (categoryName === 'Closed_Fist') gesture = 'Closed_Fist';
    else if (categoryName === 'None') gesture = 'None';
    
    // Optional: Log for debugging if needed
    // console.log(`Detected: ${categoryName} (${score.toFixed(2)})`);

    return { x, gesture };
  }

  return null;
};
