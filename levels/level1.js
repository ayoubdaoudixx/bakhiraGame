// Level 1 — The Cursed Forest.
// Cactus-McCoy-style chunky terrain: chunky earth blocks at varying heights,
// stepped cliffs, pillars to climb, gorges to leap, deadly pits.
// Ends with a SEALED BOSS ROOM — the gate slams shut behind the player and
// the boss can only be fought inside.

import { PICKUP_POOL } from '../config/weapons.js';

const G = 600;           // reference ground line (top of base earth)
const W = 5800;          // world width (extended to fit a proper arena)
const H = 900;           // world height
const DEEP = 360;        // how far each block extends below its top

const plat = (x, y, w, h, opts = {}) => ({ x, y, w, h, oneWay: !!opts.oneWay, kind: opts.kind || 'static', ...opts });

// Boss arena — sealed room from `arena.x` to `arena.x + arena.w` (right side of map).
const ARENA = {
  x: 4760,
  y: G - 320,           // ceiling visual reference
  w: 920,               // 4760..5680
  h: G - (G - 320) + 40,
  triggerX: 4820,       // crossing this point seals the gate
};

// The gate solid (initially inactive, becomes solid the moment the player crosses triggerX).
const GATE = { x: ARENA.x + 8, y: G - 320, w: 24, h: 320 + DEEP };
// Right back wall — invisible barrier so neither player nor boss falls off the right.
const BACKWALL = { x: ARENA.x + ARENA.w - 28, y: G - 320, w: 28, h: 320 + DEEP };

export const LEVEL1 = {
  name: 'Stage I — The Cursed Forest',
  bounds: { w: W, h: H },
  groundY: G,
  spawn: { x: 70, y: G - 120 },
  // The "goal" pillar is moved off-screen — winning Stage 1 now requires
  // defeating the boss inside the sealed arena, not touching a flag.
  goal: { x: -9999, y: 0, w: 0, h: 0 },

  // Boss spawns on the right side of the arena floor.
  bossSpawn: { x: ARENA.x + ARENA.w - 220, y: G - 260 },
  // Trigger is the moment the player crosses the gate-line.
  bossTriggerX: ARENA.triggerX,

  // The arena rect + gate solid are made available to the runtime.
  arena: ARENA,
  gate: GATE,
  backwall: BACKWALL,

  // ---- The TERRAIN itself is the platforming, Cactus-McCoy style. ----
  platforms: [
    // ── A — FOREST CLEARING (start) ──
    plat(0,    G,        680, DEEP),       // flat starting strip
    plat(680,  G - 50,   160, DEEP + 50),  // small mossy bump
    plat(840,  G - 110,  220, DEEP + 110), // hilltop
    plat(1060, G - 50,   160, DEEP + 50),  // back down
    plat(1220, G,        220, DEEP),       // flat clearing

    // gap 1440..1620 — deadly pit

    // ── B — TIERED CLIFFS (climb the ravine wall) ──
    plat(1620, G + 60,   200, DEEP - 60),
    plat(1820, G - 20,   180, DEEP + 20),
    plat(2000, G - 100,  180, DEEP + 100),
    plat(2180, G - 180,  200, DEEP + 180),
    plat(2380, G - 260,  300, DEEP + 260),

    // ── C — GORGE ──
    // gorge 2680..2980

    plat(2980, G - 160,  220, DEEP + 160),
    plat(3200, G - 100,  220, DEEP + 100),
    plat(3420, G - 40,   220, DEEP + 40),

    // ── D — FOREST VALLEY ──
    plat(3640, G,        520, DEEP),

    // ── E — STAIR-STEPPED PILLARS ──
    plat(4160, G - 60,   110, DEEP + 60),
    plat(4290, G - 130,  110, DEEP + 130),
    plat(4420, G - 200,  110, DEEP + 200),

    // pit 4530..4660 (deadly drop after the climb)

    // ── F — ENTRY CORRIDOR + BOSS ARENA FLOOR ──
    plat(4660, G,        100, DEEP),       // short approach corridor before the gate

    // Inside the sealed arena (4760..5680): the floor + back wall + ceiling decor.
    plat(ARENA.x, G, ARENA.w, DEEP),                 // arena floor (continuous)

    // Dodge platforms INSIDE the arena (one-way, so player can jump up through).
    plat(ARENA.x + 80,  G - 110, 130, 14, { oneWay: true }),  // low-left ledge
    plat(ARENA.x + ARENA.w - 240, G - 110, 130, 14, { oneWay: true }), // low-right ledge
    plat(ARENA.x + ARENA.w / 2 - 70, G - 210, 140, 14, { oneWay: true }), // high center
  ],

  // Mushroom mover across the gorge (kept).
  movers: [
    { x: 2780, y: G - 120, w: 96, h: 16, axis: 'y', range: 90, speed: 70 },
  ],

  crumblers: [],

  hazards: [
    { kind: 'spike', x: 1900, y: G + 80 - 16, w: 70, h: 16 },
    { kind: 'spike', x: 3700, y: G - 16,      w: 80, h: 16 },

    { kind: 'pendulum', x: 2830, y: G - 360, length: 240, period: 2.8, phase: 0, head: 26 },

    { kind: 'mushroom', x: 240,  y: G - 22,       w: 56, h: 22 },
    { kind: 'mushroom', x: 1300, y: G - 22,       w: 56, h: 22 },
    { kind: 'mushroom', x: 3260, y: G - 100 - 22, w: 56, h: 22 },
    { kind: 'mushroom', x: 4040, y: G - 22,       w: 56, h: 22 },
  ],

  zones: [],

  // Exactly three enemies — one of each type — placed on the unavoidable
  // main path so the narrative order (enemy1 → enemy2 → enemy3 → boss) is
  // always what the player experiences. No duplicates.
  // Iteration scope: only enemy1 should produce voice lines right now.
  // enemy2 and enemy3 are intentionally silent until we verify enemy1's flow.
  enemies: [
    // 1) Hilltop blocker patrol on the opening hill
    { id: 'enemy1', x: 900,  y: G - 110 - 102, patrolMin: 840,  patrolMax: 1060,
      audioAppear: 'enemy1-intro', audioDefeat: 'enemy1-defeat' },
    // 2) Sprinter waiting in the ravine — SILENT for this iteration
    { id: 'enemy2', x: 2000, y: G - 100 - 102, patrolMin: 1820, patrolMax: 2380 },
    // 3) Hurler in the valley — SILENT for this iteration
    { id: 'enemy3', x: 3820, y: G - 102, patrolMin: 3700, patrolMax: 4100 },
  ],

  crates: [
    { x: 380,  y: G - 200, weaponPool: PICKUP_POOL },
    { x: 940,  y: G - 240, weaponPool: PICKUP_POOL },
    { x: 1820, y: G - 80,  weaponPool: PICKUP_POOL },
    { x: 2440, y: G - 320, weaponPool: PICKUP_POOL },
    { x: 3060, y: G - 220, weaponPool: PICKUP_POOL },
    { x: 3800, y: G - 60,  weaponPool: PICKUP_POOL },
    { x: 4440, y: G - 260, weaponPool: PICKUP_POOL },
    // A final ammo crate just before the gate — last chance to load up.
    { x: 4700, y: G - 80,  weaponPool: PICKUP_POOL },
  ],

  coins: scatterCoins(),
};

function scatterCoins() {
  const arr = [];
  const drops = [
    { x: 360,  y: G - 200, count: 4 },
    { x: 920,  y: G - 240, count: 4 },
    { x: 1240, y: G - 40,  count: 3 },
    { x: 1500, y: G - 60,  count: 3 },
    { x: 1660, y: G + 20,  count: 3 },
    { x: 2200, y: G - 220, count: 4 },
    { x: 2440, y: G - 320, count: 5 },
    { x: 2740, y: G - 220, count: 4 },
    { x: 2860, y: G - 240, count: 4 },
    { x: 3060, y: G - 220, count: 4 },
    { x: 3460, y: G - 100, count: 3 },
    { x: 3820, y: G - 60,  count: 4 },
    { x: 4180, y: G - 100, count: 2 },
    { x: 4310, y: G - 170, count: 2 },
    { x: 4440, y: G - 260, count: 5 },
    { x: 4700, y: G - 60,  count: 3 },
  ];
  for (const d of drops) for (let i = 0; i < d.count; i++) arr.push({ x: d.x + i * 18, y: d.y });
  return arr;
}
