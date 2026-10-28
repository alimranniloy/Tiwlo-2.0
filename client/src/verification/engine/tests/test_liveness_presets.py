from __future__ import annotations

import unittest
from unittest.mock import patch

from openbiometrics.liveness.presets import get_preset
from openbiometrics.liveness.session import ActiveLivenessManager


class LivenessPresetTests(unittest.TestCase):
    def test_verification_preset_creates_session_with_its_thresholds(self):
        preset = get_preset("verification")
        manager = ActiveLivenessManager()

        self.assertGreaterEqual(
            manager._session_ttl,
            preset.timeout_seconds * preset.num_challenges,
        )

        with patch("openbiometrics.liveness.session.FaceMeshDetector"):
            session = manager.create_session(**preset.session_kwargs())

        self.assertEqual(session._action_detector._t, preset.thresholds)
        self.assertEqual(
            {challenge.type for challenge in session.challenges},
            set(preset.challenge_types),
        )
        self.assertTrue(
            all(challenge.timeout_seconds == 90.0 for challenge in session.challenges)
        )
        self.assertEqual(preset.timeout_seconds, 90.0)
        self.assertEqual(preset.thresholds.open_mouth_mar, 0.48)


if __name__ == "__main__":
    unittest.main()
