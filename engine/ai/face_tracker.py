import os
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger("AutoEdit.FaceTracker")

class Smart916Reframe:
    """
    Intelligent 9:16 vertical re-framer with smooth face and speaker tracking.
    Converts 16:9 landscape (1920x1080) or other aspect ratios into
    flawlessly centered 9:16 portrait (1080x1920) with cinematic camera damping.
    """
    def __init__(self, target_width: int = 1080, target_height: int = 1920, damping: float = 0.15):
        self.target_width = target_width
        self.target_height = target_height
        self.damping = damping

    def compute_crop_keyframes(self, video_path: str, sample_fps: int = 2) -> List[Dict[str, Any]]:
        """
        Samples video frames, computes speaker horizontal center (X-coordinate),
        and applies exponential moving average smoothing to prevent camera wobble.
        """
        if not os.path.exists(video_path):
            # Return center crop keyframe as fallback
            return [{"timestamp": 0.0, "crop_x": 420, "crop_y": 0, "crop_w": 1080, "crop_h": 1920}]

        try:
            import cv2
            import numpy as np

            cap = cv2.VideoCapture(video_path)
            if not cap.isOpened():
                return [{"timestamp": 0.0, "crop_x": 420, "crop_y": 0, "crop_w": 1080, "crop_h": 1920}]

            orig_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1920
            orig_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 1080
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 300

            # Calculate 9:16 crop box dimensions based on input resolution
            # If 16:9 (1920x1080), 9:16 crop width is (1080 * 9 / 16) = 607px
            crop_w = int(orig_h * 9.0 / 16.0)
            crop_h = orig_h

            face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

            step_frames = max(1, int(fps / sample_fps))
            current_smoothed_center_x = orig_w / 2.0
            keyframes = []

            for frame_idx in range(0, total_frames, step_frames):
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret:
                    break

                t = frame_idx / fps
                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.2, minNeighbors=4, minSize=(60, 60))

                target_center_x = orig_w / 2.0
                if len(faces) > 0:
                    # Pick the largest face in the frame
                    largest_face = max(faces, key=lambda f: f[2] * f[3])
                    x, y, w, h = largest_face
                    target_center_x = x + (w / 2.0)

                # Smooth transition with damping
                current_smoothed_center_x += (target_center_x - current_smoothed_center_x) * self.damping

                # Keep crop box within bounds
                left_x = int(current_smoothed_center_x - (crop_w / 2.0))
                left_x = max(0, min(left_x, orig_w - crop_w))

                keyframes.append({
                    "timestamp": round(t, 2),
                    "crop_x": left_x,
                    "crop_y": 0,
                    "crop_w": crop_w,
                    "crop_h": crop_h
                })

            cap.release()
            return keyframes if keyframes else [{"timestamp": 0.0, "crop_x": int((orig_w - crop_w) / 2), "crop_y": 0, "crop_w": crop_w, "crop_h": crop_h}]

        except Exception as e:
            logger.error(f"Face tracking error: {e}")
            return [{"timestamp": 0.0, "crop_x": 420, "crop_y": 0, "crop_w": 1080, "crop_h": 1920}]
