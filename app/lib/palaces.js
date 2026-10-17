import { MOUNTAINS } from './mountains.js';

// 八卦宮位，從北開始順時針
export const GUAS = ['坎', '艮', '震', '巽', '離', '坤', '兌', '乾'];
export const DIRS = { 坎: '北', 艮: '東北', 震: '東', 巽: '東南', 離: '南', 坤: '西南', 兌: '西', 乾: '西北', 中: '中央' };

// 每卦三山：壬子癸屬坎、丑艮寅屬艮……戌乾亥屬乾
export function guaOf(mountain) {
  const i = MOUNTAINS.indexOf(mountain);
  return GUAS[Math.floor(((i + 1) % 24) / 3)];
}

// 以「向」朝上的 3×3 排列（左上到右下），和試算表的九宮排法相同
export function gridOrder(faceGua) {
  const k = GUAS.indexOf(faceGua);
  const cw = (n) => GUAS[(k + n) % 8];
  return [cw(7), cw(0), cw(1), cw(6), '中', cw(2), cw(5), cw(4), cw(3)];
}
