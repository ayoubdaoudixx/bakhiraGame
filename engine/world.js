// Runtime world: turns level config into mutable hazards/movers + updates them per frame.
// Owns: solids, hazards, zones, crates, coins, projectiles.

import { Enemy } from '../entities/enemy.js';
import { getEnemyDef } from '../config/enemies.js';
import { Particles } from './particles.js';

export class World {
  constructor(level, audio, camera) {
    this.level = level;
    this.audio = audio;
    this.camera = camera;
    this.bounds = level.bounds;
    this.particles = new Particles();
    this.projectiles = [];
    this.player = null;
    this.boss = null;

    // Static platforms (clone so we don't mutate config).
    this.staticSolids = level.platforms.map(p => ({ ...p }));

    // Movers (oscillating platforms). Each is itself a solid that we update.
    this.movers = level.movers.map(m => ({
      ...m, oneWay: false, kind: 'mover',
      origin: { x: m.x, y: m.y },
      t: Math.random() * Math.PI * 2,
    }));

    // Crumblers — start solid, after a step-on timer they fall and disappear.
    this.crumblers = level.crumblers.map(c => ({
      ...c, oneWay: true, kind: 'crumbler',
      state: 'idle', timer: 0, vy: 0, originY: c.y, taken: false,
    }));

    // Hazards — copy and add runtime flags.
    this.hazards = level.hazards.map(h => {
      const o = { ...h, t: 0 };
      if (h.kind === 'roll') {
        o.startX = h.x;
      }
      if (h.kind === 'pendulum') {
        o.angle = 0;
      }
      if (h.kind === 'popSpike') {
        o.armed = false;
        o.t = h.phase || 0;
      }
      return o;
    });

    this.zones = level.zones.map(z => ({ ...z }));

    // Enemies
    this.enemies = level.enemies.map(e => {
      const def = getEnemyDef(e.id);
      return new Enemy(def, e.x, e.y, {
        patrolMin: e.patrolMin,
        patrolMax: e.patrolMax,
        audioAppear: e.audioAppear,
        audioDefeat: e.audioDefeat
      });
    });

    // Crates
    this.crates = level.crates.map(c => ({
      ...c, w: 32, h: 32, taken: false,
      weaponId: c.weaponPool[Math.floor(Math.random() * c.weaponPool.length)],
      bob: Math.random() * Math.PI * 2,
    }));

    // Coins
    this.coins = level.coins.map(c => ({ ...c, w: 12, h: 12, taken: false, t: Math.random()*Math.PI*2 }));

    this.goal = { ...level.goal };
    this.bossSpawn = { ...level.bossSpawn };
    this.bossTriggerX = level.bossTriggerX;
    this.goalReached = false;

    // ── Boss arena gate state ──
    // The gate is a solid wall that only collides once the player has crossed
    // the trigger line. closing/closed/open are visual + collision states.
    this.arena = level.arena ? { ...level.arena } : null;
    this.gate = level.gate ? {
      ...level.gate, oneWay: false, kind: 'gate',
      state: 'open',          // 'open' | 'closing' | 'closed'
      closeT: 0,              // animation progress 0..1
      yClosed: level.gate.y,
      yOpen: level.gate.y + level.gate.h, // drops below the world when open
    } : null;
    this.backwall = level.backwall ? { ...level.backwall, oneWay: false, kind: 'backwall' } : null;
    this.inBossArena = false; // true once gate locks the player in
  }

  // Combined collidable surfaces for collision module.
  get solids() {
    const out = [];
    for (const s of this.staticSolids) out.push(s);
    for (const m of this.movers) out.push(m);
    for (const c of this.crumblers) if (c.state !== 'gone') out.push(c);
    // The gate becomes solid the moment it starts closing (player gets locked in).
    if (this.gate && this.gate.state !== 'open') out.push(this.gate);
    // The back-wall is always solid (so the boss can't escape off the right).
    if (this.backwall) out.push(this.backwall);
    return out;
  }

  setPlayer(p) { this.player = p; }
  setBoss(b) { this.boss = b; }

  spawnCoin(x, y) { this.coins.push({ x, y, w: 12, h: 12, taken: false, t: 0, vy: -300 + Math.random()*-80, vx: (Math.random()-.5)*120 }); }
  spawnCrate(x, y, weaponId) {
    this.crates.push({ x, y, w: 32, h: 32, taken: false, weaponId, bob: 0, vy: -220 });
  }

  update(dt) {
    // movers
    for (const m of this.movers) {
      m.t += dt;
      const off = Math.sin(m.t * (m.speed / m.range)) * m.range;
      const prev = { x: m.x, y: m.y };
      if (m.axis === 'x') m.x = m.origin.x + off;
      else m.y = m.origin.y + off;
      m.dx = m.x - prev.x;
      m.dy = m.y - prev.y;
      // carry player if standing on mover
      const p = this.player;
      if (p && p.standingOn === m && p.grounded) {
        p.x += m.dx;
        p.y += m.dy;
      }
    }

    // crumblers
    for (const c of this.crumblers) {
      if (c.state === 'idle') {
        const p = this.player;
        if (p && p.grounded && p.standingOn === c) {
          c.state = 'shake';
          c.timer = 0.5;
        }
      } else if (c.state === 'shake') {
        c.timer -= dt;
        if (c.timer <= 0) { c.state = 'fall'; c.vy = 0; }
      } else if (c.state === 'fall') {
        c.vy += 1400 * dt;
        c.y += c.vy * dt;
        if (c.y > this.bounds.h + 100) c.state = 'gone';
      }
    }

    // hazards
    for (const h of this.hazards) {
      h.t += dt;
      if (h.kind === 'roll') {
        h.x += h.dir * h.speed * dt;
        if (h.x > h.startX + h.range) { h.x = h.startX + h.range; h.dir = -1; }
        if (h.x < h.startX) { h.x = h.startX; h.dir = 1; }
      } else if (h.kind === 'popSpike') {
        const phase = (h.t / h.period) % 1;
        h.armed = phase > 0.4 && phase < 0.85;
      } else if (h.kind === 'pendulum') {
        h.angle = Math.sin((h.t + h.phase) * (Math.PI * 2 / h.period)) * 0.9;
        // compute the head's box for collision
        const hx = h.x + Math.sin(h.angle) * h.length;
        const hy = h.y + Math.cos(h.angle) * h.length;
        h.headX = hx - h.head;
        h.headY = hy - h.head;
        h.headW = h.head * 2;
        h.headH = h.head * 2;
      }
    }

    // zones (no internal animation needed; players & projectiles read them)

    // crates bob
    for (const c of this.crates) c.bob += dt;

    // floating coins integrate (those that were spawned with vy)
    for (const c of this.coins) {
      c.t += dt;
      if (c.vy != null) {
        c.vy += 1200 * dt;
        c.x += (c.vx || 0) * dt;
        c.y += c.vy * dt;
        // settle on ground
        for (const s of this.staticSolids) {
          if (c.x > s.x && c.x < s.x + s.w && c.y > s.y - 12 && c.y < s.y + 4) {
            c.y = s.y - 12; c.vy = null; c.vx = 0; break;
          }
        }
      }
    }

    // projectiles
    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // projectiles vs player (enemy team)
    const p = this.player;
    if (p && p.invuln <= 0 && !p.dead) {
      for (const pr of this.projectiles) {
        if (pr.team !== 'enemy') continue;
        const dx = (p.x + p.w/2) - pr.x;
        const dy = (p.y + p.h/2) - pr.y;
        if (dx*dx + dy*dy < (pr.r + 22) * (pr.r + 22)) {
          p.takeDamage(pr.damage, p.x < pr.x ? -1 : 1);
          pr.dead = true;
          if (pr.explode) pr._doExplosion(this);
        }
      }
    }
    // projectiles vs enemies (player team direct hits)
    for (const pr of this.projectiles) {
      if (pr.team !== 'player' || pr.dead) continue;
      // direct hits already handled by explode at end of life; for non-explosive, hit on contact
      if (pr.explode) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (pr.x > e.x && pr.x < e.x + e.w && pr.y > e.y && pr.y < e.y + e.h) {
          e.takeHit(pr.damage, Math.sign(pr.vx) || 1);
          pr.dead = true;
          break;
        }
      }
      if (this.boss && !this.boss.dead && !pr.dead) {
        if (pr.x > this.boss.x && pr.x < this.boss.x + this.boss.w &&
            pr.y > this.boss.y && pr.y < this.boss.y + this.boss.h) {
          this.boss.takeHit(pr.damage, Math.sign(pr.vx) || 1);
          pr.dead = true;
        }
      }
    }

    // pendulum head collides with player
    for (const h of this.hazards) {
      if (h.kind !== 'pendulum') continue;
      if (!p || p.dead || p.invuln > 0) continue;
      if (p.x < h.headX + h.headW && p.x + p.w > h.headX &&
          p.y < h.headY + h.headH && p.y + p.h > h.headY) {
        p.takeDamage(1, p.x < h.headX ? -1 : 1);
        this.camera.shake(8, 0.2);
      }
    }

    // particles
    this.particles.update(dt);

    // enemy death drops
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (e.dead && e.deathT <= 0) {
        // Defeat narration only — the "between-enemies" bridge is muted for
        // this iteration. We'll re-add it once the enemy1 flow is verified.
        if (e.audioDefeat && this.audio && this.audio.playSequential) {
          this.audio.playSequential(e.audioDefeat);
        }
        // drop coin or crate randomly
        if (Math.random() < 0.4) {
          this.spawnCrate(e.x + e.w/2 - 16, e.y + 10, this.crates[0]?.weaponId ? randomFromPool() : randomFromPool());
        } else {
          for (let k = 0; k < 3; k++) this.spawnCoin(e.x + e.w/2 + (Math.random()-.5)*20, e.y + 10);
        }
        if (this.player) this.player.score += 100;
        this.enemies.splice(i, 1);
      }
    }

    // boss trigger — also slams the arena gate shut behind the player.
    if (!this.boss && this.player && this.player.x > this.bossTriggerX) {
      this.bossPending = true;
      if (this.gate && this.gate.state === 'open') {
        this.gate.state = 'closing';
        this.gate.closeT = 0;
        this.inBossArena = true;
        if (this.camera) this.camera.shake(10, 0.4);
        if (this.audio) this.audio.play('boom');
      }
    }

    // gate close animation: slide up from below into place over ~0.45s.
    if (this.gate && this.gate.state === 'closing') {
      this.gate.closeT = Math.min(1, this.gate.closeT + dt / 0.45);
      const t = this.gate.closeT;
      // ease-out cubic so it slams home
      const eased = 1 - Math.pow(1 - t, 3);
      this.gate.y = this.gate.yOpen + (this.gate.yClosed - this.gate.yOpen) * eased;
      if (t >= 1) {
        this.gate.state = 'closed';
        this.gate.y = this.gate.yClosed;
        if (this.camera) this.camera.shake(12, 0.25);
        if (this.audio) this.audio.play('boom');
      }
    }
  }

  isOnPendulum(rect, h) { return rect.x < h.headX + h.headW && rect.x + rect.w > h.headX && rect.y < h.headY + h.headH && rect.y + rect.h > h.headY; }

  draw(ctx) {
    // platforms
    for (const s of this.staticSolids) drawPlatform(ctx, s);
    for (const m of this.movers) drawPlatform(ctx, m, true);
    for (const c of this.crumblers) {
      if (c.state === 'gone') continue;
      const shake = c.state === 'shake' ? (Math.random() * 2 - 1) * 2 : 0;
      drawPlatform(ctx, { ...c, x: c.x + shake }, false, true);
    }

    // Boss arena framing — drawn behind everything else so platforms read over it.
    if (this.arena) drawArenaFraming(ctx, this.arena);

    // hazards
    for (const h of this.hazards) drawHazard(ctx, h);

    // zones
    for (const z of this.zones) drawZone(ctx, z);

    // Boss-arena gate (always drawn — visually rises when closing).
    if (this.gate) drawGate(ctx, this.gate);

    // goal
    drawGoal(ctx, this.goal);

    // crates
    for (const c of this.crates) {
      if (c.taken) continue;
      // gravity for spawned crates
      if (c.vy != null) {
        c.vy += 1400 * (1/60); // approximate; will be smoothed by re-renders
        c.y += c.vy * (1/60);
        for (const s of this.staticSolids) {
          if (c.x + c.w > s.x && c.x < s.x + s.w && c.y + c.h > s.y && c.y < s.y + 4) {
            c.y = s.y - c.h; c.vy = null; break;
          }
        }
      }
      drawCrate(ctx, c);
    }

    // coins
    for (const c of this.coins) {
      if (c.taken) continue;
      drawCoin(ctx, c);
    }

    // particles
    this.particles.draw(ctx);

    // projectiles
    for (const p of this.projectiles) p.draw(ctx);
  }
}

function randomFromPool() {
  const pool = ['foamFinger','explodingBoot','boomerang','whistle','confetti','magicCleat'];
  return pool[Math.floor(Math.random() * pool.length)];
}

// ───────────────────────────────────────────────────────────────────────────
// Forest terrain rendering — chunky mossy-earth blocks (Cactus McCoy style).
// ───────────────────────────────────────────────────────────────────────────

// Cheap deterministic PRNG seeded from an integer.
function seededRng(seed) {
  let a = (seed | 0) || 1;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function drawPlatform(ctx, s, mover = false, crumbler = false) {
  // One-way pass-through platforms render as wooden plank / branch.
  if (s.oneWay && !mover && !crumbler) {
    drawWoodenPlank(ctx, s);
    return;
  }
  // Movers (floating mushroom-cap platforms across the gorge).
  if (mover) {
    drawMushroomMover(ctx, s);
    return;
  }
  // The chunky earth blocks — main terrain.
  drawEarthBlock(ctx, s, crumbler);
}

// Big chunky forest-earth slab with mossy crust, wavy top edge, decorations,
// and dripping roots from the underside of cliffs.
function drawEarthBlock(ctx, s, crumbler) {
  const seed = ((s.x * 73856093) ^ (s.y * 19349663) ^ (s.w * 83492791)) >>> 0;
  const rng  = seededRng(seed);

  // ── Body: dark forest soil with vertical streak shading ──
  const body = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
  if (crumbler) {
    body.addColorStop(0.0, '#5a3a20');
    body.addColorStop(1.0, '#1a1008');
  } else {
    body.addColorStop(0.0, '#4a3220');
    body.addColorStop(0.4, '#33220e');
    body.addColorStop(1.0, '#160d04');
  }
  ctx.fillStyle = body;
  ctx.fillRect(s.x, s.y, s.w, s.h);

  // vertical streaks (dirt drip / cliff texture)
  ctx.save();
  ctx.globalAlpha = 0.16;
  for (let i = 0; i < Math.floor(s.w / 22); i++) {
    const lx = s.x + 4 + i * 22 + rng() * 6;
    const lh = 30 + rng() * Math.max(20, s.h * 0.5);
    ctx.fillStyle = rng() > 0.5 ? '#1a0d04' : '#5a3818';
    ctx.fillRect(lx, s.y + 16, 2, lh);
  }
  ctx.restore();

  // pebbles embedded in dirt
  ctx.save();
  ctx.globalAlpha = 0.5;
  const pebbleCount = Math.floor(s.w * s.h / 6000);
  for (let i = 0; i < pebbleCount; i++) {
    const px = s.x + 8 + rng() * (s.w - 16);
    const py = s.y + 22 + rng() * (s.h - 28);
    const r = 1 + rng() * 2.2;
    ctx.fillStyle = rng() > 0.5 ? '#5a4628' : '#2a1c0e';
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // ── Side bevels (light left edge, dark right edge for form) ──
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.fillRect(s.x + s.w - 4, s.y + 14, 4, s.h - 14);
  ctx.fillStyle = 'rgba(255,220,160,0.06)';
  ctx.fillRect(s.x, s.y + 14, 3, s.h - 14);

  // ── Mossy CRUST on top — wavy organic edge with grass tufts ──
  const crustH = crumbler ? 10 : 18;
  drawMossCrust(ctx, s.x, s.y, s.w, crustH, rng, crumbler);

  // ── Decorations on top: grass tufts, ferns, mushrooms, twigs ──
  drawTerrainDecor(ctx, s, rng);

  // ── Roots dangling from the underside if this is a real cliff (tall block) ──
  if (s.h > 120) drawHangingRoots(ctx, s, rng);
}

// Mossy green crust band with an irregular wavy top.
function drawMossCrust(ctx, x, y, w, h, rng, crumbler) {
  // Underlying dark mud line (cracked-earth border between moss and body).
  ctx.fillStyle = '#221504';
  ctx.fillRect(x, y + h - 3, w, 3);

  // Main moss gradient.
  const grad = ctx.createLinearGradient(0, y - 4, 0, y + h);
  if (crumbler) {
    grad.addColorStop(0, '#a0843a');
    grad.addColorStop(1, '#5a4218');
  } else {
    grad.addColorStop(0.0, '#94c44a');  // bright moss top
    grad.addColorStop(0.6, '#5a8628');  // forest green
    grad.addColorStop(1.0, '#2e4a18');  // dark moss base
  }

  // Build a wavy top edge — segments every 12 px, slight upward bumps.
  const path = new Path2D();
  path.moveTo(x, y + h);
  // top edge with small upward bumps (height never goes above y)
  const seg = 14;
  let cx = x;
  path.lineTo(cx, y + 2);
  while (cx < x + w) {
    const bumpW = seg + rng() * 6;
    const bumpDepth = rng() * 5;     // dips down inside the crust
    path.lineTo(Math.min(cx + bumpW * 0.5, x + w), y + 2 + bumpDepth);
    cx += bumpW;
    path.lineTo(Math.min(cx, x + w), y + 2);
  }
  path.lineTo(x + w, y + h);
  path.closePath();

  ctx.fillStyle = grad;
  ctx.fill(path);

  // Highlight line right at the very top of the crust (catches the dawn light).
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#c4ec74';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y + 2);
  let xx = x;
  while (xx < x + w) {
    const bumpW = seg + (((xx * 31) % 9));
    const bumpDip = 1 + ((xx * 17) % 4);
    ctx.lineTo(xx + bumpW * 0.5, y + 2 + bumpDip);
    xx += bumpW;
    ctx.lineTo(xx, y + 2);
  }
  ctx.stroke();
  ctx.restore();

  // Small lighter moss specks scattered across the crust.
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < Math.floor(w / 18); i++) {
    const px = x + 4 + rng() * (w - 8);
    const py = y + 4 + rng() * (h - 6);
    ctx.fillStyle = rng() > 0.5 ? '#b8e060' : '#7a9c30';
    ctx.fillRect(px, py, 2, 1);
  }
  ctx.restore();
}

// Grass tufts + ferns + tiny mushrooms scattered along the top crust.
function drawTerrainDecor(ctx, s, rng) {
  const count = Math.max(2, Math.floor(s.w / 90));
  for (let i = 0; i < count; i++) {
    const dx = s.x + 14 + rng() * (s.w - 28);
    const dy = s.y; // top edge
    const r = rng();
    if (r < 0.55)       drawGrassTuft(ctx, dx, dy, 6 + rng() * 6);
    else if (r < 0.80)  drawFern(ctx, dx, dy, 10 + rng() * 8);
    else if (r < 0.93)  drawMiniMushroom(ctx, dx, dy, rng() > 0.5);
    else                drawTwig(ctx, dx, dy);
  }
}

function drawGrassTuft(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#74a832';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-3, 0); ctx.lineTo(-2, -size);
  ctx.moveTo( 0, 0); ctx.lineTo( 1, -size - 2);
  ctx.moveTo( 3, 0); ctx.lineTo( 4, -size + 1);
  ctx.stroke();
  ctx.strokeStyle = '#94d048';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-1, 0); ctx.lineTo(0, -size + 2);
  ctx.moveTo( 2, 0); ctx.lineTo( 3, -size);
  ctx.stroke();
  ctx.restore();
}

function drawFern(ctx, x, y, h) {
  ctx.save();
  ctx.translate(x, y);
  // central stem
  ctx.strokeStyle = '#3a5a18';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-3, -h * 0.5, -2, -h);
  ctx.stroke();
  // leaflets
  ctx.fillStyle = '#5a8628';
  for (let i = 1; i <= 4; i++) {
    const ly = -h * (i / 5);
    const lx = (i % 2 === 0) ? -5 : 2;
    ctx.beginPath();
    ctx.ellipse(lx, ly, 4, 1.6, (i % 2 ? -0.4 : 0.4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawMiniMushroom(ctx, x, y, redCap) {
  ctx.save();
  ctx.translate(x, y);
  // stem
  ctx.fillStyle = '#e8d8b8';
  ctx.fillRect(-2, -7, 4, 7);
  // cap
  ctx.fillStyle = redCap ? '#c8323a' : '#704a28';
  ctx.beginPath();
  ctx.ellipse(0, -8, 6, 4, 0, Math.PI, 0);
  ctx.fill();
  // spots
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-2, -8, 1, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc( 2, -7, 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTwig(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = '#3a2a14';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 1);
  ctx.lineTo(x + 5, y - 2);
  ctx.moveTo(x - 2, y - 1);
  ctx.lineTo(x - 3, y - 4);
  ctx.stroke();
  ctx.restore();
}

// Roots dangling from the underside of a tall cliff block.
function drawHangingRoots(ctx, s, rng) {
  ctx.save();
  ctx.strokeStyle = '#2a1a0a';
  ctx.lineWidth = 2;
  const count = Math.max(2, Math.floor(s.w / 80));
  for (let i = 0; i < count; i++) {
    const x = s.x + 12 + rng() * (s.w - 24);
    const len = 20 + rng() * 60;
    ctx.beginPath();
    ctx.moveTo(x, s.y + s.h);
    ctx.bezierCurveTo(x - 6, s.y + s.h + len * 0.4, x + 8, s.y + s.h + len * 0.7, x + 2, s.y + s.h + len);
    ctx.stroke();
  }
  ctx.restore();
}

// Background trees growing up from each platform (drawn BEHIND platforms).
function drawBackgroundTrees(ctx, s) {
  // Only meaningful for the main earth blocks (not one-way platforms).
  if (s.oneWay) return;
  const seed = ((s.x * 374761393) ^ (s.y * 668265263)) >>> 0;
  const rng  = seededRng(seed);
  const count = Math.max(1, Math.floor(s.w / 220));
  ctx.save();
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < count; i++) {
    const tx = s.x + 30 + rng() * Math.max(1, s.w - 60);
    const h  = 90 + rng() * 140;
    const wd = 6 + rng() * 4;
    const baseY = s.y + 2;
    // trunk
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(tx - wd / 2, baseY - h, wd, h);
    // canopy — soft dark green clump
    const cR = 28 + rng() * 14;
    ctx.fillStyle = '#1a2a18';
    ctx.beginPath();
    ctx.arc(tx, baseY - h, cR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#243a1f';
    ctx.beginPath();
    ctx.arc(tx + 6, baseY - h - 8, cR * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a4226';
    ctx.beginPath();
    ctx.arc(tx - 8, baseY - h - 4, cR * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// One-way pass-through: a mossy wooden plank/branch.
function drawWoodenPlank(ctx, s) {
  // shadow underneath
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(s.x + 4, s.y + s.h, s.w, 3);

  // plank body (wood grain)
  const grad = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  grad.addColorStop(0, '#7a4e24');
  grad.addColorStop(1, '#3a2410');
  ctx.fillStyle = grad;
  ctx.fillRect(s.x, s.y, s.w, s.h);

  // grain lines
  ctx.strokeStyle = 'rgba(20,12,4,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(s.x + 4, s.y + s.h * 0.45);
  ctx.lineTo(s.x + s.w - 4, s.y + s.h * 0.45);
  ctx.moveTo(s.x + 8, s.y + s.h * 0.75);
  ctx.lineTo(s.x + s.w - 8, s.y + s.h * 0.75);
  ctx.stroke();

  // end knots
  ctx.fillStyle = '#2a1a08';
  ctx.beginPath(); ctx.arc(s.x + 6, s.y + s.h * 0.5, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s.x + s.w - 6, s.y + s.h * 0.5, 1.6, 0, Math.PI * 2); ctx.fill();

  // mossy top edge
  ctx.fillStyle = '#5a8628';
  ctx.fillRect(s.x, s.y - 1, s.w, 3);
  // a couple of grass tufts on top
  ctx.strokeStyle = '#94d048';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(s.x + 12, s.y); ctx.lineTo(s.x + 14, s.y - 5);
  ctx.moveTo(s.x + s.w - 14, s.y); ctx.lineTo(s.x + s.w - 12, s.y - 4);
  ctx.stroke();
}

// Moving platform — floating mushroom-cap that bobs across the chasm.
function drawMushroomMover(ctx, s) {
  const cx = s.x + s.w / 2;
  const cy = s.y + s.h / 2;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(cx, s.y + s.h + 6, s.w * 0.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  // cap (the standing surface)
  const grad = ctx.createLinearGradient(0, s.y, 0, s.y + s.h);
  grad.addColorStop(0, '#d04848');
  grad.addColorStop(1, '#7a1818');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(s.x, s.y + s.h);
  ctx.lineTo(s.x, s.y + 4);
  ctx.quadraticCurveTo(cx, s.y - 8, s.x + s.w, s.y + 4);
  ctx.lineTo(s.x + s.w, s.y + s.h);
  ctx.closePath();
  ctx.fill();
  // white spots on the cap
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(s.x + s.w * 0.3, s.y + 6, 2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s.x + s.w * 0.7, s.y + 5, 1.6, 0, Math.PI * 2); ctx.fill();
  // top mossy lip
  ctx.fillStyle = '#5a8628';
  ctx.fillRect(s.x + 4, s.y + s.h - 3, s.w - 8, 2);
  // hanging vine underneath
  ctx.strokeStyle = '#3a6a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 3, s.y + s.h);
  ctx.quadraticCurveTo(cx - 8, s.y + s.h + 14, cx, s.y + s.h + 22);
  ctx.stroke();
}

// Boss arena framing — twisted ancient trees + canopy darkening the back of the
// room, so it visually reads as an enclosed space.
function drawArenaFraming(ctx, a) {
  // Dark vignette filling the arena rectangle.
  const grad = ctx.createLinearGradient(a.x, a.y, a.x, a.y + a.h + 240);
  grad.addColorStop(0.0, 'rgba(8,6,4,0.55)');
  grad.addColorStop(0.6, 'rgba(8,6,4,0.18)');
  grad.addColorStop(1.0, 'rgba(8,6,4,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(a.x, a.y - 60, a.w, a.h + 240);

  // Two big ancient trees framing the left and right of the arena.
  drawArenaTree(ctx, a.x + 18,         a.y + a.h + 100, 360, 'left');
  drawArenaTree(ctx, a.x + a.w - 18,   a.y + a.h + 100, 380, 'right');

  // A few hanging vines from the ceiling.
  ctx.save();
  ctx.strokeStyle = '#2a3a18';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const vx = a.x + 80 + i * ((a.w - 160) / 5);
    const vy = a.y - 40;
    const len = 60 + ((i * 31) % 40);
    ctx.beginPath();
    ctx.moveTo(vx, vy);
    ctx.bezierCurveTo(vx + 4, vy + len * 0.4, vx - 6, vy + len * 0.7, vx + 2, vy + len);
    ctx.stroke();
    // small leaf at the tip
    ctx.fillStyle = '#3a6a1a';
    ctx.beginPath();
    ctx.ellipse(vx + 2, vy + len + 3, 4, 2, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawArenaTree(ctx, baseX, baseY, height, side) {
  const lean = side === 'left' ? 0.06 : -0.06;
  // trunk
  ctx.fillStyle = '#1a0f06';
  ctx.beginPath();
  ctx.moveTo(baseX - 26, baseY);
  ctx.lineTo(baseX - 18 + lean * height, baseY - height);
  ctx.lineTo(baseX + 18 + lean * height, baseY - height);
  ctx.lineTo(baseX + 26, baseY);
  ctx.closePath();
  ctx.fill();
  // bark grooves
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 4; i++) {
    const lx = baseX - 16 + i * 10;
    ctx.beginPath();
    ctx.moveTo(lx, baseY - 6);
    ctx.bezierCurveTo(lx + 3, baseY - height * 0.4, lx - 4, baseY - height * 0.7, lx + 1 + lean * height, baseY - height + 4);
    ctx.stroke();
  }
  // canopy (a dense dark cluster)
  const cx = baseX + lean * height;
  const cy = baseY - height;
  ctx.fillStyle = '#0e1a0a';
  for (const o of [[-30,-10,46],[28,-14,42],[-4,-30,50],[16,8,38],[-22,12,34]]) {
    ctx.beginPath(); ctx.arc(cx + o[0], cy + o[1], o[2], 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#1a2e14';
  ctx.beginPath(); ctx.arc(cx, cy - 6, 36, 0, Math.PI * 2); ctx.fill();
}

// The arena gate — a tall wooden / iron-bound door that slams up from below
// when the player enters the arena. Position is its current `y` (animated).
function drawGate(ctx, g) {
  if (g.state === 'open') return; // gate is below the floor, no need to draw
  const x = g.x, y = g.y, w = g.w, h = g.h;
  // shadow behind
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x + 4, y + 4, w, h);

  // dark wood body
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0.0, '#2a1808');
  grad.addColorStop(0.5, '#4a2a10');
  grad.addColorStop(1.0, '#1a0e04');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // vertical plank seams
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    const lx = x + (w / 3) * i;
    ctx.beginPath();
    ctx.moveTo(lx, y + 4);
    ctx.lineTo(lx, y + h - 4);
    ctx.stroke();
  }

  // iron bands across the gate (3 horizontal bands with rivets)
  ctx.fillStyle = '#1a1a20';
  for (let i = 0; i < 4; i++) {
    const by = y + 24 + i * (h / 4.5);
    ctx.fillRect(x - 2, by, w + 4, 8);
    // rivets
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(x - 1, by + 2, 3, 3);
    ctx.fillRect(x + w - 2, by + 2, 3, 3);
    ctx.fillStyle = '#1a1a20';
  }

  // spike line along the top — looks menacing as it slides into place
  ctx.fillStyle = '#5a5a5a';
  for (let i = 0; i < 5; i++) {
    const sx = x + 2 + (i * (w - 4) / 4);
    ctx.beginPath();
    ctx.moveTo(sx - 2, y);
    ctx.lineTo(sx, y - 8);
    ctx.lineTo(sx + 2, y);
    ctx.closePath();
    ctx.fill();
  }

  // green crack-glow along the seams (the cursed forest binding the gate)
  if (g.state === 'closed') {
    ctx.save();
    ctx.shadowColor = '#88e060';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(180,255,140,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 12);
    ctx.lineTo(x + w / 2 - 3, y + h * 0.35);
    ctx.lineTo(x + w / 2 + 2, y + h * 0.6);
    ctx.lineTo(x + w / 2 - 2, y + h - 14);
    ctx.stroke();
    ctx.restore();
  }
}

function drawHazard(ctx, h) {
  if (h.kind === 'spike' || (h.kind === 'popSpike' && h.armed)) {
    // Sharp thorn vine — dark wood with red-stained tips.
    const teeth = Math.floor(h.w / 12);
    for (let i = 0; i < teeth; i++) {
      const x = h.x + i * 12;
      // dark wood thorn
      ctx.fillStyle = '#2a1808';
      ctx.beginPath();
      ctx.moveTo(x, h.y + h.h);
      ctx.lineTo(x + 6, h.y);
      ctx.lineTo(x + 12, h.y + h.h);
      ctx.closePath();
      ctx.fill();
      // blood-stained tip
      ctx.fillStyle = '#7a1a14';
      ctx.beginPath();
      ctx.moveTo(x + 4, h.y + 4);
      ctx.lineTo(x + 6, h.y);
      ctx.lineTo(x + 8, h.y + 4);
      ctx.closePath();
      ctx.fill();
    }
    // mossy base
    ctx.fillStyle = '#3a5a18';
    ctx.fillRect(h.x, h.y + h.h - 3, h.w, 3);
  } else if (h.kind === 'popSpike') {
    ctx.fillStyle = '#1a2236';
    ctx.fillRect(h.x, h.y + h.h - 4, h.w, 4);
  } else if (h.kind === 'roll') {
    ctx.save();
    ctx.translate(h.x + h.w/2, h.y + h.h/2);
    ctx.rotate(h.t * 6 * h.dir);
    const grad = ctx.createRadialGradient(-6, -6, 4, 0, 0, h.w/2);
    grad.addColorStop(0, '#3a3a44');
    grad.addColorStop(1, '#0a0a14');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, h.w/2, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ff2a55'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, h.w/2 - 3, 0, Math.PI*2); ctx.stroke();
    // spokes
    ctx.strokeStyle = '#22e1ff';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const a = i * Math.PI / 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (h.w/2 - 4), Math.sin(a) * (h.w/2 - 4));
      ctx.stroke();
    }
    ctx.restore();
  } else if (h.kind === 'pendulum') {
    // chain
    ctx.strokeStyle = '#3a4258';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(h.x, h.y);
    ctx.lineTo(h.x + Math.sin(h.angle) * h.length, h.y + Math.cos(h.angle) * h.length);
    ctx.stroke();
    // anchor
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(h.x - 12, h.y - 6, 24, 8);
    ctx.fillStyle = '#ff2a55';
    ctx.fillRect(h.x - 12, h.y - 6, 24, 2);
    // head
    const cx = h.x + Math.sin(h.angle) * h.length;
    const cy = h.y + Math.cos(h.angle) * h.length;
    const grad = ctx.createRadialGradient(cx-4, cy-4, 4, cx, cy, h.head);
    grad.addColorStop(0, '#5a5a64'); grad.addColorStop(1, '#0a0a14');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, h.head, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#ff2a55'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, h.head - 4, 0, Math.PI*2); ctx.stroke();
    // spike tip
    ctx.fillStyle = '#dde1ee';
    ctx.beginPath();
    ctx.moveTo(cx, cy + h.head + 18);
    ctx.lineTo(cx - 8, cy + h.head - 2);
    ctx.lineTo(cx + 8, cy + h.head - 2);
    ctx.closePath();
    ctx.fill();
  } else if (h.kind === 'mushroom') {
    ctx.fillStyle = '#4a1a36';
    ctx.fillRect(h.x + 6, h.y + h.h - 8, h.w - 12, 8);
    // cap
    const grad = ctx.createRadialGradient(h.x + h.w/2, h.y, 4, h.x + h.w/2, h.y, h.w/2);
    grad.addColorStop(0, '#ff2a55'); grad.addColorStop(1, '#7a0a1a');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(h.x + h.w/2, h.y + 6, h.w/2, h.h - 4, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(h.x + h.w*0.3, h.y + 4, 3, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x + h.w*0.7, h.y + 6, 2, 0, Math.PI*2); ctx.fill();
  }
}

function drawZone(ctx, z) {
  if (z.kind === 'wind') {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#22e1ff';
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.globalAlpha = 1;
    // streamlines
    ctx.strokeStyle = 'rgba(34,225,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) {
      const y = z.y + 18 + i * (z.h / 16);
      const off = (Date.now() / 8) % 50;
      ctx.beginPath();
      for (let x = z.x - 50 + off; x < z.x + z.w; x += 60) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + 30, y);
      }
      ctx.stroke();
    }
    ctx.restore();
  } else if (z.kind === 'fog') {
    ctx.save();
    const grad = ctx.createLinearGradient(z.x, 0, z.x + z.w, 0);
    grad.addColorStop(0, 'rgba(2,3,10,0)');
    grad.addColorStop(0.4, `rgba(2,3,10,${z.alpha})`);
    grad.addColorStop(0.6, `rgba(2,3,10,${z.alpha})`);
    grad.addColorStop(1, 'rgba(2,3,10,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(z.x, z.y, z.w, z.h);
    ctx.restore();
  }
}

function drawGoal(ctx, g) {
  // Ancient glowing forest portal — cracked tree trunk wreathed in green light.
  const t = Date.now() / 1000;
  const cx = g.x + g.w / 2;
  // glowing aura
  const aura = ctx.createRadialGradient(cx, g.y + g.h * 0.45, 4, cx, g.y + g.h * 0.45, 110);
  const pulse = 0.45 + Math.sin(t * 2.6) * 0.18;
  aura.addColorStop(0.0, `rgba(160,255,140,${pulse})`);
  aura.addColorStop(0.5, `rgba(60,180,90,${pulse * 0.45})`);
  aura.addColorStop(1.0, 'rgba(40,80,40,0)');
  ctx.fillStyle = aura;
  ctx.fillRect(g.x - 90, g.y - 30, g.w + 180, g.h + 60);

  // Tree trunk gate (slightly wider than collision rect for visual)
  const tw = g.w + 18;
  const tx = cx - tw / 2;
  const grad = ctx.createLinearGradient(tx, 0, tx + tw, 0);
  grad.addColorStop(0.0, '#1a1208');
  grad.addColorStop(0.5, '#3a2810');
  grad.addColorStop(1.0, '#1a1208');
  ctx.fillStyle = grad;
  ctx.fillRect(tx, g.y, tw, g.h);

  // bark texture lines
  ctx.strokeStyle = 'rgba(20,12,4,0.7)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    const lx = tx + 6 + i * (tw / 6);
    ctx.beginPath();
    ctx.moveTo(lx, g.y + 6);
    ctx.bezierCurveTo(lx + 3, g.y + g.h * 0.4, lx - 4, g.y + g.h * 0.7, lx + 1, g.y + g.h - 6);
    ctx.stroke();
  }

  // glowing crack down the center
  ctx.save();
  ctx.shadowColor = '#a8f088';
  ctx.shadowBlur = 14;
  ctx.strokeStyle = '#c4ff9a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, g.y + 12);
  ctx.lineTo(cx - 6, g.y + g.h * 0.3);
  ctx.lineTo(cx + 4, g.y + g.h * 0.55);
  ctx.lineTo(cx - 3, g.y + g.h * 0.8);
  ctx.lineTo(cx + 2, g.y + g.h - 8);
  ctx.stroke();
  ctx.restore();

  // green leaves on top of trunk
  ctx.fillStyle = '#2a4a1a';
  ctx.beginPath(); ctx.arc(cx - 10, g.y - 4, 14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx + 12, g.y - 6, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3a6a26';
  ctx.beginPath(); ctx.arc(cx, g.y - 14, 18, 0, Math.PI * 2); ctx.fill();

  // tiny floating spirit motes around the portal
  for (let i = 0; i < 5; i++) {
    const a = t * 1.5 + i * 1.25;
    const ox = Math.sin(a) * 30;
    const oy = Math.cos(a * 0.8) * 18 - 4;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(200,255,170,0.9)' : 'rgba(255,236,170,0.8)';
    ctx.beginPath(); ctx.arc(cx + ox, g.y + g.h * 0.5 + oy, 2, 0, Math.PI * 2); ctx.fill();
  }
}

function drawCrate(ctx, c) {
  const bob = Math.sin(c.bob * 3) * 3;
  ctx.save();
  ctx.translate(c.x, c.y + bob);
  // glow
  const grad = ctx.createRadialGradient(c.w/2, c.h/2, 4, c.w/2, c.h/2, c.w);
  grad.addColorStop(0, 'rgba(255,204,51,0.55)');
  grad.addColorStop(1, 'rgba(255,204,51,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(-c.w/2, -c.h/2, c.w*2, c.h*2);
  // box
  ctx.fillStyle = '#1a1f2e';
  ctx.fillRect(0, 0, c.w, c.h);
  ctx.strokeStyle = '#ffcc33';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, c.w, c.h);
  ctx.fillStyle = '#ffcc33';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', c.w/2, c.h/2 + 1);
  ctx.restore();
}

function drawCoin(ctx, c) {
  const pulse = Math.sin(c.t * 5) * 0.4 + 0.6;
  ctx.fillStyle = `rgba(255,204,51,${pulse * 0.5})`;
  ctx.beginPath(); ctx.arc(c.x + 6, c.y + 6, 10, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffcc33';
  ctx.beginPath(); ctx.arc(c.x + 6, c.y + 6, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#fff7d6';
  ctx.fillRect(c.x + 5, c.y + 3, 1, 6);
}
