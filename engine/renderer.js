// Forest renderer — dawn-haze sky + parallax tree silhouettes + dark forest soil.
// Procedurally drawn so we don't depend on a forest background image.

import { Assets } from '../core/assets.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.W = canvas.width;
    this.H = canvas.height;
    this.t = 0;

    // Seed parallax tree silhouette layers once — deterministic across frames.
    this._layers = this._buildTreeLayers();
  }

  resize() {
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  // Pre-generate three parallax layers of trees with fixed positions per layer.
  // Each tree: { x, height, width } in layer-local coords (0..tileW).
  _buildTreeLayers() {
    const rng = mulberry32(0x9E3779B1);
    function makeLayer(count, baseY, hMin, hMax, wMin, wMax) {
      const trees = [];
      for (let i = 0; i < count; i++) {
        trees.push({
          x: rng() * 2400,             // tile width 2400 — repeats
          height: hMin + rng() * (hMax - hMin),
          width:  wMin + rng() * (wMax - wMin),
          lean:   (rng() - 0.5) * 0.06,
          seed:   rng(),
        });
      }
      trees.sort((a, b) => a.x - b.x);
      return { trees, tileW: 2400, baseY };
    }
    return {
      far:  makeLayer(28, 0.66, 90,  170, 60,  120),
      mid:  makeLayer(22, 0.74, 140, 240, 110, 180),
      near: makeLayer(14, 0.84, 220, 360, 160, 260),
    };
  }

  drawBackground(camX, dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    this.t += dt;

    // Fallback sky in case the photo isn't loaded yet.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0.00, '#3a5870');
    sky.addColorStop(0.55, '#c8a378');
    sky.addColorStop(1.00, '#3a4a30');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // ── Real forest photo as the base background (golden-hour pines) ──
    const bg = Assets.get('stage1Bg');
    if (Assets.isReal('stage1Bg')) {
      // Cover-fit the image to the viewport, gently parallax with camera.
      const aspectImg = bg.width / bg.height;
      const aspectView = W / H;
      let dw, dh;
      if (aspectImg > aspectView) { dh = H * 1.06; dw = dh * aspectImg; }
      else { dw = W * 1.06; dh = dw / aspectImg; }
      // Slow horizontal parallax — the photo drifts a fraction of the camera speed
      // and seamlessly cycles so it never runs out across the long level.
      const parX = (camX * 0.18) % dw;
      const baseX = (W - dw) / 2 - parX;
      const dy = (H - dh) / 2 - 20;
      ctx.drawImage(bg, baseX, dy, dw, dh);
      ctx.drawImage(bg, baseX + dw, dy, dw, dh);

      // Warm dusk tint over the photo so the foreground UI/terrain pops.
      const tint = ctx.createLinearGradient(0, 0, 0, H);
      tint.addColorStop(0.0, 'rgba(36,28,18,0.25)');
      tint.addColorStop(0.6, 'rgba(20,16,10,0.18)');
      tint.addColorStop(1.0, 'rgba(10,8,6,0.55)');
      ctx.fillStyle = tint;
      ctx.fillRect(0, 0, W, H);
    }

    // ── One near layer of dark tree silhouettes for foreground depth.
    // The photo already provides the sky / horizon / distant trees, so we only
    // add a closer dark band to anchor the platforms against. ──
    this._drawTreeLayer(ctx, this._layers.near, camX * 0.78, '#0a140f', 1.00);

    // ── Light particles (firefly / dust motes) — small, subtle ──
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 10; i++) {
      const fx = ((i * 137 + this.t * 18) % (W + 60)) - 30;
      const fy = ((i * 71  + this.t * 6 ) % (H * 0.6)) + H * 0.20;
      const r = 0.6 + (i % 2) * 0.3;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,236,170,0.9)' : 'rgba(255,220,160,0.7)';
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();

    // ── Subtle halftone (pulp comic feel, very light) ──
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#0a0a12';
    const step = 9;
    const offX = ((camX * 0.05) % step + step) % step;
    for (let yy = 0; yy < H; yy += step) {
      for (let xx = -step; xx < W; xx += step) {
        ctx.beginPath();
        ctx.arc(xx + offX, yy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  _drawTreeLayer(ctx, layer, scrollX, color, alpha) {
    const ctxW = this.W, ctxH = this.H;
    const baseY = ctxH * layer.baseY;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;

    // Repeat layer tile across the screen
    const tileW = layer.tileW;
    const offset = ((scrollX % tileW) + tileW) % tileW;
    // start a tile to the left so leftmost trees are visible
    for (let tileStart = -tileW - offset; tileStart < ctxW + tileW; tileStart += tileW) {
      for (const tr of layer.trees) {
        const x = tileStart + tr.x;
        if (x < -tr.width || x > ctxW + tr.width) continue;
        this._drawConifer(ctx, x, baseY, tr.width, tr.height, tr.lean, tr.seed);
      }
    }
    ctx.restore();
  }

  // Stylized conifer silhouette — stacked triangles + trunk, slight lean.
  _drawConifer(ctx, x, baseY, w, h, lean, seed) {
    const trunkW = Math.max(8, w * 0.16);
    const trunkH = h * 0.18;
    // trunk
    ctx.beginPath();
    ctx.moveTo(x - trunkW / 2, baseY);
    ctx.lineTo(x + trunkW / 2, baseY);
    ctx.lineTo(x + trunkW / 2 + lean * 6, baseY - trunkH);
    ctx.lineTo(x - trunkW / 2 + lean * 6, baseY - trunkH);
    ctx.closePath();
    ctx.fill();

    // canopy — three overlapping triangles
    const top = baseY - h;
    const canopyBase = baseY - trunkH;
    const tiers = 3;
    for (let i = 0; i < tiers; i++) {
      const f = i / (tiers - 1);
      const y0 = canopyBase - f * (canopyBase - top) * 0.95;
      const y1 = y0 - (h * 0.45 * (1 - i * 0.18));
      const halfW = (w / 2) * (1 - i * 0.22);
      const leanX = lean * (canopyBase - y0);
      ctx.beginPath();
      ctx.moveTo(x - halfW + leanX, y0);
      ctx.lineTo(x + halfW + leanX, y0);
      ctx.lineTo(x + leanX * 1.4, y1);
      ctx.closePath();
      ctx.fill();
    }
  }

  // World-space dark "void" beneath all platforms (called after camera.apply).
  // Fills from groundY down to far below the world. Keeps signature for game.js compat.
  drawGround(_camX, worldW, groundY) {
    const ctx = this.ctx;
    // Deep forest soil — fills any gap visible below the terrain blocks.
    const grad = ctx.createLinearGradient(0, groundY, 0, groundY + 800);
    grad.addColorStop(0.0, '#1a1208');
    grad.addColorStop(1.0, '#050302');
    ctx.fillStyle = grad;
    ctx.fillRect(-200, groundY, worldW + 400, 1600);

    // Faint root striations for depth
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#2a1a08';
    ctx.lineWidth = 2;
    for (let i = 0; i < 30; i++) {
      const x = (i * 287) % worldW;
      const y = groundY + 40 + (i * 53) % 240;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 20, y + 30, x + 60, y - 10, x + 100, y + 40);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFog(alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(2,3,10,${alpha})`;
    ctx.fillRect(0, 0, this.W, this.H);
  }
}

// Cheap deterministic PRNG so tree silhouettes are stable across reloads.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
