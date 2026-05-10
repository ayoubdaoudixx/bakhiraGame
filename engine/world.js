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
  }

  // Combined collidable surfaces for collision module.
  get solids() {
    const out = [];
    for (const s of this.staticSolids) out.push(s);
    for (const m of this.movers) out.push(m);
    for (const c of this.crumblers) if (c.state !== 'gone') out.push(c);
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
        // play defeat audio
        if (e.audioDefeat && this.audio) {
          this.audio.play(e.audioDefeat);
          // play transition audio after defeat audio finishes (2 second gap)
          setTimeout(() => {
            if (this.audio) this.audio.play('carayou_pouuwa_lghwat');
          }, 2000);
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

    // boss trigger
    if (!this.boss && this.player && this.player.x > this.bossTriggerX) {
      // signaled to game.js externally — we set a flag so the game loop can handle the boss state transition
      this.bossPending = true;
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

    // hazards
    for (const h of this.hazards) drawHazard(ctx, h);

    // zones
    for (const z of this.zones) drawZone(ctx, z);

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

function drawPlatform(ctx, s, mover = false, crumbler = false) {
  // base
  const grad = ctx.createLinearGradient(s.x, s.y, s.x, s.y + s.h);
  grad.addColorStop(0, mover ? '#2a3458' : (crumbler ? '#3a2a18' : '#1a2138'));
  grad.addColorStop(1, '#070a14');
  ctx.fillStyle = grad;
  ctx.fillRect(s.x, s.y, s.w, s.h);
  // neon edge
  ctx.fillStyle = mover ? '#22e1ff' : (crumbler ? '#ffcc33' : '#ff2a55');
  ctx.fillRect(s.x, s.y, s.w, 2);
  // grime
  if (s.h > 30) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 4; i++) ctx.fillRect(s.x + (i * 200) % s.w, s.y + 12 + i*8, 40, 2);
  }
}

function drawHazard(ctx, h) {
  if (h.kind === 'spike' || (h.kind === 'popSpike' && h.armed)) {
    ctx.fillStyle = '#dde1ee';
    const teeth = Math.floor(h.w / 12);
    for (let i = 0; i < teeth; i++) {
      const x = h.x + i * 12;
      ctx.beginPath();
      ctx.moveTo(x, h.y + h.h);
      ctx.lineTo(x + 6, h.y);
      ctx.lineTo(x + 12, h.y + h.h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#ff2a55';
    ctx.fillRect(h.x, h.y + h.h - 2, h.w, 2);
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
  // glowing pillar / portal
  const t = Date.now() / 1000;
  const grad = ctx.createLinearGradient(g.x, g.y, g.x + g.w, g.y);
  grad.addColorStop(0, 'rgba(34,225,255,0)');
  grad.addColorStop(0.5, `rgba(34,225,255,${0.5 + 0.2 * Math.sin(t * 3)})`);
  grad.addColorStop(1, 'rgba(34,225,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(g.x - 30, g.y, g.w + 60, g.h);
  ctx.fillStyle = '#22e1ff';
  ctx.fillRect(g.x, g.y, g.w, g.h);
  ctx.fillStyle = '#04060b';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GOAL', g.x + g.w/2, g.y + 18);
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
