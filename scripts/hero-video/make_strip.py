"""Draws one seamless chart strip (2 periods wide) matching the home page demo chart.
Same seeded candle maths as site/src/js/demo.js. Change SEED to get a different chart that still loops."""
from PIL import Image, ImageDraw

SEED, COUNT = 11, 58
W, H, STEP = 1280, 720, 44          # frame size, candle spacing (px)
PERIOD = COUNT * STEP               # one full loop of scrolling
SS = 2                              # supersample for smooth edges
TOP, BOTTOM, VOL_TOP, VOL_H = 90, 520, 570, 110
GREEN, RED, BLUE, GRID = (34, 197, 94), (239, 68, 68), (56, 189, 248), (30, 41, 59)

# --- same generator as demo.js (LCG seed*16807 % 2147483647) ---
seed, price, candles = SEED, 100.0, []
def rand():
    global seed
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
for _ in range(COUNT):
    o = price
    c = o + (rand() - 0.4) * 5.2
    hi = max(o, c) + rand() * 2.6
    lo = min(o, c) - rand() * 2.6
    candles.append([o, c, hi, lo, 0.25 + rand() * 0.75])
    price = c

# --- make the price path close on itself so the loop has no jump ---
drift = candles[-1][1] - candles[0][0]
for i, k in enumerate(candles):
    shift = drift * i / COUNT
    nxt = drift * (i + 1) / COUNT
    k[0] -= shift; k[1] -= nxt; k[2] -= shift; k[3] -= shift
lo_p = min(k[3] for k in candles); hi_p = max(k[2] for k in candles)
y = lambda p: TOP + (1 - (p - lo_p) / (hi_p - lo_p)) * (BOTTOM - TOP)
closes = [k[1] for k in candles]
avg = [sum(closes[(i - j) % COUNT] for j in range(8)) / 8 for i in range(COUNT)]  # wraps around

img = Image.new("RGBA", (2 * PERIOD * SS, H * SS), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
s = lambda v: v * SS
total = 2 * PERIOD
for g in range(5):                                     # horizontal grid
    gy = TOP + g / 4 * (BOTTOM - TOP)
    d.line([(0, s(gy)), (s(total), s(gy))], fill=GRID + (255,), width=SS)
for i in range(0, 2 * COUNT + 1, 2):                   # vertical grid, every 2 candles
    gx = i * STEP
    d.line([(s(gx), s(TOP)), (s(gx), s(VOL_TOP + VOL_H))], fill=GRID + (255,), width=SS)
for rep in range(2):
    ox = rep * PERIOD
    pts = []
    for i, (o, c, hi, lo, v) in enumerate(candles):
        col = GREEN if c >= o else RED
        cx = ox + STEP * (i + 0.5)
        d.rectangle([s(cx - STEP * .32), s(VOL_TOP + VOL_H - v * VOL_H), s(cx + STEP * .32), s(VOL_TOP + VOL_H)], fill=col + (72,))
        d.line([(s(cx), s(y(hi))), (s(cx), s(y(lo)))], fill=col + (255,), width=int(1.6 * SS))
        top, bot = y(max(o, c)), y(min(o, c))
        d.rounded_rectangle([s(cx - STEP * .32), s(top), s(cx + STEP * .32), s(max(bot, top + 2))], radius=SS, fill=col + (255,))
        pts.append((s(cx), s(y(avg[i]))))
    d.line(pts, fill=BLUE + (217,), width=int(2.4 * SS), joint="curve")
# average line must join the seam between the two repeats
d.line([(s(PERIOD - STEP * .5), s(y(avg[-1]))), (s(PERIOD + STEP * .5), s(y(avg[0])))], fill=BLUE + (217,), width=int(2.4 * SS))
img.resize((total, H), Image.LANCZOS).save("strip.png")
print("strip.png", total, "x", H, "period", PERIOD)
