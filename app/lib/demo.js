// 示範模式：用模擬的感測器自動走到指定步驟，給「怎麼用」說明頁的 iPhone 外框用
// 網址：index.html?demo=welcome｜year｜permissions｜calibrate8｜sun｜door｜result｜chart｜palace
import { sunPos } from './sun.js';
import { norm } from './geom.js';

const DEMO_TIME = '2026-10-15T02:00:00Z';     // 台北上午 10:00，太陽在東南方
const POS = { latitude: 25.03, longitude: 121.56, accuracy: 12 };
const YEAR = 2025;
const GYRO_OFFSET = 37;        // 陀螺儀和真北差 37°，示範校正會把它消掉
const COMPASS_FLAT = 42;       // 8 字校正時手機羅盤的讀數（磁北）
const DOOR_ALPHA = 11.7;       // 坐山真北 25.3°（磁北約 30.4°）→ 丑山未向
const COMPASS_AT_DOOR = 52;    // 手機羅盤在大門的讀數，示範羅盤被干擾
const ORDER = ['welcome', 'year', 'permissions', 'calibrate8', 'sun', 'door', 'result', 'chart', 'palace'];
const LIVE = ['calibrate8', 'sun', 'door'];   // 停在這幾步時才需要持續的感測器資料

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const top = () => [...document.querySelectorAll('#stack > .screen')].pop();
const q = (sel) => top().querySelector(sel);
let loop = null;
let skyTimer = null;

function fire(a, b, g, extra = {}) {
  const e = new DeviceOrientationEvent('deviceorientation', { alpha: a, beta: b, gamma: g, absolute: false });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v });
  window.dispatchEvent(e);
}

function keep(a, b, g, extra) {
  clearInterval(loop);
  loop = setInterval(() => fire(a, b, g, extra), 100);
}

// 模擬相機：藍天，太陽在正中央
function fakeSky() {
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 960;
  const x = c.getContext('2d');
  const stream = c.captureStream(15);
  const draw = () => {
    const sky = x.createLinearGradient(0, 0, 0, 960);
    sky.addColorStop(0, '#4f7fb6');
    sky.addColorStop(0.7, '#9fbad6');
    sky.addColorStop(1, '#d9e2ea');
    x.fillStyle = sky;
    x.fillRect(0, 0, 720, 960);
    const sun = x.createRadialGradient(360, 480, 0, 360, 480, 130);
    sun.addColorStop(0, '#fff');
    sun.addColorStop(0.11, '#fff');
    sun.addColorStop(0.32, 'rgba(255, 250, 235, .35)');
    sun.addColorStop(1, 'rgba(255, 250, 235, 0)');
    x.fillStyle = sun;
    x.fillRect(0, 0, 720, 960);
  };
  draw();
  skyTimer = setInterval(draw, 400);
  return stream;
}

export function install() {
  const RealDate = Date;
  const shift = new RealDate(DEMO_TIME) - RealDate.now();
  window.Date = class extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(RealDate.now() + shift); }
    static now() { return RealDate.now() + shift; }
  };
  if (window.DeviceOrientationEvent) window.DeviceOrientationEvent.requestPermission = () => Promise.resolve('granted');
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => fakeSky();
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition = (ok) => ok({ coords: POS });
  const style = document.createElement('style');
  style.textContent = '.screen, .sheet, .sheet-backdrop { transition: none !important; }';
  document.head.appendChild(style);
}

async function click(sel, ms = 150) {
  q(sel).click();
  await sleep(ms);
}

async function whenEnabled(sel) {
  for (let i = 0; i < 40 && q(sel)?.disabled !== false; i++) await sleep(100);
}

export async function run(step) {
  const n = ORDER.indexOf(step);
  if (n >= 1) {
    await click('[data-start]');
    q('.wheel').scrollTo({ top: (YEAR - 1930) * 44 });
    await sleep(150);
  }
  if (n >= 2) await click('[data-next]');
  if (n >= 3) {
    keep(0, 0, 0, { webkitCompassHeading: COMPASS_FLAT, webkitCompassAccuracy: 10 });
    await click('[data-go]', 500);
  }
  if (n >= 4) {
    await whenEnabled('[data-next]');
    await click('[data-next]', 200);
    const sp = sunPos(new Date(), POS.latitude, POS.longitude);
    keep(norm(-(sp.az - GYRO_OFFSET)), 90 + sp.el, 0);
  }
  if (n >= 5) {
    await whenEnabled('[data-go]');
    await click('[data-go]', 200);
    keep(DOOR_ALPHA, 0, 0, { webkitCompassHeading: COMPASS_AT_DOOR });
    await whenEnabled('[data-rec]');
    await click('[data-rec]', 300);
    await click('[data-rec]', 150);
  }
  if (n >= 6) await click('[data-done]', 200);
  if (n >= 7) await click('[data-chart]', 250);
  if (n >= 8) await click('[data-grid] .cell.face', 300);
  // 說明頁同時開著好幾個示範畫面，用不到的模擬相機和感測器先關掉
  if (!LIVE.includes(step)) clearInterval(loop);
  if (step !== 'sun') {
    clearInterval(skyTimer);
    document.getElementById('camVideo').srcObject?.getTracks().forEach((track) => track.stop());
  }
  window.__xkDemoReady = step;
  window.parent?.postMessage({ type: 'xk-demo-ready', step }, '*');
}
