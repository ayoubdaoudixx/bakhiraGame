// Physics constants + integration helpers.

export const PHYSICS = {
  gravity: 1800,         // px/s^2
  maxFall: 1200,
  moveAccel: 3200,
  airAccel: 2200,
  friction: 2600,
  maxSpeed: 360,
  jumpVel: -680,
  doubleJumpVel: -560,
  knockbackDecay: 6,     // exp decay per second
};

// Standard semi-implicit Euler integration with capped fall + drag.
export function integrate(body, dt) {
  body.vy += PHYSICS.gravity * dt;
  if (body.vy > PHYSICS.maxFall) body.vy = PHYSICS.maxFall;

  // optional knockback impulse component (decays separately so player regains control).
  if (body.kbx || body.kby) {
    const k = Math.exp(-PHYSICS.knockbackDecay * dt);
    body.x += body.kbx * dt;
    body.y += body.kby * dt;
    body.kbx *= k;
    body.kby *= k;
    if (Math.abs(body.kbx) < 1) body.kbx = 0;
    if (Math.abs(body.kby) < 1) body.kby = 0;
  }

  body.x += body.vx * dt;
  body.y += body.vy * dt;
}

export function applyHorizontal(body, dir, grounded, dt, speedCap = PHYSICS.maxSpeed) {
  const accel = grounded ? PHYSICS.moveAccel : PHYSICS.airAccel;
  if (dir !== 0) {
    body.vx += dir * accel * dt;
    if (body.vx > speedCap) body.vx = speedCap;
    if (body.vx < -speedCap) body.vx = -speedCap;
  } else if (grounded) {
    // friction — only on ground for snappier air control
    const f = PHYSICS.friction * dt;
    if (Math.abs(body.vx) <= f) body.vx = 0;
    else body.vx -= Math.sign(body.vx) * f;
  }
}
