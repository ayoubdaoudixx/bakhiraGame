// Camera with smooth follow, screen shake, and world bounds clamping.

export class Camera {
  constructor(viewW, viewH) {
    this.x = 0; this.y = 0;
    this.viewW = viewW; this.viewH = viewH;
    this.world = { x: 0, y: 0, w: viewW, h: viewH };
    this.target = null;
    this.shakeT = 0; this.shakeAmp = 0;
    this.lerp = 6;
    this.offsetY = -40; // bias slightly upward so player isn't centered
  }

  setWorld(w, h) { this.world.w = w; this.world.h = h; }

  follow(t) { this.target = t; }

  shake(amp = 8, time = 0.4) {
    this.shakeAmp = Math.max(this.shakeAmp, amp);
    this.shakeT = Math.max(this.shakeT, time);
  }

  update(dt) {
    if (this.target) {
      const tx = this.target.x + this.target.w / 2 - this.viewW / 2;
      const ty = this.target.y + this.target.h / 2 - this.viewH / 2 + this.offsetY;
      const k = 1 - Math.exp(-this.lerp * dt);
      this.x += (tx - this.x) * k;
      this.y += (ty - this.y) * k;
    }
    // clamp to world
    if (this.x < 0) this.x = 0;
    if (this.y < -200) this.y = -200; // allow some sky
    const maxX = Math.max(0, this.world.w - this.viewW);
    const maxY = Math.max(0, this.world.h - this.viewH);
    if (this.x > maxX) this.x = maxX;
    if (this.y > maxY) this.y = maxY;

    if (this.shakeT > 0) this.shakeT -= dt;
    if (this.shakeT <= 0) this.shakeAmp = 0;
  }

  // Apply transform to a context. Caller restores manually.
  apply(ctx) {
    let sx = 0, sy = 0;
    if (this.shakeT > 0) {
      sx = (Math.random() * 2 - 1) * this.shakeAmp;
      sy = (Math.random() * 2 - 1) * this.shakeAmp;
    }
    ctx.translate(-Math.round(this.x + sx), -Math.round(this.y + sy));
  }

  worldFromScreen(sx, sy) { return { x: sx + this.x, y: sy + this.y }; }
}
