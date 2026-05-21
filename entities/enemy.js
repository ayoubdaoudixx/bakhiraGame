// Enemy entity. Body is procedurally drawn, face image is mapped onto the head area.
// Behaviors: patrol, chase, jump, ranged.

import { PHYSICS, integrate } from '../engine/physics.js';
import { resolveSolids } from '../engine/collision.js';
import { Assets } from '../core/assets.js';
import { Projectile } from './projectile.js';

export class Enemy {
  constructor(def, x, y, opts = {}) {
    this.def = def;
    this.id = def.id;
    this.x = x; this.y = y;
    this.scale = def.scale || 1;
    this.w = 72 * this.scale;
    this.h = 102 * this.scale;
    this.vx = 0; this.vy = 0;
    this.kbx = 0; this.kby = 0;
    this.facing = -1;
    this.grounded = false;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.dead = false;
    this.flash = 0;
    this.stunT = 0;
    this.deathT = 0;
    this.behavior = def.behavior;
    this.speed = def.speed;
    this.bounceT = Math.random() * Math.PI * 2;
    this.shootCooldown = 1.5 + Math.random();

    // patrol bounds
    this.patrolMin = opts.patrolMin ?? (x - 120);
    this.patrolMax = opts.patrolMax ?? (x + 120);

    // audio
    this.audioAppear = opts.audioAppear;
    this.audioDefeat = opts.audioDefeat;
    this.audioPlayed = false;

    this.faceKey = `face_${def.id}`;
    Assets.loadImage(this.faceKey, `/assets/enemies/${def.facePng}`, def.id);
  }

  takeHit(dmg, kbDir) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flash = 0.18;
    this.kbx = kbDir;
    this.kby = -200;
    if (this.hp <= 0) {
      this.dead = true;
      this.deathT = 0.6;
    }
  }

  update(dt, world) {
    if (this.dead) {
      this.deathT -= dt;
      this.vy += PHYSICS.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= 0.96;
      return;
    }

    // Intro narration fires only when the enemy is actually VISIBLE inside
    // the camera viewport — distance-based triggers used to fire while the
    // enemy was still off-screen, which was queueing voices too early.
    if (!this.audioPlayed && this.audioAppear && world.camera) {
      const cam = world.camera;
      const viewL = cam.x;
      const viewR = cam.x + cam.viewW;
      const viewT = cam.y;
      const viewB = cam.y + cam.viewH;
      const onScreen =
        this.x + this.w > viewL && this.x < viewR &&
        this.y + this.h > viewT && this.y < viewB;
      if (onScreen) {
        // Sequential narrative channel — waits for any prior voice line to
        // finish so intros never collide with stage-start or "between" clips.
        if (world.audio.playSequential) world.audio.playSequential(this.audioAppear);
        else world.audio.play(this.audioAppear);
        this.audioPlayed = true;
      }
    }

    if (this.flash > 0) this.flash -= dt;
    if (this.stunT > 0) this.stunT -= dt;
    this.bounceT += dt;
    this.shootCooldown -= dt;

    if (this.stunT <= 0) {
      const player = world.player;
      const px = player.x + player.w/2;
      const myCx = this.x + this.w/2;
      const dx = px - myCx;
      const dist = Math.abs(dx);

      switch (this.behavior) {
        case 'patrol':
          this.vx = this.facing * this.speed;
          if (this.x <= this.patrolMin) this.facing = 1;
          if (this.x + this.w >= this.patrolMax) this.facing = -1;
          break;
        case 'chase':
          if (dist < 420 && Math.abs(player.y - this.y) < 200) {
            this.facing = Math.sign(dx) || this.facing;
            this.vx = this.facing * this.speed;
          } else {
            this.vx = 0;
          }
          break;
        case 'jump':
          this.facing = Math.sign(dx) || this.facing;
          this.vx = this.facing * this.speed * 0.8;
          if (this.grounded && Math.random() < dt * 1.2) {
            this.vy = -560;
          }
          break;
        case 'ranged':
          this.facing = Math.sign(dx) || this.facing;
          this.vx = 0;
          if (this.shootCooldown <= 0 && dist < 540) {
            this._shoot(world);
            this.shootCooldown = 1.6 + Math.random() * 0.6;
          }
          break;
      }
    } else {
      this.vx *= 0.85;
    }

    const prevX = this.x, prevY = this.y;
    integrate(this, dt);
    resolveSolids(this, world.solids, prevX, prevY);

    // patrol turnaround at ledges
    if (this.behavior === 'patrol' && this.grounded) {
      const probeX = this.facing > 0 ? this.x + this.w + 4 : this.x - 4;
      const probeY = this.y + this.h + 4;
      const onSomething = world.solids.some(s => probeX > s.x && probeX < s.x + s.w && probeY > s.y && probeY < s.y + s.h);
      if (!onSomething) this.facing *= -1;
    }

    // contact damage to player
    const p = world.player;
    if (!p.dead && p.invuln <= 0) {
      if (this.x < p.x + p.w && this.x + this.w > p.x && this.y < p.y + p.h && this.y + this.h > p.y) {
        p.takeDamage(1, p.x < this.x ? -1 : 1);
        world.camera.shake(6, 0.18);
      }
    }
  }

  _shoot(world) {
    const cx = this.x + this.w/2;
    const cy = this.y + 18;
    const tx = world.player.x + world.player.w/2;
    const ty = world.player.y + world.player.h/2;
    const angle = Math.atan2(ty - cy, tx - cx);
    const sp = 320;
    world.projectiles.push(new Projectile({
      x: cx, y: cy, vx: Math.cos(angle)*sp, vy: Math.sin(angle)*sp,
      radius: 7, lifetime: 2.5, gravity: 0, damage: 1, team: 'enemy',
      kind: 'bullet', color: this.def.accent, owner: this,
    }));
  }

  draw(ctx) {
    const x = this.x, y = this.y;
    const w = this.w, h = this.h;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x + w/2, y + h - 1, w/2 + 4, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    if (this.dead) {
      const t = Math.max(0, this.deathT / 0.6);
      ctx.globalAlpha = t;
    }

    const bob = Math.sin(this.bounceT * 6) * 1.5;
    ctx.save();
    ctx.translate(x + w/2, y + h);
    if (this.facing < 0) ctx.scale(-1, 1);

    // Full chibi avatar drawn at body size, scaled up a little so the character
    // reads clearly against the forest backdrop. The image's own aspect is
    // honored so the avatar doesn't squash.
    const img = Assets.get(this.faceKey);
    const isReal = img && img.naturalWidth > 1;
    const drawH = h * 1.30;
    const aspect = isReal ? (img.width / img.height) : 0.66;
    const drawW = drawH * aspect;
    const top = -drawH + bob + 4;

    if (isReal) {
      ctx.drawImage(img, -drawW/2, top, drawW, drawH);
      if (this.flash > 0) {
        // white hit-flash over the sprite
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.fillRect(-drawW/2, top, drawW, drawH);
        ctx.globalCompositeOperation = 'source-over';
      }
    } else {
      // procedural fallback so the world still works without the asset
      ctx.fillStyle = this.def.bodyColor || '#1c2438';
      ctx.fillRect(-w*0.4, -h * 0.9 + bob, w*0.8, h*0.8);
    }

    // Restore axes so HUD-like overlays (HP pips, stun ring) read upright.
    ctx.restore();

    // ── HP pips floating above the avatar's head ──
    if (!this.dead) {
      const headTop = y - 6;
      const pips = this.maxHp;
      for (let i = 0; i < pips; i++) {
        const px = x + w/2 - ((pips - 1) * 6) + i * 12 - 4;
        ctx.fillStyle = i < this.hp ? '#ff2a55' : 'rgba(255,255,255,0.20)';
        ctx.fillRect(px, headTop, 8, 4);
      }
    }

    // ── Stun ring around the avatar ──
    if (this.stunT > 0) {
      const cx = x + w/2;
      const cy = y + h * 0.35;
      const r = w * 0.6 + Math.sin(this.bounceT * 12) * 2;
      ctx.strokeStyle = '#22e1ff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
