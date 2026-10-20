const KEY = 'teal-xuankong-v1';

let memory = null;   // 示範模式：只存在記憶體

export function useMemory() {
  const m = new Map();
  memory = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

function storage() {
  if (memory) return memory;
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
