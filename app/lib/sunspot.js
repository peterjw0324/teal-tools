// 從 RGBA 像素找最亮的區塊（太陽）
// 回傳中心位置（0–1）、離畫面中心的距離（以短邊為 1）、亮區面積比例
export function findBrightest(data, w, h, alignRadius) {
  let max = 0;
  for (let i = 0; i < data.length; i += 4) {
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (l > max) max = l;
  }
  if (max < 245) return { found: false, aligned: false };
  const th = max - 4;
  let sx = 0, sy = 0, n = 0;
  for (let p = 0, k = 0; p < data.length; p += 4, k++) {
    const l = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2];
    if (l >= th) { sx += k % w; sy += Math.floor(k / w); n++; }
  }
  const cx = sx / n + 0.5, cy = sy / n + 0.5;
  const dist = Math.hypot(cx - w / 2, cy - h / 2) / Math.min(w, h);
  const cover = n / (w * h);
  const found = cover < 0.15;
  return { found, aligned: found && dist < alignRadius, dist, cover, cx: cx / w, cy: cy / h };
}
