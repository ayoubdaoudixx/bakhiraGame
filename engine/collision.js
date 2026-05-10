// AABB collision helpers + tile/platform resolution.

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function aabbOverlapAmount(a, b) {
  const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return { dx, dy };
}

// Resolve body against a list of solids (rect platforms). Updates grounded flag.
// Solids may be one-way (oneWay: true) — only collide when falling and feet above surface.
export function resolveSolids(body, solids, prevX, prevY) {
  body.grounded = false;
  body.touchedCeiling = false;
  body.touchedWall = 0;

  // Horizontal pass: snap back if overlapping after horizontal move.
  for (const s of solids) {
    if (s.oneWay) continue;
    const box = { x: body.x, y: prevY, w: body.w, h: body.h };
    if (aabb(box, s)) {
      if (prevX + body.w <= s.x) { body.x = s.x - body.w; body.vx = 0; body.touchedWall = 1; }
      else if (prevX >= s.x + s.w) { body.x = s.x + s.w; body.vx = 0; body.touchedWall = -1; }
    }
  }

  // Vertical pass.
  for (const s of solids) {
    const box = { x: body.x, y: body.y, w: body.w, h: body.h };
    if (!aabb(box, s)) continue;
    if (s.oneWay) {
      // Only land if previous bottom was above platform top and we're moving down.
      if (body.vy >= 0 && prevY + body.h <= s.y + 1) {
        body.y = s.y - body.h;
        body.vy = 0;
        body.grounded = true;
        body.standingOn = s;
      }
      continue;
    }
    if (prevY + body.h <= s.y) {
      body.y = s.y - body.h;
      body.vy = 0;
      body.grounded = true;
      body.standingOn = s;
    } else if (prevY >= s.y + s.h) {
      body.y = s.y + s.h;
      body.vy = 0;
      body.touchedCeiling = true;
    }
  }
}
