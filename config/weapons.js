// Weapon definitions. Each weapon is a behavior config consumed by entities/weapon.js.
// type: melee | projectile | boomerang | aoe | rapid | homing

export const WEAPONS = {
  // Starter weapon — heavier than fists, better range, never runs out.
  bat: {
    id: 'bat', name: 'Slugger Bat', type: 'melee',
    damage: 1, range: 110, cooldown: 0.36, ammo: Infinity, color: '#c89466',
    swing: { arc: 1.8, reach: 110 },
    icon: 'bat',
  },
  fist: {
    id: 'fist', name: 'Bare Knuckles', type: 'melee',
    damage: 1, range: 60, cooldown: 0.32, ammo: Infinity, color: '#e8eef7',
    swing: { arc: 1.4, reach: 60 },
    icon: 'fist',
  },
  foamFinger: {
    id: 'foamFinger', name: 'Giant Foam Finger', type: 'melee',
    damage: 1, range: 90, cooldown: 0.28, ammo: 30, color: '#ff2a55',
    swing: { arc: 1.7, reach: 90 },
    icon: 'finger',
  },
  explodingBoot: {
    id: 'explodingBoot', name: 'Exploding Boot', type: 'projectile',
    damage: 2, cooldown: 0.6, ammo: 8, projectile: {
      speed: 520, gravity: 900, lifetime: 2.5, radius: 14,
      explode: { radius: 90, damage: 3, color: '#ffcc33' },
      sprite: 'boot',
    },
    color: '#ffcc33',
    icon: 'boot',
  },
  boomerang: {
    id: 'boomerang', name: 'Red Card Boomerang', type: 'boomerang',
    damage: 1, cooldown: 0.7, ammo: 12,
    projectile: { speed: 480, lifetime: 1.6, radius: 10, sprite: 'card' },
    color: '#ff2a55', icon: 'card',
  },
  whistle: {
    id: 'whistle', name: 'Giant Whistle', type: 'aoe',
    damage: 1, cooldown: 1.4, ammo: 5,
    aoe: { radius: 180, stunTime: 1.8, color: '#22e1ff' },
    color: '#22e1ff', icon: 'whistle',
  },
  confetti: {
    id: 'confetti', name: 'Confetti Cannon', type: 'rapid',
    damage: 1, cooldown: 0.08, ammo: 60,
    projectile: { speed: 720, gravity: 0, lifetime: 0.7, radius: 4, sprite: 'confetti', spread: 0.18 },
    color: '#ffcc33', icon: 'confetti',
  },
  magicCleat: {
    id: 'magicCleat', name: 'Magic Cleat', type: 'homing',
    damage: 2, cooldown: 0.55, ammo: 10,
    projectile: { speed: 360, lifetime: 2.4, radius: 9, sprite: 'cleat', turn: 4.0 },
    color: '#22e1ff', icon: 'cleat',
  },
};

// Pool of pickups (excluding fists which are starter).
export const PICKUP_POOL = ['foamFinger','explodingBoot','boomerang','whistle','confetti','magicCleat'];
