// Home page only: draws the demo chart in the hero.
(function () {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = (name, attrs) => {
    const el = document.createElementNS(ns, name);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
    return el;
  };

  // Demo chart: made-up candles from a fixed seed, so the picture never changes between visits.
  // The drawing area is 1000 wide and 500 tall; candles use the top 400, volume the bottom 100.
  (function drawDemo() {
    const canvas = document.getElementById('demo-canvas');
    const chart = document.getElementById('demo-chart');
    const axis = document.getElementById('demo-axis');
    if (!canvas || !chart || !axis) return;

    const COUNT = 58, W = 1000, TOP = 28, BOTTOM = 376, VOL_TOP = 420;
    let price = 100, seed = 11;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const candles = [];
    for (let i = 0; i < COUNT; i++) {
      const open = price;
      const close = open + (rand() - 0.4) * 5.2;
      const high = Math.max(open, close) + rand() * 2.6;
      const low = Math.min(open, close) - rand() * 2.6;
      candles.push({ open, close, high, low, vol: 0.25 + rand() * 0.75 });
      price = close;
    }
    const min = Math.min(...candles.map((c) => c.low));
    const max = Math.max(...candles.map((c) => c.high));
    const y = (p) => TOP + (1 - (p - min) / (max - min)) * (BOTTOM - TOP);
    const step = W / COUNT;
    const x = (i) => step * (i + 0.5);

    for (let g = 0; g <= 4; g++) {
      const gy = TOP + (g / 4) * (BOTTOM - TOP);
      chart.append(svg('line', { x1: 0, x2: W, y1: gy, y2: gy, stroke: '#1e293b', 'stroke-width': 1 }));
      const label = document.createElement('span');
      label.style.top = (gy / 5) + '%';
      label.textContent = (max - (g / 4) * (max - min)).toFixed(2);
      axis.append(label);
    }

    const average = [];
    candles.forEach((c, i) => {
      const up = c.close >= c.open;
      const color = up ? '#22c55e' : '#ef4444';
      chart.append(svg('rect', { x: x(i) - step * 0.32, width: step * 0.64, y: VOL_TOP + (1 - c.vol) * 76, height: c.vol * 76, fill: color, opacity: 0.28 }));
      chart.append(svg('line', { x1: x(i), x2: x(i), y1: y(c.high), y2: y(c.low), stroke: color, 'stroke-width': 1.5 }));
      chart.append(svg('rect', { x: x(i) - step * 0.32, width: step * 0.64, y: y(Math.max(c.open, c.close)), height: Math.max(2, Math.abs(y(c.open) - y(c.close))), fill: color, rx: 1 }));
      const from = Math.max(0, i - 7);
      const slice = candles.slice(from, i + 1);
      average.push(x(i) + ',' + y(slice.reduce((sum, s) => sum + s.close, 0) / slice.length));
    });
    chart.append(svg('polyline', { points: average.join(' '), fill: 'none', stroke: '#38bdf8', 'stroke-width': 1.6, opacity: 0.85 }));

    // Numbered flags match the numbered rows in the panel.
    const flags = [[14, 'buy', 3], [36, 'sell', 2], [49, 'buy', 1]];
    for (const [index, side, label] of flags) {
      const flag = document.createElement('span');
      flag.className = 'flag ' + side;
      flag.textContent = label;
      flag.style.left = (x(index) / W) * 100 + '%';
      flag.style.top = ((y(candles[index].high) - 20) / 5) + '%';
      canvas.append(flag);
    }

    const last = candles[COUNT - 1].close;
    const tag = document.createElement('span');
    tag.className = 'last';
    tag.style.top = (y(last) / 5) + '%';
    tag.textContent = last.toFixed(2);
    axis.append(tag);
  })();
})();
