// Level 1 — Stadium at Night.
// Tuned for a "first level" difficulty: fewer hazards, more breathing room.

import { PICKUP_POOL } from '../config/weapons.js';

const GROUND_Y = 560;
const W = 4400;     // shortened world
const H = 900;

const plat = (x, y, w, h, opts = {}) => ({ x, y, w, h, oneWay: !!opts.oneWay, kind: opts.kind || 'static', ...opts });

export const LEVEL1 = {
  name: 'Stage I — The Stolen Game',
  bounds: { w: W, h: H },
  groundY: GROUND_Y,
  spawn: { x: 80, y: GROUND_Y - 120 },
  goal: { x: W - 220, y: GROUND_Y - 200, w: 60, h: 200 },
  bossSpawn: { x: W - 460, y: GROUND_Y - 220 },
  bossTriggerX: W - 900,

  // Continuous floor with two small gaps (down from five). Easier to navigate.
  platforms: [
    plat(0,    GROUND_Y, 1100, 340),
    plat(1240, GROUND_Y, 940,  340),  // first gap
    plat(2400, GROUND_Y, 800,  340),  // second gap
    plat(3360, GROUND_Y, W-3360, 340),

    // Floating one-way platforms, more generous spacing.
    plat(420,  GROUND_Y - 150, 160, 18, { oneWay: true }),
    plat(680,  GROUND_Y - 240, 160, 18, { oneWay: true }),
    plat(900,  GROUND_Y - 150, 160, 18, { oneWay: true }),
    plat(1500, GROUND_Y - 200, 200, 18, { oneWay: true }),
    plat(1820, GROUND_Y - 320, 160, 18, { oneWay: true }),
    plat(2520, GROUND_Y - 220, 200, 18, { oneWay: true }),
    plat(2840, GROUND_Y - 340, 160, 18, { oneWay: true }),
    plat(3500, GROUND_Y - 220, 200, 18, { oneWay: true }),
    plat(3800, GROUND_Y - 340, 160, 18, { oneWay: true }),
  ],

  // One moving platform (was three).
  movers: [
    { x: 2280, y: GROUND_Y - 240, w: 140, h: 18, axis: 'x', range: 120, speed: 60 },
  ],

  // No crumbling platforms — too punishing for level 1.
  crumblers: [],

  // Reduced hazards: 2 spike pits, 1 pendulum, a few mushrooms (helpful).
  hazards: [
    { kind: 'spike', x: 1140, y: GROUND_Y - 16, w: 80, h: 16 },
    { kind: 'spike', x: 3260, y: GROUND_Y - 16, w: 80, h: 16 },

    // One pendulum near boss arena for tension.
    { kind: 'pendulum', x: 3700, y: GROUND_Y - 360, length: 200, period: 2.6, phase: 0, head: 26 },

    // Mushrooms (helpful, not damaging).
    { kind: 'mushroom', x: 850,  y: GROUND_Y - 22, w: 50, h: 22 },
    { kind: 'mushroom', x: 1900, y: GROUND_Y - 22, w: 50, h: 22 },
    { kind: 'mushroom', x: 3050, y: GROUND_Y - 22, w: 50, h: 22 },
  ],

  // No wind/fog zones — keep level 1 readable.
  zones: [],

  // Lighter enemy load: 3 patrols + 1 ranged.
  enemies: [
    { id: 'enemy1', x: 700,  y: GROUND_Y - 102, patrolMin: 600,  patrolMax: 900,  audioAppear: 'wld_fayza', audioDefeat: 'l7w_bamos' },
    { id: 'enemy1', x: 1700, y: GROUND_Y - 102, patrolMin: 1500, patrolMax: 2080, audioAppear: 'wa_3la_krita', audioDefeat: 'finition' },
    { id: 'enemy3', x: 2700, y: GROUND_Y - 102, audioAppear: 'bnsnss', audioDefeat: 'bnsns_hziti_lqlwa' },
    { id: 'enemy1', x: 3500, y: GROUND_Y - 102, patrolMin: 3380, patrolMax: 3760, audioAppear: 'wld_fayza', audioDefeat: 'l7w_bamos' },
  ],

  // More crates so the player always has ammo on hand.
  crates: [
    { x: 480,  y: GROUND_Y - 190, weaponPool: PICKUP_POOL },
    { x: 700,  y: GROUND_Y - 280, weaponPool: PICKUP_POOL },
    { x: 1540, y: GROUND_Y - 240, weaponPool: PICKUP_POOL },
    { x: 1860, y: GROUND_Y - 360, weaponPool: PICKUP_POOL },
    { x: 2560, y: GROUND_Y - 260, weaponPool: PICKUP_POOL },
    { x: 3540, y: GROUND_Y - 260, weaponPool: PICKUP_POOL },
    { x: 3840, y: GROUND_Y - 380, weaponPool: PICKUP_POOL },
  ],

  coins: scatterCoins(),
};

function scatterCoins() {
  const arr = [];
  const drops = [
    { x: 460,  y: GROUND_Y - 190, count: 4 },
    { x: 720,  y: GROUND_Y - 280, count: 4 },
    { x: 940,  y: GROUND_Y - 190, count: 4 },
    { x: 1540, y: GROUND_Y - 240, count: 5 },
    { x: 1860, y: GROUND_Y - 360, count: 4 },
    { x: 2560, y: GROUND_Y - 260, count: 5 },
    { x: 2880, y: GROUND_Y - 380, count: 4 },
    { x: 3540, y: GROUND_Y - 260, count: 5 },
    { x: 3840, y: GROUND_Y - 380, count: 4 },
  ];
  for (const d of drops) for (let i = 0; i < d.count; i++) arr.push({ x: d.x + i * 18, y: d.y });
  return arr;
}
