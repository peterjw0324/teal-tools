import { guaOf, GUAS } from './palaces.js';

// 九運星的分類（Peter 2026-10-17 提供：6891 財星、68 退氣星、12 生氣星、257 兇星、4 文昌、3 中性）
const TAGS = {
  1: ['財星', '生氣星'],
  2: ['生氣星', '兇星'],
  3: ['中性'],
  4: ['文昌'],
  5: ['兇星'],
  6: ['財星', '退氣星'],
  7: ['兇星'],
  8: ['財星', '退氣星'],
  9: ['財星'],
};

// 以下強弱與建議是規則草案，待 Peter 確認
const SCORE = { 9: 3, 1: 2, 8: 1, 6: 1, 4: 1, 2: 0, 3: 0, 7: -1, 5: -2 };
const NEXT_STAR = 1;   // 九運的下一運

export function tagsOf(n) {
  return TAGS[n] || [];
}

export function strengthOf(n) {
  const s = SCORE[n];
  if (s >= 2) return '強';
  return s >= 0 ? '中' : '弱';
}

// 一句補充：當令、生氣或退氣
export function starNote(n) {
  if (n === 9) return '九運當令的旺星';
  const t = tagsOf(n);
  if (t.includes('退氣星')) return '九運已經退氣';
  if (t.includes('生氣星') && !t.includes('兇星')) return '會越來越旺';
  return '';
}

// 山星管人丁與健康：吉星宜高宜靜，兇星不宜高
export function shanAdvice(n) {
  const s = strengthOf(n);
  if (s === '強') return '這一方適合「高」和「靜」：外面有高樓或靠山最好；屋內適合放高櫃、書櫃，或當臥室、書房。';
  if (s === '弱') return '這一方不宜「高」：避免高大壓迫的建物或家具，保持清爽、少堆東西。';
  return tagsOf(n).includes('兇星') ? '這一方高低都可以，但不宜大動，保持整齊就好。' : '這一方高低都可以，保持整齊就好。';
}

// 向星管財運：吉星宜低宜動，兇星宜靜
export function xiangAdvice(n) {
  const s = strengthOf(n);
  if (s === '強') return '這一方適合「低」和「動」：外面開闊、有路或見水最好；屋內適合開門、走道或客廳，常有人走動。';
  if (s === '弱') return '這一方適合「靜」：不宜開門、放魚缸或水景，可以用高櫃或屏風擋一下。';
  return tagsOf(n).includes('兇星') ? '這一方不必刻意加強，也不宜大動，保持通風整潔就好。' : '這一方不必刻意加強，保持通風、整潔。';
}

// 依盤的元運看令星落在哪裡
export function pattern(chart) {
  const P = chart.period, sitG = guaOf(chart.sit), faceG = guaOf(chart.face);
  const at = (key) => Object.keys(chart.palaces).find((g) => chart.palaces[g][key] === P);
  const shanAt = at('shan'), xiangAt = at('xiang');
  if (shanAt === sitG && xiangAt === faceG) return '旺山旺向';
  if (shanAt === faceG && xiangAt === faceG) return '雙星到向';
  if (shanAt === sitG && xiangAt === sitG) return '雙星到坐';
  if (shanAt === faceG && xiangAt === sitG) return '上山下水';
  return null;
}

// 免費的初步結論：格局、生氣方（向星為九運下一運）、需留意（五黃）
export function summary(chart) {
  const outer = GUAS.filter((g) => chart.palaces[g]);
  return {
    pattern: pattern(chart),
    shengqi: outer.filter((g) => chart.palaces[g].xiang === NEXT_STAR),
    caution: outer.filter((g) => chart.palaces[g].shan === 5 || chart.palaces[g].xiang === 5),
  };
}
