#!/usr/bin/env bash
# Re-encode a source video to all-keyframe H.264 for smooth scroll scrubbing.
# Every frame becomes a keyframe (-g 1) so seeking during scroll is instant in
# both directions. Requires ffmpeg on PATH.
#
# Usage:
#   scripts/swap-bg-video.sh ../assets/videos/BRAND-scroll-background.mp4
#
set -euo pipefail

INPUT="${1:-../assets/videos/BRAND-scroll-background.mp4}"
OUTPUT="public/bg.mp4"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg not found on PATH. Install ffmpeg, then re-run this script." >&2
  exit 1
fi

mkdir -p public

ffmpeg -y -i "$INPUT" -an -c:v libx264 -preset slow -crf 18 \
  -g 1 -keyint_min 1 -sc_threshold 0 -pix_fmt yuv420p \
  -movflags +faststart "$OUTPUT"

echo "Encoded all-keyframe background video to $OUTPUT"
