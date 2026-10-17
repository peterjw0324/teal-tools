import { norm } from './geom.js';

export const MOUNTAINS = ['子', '癸', '丑', '艮', '寅', '甲', '卯', '乙', '辰', '巽', '巳', '丙', '午', '丁', '未', '坤', '申', '庚', '酉', '辛', '戌', '乾', '亥', '壬'];

// 方位所在的山、離最近交界幾度、交界另一邊是哪一山
export function mountainOf(deg) {
  const p = norm(deg + 7.5);
  const index = Math.floor(p / 15) % 24;
  const pos = p % 15;
  return {
    name: MOUNTAINS[index],
    index,
    edge: Math.min(pos, 15 - pos),
    neighbor: pos < 7.5 ? MOUNTAINS[(index + 23) % 24] : MOUNTAINS[(index + 1) % 24],
  };
}

// 由向的度數得到坐向
export function panFromFace(faceDeg) {
  const face = norm(faceDeg);
  const sit = norm(face + 180);
  const faceMountain = mountainOf(face);
  const sitMountain = mountainOf(sit);
  return { face, sit, faceMountain, sitMountain, label: `${sitMountain.name}山${faceMountain.name}向` };
}
