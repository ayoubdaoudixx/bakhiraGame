// Keyboard input — tracks held + just-pressed (consume-once) state.

const held = new Set();
const pressed = new Set();
const consumed = new Set();

const keymap = {
  left:  ['ArrowLeft'],
  right: ['ArrowRight'],
  up:    ['ArrowUp'],
  down:  ['ArrowDown'],
  jump:  ['ArrowUp'],
  attack:['Space'],
  swap:  ['KeyK'],
  pause: ['Escape'],
  skip:  ['Enter'],
};

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  // prevent page scroll on space/arrows
  if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
  held.add(e.code);
  pressed.add(e.code);
});
window.addEventListener('keyup', (e) => {
  held.delete(e.code);
  consumed.delete(e.code);
});
window.addEventListener('blur', () => { held.clear(); pressed.clear(); consumed.clear(); });

function anyHeld(codes){ for (const c of codes) if (held.has(c)) return true; return false; }
function anyPressed(codes){
  for (const c of codes) if (pressed.has(c) && !consumed.has(c)) { consumed.add(c); pressed.delete(c); return true; }
  return false;
}

export const Input = {
  held: (action) => anyHeld(keymap[action] || []),
  pressed: (action) => anyPressed(keymap[action] || []),
  // call once per frame to flush stale presses
  endFrame() { pressed.clear(); }
};
