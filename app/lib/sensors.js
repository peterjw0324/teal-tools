import { camAxis, topAxis, circMean, circSpread } from './geom.js';
import { findBrightest } from './sunspot.js';

const BUFFER_MS = 600;
const gyro = [];           // 最近 0.6 秒的相對姿態 {t, a, b, g}
let lastRel = null;
let lastAbs = null;
let relCount = 0;

function onRel(e) {
  if (typeof e.alpha !== 'number' || typeof e.beta !== 'number') return;
  relCount++;
  lastRel = e;
  const t = performance.now();
  gyro.push({ t, a: e.alpha, b: e.beta, g: e.gamma || 0 });
  while (gyro.length && t - gyro[0].t > BUFFER_MS) gyro.shift();
}

function onAbs(e) {
  if (typeof e.alpha === 'number') lastAbs = e;
}

// iOS 必須在點擊當下呼叫，第一個 await 之前就要送出權限請求
export async function requestMotion() {
  const D = window.DeviceOrientationEvent;
  if (!D) throw new Error('這個瀏覽器讀不到手機的動作與方向。');
  if (typeof D.requestPermission === 'function') {
    const s = await D.requestPermission();
    if (s !== 'granted') throw new Error('沒有拿到「動作與方向」權限。請到設定 › Safari 打開「動作與方向取用」。');
  }
  window.addEventListener('deviceorientation', onRel);
  if ('ondeviceorientationabsolute' in window) window.addEventListener('deviceorientationabsolute', onAbs);
}

export function motionCount() {
  return relCount;
}

// 最近 0.6 秒的平均姿態；axis 是 'cam'（鏡頭）或 'top'（手機頂端）
export function pose(axis) {
  if (gyro.length < 3) return null;
  const fn = axis === 'cam' ? camAxis : topAxis;
  const list = gyro.map((s) => fn(s.a, s.b, s.g));
  const headings = list.map((x) => x.heading);
  const last = gyro[gyro.length - 1];
  return {
    heading: circMean(headings),
    elev: list.reduce((s, x) => s + x.elev, 0) / list.length,
    spread: circSpread(headings),
    beta: last.b,
    gamma: last.g,
  };
}

// 手機羅盤的頂端方位（磁北），只當參考；手機平放時才有意義
export function compassTop() {
  if (lastRel && typeof lastRel.webkitCompassHeading === 'number' && lastRel.webkitCompassHeading >= 0) {
    return {
      heading: lastRel.webkitCompassHeading,
      accuracy: typeof lastRel.webkitCompassAccuracy === 'number' ? lastRel.webkitCompassAccuracy : null,
      source: 'ios',
    };
  }
  if (lastAbs) return { heading: topAxis(lastAbs.alpha, lastAbs.beta).heading, accuracy: null, source: 'android' };
  return null;
}

export async function startCamera(video) {
  if (video.srcObject) return;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('這個瀏覽器打不開相機。');
  try {
    video.srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    throw new Error('沒有拿到相機權限。請到設定 › Safari › 相機，改成「允許」。');
  }
  await video.play().catch(() => {});
}

export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('這個瀏覽器拿不到位置。')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }),
      () => reject(new Error('沒有拿到位置權限。請到設定 › 隱私權與安全性 › 定位服務，允許 Safari 使用位置。')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 60000 });
  });
}

// 把目前的相機畫面縮小後找太陽
export function detectSun(video, canvas, alignRadius) {
  if (!video.videoWidth) return { found: false, aligned: false };
  const w = 160, h = Math.round((160 * video.videoHeight) / video.videoWidth);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, w, h);
  return findBrightest(ctx.getImageData(0, 0, w, h).data, w, h, alignRadius);
}

export function inAppBrowser() {
  const ua = navigator.userAgent;
  if (/Line\//i.test(ua)) return 'LINE';
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
  if (/Instagram/i.test(ua)) return 'Instagram';
  return '';
}
