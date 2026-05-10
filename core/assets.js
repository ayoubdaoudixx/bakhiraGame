// Asset loader: tries multiple extensions, returns a transparent placeholder on miss.
// Never rejects — missing assets are non-fatal so the game keeps running.

const tryExts = ['.png', '.jpg', '.jpeg', '.webp'];

function makePlaceholder(label = '?') {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1f2e';
  x.fillRect(0, 0, 128, 128);
  x.strokeStyle = '#ff2a55';
  x.lineWidth = 3;
  x.strokeRect(2, 2, 124, 124);
  x.beginPath();
  x.moveTo(2, 2); x.lineTo(126, 126);
  x.moveTo(126, 2); x.lineTo(2, 126);
  x.stroke();
  x.fillStyle = '#e8eef7';
  x.font = 'bold 18px monospace';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(label.slice(0, 8), 64, 64);
  return c;
}

function loadOne(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// Try a base path with multiple extensions, or honor an explicit extension.
async function tryWithExtensions(basePath) {
  // If path already has an extension, try it first then the rest as fallback.
  const m = basePath.match(/\.(png|jpg|jpeg|webp)$/i);
  const stem = m ? basePath.slice(0, -m[0].length) : basePath;
  const order = m ? [m[0].toLowerCase(), ...tryExts.filter(e => e !== m[0].toLowerCase())] : tryExts;
  for (const ext of order) {
    const img = await loadOne(stem + ext);
    if (img) return img;
  }
  return null;
}

export class AssetManager {
  constructor() {
    this.images = new Map();
    this.placeholders = new Map();
    this._pending = 0;
    this._done = 0;
    this.onProgress = null;
  }

  progress() {
    return this._pending === 0 ? 1 : this._done / this._pending;
  }

  // Returns a placeholder canvas while attempting to load asynchronously.
  // Subsequent reads via .get(key) return the loaded image once ready.
  loadImage(key, path, label) {
    if (this.images.has(key)) return this.images.get(key);
    this._pending++;
    const ph = makePlaceholder(label || key);
    this.placeholders.set(key, ph);
    this.images.set(key, ph); // start with placeholder so callers can draw immediately

    tryWithExtensions(path).then((img) => {
      if (img) this.images.set(key, img);
      this._done++;
      if (this.onProgress) this.onProgress(this.progress());
    });
    return ph;
  }

  get(key) {
    return this.images.get(key) || this.placeholders.get(key) || makePlaceholder(key);
  }

  isReal(key) {
    const img = this.images.get(key);
    return !!img && img !== this.placeholders.get(key);
  }

  // Wait until all in-flight loads finish (placeholders persist for failures).
  ready() {
    return new Promise((resolve) => {
      const check = () => {
        if (this._done >= this._pending) resolve();
        else setTimeout(check, 30);
      };
      check();
    });
  }
}

export const Assets = new AssetManager();
