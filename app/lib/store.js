const KEY = 'teal-xuankong-v1';

function storage() {
  try { return globalThis.window ? window.localStorage : null; } catch { return null; }
}

export function load() {
  try {
    const raw = storage()?.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// 私密瀏覽等情況存不了，照常運作
export function save(state) {
  try { storage()?.setItem(KEY, JSON.stringify(state)); } catch { /* 存不了就算了 */ }
}

export function clear() {
  try { storage()?.removeItem(KEY); } catch { /* 清不了就算了 */ }
}
