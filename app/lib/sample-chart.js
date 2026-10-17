// 試算表目前的快取結果：落成年 2026、坐山 30°（九運丑山未向下卦）
// 排盤引擎完成前，結果頁先用這張盤做設計
export const SAMPLE = {
  period: 9,
  sit: '丑',
  face: '未',
  kind: '下卦',
  label: '九運[丑山未向]下卦',
  palaces: {
    離: { yun: 4, shan: 7, xiang: 2 },
    坤: { yun: 6, shan: 9, xiang: 9 },
    兌: { yun: 2, shan: 5, xiang: 4 },
    巽: { yun: 8, shan: 2, xiang: 7 },
    中: { yun: 9, shan: 3, xiang: 6 },
    乾: { yun: 1, shan: 4, xiang: 5 },
    震: { yun: 7, shan: 1, xiang: 8 },
    艮: { yun: 3, shan: 6, xiang: 3 },
    坎: { yun: 5, shan: 8, xiang: 1 },
  },
};
