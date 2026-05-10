// Renderer: stadium photo as level background with night tinting + parallax.
// Falls back to a procedural gradient if the image hasn't loaded yet.

import { Assets } from '../core/assets.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = true;
    this.W = canvas.width;
    this.H = canvas.height;
    this.t = 0;
    Assets.loadImage('bgLvl1', '/assets/bg-lvl1.jpg', 'BG');
  }

  resize() {
    this.W = this.canvas.width;
    this.H = this.canvas.height;
  }

  drawBackground(camX, dt) {
    const ctx = this.ctx, W = this.W, H = this.H;
    this.t += dt;

    // Base sky fill so corners are never empty.
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, W, H);

    const bg = Assets.get('bgLvl1');
    const isReal = Assets.isReal('bgLvl1');

    if (isReal) {
      // Cover-fit the photo to the canvas with light parallax (slower than world).
      const aspectImg = bg.width / bg.height;
      const aspectView = W / H;
      let dw, dh;
      if (aspectImg > aspectView) { dh = H * 1.10; dw = dh * aspectImg; }
      else { dw = W * 1.10; dh = dw / aspectImg; }

      const offX = -((camX * 0.18) % (dw)) * 0.5; // gentle horizontal drift
      const dx = (W - dw) / 2 + offX * 0.3;
      const dy = (H - dh) / 2 - 30;

      ctx.drawImage(bg, dx, dy, dw, dh);
    } else {
      // Procedural fallback while the image loads.
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, '#0a0414');
      grad.addColorStop(1, '#02030a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Night-mood overlay: deep blue tint + vignette.
    ctx.fillStyle = 'rgba(6,10,28,0.55)';
    ctx.fillRect(0, 0, W, H);

    // Stadium-light haze from the top
    const topGlow = ctx.createLinearGradient(0, 0, 0, H * 0.5);
    topGlow.addColorStop(0, 'rgba(255,225,180,0.18)');
    topGlow.addColorStop(1, 'rgba(255,225,180,0)');
    ctx.fillStyle = topGlow;
    ctx.fillRect(0, 0, W, H * 0.5);

    // Distant moon, kept for the dramatic night feel
    const mx = W * 0.82, my = H * 0.18;
    const pulse = 1 + Math.sin(this.t * 1.2) * 0.05;
    const rg = ctx.createRadialGradient(mx, my, 0, mx, my, 200 * pulse);
    rg.addColorStop(0, 'rgba(255,170,180,0.45)');
    rg.addColorStop(0.4, 'rgba(180,80,120,0.15)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffd1c8';
    ctx.beginPath(); ctx.arc(mx, my, 44 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(40,10,30,0.35)';
    ctx.beginPath(); ctx.arc(mx + 14, my - 6, 44 * pulse, 0, Math.PI * 2); ctx.fill();

    // A few bright neon flickers — stadium floodlights catching on something
    ctx.fillStyle = '#ffcc33';
    for (let i = 0; i < 6; i++) {
      const fx = ((i * 211 - camX * 0.4) % W + W) % W;
      const fy = H * 0.10 + (i % 2) * 6;
      const a = 0.4 + 0.4 * Math.sin(this.t * 8 + i);
      ctx.globalAlpha = a;
      ctx.fillRect(fx, fy, 3, 2);
    }
    ctx.globalAlpha = 1;

    // Bottom horizon shadow so the level platforms read against it.
    const bottom = ctx.createLinearGradient(0, H * 0.55, 0, H);
    bottom.addColorStop(0, 'rgba(2,3,10,0)');
    bottom.addColorStop(1, 'rgba(2,3,10,0.85)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, H * 0.55, W, H * 0.45);

    // Subtle red atmospheric haze low — keeps the "revenge" feel
    const danger = ctx.createLinearGradient(0, H * 0.7, 0, H);
    danger.addColorStop(0, 'rgba(255,42,85,0)');
    danger.addColorStop(1, 'rgba(255,42,85,0.10)');
    ctx.fillStyle = danger;
    ctx.fillRect(0, H * 0.7, W, H * 0.3);
  }

  // Draw a stylized street ground at world Y.
  drawGround(camX, worldW, groundY) {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(-camX, 0);
    const grad = ctx.createLinearGradient(0, groundY, 0, this.H + 200);
    grad.addColorStop(0, '#0c1020');
    grad.addColorStop(1, '#04060c');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, worldW, this.H * 2);

    ctx.fillStyle = '#ff2a55';
    ctx.globalAlpha = 0.55;
    ctx.fillRect(0, groundY - 2, worldW, 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(34,225,255,0.25)';
    for (let x = 0; x < worldW; x += 80) ctx.fillRect(x, groundY + 36, 30, 2);
    ctx.restore();
  }

  drawFog(alpha) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(2,3,10,${alpha})`;
    ctx.fillRect(0, 0, this.W, this.H);
  }
}
