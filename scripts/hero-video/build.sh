#!/usr/bin/env bash
# Rebuilds the home page background video (3s, 30fps, loops with no jump).
# Needs ffmpeg, python3, Pillow. Run from anywhere: scripts/hero-video/build.sh
# Writes site/public/media/hero-chart-loop.mp4, hero-chart-loop.webm (fallback for browsers without H.264) and hero-chart-poster.jpg.
set -euo pipefail
cd "$(dirname "$0")"
OUT=../../site/public/media
P=2552   # PERIOD in make_strip.py (58 candles x 44px)
mkdir -p "$OUT"
python3 -I make_strip.py
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "color=c=0x0b1220:s=1280x720:r=30:d=3" \
  -loop 1 -framerate 30 -t 3 -i strip.png \
  -filter_complex "
    [0][1]overlay=x='-mod(t,3)/3*${P}':y=0:format=auto,format=rgb24,split[a][b];
    [b]gblur=sigma=9[glow];
    [a][glow]blend=all_mode=screen:all_opacity=0.55,
    lutrgb=r='val*0.7':g='val*0.7':b='val*0.7',
    vignette=angle=PI/4.5,scale=out_color_matrix=bt709:out_range=tv:flags=accurate_rnd+full_chroma_int,format=yuv420p[v]" \
  -map "[v]" -frames:v 90 -an \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -c:v libx264 -crf 26 -preset slow -movflags +faststart "$OUT/hero-chart-loop.mp4"
ffmpeg -y -hide_banner -loglevel error -i "$OUT/hero-chart-loop.mp4" -an -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 "$OUT/hero-chart-loop.webm"
ffmpeg -y -hide_banner -loglevel error -i "$OUT/hero-chart-loop.mp4" -frames:v 1 -q:v 3 "$OUT/hero-chart-poster.jpg"
rm -f strip.png
ls -l "$OUT"
