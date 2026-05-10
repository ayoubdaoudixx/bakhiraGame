// Lightweight particle system. Pool-free, just GC-friendly arrays.

export class Particles {
  constructor() { this.arr = []; }
  spawn(p) { this.arr.push(p); }

  burst(x, y, opts = {}) {
    const n = opts.count || 12;
    const speed = opts.speed || 200;
    const colors = opts.colors || ['#ff2a55', '#ffcc33', '#22e1ff'];
    for (let i = 0; i < n; i++) {
      const a = (opts.angle ?? Math.random() * Math.PI * 2);
      const sp = (opts.angleSpread != null) ? a + (Math.random() * 2 - 1) * opts.angleSpread : Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.6);
      this.arr.push({
        x, y,
        vx: Math.cos(sp) * v,
        vy: Math.sin(sp) * v - (opts.lift || 0),
        life: opts.life || 0.6 + Math.random() * 0.4,
        max: opts.life || 0.9,
        size: opts.size || 3 + Math.random() * 3,
        color: colors[(Math.random() * colors.length) | 0],
        gravity: opts.gravity ?? 600,
        shape: opts.shape || 'square',
        rot: Math.random() * Math.PI * 2,
        vrot: (Math.random() - 0.5) * 8,
      });
    }
  }

  trail(x, y, vx, vy, color = '#22e1ff') {
    this.arr.push({
      x, y, vx: vx * 0.2 + (Math.random()-.5)*40, vy: vy * 0.2 + (Math.random()-.5)*40,
      life: 0.4, max: 0.4, size: 4, color, gravity: 0, shape: 'circle', rot: 0, vrot: 0,
    });
  }

  update(dt) {
    for (let i = this.arr.length - 1; i >= 0; i--) {
      const p = this.arr[i];
      p.life -= dt;
      if (p.life <= 0) { this.arr.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
    }
  }

  draw(ctx) {
    for (const p of this.arr) {
      const a = Math.max(0, Math.min(1, p.life / p.max));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
}
