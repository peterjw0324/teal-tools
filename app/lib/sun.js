import { norm, D2R, R2D } from './geom.js';

export const TAIPEI = { lat: 25.03, lon: 121.56 };

// NOAA 太陽位置演算法：方位角以真北為 0°、順時針；仰角含大氣折射
export function sunPos(date, lat, lon) {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const jc = (jd - 2451545) / 36525;
  const L0 = norm(280.46646 + jc * (36000.76983 + jc * 0.0003032));
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C = Math.sin(M * D2R) * (1.914602 - jc * (0.004817 + 0.000014 * jc))
    + Math.sin(2 * M * D2R) * (0.019993 - 0.000101 * jc) + Math.sin(3 * M * D2R) * 0.000289;
  const omega = 125.04 - 1934.136 * jc;
  const appLong = L0 + C - 0.00569 - 0.00478 * Math.sin(omega * D2R);
  const obliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60
    + 0.00256 * Math.cos(omega * D2R);
  const decl = Math.asin(Math.sin(obliq * D2R) * Math.sin(appLong * D2R)) * R2D;
  const y = Math.tan((obliq / 2) * D2R) ** 2;
  const eot = 4 * R2D * (y * Math.sin(2 * L0 * D2R) - 2 * e * Math.sin(M * D2R)
    + 4 * e * y * Math.sin(M * D2R) * Math.cos(2 * L0 * D2R)
    - 0.5 * y * y * Math.sin(4 * L0 * D2R) - 1.25 * e * e * Math.sin(2 * M * D2R));
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
  const tst = (((utcMin + eot + 4 * lon) % 1440) + 1440) % 1440;
  const ha = tst / 4 - 180;
  const cosZ = Math.sin(lat * D2R) * Math.sin(decl * D2R) + Math.cos(lat * D2R) * Math.cos(decl * D2R) * Math.cos(ha * D2R);
  const zen = Math.acos(Math.max(-1, Math.min(1, cosZ))) * R2D;
  const den = Math.cos(lat * D2R) * Math.sin(zen * D2R);
  let az = 180;
  if (Math.abs(den) > 1e-9) {
    const a = Math.acos(Math.max(-1, Math.min(1, (Math.sin(lat * D2R) * Math.cos(zen * D2R) - Math.sin(decl * D2R)) / den))) * R2D;
    az = ha > 0 ? norm(a + 180) : norm(540 - a);
  }
  const el = 90 - zen;
  const te = Math.tan(el * D2R);
  let refr = 0;
  if (el <= 85) {
    if (el > 5) refr = 58.1 / te - 0.07 / te ** 3 + 0.000086 / te ** 5;
    else if (el > -0.575) refr = 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)));
    else refr = -20.772 / te;
  }
  return { az, el: el + refr / 3600 };
}

// 台灣磁偏角（WMM2025 擬合，本島、澎湖、金門 2026–2028 誤差 < 0.01°；偏西為負）
export function declination(lat, lon, date) {
  const x = lat - 24, y = lon - 121;
  const year = date.getUTCFullYear();
  const t = year + (date.getTime() - Date.UTC(year, 0, 1)) / 31557600000 - 2027;
  return -4.75725 - 0.22783 * x - 0.13264 * y - 0.00148 * x * x - 0.00572 * x * y + 0.00609 * y * y - 0.03367 * t;
}

export function inTaiwan(lat, lon) {
  return lat > 21.5 && lat < 26.6 && lon > 117.8 && lon < 122.5;
}
