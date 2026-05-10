// Player entity. Uses /assets/characters/main-character.png as the avatar
// (sprite is drawn body-shaped; missing asset falls back to a procedural figure).

import { PHYSICS, integrate, applyHorizontal } from '../engine/physics.js';
import { resolveSolids } from '../engine/collision.js';
import { Input } from '../core/input.js';
import { Weapon } from './weapon.js';
import { Assets } from '../core/assets.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 56; this.h = 96;
    this.vx = 0; this.vy = 0;
    this.kbx = 0; this.kby = 0;
    this.facing = 1;
    this.grounded = false;
    this.coyote = 0;
    this.jumpsLeft = 2;
    this.jumpBuffer = 0;

    this.maxHealth = 3;
    this.health = 3;
    this.lives = 3;
    this.score = 0;
    this.coins = 0;

    this.invuln = 0;
    this.flash = 0;
    this.runT = 0;

    this.inventory = ['bat'];
    this.weaponIndex = 0;
    this.weapon = new Weapon('bat', this);

    this.dead = false;
    this.respawnPoint = { x, y };
    this.spawnEffectT = 0.6;

    Assets.loadImage('player', '/assets/characters/main-character.png', 'PLAYER');
  }

  pickupWeapon(id) {
    if (!this.inventory.includes(id)) {
      this.inventory.push(id);
      this.weaponIndex = this.inventory.length - 1;
      this.weapon = new Weapon(id, this);
    } else {
      // refill ammo
      const w = new Weapon(id, this);
      if (this.weapon.id === id) {
        this.weapon.ammo = w.ammo;
      } else {
        // swap to it and refill
        this.weaponIndex = this.inventory.indexOf(id);
        this.weapon = w;
      }
    }
  }

  cycleWeapon() {
    if (this.inventory.length < 2) return;
    this.weaponIndex = (this.weaponIndex + 1) % this.inventory.length;
    this.weapon = new Weapon(this.inventory[this.weaponIndex], this);
  }

  setSpawn(x, y) { this.respawnPoint = { x, y }; }

  takeDamage(amount, fromDir) {
    if (this.invuln > 0 || this.dead) return;
    this.health -= amount;
    this.invuln = 1.2;
    this.flash = 0.3;
    this.kbx = fromDir * 280;
    this.kby = -260;
    if (this.health <= 0) {
      this.lives--;
      this.health = this.maxHealth;
      this.dead = (this.lives < 0);
      if (!this.dead) {
        this.x = this.respawnPoint.x;
        this.y = this.respawnPoint.y;
        this.vx = this.vy = this.kbx = this.kby = 0;
        this.invuln = 1.5;
        this.spawnEffectT = 0.6;
      }
    }
  }

  update(dt, world) {
    if (this.dead) return;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.flash > 0) this.flash -= dt;
    if (this.spawnEffectT > 0) this.spawnEffectT -= dt;
    this.weapon.update(dt);

    // input
    const left = Input.held('left'), right = Input.held('right');
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) this.facing = dir;
    applyHorizontal(this, dir, this.grounded, dt);

    // jump buffering + coyote
    if (Input.pressed('jump')) this.jumpBuffer = 0.12;
    if (this.jumpBuffer > 0) this.jumpBuffer -= dt;
    if (this.coyote > 0) this.coyote -= dt;

    if (this.jumpBuffer > 0) {
      if (this.grounded || this.coyote > 0) {
        this.vy = PHYSICS.jumpVel;
        this.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumpsLeft = 1;
        world.audio.play('jump');
      } else if (this.jumpsLeft > 0) {
        this.vy = PHYSICS.doubleJumpVel;
        this.jumpsLeft = 0;
        this.jumpBuffer = 0;
        world.particles.burst(this.x + this.w/2, this.y + this.h, {
          count: 14, speed: 200, life: 0.4,
          colors: ['#22e1ff', '#ffffff'], gravity: 0, size: 3,
          angle: -Math.PI/2, angleSpread: 0.7, lift: 60,
        });
        world.audio.play('jump');
      }
    }

    // attack / swap
    if (Input.held('attack')) {
      // for rapid weapons just hold; for others canAttack guards cooldown
      this.weapon.attack(world);
    } else if (Input.pressed('attack')) {
      this.weapon.attack(world);
    }
    if (Input.pressed('swap')) this.cycleWeapon();

    // physics
    const prevX = this.x, prevY = this.y;
    integrate(this, dt);
    const wasGrounded = this.grounded;
    resolveSolids(this, world.solids, prevX, prevY);
    if (!this.grounded && wasGrounded) this.coyote = 0.1;
    if (this.grounded) this.jumpsLeft = 1;

    // run animation timing
    if (this.grounded && Math.abs(this.vx) > 20) this.runT += dt * (Math.abs(this.vx) / 240);
    else this.runT *= 0.92;

    // wind / fog modifiers
    for (const z of (world.zones || [])) {
      if (z.x < this.x + this.w && z.x + z.w > this.x && z.y < this.y + this.h && z.y + z.h > this.y) {
        if (z.kind === 'wind') this.vx += z.force * dt;
      }
    }

    // hazards check
    for (const h of (world.hazards || [])) {
      if (h.x < this.x + this.w && h.x + h.w > this.x && h.y < this.y + this.h && h.y + h.h > this.y) {
        if (h.kind === 'spike' || h.kind === 'roll' || h.kind === 'pendulum') {
          if (!h.armed && h.armed !== undefined) continue;
          this.takeDamage(1, this.x < h.x ? -1 : 1);
        }
        if (h.kind === 'mushroom' && this.vy >= 0 && prevY + this.h <= h.y + 4) {
          this.vy = -900;
          this.grounded = false;
          this.jumpsLeft = 1;
          world.particles.burst(this.x + this.w/2, this.y + this.h, {
            count: 16, speed: 240, life: 0.4, colors: ['#ff2a55','#ffcc33','#ffffff'],
            gravity: 200, size: 3,
          });
          world.audio.play('jump');
        }
      }
    }

    // pickups
    for (const c of world.crates) {
      if (c.taken) continue;
      if (c.x < this.x + this.w && c.x + c.w > this.x && c.y < this.y + this.h && c.y + c.h > this.y) {
        c.taken = true;
        this.pickupWeapon(c.weaponId);
        world.particles.burst(c.x + c.w/2, c.y + c.h/2, {
          count: 24, speed: 320, life: 0.7,
          colors: ['#ffcc33','#ffffff','#22e1ff'], gravity: 200, size: 4,
        });
        world.audio.play('pickup');
        this.score += 50;
      }
    }
    for (const cn of world.coins) {
      if (cn.taken) continue;
      if (cn.x < this.x + this.w && cn.x + 12 > this.x && cn.y < this.y + this.h && cn.y + 12 > this.y) {
        cn.taken = true;
        this.coins++;
        this.score += 10;
        world.particles.burst(cn.x + 6, cn.y + 6, { count: 8, speed: 140, life: 0.4,
          colors: ['#ffcc33','#ffffff'], gravity: 200, size: 3 });
        world.audio.play('pickup');
      }
    }

    // fell off world
    if (this.y > world.bounds.h + 200) {
      this.takeDamage(99, 0);
    }
  }

  draw(ctx) {
    const flicker = (this.invuln > 0 && Math.floor(this.invuln * 20) % 2 === 0);
    const px = this.x, py = this.y;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(px + this.w/2, py + this.h - 1, this.w/2 + 4, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // spawn-in shimmer
    if (this.spawnEffectT > 0) {
      const a = this.spawnEffectT / 0.6;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#22e1ff';
      ctx.fillRect(px - 4, py - 4, this.w + 8, this.h + 8);
      ctx.globalAlpha = 1;
    }

    if (flicker) return;

    const img = Assets.get('player');
    const isReal = Assets.isReal('player');

    ctx.save();
    ctx.translate(px + this.w/2, py + this.h);
    if (this.facing < 0) ctx.scale(-1, 1);

    // bobbing
    const bob = this.grounded ? Math.sin(this.runT * 8) * 1.5 : 0;
    const tilt = this.grounded ? 0 : (this.vy < 0 ? -0.05 : 0.06);
    ctx.rotate(tilt);

    if (isReal) {
      // draw the real character image, fit to body box
      const drawH = this.h + 6;
      const aspect = img.width / img.height;
      const drawW = drawH * aspect;
      if (this.flash > 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, -drawW/2, -drawH + bob, drawW, drawH);
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(-drawW/2, -drawH + bob, drawW, drawH);
        ctx.globalCompositeOperation = 'source-over';
      } else {
        ctx.drawImage(img, -drawW/2, -drawH + bob, drawW, drawH);
      }
    } else {
      // procedural fallback figure
      this._drawProcedural(ctx, bob);
    }

    // weapon held in hand
    ctx.scale(this.facing < 0 ? -1 : 1, 1); // un-flip so weapon faces right relative to facing
    this.weapon.drawHeld(ctx, 0 + this.facing * 6, -this.h/2 + 4 + bob, this.facing);
    ctx.restore();
  }

  _drawProcedural(ctx, bob) {
    // body
    ctx.fillStyle = '#ff2a55';
    ctx.fillRect(-12, -50 + bob, 24, 30);
    // pants
    ctx.fillStyle = '#0e0e1a';
    ctx.fillRect(-12, -22 + bob, 10, 22);
    ctx.fillRect(2, -22 + bob, 10, 22);
    // head
    ctx.fillStyle = '#f3c79b';
    ctx.fillRect(-10, -68 + bob, 20, 20);
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(-10, -68 + bob, 20, 6);
    // eye
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(2, -56 + bob, 4, 3);
  }
}
