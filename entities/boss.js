// Level 1 boss — The Iron Hooligan.
// A brutish, masked enforcer working for the main villain. NOT the villain himself.
// Fully procedural (no face PNG) so he reads as a distinct first-stage threat.
// Two-phase: phase 1 hurls stadium debris in arcs; phase 2 charges and slams.

import { PHYSICS, integrate } from '../engine/physics.js';
import { resolveSolids } from '../engine/collision.js';
import { Projectile } from './projectile.js';
import { BOSS } from '../config/enemies.js';
import { Assets } from '../core/assets.js';

export class Boss {
  constructor(x, y) {
    this.def = BOSS;
    this.x = x; this.y = y;
    this.scale = BOSS.scale;
    this.w = 130; this.h = 170;
    this.vx = 0; this.vy = 0;
    this.kbx = 0; this.kby = 0;
    this.facing = -1;
    this.grounded = false;
    this.maxHp = BOSS.hp;
    this.hp = this.maxHp;
    this.dead = false;
    this.flash = 0;
    this.deathT = 0;

    // entrance
    this.entrance = 1;
    this.entranceTotal = 2.4;
    this.appeared = false;
    this.startY = null;

    // attack/movement state
    this.attackCooldown = 1.5;
    this.dashT = 0;
    this.slamT = 0;        // charge wind-up + slam
    this.slamPhase = null; // 'wind' | 'charge' | 'recover'
    this.bounceT = 0;
    this.phase = 1;
    this.eyeShake = 0;

    Assets.loadImage('bossLvl1', '/assets/enemies/boss-lvl1.png', 'BOSS');
  }

  trigger() {
    if (!this.appeared) {
      this.appeared = true;
      this.entrance = this.entranceTotal;
    }
  }

  takeHit(dmg, kbDir) {
    if (this.dead || this.entrance > 0) return;
    this.hp -= dmg;
    this.flash = 0.16;
    this.kbx = kbDir * 0.4;
    this.eyeShake = 0.25;
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.deathT = 1.6;
    }
    if (this.hp / this.maxHp <= 0.5 && this.phase === 1) {
      this.phase = 2;
      this.flash = 0.45;
      this.eyeShake = 0.6;
    }
  }

  update(dt, world) {
    this.bounceT += dt;
    if (this.eyeShake > 0) this.eyeShake -= dt;

    if (this.dead) {
      this.deathT -= dt;
      this.vy += PHYSICS.gravity * dt * 0.4;
      this.x += this.vx * dt; this.y += this.vy * dt;
      // rivet sparks tumble out as he falls
      if (Math.random() < 0.6) {
        world.particles.spawn({
          x: this.x + this.w/2 + (Math.random()-.5)*60,
          y: this.y + this.h/2 + (Math.random()-.5)*60,
          vx: (Math.random()-.5)*200, vy: -120 - Math.random()*100,
          life: 0.9, max: 0.9, size: 3, color: ['#ff7a1a','#ffcc33','#7a7a84'][(Math.random()*3)|0],
          gravity: 400, shape: 'square', rot: 0, vrot: (Math.random()-.5)*8,
        });
      }
      return;
    }
    if (this.flash > 0) this.flash -= dt;

    if (this.entrance > 0) {
      this.entrance -= dt;
      if (this.startY === null) this.startY = this.y;
      // dust kicks up at his feet during the slow approach
      if (Math.random() < 0.4) {
        world.particles.spawn({
          x: this.x + this.w/2 + (Math.random()-.5)*100,
          y: this.y + this.h - 4,
          vx: (Math.random()-.5)*60, vy: -20 - Math.random()*30,
          life: 1.0, max: 1.0, size: 10 + Math.random()*8,
          color: 'rgba(60,40,30,0.5)', gravity: -20, shape: 'circle', rot: 0, vrot: 0,
        });
      }
      if (this.entrance <= 0) world.camera.shake(14, 0.5);
      return;
    }

    const player = world.player;
    const dx = (player.x + player.w/2) - (this.x + this.w/2);
    this.facing = Math.sign(dx) || this.facing;
    this.attackCooldown -= dt;

    const speedMul = this.phase === 2 ? 1.5 : 1;

    // SLAM: wind up, dash, recover (only phase 2 uses this)
    if (this.slamPhase === 'wind') {
      this.slamT -= dt;
      this.vx *= 0.85;
      if (this.slamT <= 0) {
        this.slamPhase = 'charge';
        this.slamT = 0.55;
        if (this.grounded) this.vy = -260;
      }
    } else if (this.slamPhase === 'charge') {
      this.slamT -= dt;
      this.vx = this.facing * this.def.speed * 2.6;
      if (this.slamT <= 0) {
        this.slamPhase = 'recover';
        this.slamT = 0.4;
        this.vx = 0;
        // slam impact: shockwave debris + screen shake
        if (this.grounded || true) {
          for (let i = -2; i <= 2; i++) {
            world.particles.spawn({
              x: this.x + this.w/2,
              y: this.y + this.h - 4,
              vx: i * 90, vy: -240 - Math.abs(i) * 30,
              life: 0.7, max: 0.7, size: 6,
              color: ['#ff7a1a','#ffcc33','#7a7a84'][(Math.abs(i))%3],
              gravity: 700, shape: 'square', rot: 0, vrot: (Math.random()-.5)*10,
            });
          }
          world.camera.shake(14, 0.35);
          world.audio.play('boom');
        }
      }
    } else if (this.slamPhase === 'recover') {
      this.slamT -= dt;
      this.vx *= 0.8;
      if (this.slamT <= 0) {
        this.slamPhase = null;
        this.attackCooldown = 1.0;
      }
    } else {
      // patrol toward player
      this.vx = this.facing * this.def.speed * 0.7 * speedMul;
    }

    // attack scheduling (only when not slamming)
    if (this.slamPhase === null && this.attackCooldown <= 0) {
      if (this.phase === 1) {
        this._hurlDebris(world, 1);
        this.attackCooldown = 1.6;
      } else {
        if (Math.random() < 0.55) {
          this._hurlDebris(world, 3);
          this.attackCooldown = 1.1;
        } else {
          this.slamPhase = 'wind';
          this.slamT = 0.55;
        }
      }
    }

    const prevX = this.x, prevY = this.y;
    integrate(this, dt);
    resolveSolids(this, world.solids, prevX, prevY);

    // Clamp to the boss arena so he can't walk off the platform edge.
    // The gate + backwall solids will also do this physically, but a hard
    // clamp guarantees no edge-case escapes.
    if (world.arena) {
      const a = world.arena;
      const minX = a.x + 40;
      const maxX = a.x + a.w - 40 - this.w;
      if (this.x < minX) { this.x = minX; this.vx = Math.max(0, this.vx); }
      if (this.x > maxX) { this.x = maxX; this.vx = Math.min(0, this.vx); }
    }

    // contact damage to player
    if (!player.dead && player.invuln <= 0) {
      if (this.x < player.x + player.w && this.x + this.w > player.x &&
          this.y < player.y + player.h && this.y + this.h > player.y) {
        const force = this.slamPhase === 'charge' ? 2 : 1;
        player.takeDamage(force, player.x < this.x ? -1 : 1);
        world.camera.shake(8, 0.2);
      }
    }
  }

  _hurlDebris(world, count) {
    const cx = this.x + this.w/2 + this.facing * 30;
    const cy = this.y + 60;
    for (let i = 0; i < count; i++) {
      const tx = world.player.x + world.player.w/2 + (i - count/2) * 80;
      const ty = world.player.y + world.player.h/2;
      const angle = Math.atan2(ty - cy, tx - cx);
      const sp = 380;
      world.projectiles.push(new Projectile({
        x: cx, y: cy,
        vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp - 120,
        radius: 13, lifetime: 3, gravity: 600, damage: 1, team: 'enemy',
        kind: 'bullet', color: '#ff7a1a', owner: this,
      }));
    }
    world.audio.play('shoot');
  }

  draw(ctx) {
    if (!this.appeared) return;
    const w = this.w, h = this.h;

    // long ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(this.x + w/2, this.y + h - 1, w/2 + 10, 8, 0, 0, Math.PI*2);
    ctx.fill();

    if (this.dead) ctx.globalAlpha = Math.max(0, this.deathT / 1.6);

    ctx.save();
    ctx.translate(this.x + w/2, this.y + h);
    if (this.facing < 0) ctx.scale(-1, 1);

    const bob = Math.sin(this.bounceT * 4) * 2;
    const wind = this.slamPhase === 'wind' ? Math.sin(this.bounceT * 30) * 3 : 0;

    // boots — heavy cleats
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-w*0.36, -10, w*0.30, 12);
    ctx.fillRect( w*0.06, -10, w*0.30, 12);
    // cleat studs
    ctx.fillStyle = this.def.rivet;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-w*0.34 + i * 8, 0, 3, 3);
      ctx.fillRect( w*0.08 + i * 8, 0, 3, 3);
    }

    // legs (torn black trousers)
    ctx.fillStyle = '#0e0e10';
    ctx.fillRect(-w*0.34, -h*0.40 + bob, w*0.26, h*0.40);
    ctx.fillRect( w*0.08, -h*0.40 + bob, w*0.26, h*0.40);
    // tear lines
    ctx.fillStyle = '#1a0a0a';
    ctx.fillRect(-w*0.30, -h*0.20 + bob, w*0.18, 2);
    ctx.fillRect( w*0.12, -h*0.10 + bob, w*0.18, 2);

    // bulky torso — torn referee jersey, dark blood-red with black stripes
    ctx.fillStyle = this.flash > 0 ? '#ffffff' : this.def.uniform;
    ctx.beginPath();
    ctx.moveTo(-w*0.55 + wind, -h*0.40 + bob);
    ctx.lineTo( w*0.55 + wind, -h*0.40 + bob);
    ctx.lineTo( w*0.50 + wind, -h*0.78 + bob);
    ctx.lineTo(-w*0.50 + wind, -h*0.78 + bob);
    ctx.closePath();
    ctx.fill();
    // ref stripes (thick verticals)
    if (this.flash <= 0) {
      ctx.fillStyle = this.def.uniformStripe;
      const stripes = 3;
      for (let i = 0; i < stripes; i++) {
        const sx = -w*0.40 + (i * w * 0.40) + wind;
        ctx.fillRect(sx, -h*0.78 + bob, w*0.06, h*0.38);
      }
      // tear at the gut (revealing chest binding)
      ctx.fillStyle = '#8a1a1a';
      ctx.beginPath();
      ctx.moveTo(-w*0.10 + wind, -h*0.55 + bob);
      ctx.lineTo( w*0.05 + wind, -h*0.50 + bob);
      ctx.lineTo( w*0.00 + wind, -h*0.42 + bob);
      ctx.lineTo(-w*0.15 + wind, -h*0.46 + bob);
      ctx.closePath();
      ctx.fill();
    }

    // chest plate / belt
    ctx.fillStyle = this.def.armor;
    ctx.fillRect(-w*0.45 + wind, -h*0.44 + bob, w*0.90, 6);
    // belt buckle
    ctx.fillStyle = this.def.glow;
    ctx.fillRect(-6 + wind, -h*0.43 + bob, 12, 4);

    // SPIKED SHOULDER ARMOR — first-boss signature
    drawShoulder(ctx, -w*0.50 + wind, -h*0.78 + bob, this.def.armor, this.def.rivet, this.def.glow, 'left');
    drawShoulder(ctx,  w*0.50 + wind, -h*0.78 + bob, this.def.armor, this.def.rivet, this.def.glow, 'right');

    // arms — bulky, with chained gauntlets at fists
    const armSwing = this.slamPhase === 'wind' ? -1.2 : Math.sin(this.bounceT * 5) * 0.25;
    drawArm(ctx, -w*0.50 + wind, -h*0.66 + bob, h*0.55, armSwing, this.def.uniform, this.def.armor, this.def.rivet, true);
    drawArm(ctx,  w*0.50 + wind, -h*0.66 + bob, h*0.55, -armSwing * 1.2, this.def.uniform, this.def.armor, this.def.rivet, false);

    // NECK + HEAD (helmet/mask) — drawn upright regardless of body flip
    ctx.save();
    if (this.facing < 0) ctx.scale(-1, 1);

    const headCx = 0;
    const headCy = -h * 0.78 - 50 + bob;
    drawIronMask(ctx, headCx, headCy, this.def, this.eyeShake, this.flash, this.phase);

    // phase-2 menace aura behind head
    if (this.phase === 2) {
      const auraR = 70 + Math.sin(this.bounceT * 6) * 4;
      const grad = ctx.createRadialGradient(headCx, headCy, 10, headCx, headCy, auraR);
      grad.addColorStop(0, 'rgba(255,122,26,0.55)');
      grad.addColorStop(1, 'rgba(255,122,26,0)');
      ctx.fillStyle = grad;
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillRect(headCx - auraR, headCy - auraR, auraR * 2, auraR * 2);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();

    // wind-up tell: red ground glow at his feet
    if (this.slamPhase === 'wind') {
      const t = 1 - (this.slamT / 0.55);
      ctx.fillStyle = `rgba(255,122,26,${0.25 + 0.4 * t})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.6, 14, 0, 0, Math.PI*2);
      ctx.fill();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

// --- helper drawers ---

function drawShoulder(ctx, x, y, armor, rivet, glow, side) {
  ctx.save();
  ctx.translate(x, y);
  // pad
  ctx.fillStyle = armor;
  ctx.beginPath();
  ctx.moveTo(-12, 0);
  ctx.lineTo(20, -6);
  ctx.lineTo(22, 12);
  ctx.lineTo(-10, 16);
  ctx.closePath();
  ctx.fill();
  // dark edge
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(-12, 14, 34, 2);
  // spikes (3 forward-pointing)
  ctx.fillStyle = '#cccccc';
  for (let i = 0; i < 3; i++) {
    const sx = 0 + i * 8;
    ctx.beginPath();
    ctx.moveTo(sx, -8);
    ctx.lineTo(sx + 4, -22);
    ctx.lineTo(sx + 8, -8);
    ctx.closePath();
    ctx.fill();
  }
  // rivets
  ctx.fillStyle = rivet;
  for (let i = 0; i < 3; i++) ctx.fillRect(-8 + i * 8, 8, 2, 2);
  // a single ember rivet
  ctx.fillStyle = glow;
  ctx.fillRect(16, 8, 3, 3);
  ctx.restore();
}

function drawArm(ctx, ox, oy, len, rot, sleeve, armor, rivet, isLead) {
  ctx.save();
  ctx.translate(ox, oy);
  ctx.rotate(rot);
  // sleeve
  ctx.fillStyle = sleeve;
  ctx.fillRect(-7, 0, 14, len * 0.55);
  // forearm wrap (dirty bandage)
  ctx.fillStyle = '#5a4a30';
  ctx.fillRect(-8, len * 0.55, 16, len * 0.20);
  // forearm thick
  ctx.fillStyle = '#1c1410';
  ctx.fillRect(-9, len * 0.55, 18, len * 0.20);
  // bandage stripes
  ctx.fillStyle = '#7a6a48';
  ctx.fillRect(-9, len * 0.62, 18, 2);
  ctx.fillRect(-9, len * 0.70, 18, 2);

  // gauntlet (steel block over fist)
  const fy = len * 0.78;
  ctx.fillStyle = armor;
  ctx.fillRect(-12, fy, 24, 18);
  // chain wrap
  ctx.fillStyle = rivet;
  for (let i = -10; i < 10; i += 4) {
    ctx.fillRect(i, fy - 2, 3, 2);
    ctx.fillRect(i, fy + 18, 3, 2);
  }
  // knuckle spikes (only on the lead/forward fist)
  if (isLead) {
    ctx.fillStyle = '#dddddd';
    for (let i = -8; i <= 8; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, fy + 18);
      ctx.lineTo(i + 3, fy + 26);
      ctx.lineTo(i + 6, fy + 18);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawIronMask(ctx, cx, cy, def, eyeShake, flash, phase) {
  ctx.save();
  ctx.translate(cx, cy);

  // back silhouette / neck shadow
  ctx.fillStyle = '#0a0a0e';
  ctx.beginPath();
  ctx.ellipse(0, 16, 56, 36, 0, 0, Math.PI*2);
  ctx.fill();

  // photo plate frame — riveted steel ring around the boss face photo
  const r = 50;
  ctx.fillStyle = flash > 0 ? '#ffffff' : def.armor;
  ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1a1a20';
  ctx.beginPath(); ctx.arc(0, 0, r + 2, 0, Math.PI*2); ctx.fill();

  // photo (boss-Lvl1.png) cropped into the circular plate
  const img = Assets.get('bossLvl1');
  ctx.save();
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.clip();
  // cover-fit the image inside the circle
  const aspect = img.width / Math.max(1, img.height);
  let dw, dh;
  if (aspect > 1) { dh = r * 2.4; dw = dh * aspect; }
  else { dw = r * 2.4; dh = dw / aspect; }
  ctx.drawImage(img, -dw/2, -dh/2 - 6, dw, dh);
  // moody darken overlay so the photo matches the night palette
  ctx.fillStyle = 'rgba(20,8,4,0.30)';
  ctx.fillRect(-r, -r, r*2, r*2);
  // phase-2 red wash
  if (phase === 2) {
    ctx.fillStyle = 'rgba(255,42,30,0.18)';
    ctx.fillRect(-r, -r, r*2, r*2);
  }
  // eye-glow accents — small embers over the eyes (no slit overlay; subtle)
  ctx.globalCompositeOperation = 'lighter';
  const sh = eyeShake > 0 ? (Math.random() - 0.5) * 2 : 0;
  const eg = ctx.createRadialGradient(-12 + sh, -10, 0, -12 + sh, -10, 14);
  eg.addColorStop(0, `rgba(255,122,26,${phase === 2 ? 0.85 : 0.55})`);
  eg.addColorStop(1, 'rgba(255,122,26,0)');
  ctx.fillStyle = eg;
  ctx.fillRect(-30, -28, 36, 28);
  const eg2 = ctx.createRadialGradient(12 + sh, -10, 0, 12 + sh, -10, 14);
  eg2.addColorStop(0, `rgba(255,122,26,${phase === 2 ? 0.85 : 0.55})`);
  eg2.addColorStop(1, 'rgba(255,122,26,0)');
  ctx.fillStyle = eg2;
  ctx.fillRect(-6, -28, 36, 28);
  ctx.globalCompositeOperation = 'source-over';
  // flash overlay when struck
  if (flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(-r, -r, r*2, r*2);
  }
  ctx.restore();

  // outer rivet ring
  ctx.fillStyle = def.rivet;
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
    const rx = Math.cos(a) * (r + 4);
    const ry = Math.sin(a) * (r + 4);
    ctx.fillRect(rx - 1.5, ry - 1.5, 3, 3);
  }
  // a single ember rivet at the bottom (phase indicator)
  ctx.fillStyle = def.glow;
  ctx.fillRect(-2, r + 3, 4, 4);

  // crown spikes on top — first-boss menace
  ctx.fillStyle = '#cccccc';
  for (let i = -2; i <= 2; i++) {
    const sx = i * 12;
    const baseY = -r;
    const tipY = baseY - 16 - (i === 0 ? 8 : 0);
    ctx.beginPath();
    ctx.moveTo(sx - 4, baseY);
    ctx.lineTo(sx, tipY);
    ctx.lineTo(sx + 4, baseY);
    ctx.closePath();
    ctx.fill();
  }
  // spike base band
  ctx.fillStyle = '#1a1a20';
  ctx.fillRect(-32, -r - 2, 64, 4);

  // phase-2 cracks across the steel ring
  if (phase === 2) {
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r - 4, -10);
    ctx.lineTo(-r + 4, 0);
    ctx.lineTo(-r - 2, 12);
    ctx.moveTo(r + 2, -8);
    ctx.lineTo(r - 6, 4);
    ctx.stroke();
  }

  ctx.restore();
}
