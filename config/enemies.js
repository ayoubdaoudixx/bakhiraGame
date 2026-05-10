// Enemy roster. Drop a face PNG/JPG named after `facePng` into /assets/enemies/
// and the loader will pick it up automatically. Body is generated procedurally.

export const ENEMIES = [
  {
    id: 'enemy1',
    name: 'The Blocker',
    facePng: 'enemy1-face.jpeg',     // dash + jpeg per current asset folder
    hp: 3,
    speed: 90,
    behavior: 'patrol',              // patrol | chase | jump | ranged
    scale: 1.0,
    bodyColor: '#1c2438',
    accent: '#ff2a55',
  },
  {
    id: 'enemy2',
    name: 'The Sprinter',
    facePng: 'enemy2-face.jpeg',
    hp: 3,
    speed: 160,
    behavior: 'chase',
    scale: 0.95,
    bodyColor: '#2a1a30',
    accent: '#22e1ff',
  },
  {
    id: 'enemy3',
    name: 'The Hurler',
    facePng: 'enemy3-face.jpeg',
    hp: 3,
    speed: 70,
    behavior: 'ranged',
    scale: 1.05,
    bodyColor: '#1a2a22',
    accent: '#ffcc33',
  },
];

// Level 1 boss — a brutish minion of the main villain, NOT the villain himself.
// Procedurally drawn (no face PNG) so he reads visually distinct from the cutscene villain.
// He's a "first-stage muscle" archetype: stadium enforcer in a riveted metal mask.
export const BOSS = {
  id: 'boss1',
  name: 'The Iron Hooligan',
  subtitle: 'Enforcer of the Shadow',
  hp: 24,
  speed: 110,
  scale: 2.0,
  bodyColor: '#1a1410',       // gunmetal/charcoal
  uniform: '#2a0f12',         // deep blood-red torn referee shirt
  uniformStripe: '#0a0a0a',   // black ref stripes
  armor: '#3a3a44',           // steel
  rivet: '#7a7a84',
  glow: '#ff7a1a',            // ORANGE eye slits — distinct from villain's magenta
  accent: '#ff8a3a',
};

export function getEnemyDef(id) {
  return ENEMIES.find(e => e.id === id) || ENEMIES[0];
}
