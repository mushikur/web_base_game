# Bengali voice quality review — 2026-11-03

## Current decision

Research only: no alternative model was installed or downloaded and no paid API was used. The user's subsequent dry-clip A/B response, relayed by the root agent, says `voice-spawn-0.wav` is clear. Keep the existing bank while fixing the observed in-game audition/overlapping-speech problems. That response approves intelligibility of that dry sample; it does not establish every voice, in-world mix or Dhaka dialect as accepted.

## Existing Piper bank

The official [Piper model card](https://huggingface.co/rhasspy/piper-voices/blob/main/bn/bn_BD/google/medium/MODEL_CARD) explicitly lists both Bangladesh and Indian Bengali, 16 speakers and 22,050 Hz output. The [published speaker map](https://github.com/OHF-Voice/wyoming-piper/blob/main/wyoming_piper/voices.json) maps the currently authored IDs 0/4/8/11 to source IDs 00737/00779/3108/4046. It does not document a regional accent for each ID. Do not infer a Bangladeshi accent from the `bn_BD` filename alone.

[OpenSLR 37](https://www.openslr.org/37/) distinguishes Bangladesh and Indian source archives and licenses the corpus under CC BY-SA 4.0. Existing project speech attribution and retained CMU/model-card notices remain necessary. Selecting another speaker or changing synthesis speed is an audition candidate, not proof of improved naturalness.

## Alternative paths considered

| Candidate | Evidence and practical limit | Decision |
| --- | --- | --- |
| [AI4Bharat IndicF5](https://huggingface.co/ai4bharat/IndicF5) | Bengali support; approximately 0.4B parameters and 1.4 GB weights. MIT; the [maintainer confirms commercial use](https://huggingface.co/ai4bharat/IndicF5/discussions/34). Requires prompt audio/transcript and explicit permission for the reference voice. Files are access-gated. Bangladesh accent is not promised. | Possible offline authoring trial only after authorized reference/access and listening evaluation; not a drop-in verified fix. |
| [Bodhan Indic-Speak](https://huggingface.co/bodhan-ai/indic-speak) | Two Bengali stock voices, Ishita/Sourav; contracted consenting artists. 3.78B BF16 parameters, about 7.56 GB for LM weights alone, plus decoder/runtime memory. Files gated. Custom [Indic Open Model License](https://github.com/Bodhan-AI/bodhan-model-info/blob/main/licenses/indic-open-model-license/v1/Indic_Open_Model_License.md) includes attribution, upstream-component and hosting conditions. No Bangladesh accent guarantee. | Larger offline trial candidate, subject to terms/access and actual audition; no installation. |
| [EMTIAZZ Bangladesh VITS](https://huggingface.co/EMTIAZZ/bangladeshi-bangla-tts-vits) | Author labels it Apache 2.0; approximately 998 MB, single female voice, CPU inference example. The custom dataset and underlying voice permissions are not documented clearly enough in the reviewed model card to establish the complete production provenance. | Do not promise a rights-cleared or higher-quality replacement from its metadata alone. |

## Exclusions and distribution risks

- [ehzawad/indicf5-bangla-tts](https://huggingface.co/ehzawad/indicf5-bangla-tts/blob/main/README.md) now restricts current weights to noncommercial research; its card says production use requires written permission. The stated license changed on 15 October 2026. Old MIT descriptions are not sufficient for newly obtained current weights.
- [BanglaBox](https://huggingface.co/Banglabox/chatterbox-bangla-tts) has MIT model metadata and about 3.49 GB of repository files, but its [paper, Appendix C.2](https://arxiv.org/html/2610.09211v1), states Tier A voice consent includes no commercial use. That conflicts with the broad release labels. Do not ship its bundled voice references as clearly authorized production voices without clarification.
- Azure officially lists Bangladesh Bengali neural voices ([voice table](https://learn.microsoft.com/en-sg/azure/ai-services/speech-service/language-support?tabs=tts)). However, current [Microsoft Product Terms](https://www.microsoft.com/licensing/terms/product/MicrosoftAzure/all) grant TTS output use rights to paid-tier customers. Free/demo/Edge access is not a confirmed free-distribution route. No Azure service was invoked.

No model card, automated recognition score or waveform measurement proves natural speech for this game. Use short dry and in-world A/B auditions after fixing playback, retain source/license evidence, and record the listener's result separately from signal/runtime checks.
