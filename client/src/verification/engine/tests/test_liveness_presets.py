from __future__ import annotations

import unittest
from unittest.mock import patch

from openbiometrics.liveness.presets import get_preset
from openbiometrics.liveness.session import ActiveLivenessManager


class LivenessPresetTests(unittest.TestCase):
    def test_verification_preset_creates_session_with_its_thresholds(self):
        preset = get_preset("verification")
        manager = ActiveLivenessManager()

        with patch("openbiometrics.liveness.session.FaceMeshDetector"):
            session = manager.create_session(**preset.session_kwargs())

        self.assertEqual(session._action_detector._t, preset.thresholds)
        self.assertEqual(
            {challenge.type for challenge in session.challenges},
            set(preset.challenge_types),
        )


if __name__ == "__main__":
    unittest.main()
