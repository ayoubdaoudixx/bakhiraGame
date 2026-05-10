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

    if (!this.audioPlayed && this.audioAppear) {
      const px = world.player.x + world.player.w/2;
      const myCx = this.x + this.w/2;
      const dist = Math.abs(px - myCx);
      if (dist < 800) {
        world.audio.play(this.audioAppear);
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
      // disintegration
      const t = Math.max(0, this.deathT / 0.6);
      ctx.globalAlpha = t;
    }

    const bob = Math.sin(this.bounceT * 6) * 2;
    ctx.save();
    ctx.translate(x + w/2, y + h);
    if (this.facing < 0) ctx.scale(-1, 1);

    // legs
    ctx.fillStyle = '#0c0e18';
    ctx.fillRect(-w*0.35, -h*0.45 + bob, w*0.25, h*0.45);
    ctx.fillRect(w*0.10, -h*0.45 + bob, w*0.25, h*0.45);

    // body
    ctx.fillStyle = this.def.bodyColor || '#1c2438';
    if (this.flash > 0) ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(-w*0.45, -h*0.40 + bob);
    ctx.lineTo( w*0.45, -h*0.40 + bob);
    ctx.lineTo( w*0.40, -h*0.85 + bob);
    ctx.lineTo(-w*0.40, -h*0.85 + bob);
    ctx.closePath();
    ctx.fill();

    // accent stripe
    ctx.fillStyle = this.def.accent || '#ff2a55';
    ctx.fillRect(-w*0.45, -h*0.55 + bob, w*0.9, 4);

    // arms (waving)
    const swing = Math.sin(this.bounceT * 8) * 0.4;
    ctx.save();
    ctx.translate(-w*0.42, -h*0.70 + bob);
    ctx.rotate(swing);
    ctx.fillStyle = this.def.bodyColor || '#1c2438';
    ctx.fillRect(-6, 0, 6, h*0.45);
    ctx.restore();
    ctx.save();
    ctx.translate(w*0.42, -h*0.70 + bob);
    ctx.rotate(-swing);
    ctx.fillRect(0, 0, 6, h*0.45);
    ctx.restore();

    // head + face image (face is drawn upright, ignoring flip)
    const headSize = w * 0.7;
    const headY = -h * 0.85 - headSize * 0.7 + bob;
    ctx.save();
    if (this.facing < 0) ctx.scale(-1, 1); // un-flip for face

    // head bg
    ctx.fillStyle = '#2a1f2e';
    ctx.beginPath();
    ctx.arc(0, headY + headSize/2, headSize/2 + 4, 0, Math.PI*2);
    ctx.fill();

    const face = Assets.get(this.faceKey);
    // clip to circle and draw face
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, headY + headSize/2, headSize/2, 0, Math.PI*2);
    ctx.clip();
    ctx.drawImage(face, -headSize/2, headY, headSize, headSize);
    ctx.restore();

    // head ring
    ctx.strokeStyle = this.def.accent || '#ff2a55';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, headY + headSize/2, headSize/2, 0, Math.PI*2);
    ctx.stroke();

    if (this.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(0, headY + headSize/2, headSize/2, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    // hp pips above head
    if (!this.dead) {
      const pips = this.maxHp;
      for (let i = 0; i < pips; i++) {
        const px = -((pips-1) * 6) + i * 12 - 4;
        ctx.fillStyle = i < this.hp ? '#ff2a55' : 'rgba(255,255,255,0.18)';
        ctx.fillRect(px, headY - 14, 8, 4);
      }
    }

    if (this.stunT > 0) {
      ctx.strokeStyle = '#22e1ff';
      ctx.lineWidth = 2;
      const r = headSize/2 + 6 + Math.sin(this.bounceT * 12) * 2;
      ctx.beginPath();
      ctx.arc(0, headY + headSize/2, r, 0, Math.PI*2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
