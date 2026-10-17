import { norm, angDiff, circMean, circSpread, R2D } from './lib/geom.js';
import { panFromFace } from './lib/mountains.js';
import { sunPos, declination, inTaiwan, TAIPEI } from './lib/sun.js';
import * as sensors from './lib/sensors.js';
import * as store from './lib/store.js';
import { guaOf, gridOrder, GUAS, DIRS } from './lib/palaces.js';
import { tagsOf, strengthOf, starNote, shanAdvice, xiangAdvice, summary } from './lib/stars.js';
import { SAMPLE } from './lib/sample-chart.js';
import { chart as computeChart } from './lib/xuankong.js';

const $ = (sel, root = document) => root.querySelector(sel);
const fmt = (d) => (Math.round(d * 10) / 10).toFixed(1);
const ALIGN_RADIUS = 0.02;      // 太陽離中心的容許距離（畫面短邊比例，約 1°）
const CAL_MAX_MS = 180000;      // 校正有效 3 分鐘
const BOUNDARY_YEARS = [1984, 2004, 2024];

const camVideo = $('#camVideo');
const camHolder = $('#camHolder');
const session = { pos: null, roughOffset: null, cal: null, records: [] };
let state = store.load();
function setState(patch) { state = { ...state, ...patch }; store.save(state); }

function inAppHint() {
  const app = sensors.inAppBrowser();
  if (!app) return '';
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  return ` 你正在用 ${app} 內建瀏覽器，請改用 ${isIOS ? 'Safari' : 'Chrome'} 開這個網址。`;
}

// ---------- 畫面堆疊 ----------
const stackEl = $('#stack');
const navbar = $('#navbar');
const navBack = $('#navBack');
const navTitle = $('#navTitle');
const stack = [];
let titleObserver = null;

function build(id, params) {
  const el = document.getElementById(`t-${id}`).content.firstElementChild.cloneNode(true);
  const ctl = SCREENS[id](el, params) || {};
  return { id, el, ctl };
}

function applyNav(entry) {
  navBack.hidden = stack.length < 2;
  navTitle.textContent = entry.ctl.title || '';
  navbar.classList.toggle('dark', !!entry.ctl.dark);
  navbar.classList.remove('scrolled');
  if (titleObserver) titleObserver.disconnect();
  const t = entry.el.querySelector('.large-title');
  if (t && 'IntersectionObserver' in window) {
    titleObserver = new IntersectionObserver(([e]) => navbar.classList.toggle('scrolled', !e.isIntersecting),
      { root: entry.el, rootMargin: `-${navbar.offsetHeight}px 0px 0px 0px` });
    titleObserver.observe(t);
  }
}

function setRoot(id) {
  const entry = build(id);
  stack.push(entry);
  stackEl.appendChild(entry.el);
  applyNav(entry);
  entry.ctl.mount?.();
  history.replaceState({ d: 1 }, '');
}

function push(id, params) {
  const prev = stack[stack.length - 1];
  const entry = build(id, params);
  stack.push(entry);
  entry.el.classList.add('enter');
  stackEl.appendChild(entry.el);
  prev?.ctl.pause?.();
  void entry.el.offsetWidth;   // 先套用起始位置，移除 enter 才會滑入
  entry.el.classList.remove('enter');
  prev?.el.classList.add('under');
  applyNav(entry);
  entry.ctl.mount?.();
  history.pushState({ d: stack.length }, '');
}

function popOne() {
  const top = stack.pop();
  const prev = stack[stack.length - 1];
  top.ctl.unmount?.();
  top.el.classList.add('enter');
  prev.el.classList.remove('under');
  setTimeout(() => top.el.remove(), 420);
  applyNav(prev);
  prev.ctl.resume?.();
}

window.addEventListener('popstate', (e) => {
  const d = e.state?.d || 1;
  while (stack.length > Math.max(1, d)) popOne();
});
navBack.addEventListener('click', () => history.back());

function popTo(id) {
  const i = stack.findIndex((s) => s.id === id);
  if (i >= 0 && i < stack.length - 1) history.go(i + 1 - stack.length);
}

// ---------- Sheet ----------
const sheet = $('#sheet');
const backdrop = $('#sheetBackdrop');
let dragY = null;

function openSheet(id, opts = {}) {
  const tpl = document.getElementById(`s-${id}`);
  $('#sheetBody').replaceChildren(tpl.content.cloneNode(true));
  $('#sheetTitle').textContent = opts.title ?? tpl.dataset.title ?? '';
  opts.fill?.($('#sheetBody'));
  sheet.scrollTop = 0;
  sheet.hidden = false;
  backdrop.hidden = false;
  void sheet.offsetWidth;
  sheet.classList.add('show');
  backdrop.classList.add('show');
}

function closeSheet() {
  sheet.classList.remove('show');
  backdrop.classList.remove('show');
  setTimeout(() => { sheet.hidden = true; backdrop.hidden = true; }, 400);
}

backdrop.addEventListener('click', closeSheet);
$('#sheetDone').addEventListener('click', closeSheet);
sheet.addEventListener('touchstart', (e) => { dragY = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
sheet.addEventListener('touchmove', (e) => {
  if (dragY == null) return;
  sheet.style.transition = 'none';
  sheet.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - dragY)}px)`;
}, { passive: true });
sheet.addEventListener('touchend', (e) => {
  if (dragY == null) return;
  const dy = e.changedTouches[0].clientY - dragY;
  dragY = null;
  sheet.style.transition = '';
  sheet.style.transform = '';
  if (dy > 100) closeSheet();
});

// 計時器小工具：畫面離開或被蓋住時停止
function ticker(fn, ms) {
  let id = null;
  return {
    start() { if (id == null) { fn(); id = setInterval(fn, ms); } },
    stop() { clearInterval(id); id = null; },
  };
}

function checkMark(el, ok) {
  el.classList.toggle('ok', ok);
  el.innerHTML = ok ? '<svg class="ic"><use href="icons.svg#i-checkmark-circle"/></svg>' : '調整中';
}

// ---------- 各畫面 ----------
const SCREENS = {
  welcome(el) {
    if (state.measure) {
      $('[data-last-group]', el).hidden = false;
      $('[data-last] .value', el).textContent = panFromFace(state.measure.faceMag).label;
      $('[data-last]', el).addEventListener('click', () => push('result'));
    }
    $('[data-start]', el).addEventListener('click', () => push('year'));
    return {};
  },

  year(el) {
    const MIN = 1930, MAX = new Date().getFullYear(), ROW = 44;
    const wheel = $('.wheel', el), ul = $('ul', wheel);
    const segBlock = $('[data-lichun]', el), next = $('[data-next]', el);
    for (let y = MIN; y <= MAX; y++) {
      const li = document.createElement('li');
      li.textContent = y;
      li.dataset.year = y;
      ul.appendChild(li);
    }
    let year = Math.min(MAX, Math.max(MIN, state.year || 2000));
    let lichun = state.year === year ? state.lichun || null : null;
    let settle = null;

    function paint() {
      [...ul.children].forEach((li, i) => li.classList.toggle('sel', MIN + i === year));
      const needs = BOUNDARY_YEARS.includes(year);
      segBlock.hidden = !needs;
      segBlock.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === lichun));
      next.disabled = needs && !lichun;
    }
    function scrollToYear(y, smooth) { wheel.scrollTo({ top: (y - MIN) * ROW, behavior: smooth ? 'smooth' : 'auto' }); }

    wheel.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = setTimeout(() => {
        const y = Math.min(MAX, Math.max(MIN, MIN + Math.round(wheel.scrollTop / ROW)));
        if (y !== year) { year = y; lichun = null; paint(); }
      }, 80);
    }, { passive: true });
    ul.addEventListener('click', (e) => { const li = e.target.closest('li'); if (li) scrollToYear(+li.dataset.year, true); });
    wheel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); scrollToYear(Math.min(MAX, Math.max(MIN, year + (e.key === 'ArrowDown' ? 1 : -1))), true); }
    });
    segBlock.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { lichun = b.dataset.v; paint(); } });
    $('[data-where]', el).addEventListener('click', () => openSheet('where'));
    next.addEventListener('click', () => {
      // 以滾輪實際停的位置為準，不等捲動事件
      const y = Math.min(MAX, Math.max(MIN, MIN + Math.round(wheel.scrollTop / ROW)));
      if (y !== year) { year = y; lichun = null; paint(); if (next.disabled) return; }
      setState({ year, lichun: BOUNDARY_YEARS.includes(year) ? lichun : null });
      const sunUp = sunPos(new Date(), TAIPEI.lat, TAIPEI.lon).el >= 2;
      push(sunUp ? 'permissions' : 'night', { reason: 'night' });
    });
    return { title: '落成年', mount() { scrollToYear(year, false); paint(); } };
  },

  permissions(el) {
    const go = $('[data-go]', el), err = $('.notice', el);
    go.addEventListener('click', async () => {
      go.disabled = true;
      err.textContent = '';
      try {
        await sensors.requestMotion();
        await sensors.startCamera(camVideo);
        session.pos = await sensors.getPosition();
        if (!inTaiwan(session.pos.lat, session.pos.lon)) throw new Error('目前位置不在台灣，這個版本只支援台灣。');
        push('calibrate8');
      } catch (e) {
        err.textContent = e.message + inAppHint();
      } finally {
        go.disabled = false;
      }
    });
    return { title: '權限' };
  },

  calibrate8(el) {
    const acc = $('[data-acc]', el), next = $('[data-next]', el);
    const started = Date.now();
    const t = ticker(() => {
      const c = sensors.compassTop();
      const secs = (Date.now() - started) / 1000;
      let ok;
      if (c?.source === 'ios' && c.accuracy != null) {
        ok = c.accuracy > 0 && c.accuracy <= 15;
        acc.textContent = `±${Math.round(c.accuracy)}°${ok ? '　好了' : ''}`;
      } else if (c) {
        ok = secs >= 5;
        acc.textContent = ok ? '好了' : `再畫 ${Math.ceil(5 - secs)} 秒`;
      } else {
        ok = true;
        acc.textContent = '這支手機沒有羅盤資料';
      }
      acc.classList.toggle('ok', ok);
      next.disabled = !(ok || secs >= 12);
    }, 200);
    next.addEventListener('click', () => {
      const c = sensors.compassTop(), g = sensors.pose('top');
      const flat = g && Math.abs(g.beta) < 25 && Math.abs(g.gamma) < 25;
      session.roughOffset = c && flat ? angDiff(c.heading, g.heading) : null;
      push('sun');
    });
    return { title: '校正羅盤', mount: t.start, unmount: t.stop, pause: t.stop, resume: t.start };
  },

  sun(el) {
    const stage = $('.cam-stage', el), reticle = $('.reticle', el), ring = $('.ring', el), mark = $('.sunmark', el);
    const guide = $('.guide', el), guideIcon = $('.guide .ic', el), guideText = $('.guide span', el);
    const hud = $('.hud', el), status = $('[data-status]', el), warn = $('.notice', el), go = $('[data-go]', el);
    const canvas = document.createElement('canvas');
    let sun = { found: false, aligned: false };

    function placeOverlay() {
      const dW = stage.clientWidth, dH = stage.clientHeight, vW = camVideo.videoWidth, vH = camVideo.videoHeight;
      if (!vW) return;
      const sc = Math.max(dW / vW, dH / vH), ox = (dW - vW * sc) / 2, oy = (dH - vH * sc) / 2;
      const d = Math.max(16, ALIGN_RADIUS * Math.min(vW, vH) * sc * 2);
      ring.style.width = ring.style.height = `${d}px`;
      mark.hidden = !sun.found;
      if (sun.found) { mark.style.left = `${ox + sun.cx * vW * sc}px`; mark.style.top = `${oy + sun.cy * vH * sc}px`; }
      reticle.classList.toggle('on', sun.aligned);
    }

    const t = ticker(() => {
      const now = new Date();
      const sp = sunPos(now, session.pos.lat, session.pos.lon);
      const decl = declination(session.pos.lat, session.pos.lon, now);
      const g = sensors.pose('cam');
      sun = sensors.detectSun(camVideo, canvas, ALIGN_RADIUS);
      placeOverlay();
      hud.textContent = `太陽 方位 ${fmt(sp.az)}°　仰角 ${fmt(sp.el)}°${g ? `　鏡頭仰角 ${fmt(g.elev)}°` : ''}`;

      if (!sun.found && g && session.roughOffset != null) {
        const camTrue = norm(g.heading + session.roughOffset + decl);
        const dAz = angDiff(sp.az, camTrue), dEl = sp.el - g.elev;
        guide.hidden = false;
        guideIcon.style.transform = `rotate(${Math.atan2(dAz, dEl) * R2D}deg)`;
        guideText.textContent = Math.abs(dAz) > 15 ? `往${dAz > 0 ? '右' : '左'}轉約 ${Math.round(Math.abs(dAz))}°`
          : Math.abs(dEl) > 8 ? `往${dEl > 0 ? '上' : '下'}抬一點` : '太陽就在附近';
      } else {
        guide.hidden = true;
      }

      const elevOk = g && Math.abs(g.elev - sp.el) <= 6;
      status.textContent = sun.aligned ? '對準了，可以校正。' : sun.found ? '把橘色圈移進中間的圓圈。' : '把相機轉向太陽。';
      const w = [];
      if (sp.el < 2) w.push('太陽已經下山，現在沒辦法用太陽量。');
      else if (sp.el > 65) w.push('太陽太高，量出來的誤差會變大，建議早上 10 點前或下午 2 點後再量。');
      if (sun.found && g && !elevOk) w.push('這個亮點的高度和太陽對不上，可能是燈或反光。');
      if (g && g.spread > 1.5) w.push('手機在晃，請拿穩。');
      if (!g && sensors.motionCount() === 0) w.push(`讀不到手機的動作感測器。${inAppHint()}`);
      warn.textContent = w.join(' ');
      go.disabled = !(g && sun.aligned && elevOk && g.spread <= 1.5 && sp.el >= 2);
    }, 100);

    go.addEventListener('click', () => {
      const now = new Date(), g = sensors.pose('cam');
      const sp = sunPos(now, session.pos.lat, session.pos.lon);
      session.cal = { t: Date.now(), offset: norm(sp.az - g.heading), decl: declination(session.pos.lat, session.pos.lon, now) };
      session.records = [];
      push('door');
    });
    $('[data-nosun]', el).addEventListener('click', () => push('night', { reason: 'cloudy' }));

    const attach = () => { stage.prepend(camVideo); camVideo.play().catch(() => {}); };
    return {
      dark: true,
      mount() { attach(); t.start(); window.addEventListener('resize', placeOverlay); },
      unmount() { t.stop(); camHolder.appendChild(camVideo); window.removeEventListener('resize', placeOverlay); },
      pause: t.stop,
      resume() { attach(); t.start(); },
    };
  },

  door(el) {
    const pan = $('[data-pan]', el), deg = $('[data-deg]', el), flat = $('[data-flat]', el), steady = $('[data-steady]', el), age = $('[data-age]', el);
    const rec = $('[data-rec]', el), done = $('[data-done]', el), count = $('[data-count]', el), warn = $('.notice', el);

    function reading() {
      const g = sensors.pose('top');
      if (!g || !session.cal) return null;
      const sitTrue = norm(g.heading + session.cal.offset);
      const faceTrue = norm(sitTrue + 180);
      return { g, sitTrue, faceTrue, faceMag: norm(faceTrue - session.cal.decl) };
    }
    function paintCount() {
      const n = session.records.length;
      done.hidden = n === 0;
      count.textContent = n
        ? `已記錄 ${n} 筆，各筆最多差 ${fmt(circSpread(session.records.map((r) => r.faceMag)))}°。`
        : '建議沿著門換兩、三個位置，各記一筆。';
    }

    const t = ticker(() => {
      const r = reading();
      if (!r) return;
      const isFlat = Math.abs(r.g.beta) < 8 && Math.abs(r.g.gamma) < 8;
      const isSteady = r.g.spread < 1;
      const ageMs = Date.now() - session.cal.t;
      const p = panFromFace(r.faceMag);
      pan.textContent = p.label;
      deg.textContent = `向 ${fmt(r.faceMag)}°（磁北）`;
      checkMark(flat, isFlat);
      checkMark(steady, isSteady);
      age.textContent = `${Math.round(ageMs / 1000)} 秒`;
      warn.textContent = ageMs > CAL_MAX_MS ? '校正超過 3 分鐘，陀螺儀可能累積誤差，請重新校正。' : '';
      rec.disabled = !(isFlat && isSteady && ageMs <= CAL_MAX_MS);
    }, 100);

    rec.addEventListener('click', () => {
      const r = reading();
      if (!r) return;
      const c = sensors.compassTop();
      const sitMag = norm(r.sitTrue - session.cal.decl);
      session.records.push({ faceMag: r.faceMag, faceTrue: r.faceTrue, compassDev: c ? angDiff(c.heading, sitMag) : null });
      paintCount();
    });
    done.addEventListener('click', () => {
      const recs = session.records;
      const devs = recs.map((r) => r.compassDev).filter((d) => d != null);
      setState({
        measure: {
          method: 'sun',
          faceMag: circMean(recs.map((r) => r.faceMag)),
          faceTrue: circMean(recs.map((r) => r.faceTrue)),
          decl: session.cal.decl,
          count: recs.length,
          spread: circSpread(recs.map((r) => r.faceMag)),
          compassDev: devs.length ? devs.reduce((a, b) => a + b, 0) / devs.length : null,
          at: Date.now(),
        },
      });
      push('result');
    });
    $('[data-recal]', el).addEventListener('click', () => popTo('sun'));
    return { title: '量向', mount() { paintCount(); t.start(); }, unmount: t.stop, pause: t.stop, resume: t.start };
  },

  result(el) {
    const m = state.measure;
    const p = panFromFace(m.faceMag);
    $('[data-pan]', el).textContent = p.label;
    $('[data-deg]', el).textContent = `向 ${fmt(p.face)}°・坐 ${fmt(p.sit)}°（磁北）`;
    const edge = $('[data-edge]', el);
    edge.hidden = p.faceMountain.edge >= 3;
    edge.textContent = `向落在「${p.faceMountain.name}」和「${p.faceMountain.neighbor}」交界 ${fmt(p.faceMountain.edge)}° 內，差一點就可能換成另一個盤。`;
    $('[data-method]', el).textContent = m.method === 'sun' ? '太陽校正' : '手動輸入';
    $('[data-records-row]', el).hidden = m.method !== 'sun';
    $('[data-records]', el).textContent = `${m.count} 筆，最多差 ${fmt(m.spread)}°`;
    const hasDev = m.compassDev != null;
    $('[data-compass-row]', el).hidden = !hasDev;
    if (hasDev) {
      const abs = Math.abs(m.compassDev);
      $('[data-compass]', el).textContent = abs < 3 ? `很準，只差 ${fmt(abs)}°` : `偏了 ${Math.round(abs)}°`;
      $('[data-compass-note]', el).hidden = abs < 3;
    }
    $('[data-chart]', el).addEventListener('click', () => push('chart'));
    $('[data-again]', el).addEventListener('click', () => {
      const back = ['door', 'manual'].find((id) => stack.some((s) => s.id === id));
      if (back) popTo(back); else push('year');
    });
    return { title: '量測結果' };
  },

  chart(el) {
    // 交運年（1984、2004、2024）選「立春以前」算前一運；試算表只看年份，這裡依立春交運
    const m = state.measure;
    const year = state.year && BOUNDARY_YEARS.includes(state.year) && state.lichun === 'before' ? state.year - 1 : state.year;
    const c = year && m ? computeChart({ year, sitDeg: norm(m.faceMag + 180) }) : SAMPLE;
    const NUM = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    const SHORT = { 財星: '財', 生氣星: '生', 退氣星: '退', 兇星: '兇', 文昌: '文', 中性: '中' };
    const sitG = guaOf(c.sit), faceG = guaOf(c.face);
    const role = (g) => (g === faceG ? '向首' : g === sitG ? '坐山' : '');
    const name = (g) => (g === '中' ? '中宮' : `${g}・${DIRS[g]}`);
    const tone = (n) => {
      const t = tagsOf(n);
      if (t.includes('兇星')) return 'bad';
      return t.includes('財星') && !t.includes('退氣星') ? 'wealth' : '';
    };
    const star = (n) => `<span class="star"><b>${n}</b><small class="${tone(n)}">${tagsOf(n).map((t) => SHORT[t]).join('・')}</small></span>`;
    const sv = (area, n) => `<span class="st-${strengthOf(n)}">${area}${strengthOf(n)}</span>`;

    $('[data-title]', el).textContent = `${c.sit}山${c.face}向`;
    $('[data-sub]', el).textContent = c === SAMPLE ? `${NUM[c.period]}運・${c.kind}` : `${NUM[c.period]}運・${c.kind}・${state.year} 年落成`;
    $('[data-sample]', el).hidden = c !== SAMPLE;

    $('[data-grid]', el).innerHTML = gridOrder(faceG).map((g) => {
      const p = c.palaces[g], r = role(g);
      return `<button class="cell${g === faceG ? ' face' : ''}" data-g="${g}" aria-label="${name(g)}，山星 ${p.shan}，向星 ${p.xiang}，運星${NUM[p.yun]}">`
        + `<span class="cell-head">${g === '中' ? '中宮' : `${g} ${DIRS[g]}`}${r ? `<em>${r === '向首' ? '向' : '坐'}</em>` : ''}</span>`
        + `<span class="stars">${star(p.shan)}${star(p.xiang)}</span><span class="yun">${NUM[p.yun]}</span></button>`;
    }).join('');

    const s = summary(c);
    const names = (list) => list.map((g) => `${g}（${DIRS[g]}）`).join('、');
    const palaceShort = (g) => (g === '中' ? '中宮' : g);
    $('[data-pattern]', el).textContent = s.pattern || `山星在${palaceShort(s.shanAt)}，向星在${palaceShort(s.xiangAt)}`;
    $('[data-shengqi]', el).textContent = s.shengqi.length ? names(s.shengqi) : '無';
    $('[data-caution]', el).textContent = s.caution.length ? `${names(s.caution)}・五黃` : '無';

    const k = GUAS.indexOf(faceG);
    const order = [...GUAS.map((_, i) => GUAS[(k + i) % 8]), '中'];
    $('[data-list]', el).innerHTML = order.map((g) => {
      const p = c.palaces[g], r = role(g);
      return `<button class="row" data-g="${g}"><span class="grow">${name(g)}${r ? `<em class="role">${r}</em>` : ''}`
        + `<span class="sub">山 ${p.shan}　${tagsOf(p.shan).join('・')}<br>向 ${p.xiang}　${tagsOf(p.xiang).join('・')}</span></span>`
        + `<span class="value">${sv('人丁', p.shan)}・${sv('財運', p.xiang)}</span><svg class="chev"><use href="icons.svg#i-chevron-forward"/></svg></button>`;
    }).join('');

    const block = (label, n, area, advice) => `<div class="group"><div class="row"><span class="grow">${label} ${n}`
      + `<span class="sub">${tagsOf(n).join('・')}${starNote(n) ? `：${starNote(n)}` : ''}</span></span>`
      + `<span class="value"><span class="st-${strengthOf(n)}">${area}${strengthOf(n)}</span></span></div></div><p class="advice">${advice}</p>`;
    function openPalace(g) {
      const p = c.palaces[g];
      openSheet('palace', {
        title: name(g),
        fill(body) {
          body.innerHTML = `<p class="sheet-sub">${[role(g), `運星${NUM[p.yun]}`].filter(Boolean).join('・')}</p>`
            + block('山星', p.shan, '人丁', shanAdvice(p.shan))
            + block('向星', p.xiang, '財運', xiangAdvice(p.xiang))
            + '<p class="group-footer">強弱與佈置建議是規則草案，確認後再定稿。</p>';
        },
      });
    }
    el.addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) openPalace(b.dataset.g); });
    return { title: '你家的盤' };
  },

  night(el, params) {
    const isNight = params?.reason === 'night';
    $('.large-title', el).textContent = isNight ? '現在是晚上' : '現在看不到太陽';
    $('.lead', el).textContent = isNight ? '用太陽量方位最準，請在晴天白天再來量。' : '用太陽量方位最準，請在看得到太陽的晴天再來量。';
    $('[data-manual]', el).addEventListener('click', () => push('manual'));
    $('[data-later]', el).addEventListener('click', () => popTo('welcome'));
    return { title: '其他量法' };
  },

  manual(el) {
    const input = $('input', el), pan = $('[data-pan]', el), edge = $('[data-edge]', el), go = $('[data-go]', el);
    const value = () => {
      const v = parseFloat(input.value);
      return Number.isFinite(v) && v >= 0 && v < 360 ? v : null;
    };
    function paint() {
      const v = value();
      go.disabled = v == null;
      edge.hidden = true;
      if (v == null) { pan.textContent = '—'; return; }
      const p = panFromFace(v);
      pan.textContent = p.label;
      edge.hidden = p.faceMountain.edge >= 3;
      edge.textContent = `落在「${p.faceMountain.name}」和「${p.faceMountain.neighbor}」交界 ${fmt(p.faceMountain.edge)}° 內。`;
    }
    input.addEventListener('input', paint);
    go.addEventListener('click', () => {
      setState({ measure: { method: 'manual', faceMag: value(), faceTrue: null, decl: null, count: 1, spread: 0, compassDev: null, at: Date.now() } });
      push('result');
    });
    return { title: '手動輸入', mount: paint };
  },
};

setRoot('welcome');
