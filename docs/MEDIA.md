# Media

## `amabo-explainer.webm`

A ~38s, 1080p concept explainer for Amabo — the myth, the care loop, the two fates
(Amabo / Yim), the stage ladder (with the real polymorphic sprite growing Mote → Bloom),
the found-family split, the "while you were away" beat, and ascension into a star. Built
from Chromium-rendered storyboard frames, encoded VP8/WebM. **Silent.**

### Make an MP4 (with optional music) locally

The CI/build environment's bundled ffmpeg only encodes VP8/WebM and has no audio
encoder, so the committed file is a silent WebM. To get an MP4 (and add a soundtrack),
run a full ffmpeg locally:

```bash
# WebM → MP4 (H.264 + AAC), silent
ffmpeg -i docs/amabo-explainer.webm -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  amabo-explainer.mp4

# …with a music bed (any track), trimmed to the video and gently faded
ffmpeg -i docs/amabo-explainer.webm -i track.mp3 \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -shortest -af "afade=t=in:st=0:d=1.5,afade=t=out:st=33:d=2" \
  amabo-explainer.mp4
```
