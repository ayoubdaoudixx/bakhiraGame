// Weapon: takes a config and an owner, runs an attack lifecycle (cooldown, ammo, spawn projectiles or melee hits).

import { Projectile } from './projectile.js';
import { WEAPONS } from '../config/weapons.js';

export class Weapon {
  constructor(id, owner) {
    this.def = WEAPONS[id];
    if (!this.def) throw new Error('Unknown weapon ' + id);
    this.id = id;
    this.owner = owner;
    this.ammo = this.def.ammo;
    this.cooldown = 0;
    this.swingT = 0;       // melee animation time
  }

  get name() { return this.def.name; }
  get color() { return this.def.color; }
  get isInfinite() { return !isFinite(this.ammo); }

  update(dt) {
    if (this.cooldown > 0) this.cooldown -= dt;
    if (this.swingT > 0) this.swingT -= dt;
  }

  canAttack() {
    return this.cooldown <= 0 && (this.isInfinite || this.ammo > 0);
  }

  attack(world) {
    if (!this.canAttack()) return false;
    const o = this.owner;
    const facing = o.facing;
    const def = this.def;
    this.cooldown = def.cooldown;
    if (!this.isInfinite) this.ammo = Math.max(0, this.ammo - 1);

    const cx = o.x + o.w / 2;
    const cy = o.y + o.h / 2 - 4;

    if (def.type === 'melee') {
      this.swingT = def.cooldown * 0.9;
      const reach = def.swing.reach;
      const hit = {
        x: facing > 0 ? cx : cx - reach,
        y: cy - 22,
        w: reach,
        h: 56,
      };
      // damage anything inside
      for (const e of (world.enemies || [])) {
        if (e.dead) continue;
        if (rectsOverlap(hit, e)) e.takeHit(def.damage, facing * 320);
      }
      if (world.boss && !world.boss.dead && rectsOverlap(hit, world.boss)) {
        world.boss.takeHit(def.damage, facing * 200);
      }
      world.particles.burst(facing > 0 ? o.x + o.w + 10 : o.x - 10, cy - 6, {
        count: 8, speed: 220, life: 0.3, colors: [def.color, '#ffffff'], gravity: 200, size: 3,
      });
      world.audio.play('hit');
      return true;
    }

    if (def.type === 'projectile' || def.type === 'rapid' || def.type === 'boomerang' || def.type === 'homing') {
      const p = def.projectile;
      let angle = 0;
      if (def.type === 'rapid' && p.spread) angle += (Math.random() * 2 - 1) * p.spread;
      const sp = p.speed;
      const vx = Math.cos(angle) * sp * facing;
      const vy = Math.sin(angle) * sp - (def.type === 'projectile' ? 220 : 0);
      const proj = new Projectile({
        x: cx + facing * 18,
        y: cy - 4,
        vx, vy,
        radius: p.radius,
        lifetime: p.lifetime,
        gravity: p.gravity || 0,
        damage: def.damage,
        team: 'player',
        kind: p.sprite || 'bullet',
        color: def.color,
        owner: o,
        explode: p.explode || (def.type === 'projectile' && def.id === 'explodingBoot' ? def.projectile.explode : null),
        boomerang: def.type === 'boomerang',
        homing: def.type === 'homing' ? p.turn : 0,
      });
      world.projectiles.push(proj);
      world.audio.play(def.type === 'projectile' ? 'shoot' : 'shoot');
      return true;
    }

    if (def.type === 'aoe') {
      const r = def.aoe.radius;
      world.particles.burst(cx, cy, {
        count: 40, speed: 420, life: 0.6,
        colors: [def.aoe.color, '#ffffff'], gravity: 0, size: 4,
      });
      // ring
      world.particles.spawn({
        x: cx, y: cy, vx: 0, vy: 0, life: 0.4, max: 0.4,
        size: r * 2, color: def.aoe.color, gravity: 0, shape: 'circle',
        rot: 0, vrot: 0, _ring: true,
      });
      for (const e of (world.enemies || [])) {
        if (e.dead) continue;
        const dx = (e.x + e.w/2) - cx, dy = (e.y + e.h/2) - cy;
        if (dx*dx + dy*dy < r*r) {
          e.takeHit(def.damage, Math.sign(dx) * 280);
          e.stunT = Math.max(e.stunT || 0, def.aoe.stunTime);
        }
      }
      if (world.boss && !world.boss.dead) {
        const dx = (world.boss.x + world.boss.w/2) - cx, dy = (world.boss.y + world.boss.h/2) - cy;
        if (dx*dx + dy*dy < r*r) world.boss.takeHit(def.damage, Math.sign(dx) * 160);
      }
      world.camera.shake(8, 0.25);
      world.audio.play('boom');
      return true;
    }

    return false;
  }

  // Draw melee swing arc / weapon held in hand. Called from player draw.
  drawHeld(ctx, ox, oy, facing) {
    const def = this.def;
    if (def.type === 'melee' && this.swingT > 0) {
      // bright slash arc
      const t = 1 - this.swingT / Math.max(0.01, def.cooldown);
      ctx.save();
      ctx.translate(ox, oy - 8);
      ctx.rotate((facing > 0 ? -1 : 1) * (t * 1.6 - 0.8));
      ctx.fillStyle = def.color;
      ctx.globalAlpha = 0.85;
      const r = def.swing.reach * (0.6 + 0.4 * t);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -0.6, 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    // weapon icon held in hand
    drawWeaponIcon(ctx, def.icon, ox + facing * 14, oy - 6, facing, def.color);
  }
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function drawWeaponIcon(ctx, icon, x, y, facing = 1, color = '#ffcc33', size = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * size, size);
  switch (icon) {
    case 'finger':
      ctx.fillStyle = '#ff2a55';
      ctx.fillRect(0, -6, 22, 10);
      ctx.beginPath(); ctx.arc(22, -1, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, -4, 12, 2);
      break;
    case 'boot':
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(0, -4, 22, 8);
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, 2, 24, 3);
      ctx.fillStyle = '#ffcc33';
      ctx.fillRect(0, -6, 5, 3);
      break;
    case 'card':
      ctx.fillStyle = '#ff2a55';
      ctx.fillRect(0, -10, 12, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, -8, 4, 16);
      break;
    case 'whistle':
      ctx.fillStyle = '#22e1ff';
      ctx.fillRect(0, -4, 18, 8);
      ctx.beginPath(); ctx.arc(18, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -2, 4, 4);
      break;
    case 'confetti':
      ctx.fillStyle = '#ffcc33';
      ctx.beginPath();
      ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.lineTo(20, 0); ctx.closePath();
      ctx.fill();
      break;
    case 'cleat':
      ctx.fillStyle = '#22e1ff';
      ctx.fillRect(0, -3, 22, 7);
      for (let i = 2; i < 22; i += 4) {
        ctx.fillStyle = '#22e1ff';
        ctx.fillRect(i, 4, 2, 3);
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, -2, 4, 2);
      break;
    case 'bat':
      // grip
      ctx.fillStyle = '#1a1208';
      ctx.fillRect(0, -3, 8, 6);
      // grip tape stripes
      ctx.fillStyle = '#3a2a14';
      ctx.fillRect(2, -3, 1, 6);
      ctx.fillRect(5, -3, 1, 6);
      // knob
      ctx.fillStyle = '#c89466';
      ctx.fillRect(-2, -4, 3, 8);
      // barrel — tapered wood
      ctx.fillStyle = '#c89466';
      ctx.beginPath();
      ctx.moveTo(8, -4);
      ctx.lineTo(36, -7);
      ctx.lineTo(36, 7);
      ctx.lineTo(8, 4);
      ctx.closePath();
      ctx.fill();
      // wood grain highlight
      ctx.fillStyle = '#e0b080';
      ctx.fillRect(10, -3, 22, 1);
      // dark scuffs
      ctx.fillStyle = '#7a5430';
      ctx.fillRect(20, 2, 3, 1);
      ctx.fillRect(28, -1, 4, 1);
      break;
    case 'fist':
    default:
      ctx.fillStyle = color;
      ctx.fillRect(0, -6, 14, 12);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, -4, 4, 2);
      break;
  }
  ctx.restore();
}
