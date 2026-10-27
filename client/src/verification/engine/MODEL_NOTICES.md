# Model notices

## MiniFASNet-V2 passive liveness model

The `antispoofing.onnx` model is downloaded at deployment time from
[garciafido/minifasnet-v2-anti-spoofing-onnx](https://huggingface.co/garciafido/minifasnet-v2-anti-spoofing-onnx),
pinned to revision `d29c87568ca9b5662da803b10f217c4db20b142b`. Its model card
identifies the weights as an ONNX conversion of
[minivision-ai/Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing)
and provides the upstream attribution and Apache-2.0 license. The converted
model SHA-256 is
`d7b3cd9ba8a7ceb13baa8c4720902e27ca3112eff52f926c08804af6b6eecc7b`.

The model expects an 80x80 BGR face crop normalized to `[0, 1]` and returns
three classes in this order: live, print attack, replay attack. The runtime
uses the live class probability as the passive liveness score.
