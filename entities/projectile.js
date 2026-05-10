// Projectile entity. Configurable per weapon; supports straight, gravity, boomerang, homing, AOE.

export class Projectile {
  constructor(opts) {
    this.x = opts.x; this.y = opts.y;
    this.vx = opts.vx || 0; this.vy = opts.vy || 0;
    this.r = opts.radius || 6;
    this.w = this.r * 2; this.h = this.r * 2;
    this.life = opts.lifetime || 1.5;
    this.maxLife = this.life;
    this.gravity = opts.gravity || 0;
    this.damage = opts.damage || 1;
    this.team = opts.team || 'player';   // 'player' | 'enemy'
    this.kind = opts.kind || 'bullet';   // bullet | boot | card | confetti | cleat
    this.color = opts.color || '#ffcc33';
    this.dead = false;
    this.spawnX = opts.x;
    this.spawnY = opts.y;
    this.owner = opts.owner || null;
    this.explode = opts.explode || null; // {radius, damage, color}
    this.boomerang = !!opts.boomerang;
    this.boomerangPhase = 'out';
    this.homing = opts.homing || 0;      // turn rate rad/s; 0 = none
    this.target = null;
    this.angle = Math.atan2(this.vy, this.vx);
    this.spin = (Math.random()-.5) * 16;
  }

  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; if (this.explode) this._doExplosion(world); return; }

    // boomerang return logic
    if (this.boomerang && this.owner) {
      const tx = this.owner.x + this.owner.w/2;
      const ty = this.owner.y + this.owner.h/2;
      if (this.boomerangPhase === 'out' && this.life < this.maxLife * 0.55) this.boomerangPhase = 'back';
      if (this.boomerangPhase === 'back') {
        const dx = tx - this.x, dy = ty - this.y;
        const len = Math.hypot(dx, dy) || 1;
        const sp = 520;
        this.vx = (dx/len) * sp;
        this.vy = (dy/len) * sp;
        if (len < 28) this.dead = true;
      }
    }

    // homing
    if (this.homing > 0) {
      // retarget if needed
      if (!this.target || this.target.dead) {
        let best = null, bd = Infinity;
        for (const e of (world.enemies || [])) {
          if (e.dead) continue;
          const dx = e.x - this.x, dy = e.y - this.y;
          const d = dx*dx+dy*dy;
          if (d < bd) { bd = d; best = e; }
        }
        this.target = best;
      }
      if (this.target) {
        const tx = this.target.x + this.target.w/2;
        const ty = this.target.y + this.target.h/2;
        const desired = Math.atan2(ty - this.y, tx - this.x);
        const cur = Math.atan2(this.vy, this.vx);
        let d = desired - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        const turn = Math.max(-this.homing*dt, Math.min(this.homing*dt, d));
        const sp = Math.hypot(this.vx, this.vy);
        const na = cur + turn;
        this.vx = Math.cos(na) * sp;
        this.vy = Math.sin(na) * sp;
      }
    }

    this.vy += this.gravity * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.angle = Math.atan2(this.vy, this.vx) + this.spin * 0.05;

    // collide with solids (only damaging projectiles that explode)
    if (this.explode) {
      for (const s of (world.solids || [])) {
        if (this.x > s.x && this.x < s.x + s.w && this.y > s.y && this.y < s.y + s.h) {
          this.dead = true;
          this._doExplosion(world);
          break;
        }
      }
    }

    // out of world
    if (this.x < -200 || this.x > world.bounds.w + 200 || this.y > world.bounds.h + 600) this.dead = true;
  }

  _doExplosion(world) {
    if (!this.explode) return;
    world.particles.burst(this.x, this.y, {
      count: 28, speed: 380, life: 0.6,
      colors: [this.explode.color, '#ff2a55', '#ffffff'],
      gravity: 80, size: 5, shape: 'square',
    });
    if (world.camera) world.camera.shake(10, 0.3);
    // damage anyone in radius
    const r = this.explode.radius;
    if (this.team === 'player') {
      for (const e of (world.enemies || [])) {
        if (e.dead) continue;
        const dx = (e.x + e.w/2) - this.x;
        const dy = (e.y + e.h/2) - this.y;
        if (dx*dx + dy*dy < r*r) e.takeHit(this.explode.damage, Math.sign(dx) * 320);
      }
      if (world.boss && !world.boss.dead) {
        const dx = (world.boss.x + world.boss.w/2) - this.x;
        const dy = (world.boss.y + world.boss.h/2) - this.y;
        if (dx*dx + dy*dy < r*r) world.boss.takeHit(this.explode.damage, Math.sign(dx) * 200);
      }
    }
  }

  draw(ctx) {
    const x = this.x, y = this.y;
    ctx.save();
    ctx.translate(x, y);

    if (this.kind === 'boot') {
      ctx.rotate(this.angle);
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(-12, -8, 24, 12);
      ctx.fillStyle = '#ffcc33';
      ctx.fillRect(-14, -10, 6, 4);
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(-12, 4, 24, 4);
      // sparks
      ctx.fillStyle = '#ff2a55';
      for (let i = 0; i < 3; i++) ctx.fillRect((Math.random()*20-10), (Math.random()*16-8), 2, 2);
    } else if (this.kind === 'card') {
      ctx.rotate(this.angle * 4);
      ctx.fillStyle = '#ff2a55';
      ctx.fillRect(-8, -12, 16, 24);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -8, 4, 16);
    } else if (this.kind === 'cleat') {
      ctx.rotate(this.angle);
      ctx.fillStyle = '#22e1ff';
      ctx.beginPath();
      ctx.moveTo(-12, -4); ctx.lineTo(10, 0); ctx.lineTo(-12, 4); ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 12; ctx.shadowColor = '#22e1ff';
      ctx.fillRect(-8, -2, 12, 4);
      ctx.shadowBlur = 0;
    } else if (this.kind === 'confetti') {
      ctx.rotate(this.angle * 2);
      const cs = ['#ff2a55','#22e1ff','#ffcc33','#ffffff'];
      ctx.fillStyle = cs[(this.spawnX|0) % cs.length];
      ctx.fillRect(-3, -3, 6, 6);
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
}
