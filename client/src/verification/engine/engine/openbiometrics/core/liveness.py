"""Passive liveness detection (presentation attack detection).

Uses MiniFASNet-based models for silent anti-spoofing.
No user interaction required — works on a single image.

The bundled MiniFASNet-V2 model returns [live, print attack, replay attack].
"""

import cv2
import numpy as np

from openbiometrics.runtime.session import OnnxModelSession


class LivenessDetector:
    """Passive liveness detection from a single face image."""

    def __init__(self, model_path: str, ctx_id: int = 0):
        """
        Args:
            model_path: Path to anti-spoofing .onnx model
            ctx_id: GPU device ID (-1 for CPU)
        """
        self._model = OnnxModelSession(model_path, ctx_id=ctx_id)
        self.session = self._model.session
        self.input_name = self._model.input_name
        self.input_size = (self._model.input_shape[3], self._model.input_shape[2])  # (W, H)

    def check(self, image: np.ndarray, bbox: np.ndarray) -> tuple[bool, float]:
        """Check if a face is live (real) or a presentation attack (spoof).

        Args:
            image: Source image in BGR format.
            bbox: Face bounds [x1, y1, x2, y2] in source-image coordinates.

        Returns:
            (is_live, confidence) where confidence is in [0, 1]
        """
        face_crop = _expanded_face_crop(image, bbox)
        blob = self._preprocess(face_crop)
        output = self._model.run(blob)[0][0]

        # Model classes are ordered [live, print attack, replay attack].
        exp_output = np.exp(output - np.max(output))
        probs = exp_output / exp_output.sum()

        live_score = float(probs[0])
        is_live = live_score > 0.5

        return is_live, live_score

    def _preprocess(self, face_crop: np.ndarray) -> np.ndarray:
        """Prepare a BGR 80x80 crop in the model's [0, 1] input range."""
        img = cv2.resize(face_crop, self.input_size)
        img = img.astype(np.float32) / 255.0
        img = img.transpose(2, 0, 1)[np.newaxis, ...]
        return img.astype(np.float32)


def _expanded_face_crop(image: np.ndarray, bbox: np.ndarray, scale: float = 2.7) -> np.ndarray:
    """Build the square context crop used to train the MiniFASNet model."""
    x1, y1, x2, y2 = (float(value) for value in bbox)
    side = max(1, int(round(max(x2 - x1, y2 - y1) * scale)))
    center_x = (x1 + x2) / 2
    center_y = (y1 + y2) / 2
    left = int(np.floor(center_x - side / 2))
    top = int(np.floor(center_y - side / 2))
    right = left + side
    bottom = top + side

    height, width = image.shape[:2]
    pad_left = max(0, -left)
    pad_top = max(0, -top)
    pad_right = max(0, right - width)
    pad_bottom = max(0, bottom - height)
    if pad_left or pad_top or pad_right or pad_bottom:
        image = cv2.copyMakeBorder(
            image,
            pad_top,
            pad_bottom,
            pad_left,
            pad_right,
            cv2.BORDER_REPLICATE,
        )

    left += pad_left
    right += pad_left
    top += pad_top
    bottom += pad_top
    return image[top:bottom, left:right]
