// 角度與手機姿態的純函式（瀏覽器與 Node 共用）
export const D2R = Math.PI / 180;
export const R2D = 180 / Math.PI;

export function norm(d) {
  const r = d % 360;
  return r < 0 ? r + 360 : r;
}

// 帶正負號的角度差 a − b，範圍 (−180, 180]
export function angDiff(a, b) {
  const d = norm(a - b);
  return d > 180 ? d - 360 : d;
}

export function circMean(list) {
  let x = 0, y = 0;
  for (const h of list) { x += Math.cos(h * D2R); y += Math.sin(h * D2R); }
  return norm(Math.atan2(y, x) * R2D);
}

// 一組方位裡，離平均最遠的那一筆差幾度
export function circSpread(list) {
  if (list.length < 2) return 0;
  const m = circMean(list);
  return Math.max(...list.map((h) => Math.abs(angDiff(h, m))));
}

// DeviceOrientation 的 alpha、beta、gamma → R = Rz(α)·Rx(β)·Ry(γ)
// 後鏡頭光軸 = R·(0,0,−1)，回傳水平方位與仰角
export function camAxis(a, b, g) {
  const ca = Math.cos(a * D2R), sa = Math.sin(a * D2R);
  const cb = Math.cos(b * D2R), sb = Math.sin(b * D2R);
  const cg = Math.cos(g * D2R), sg = Math.sin(g * D2R);
  const E = -ca * sg - sa * sb * cg;
  const N = -sa * sg + ca * sb * cg;
  const U = -cb * cg;
  return { heading: norm(Math.atan2(E, N) * R2D), elev: Math.asin(Math.max(-1, Math.min(1, U))) * R2D };
}

// 手機頂端 = R·(0,1,0)；beta 不到 90° 時，水平方位只和 alpha 有關
export function topAxis(a, b) {
  const ca = Math.cos(a * D2R), sa = Math.sin(a * D2R);
  const cb = Math.cos(b * D2R), sb = Math.sin(b * D2R);
  return { heading: norm(Math.atan2(-sa * cb, ca * cb) * R2D), elev: Math.asin(Math.max(-1, Math.min(1, sb))) * R2D };
}
