// ==========================================================
// Classimal World 세계지도 엔진 (HTML5 Canvas, 외부 라이브러리 없음)
// - Natural Earth 1:110m 실제 해안선·국경·호수로 그린 3D 지구본 / 평면 세계지도
// - 21개 도시 마커, 드래그·관성 회전·확대, 나라 이름 표시, 랜드마크 상세창
// ==========================================================
import { $, esc, fmt } from './core.js';

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const GEO_URL = new URL('../assets/world-110m.json', import.meta.url);

// 평면 지도는 우리나라 교과서처럼 태평양을 가운데에 둔다 (지도 끝: 서경 30도, 대서양 한가운데)
const FLAT_CENTER_LON = 150;
const MAP_W = 2 * Math.PI * 0.8707;   // Natural Earth 도법의 가로 폭
const MAP_H = 2 * 1.4224;             // 세로 높이

// 나라 색 (Natural Earth MAPCOLOR7 번호: 이웃한 나라끼리 색이 겹치지 않음)
const LAND_COLORS = ['#f2d38c', '#a8d79a', '#f2b29b', '#c5b5e9', '#8fd2c2', '#f4c2d5', '#e2d2a0'];
const ICE_COLOR = '#edf4fb';

export const KIND_COLOR = { mine: '#10b981', friend: '#a855f7', empty: '#f5a524' };
export const KIND_LABEL = { mine: '내 영토', friend: '친구 영토', empty: '미개척' };
export const CONTINENT_NAMES = { asia: '아시아', europe: '유럽', americas: '아메리카', africa: '아프리카', oceania: '오세아니아' };

// 지도 위 대륙·바다 이름 [이름, 위도, 경도, 바다 여부]
const GEO_LABELS = [
  ['아시아', 47, 95, 0], ['유럽', 56, 32, 0], ['아프리카', 5, 21, 0], ['북아메리카', 47, -101, 0],
  ['남아메리카', -14, -59, 0], ['오세아니아', -24, 134, 0], ['남극', -80, 30, 0],
  ['북태평양', 24, 172, 1], ['남태평양', -24, -128, 1], ['북대서양', 31, -42, 1], ['남대서양', -24, -16, 1],
  ['인도양', -22, 79, 1], ['북극해', 82, 40, 1], ['남극해', -62, 120, 1],
];

// 대륙·바다 이름이 도시와 겹칠 때 옮겨 볼 자리
const LABEL_NUDGE = [[0, 0], [0, -18], [0, 18], [-34, 0], [34, 0], [-28, -16], [28, 16], [28, -16], [-28, 16]];

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const wrap180 = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : '#6366f1');

// ─────────────────────────── 도시 국가 영역 ───────────────────────────
// 21개 도시는 저마다 하나의 '도시 국가'예요. 도시 국가의 경계(옅게 칠한 땅과 테두리)는 이웃 도시와의
// 가운데 선에서 나뉘고, 그 안에서 학생 영토(진하게 칠한 땅)가 칸 수만큼 넓어져요.
// 여러 학생이 함께 살면 칸 수만큼 부채꼴로 나눠 학생마다 다른 색으로 칠해요.
const ZONE_MAX = 18;   // 도시 국가 경계의 가장 큰 반지름 (위도 1도 ≈ 111km)
const ZONE_STEP = 5;   // 둘레를 그리는 각도 간격
const ZONE_GAP = 0.4;  // 이웃 도시 국가와 사이를 조금 띄워 경계가 보이게
/** 영토 칸 수 → 학생 영토 반지름(도). 1칸 늘 때마다 약 67km씩 넓어져 도시 국가 경계까지 자란다 */
export const zoneRadius = (tiles) => (tiles > 0 ? clamp(2.5 + 0.6 * tiles, 3, ZONE_MAX) : 0);
/** 도시 국가의 전체 영토 칸 수 */
export const zoneTiles = (city) => (city.residents || []).reduce((a, r) => a + Math.max(0, Number(r.tiles) || 0), 0);

/** 학생마다 다른 영토 색 (내 영토는 초록. 다른 학생에게는 초록 계열을 쓰지 않는다) */
export function ownerColor(r, myId = null) {
  if (myId && r.id === myId) return KIND_COLOR.mine;
  let n = Number(r.number);
  if (!Number.isFinite(n) || n <= 0) n = [...String(r.id || '')].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 997, 7);
  const idx = (n * 8) % 21;                 // 번호가 이웃한 학생끼리 색이 멀어지도록 섞는다
  const hue = (190 + idx * (270 / 21)) % 360; // 초록(100~190도)은 '내 영토' 몫
  return `hsl(${Math.round(hue)}, ${n % 2 ? 80 : 70}%, ${n % 2 ? 56 : 64}%)`;
}

/** 위도·경도에서 방위각(북쪽부터 시계 방향)으로 dist도만큼 간 지점 [경도, 위도] */
function destPoint(lat, lon, bearing, dist) {
  const p1 = lat * DEG, l1 = lon * DEG, b = bearing * DEG, d = dist * DEG;
  const sp2 = Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(b);
  const p2 = Math.asin(clamp(sp2, -1, 1));
  const l2 = l1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * sp2);
  return [wrap180(l2 / DEG), p2 / DEG];
}

const unitVec = (lat, lon) => {
  const a = lat * DEG, o = lon * DEG, c = Math.cos(a);
  return [c * Math.cos(o), c * Math.sin(o), Math.sin(a)];
};

/** 도시 국가 영역 (위경도 다각형). 도시 정보가 바뀔 때만 다시 계산한다 */
function buildZones(cities, myId) {
  const vecs = cities.map((c) => unitVec(Number(c.lat), Number(c.lon)));
  return cities.map((c, i) => {
    const lat = Number(c.lat), lon = Number(c.lon);
    const [x, y, z] = vecs[i];
    const sl = Math.sin(lat * DEG), cl = Math.cos(lat * DEG), so = Math.sin(lon * DEG), co = Math.cos(lon * DEG);
    // 방향마다: 이웃 도시와 똑같이 떨어진 선(두 도시의 가운데)까지의 거리, 최대 cap도
    const reach = (bearing, cap) => {
      const b = bearing * DEG, cb = Math.cos(b), sb = Math.sin(b);
      const tx = -sl * co * cb - so * sb, ty = -sl * so * cb + co * sb, tz = cl * cb;
      let d = cap;
      for (let j = 0; j < vecs.length; j++) {
        if (j === i) continue;
        const v = vecs[j];
        const tj = tx * v[0] + ty * v[1] + tz * v[2];
        if (tj <= 1e-9) continue; // 그 도시에서 멀어지는 방향
        const m = Math.atan2(1 - (x * v[0] + y * v[1] + z * v[2]), tj) / DEG - ZONE_GAP;
        if (m < d) d = m;
      }
      return Math.max(0.3, d);
    };
    // 반시계 방향(북→서→남→동)으로 둘레를 잇는다 (지구본에서 앞면만 자를 때 필요)
    const ring = (cap) => {
      const out = [];
      for (let b = 360; b > 0; b -= ZONE_STEP) out.push(...destPoint(lat, lon, b, reach(b, cap)));
      return Float64Array.from(out);
    };
    const owners = (c.residents || [])
      .filter((r) => Number(r.tiles) > 0)
      .sort((a, b) => Number(!!b.isHome) - Number(!!a.isHome) || Number(b.tiles) - Number(a.tiles));
    const total = owners.reduce((a, r) => a + Number(r.tiles), 0);
    const R = zoneRadius(total);
    const parts = [];
    if (owners.length === 1) {
      parts.push({ owner: owners[0], ll: ring(R) });
    } else if (owners.length > 1) {
      let a0 = 0;
      for (const r of owners) {
        const span = (360 * Number(r.tiles)) / total;
        const steps = Math.max(2, Math.ceil(span / ZONE_STEP));
        const pts = [lon, lat];
        for (let k = steps; k >= 0; k--) {
          const b = a0 + (span * k) / steps;
          pts.push(...destPoint(lat, lon, b, reach(b, R)));
        }
        parts.push({ owner: r, ll: Float64Array.from(pts) });
        a0 += span;
      }
    }
    for (const p of parts) {
      p.color = ownerColor(p.owner, myId);
      p.mine = !!myId && p.owner.id === myId;
      p.shape = toShape(p.ll);
    }
    const domain = ring(ZONE_MAX);
    const color = owners.length ? ownerColor(owners[0], myId) : null; // 도시 국가 색 = 시작 도시 주인(가장 큰 주인)
    return { city: c, lat, lon, total, R, parts, color, domain, domainShape: toShape(domain) };
  });
}

/** 평면 지도용 경로 (도시를 기준으로 경도를 이어서, 지도 끝을 넘으면 반대쪽에도 그린다) */
function flatZonePath(ll, lon0) {
  const lam0 = flatLam(lon0), n = ll.length / 2, lams = new Float64Array(n);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    lams[i] = lam0 + wrap180(ll[2 * i] - lon0);
    if (lams[i] < min) min = lams[i];
    if (lams[i] > max) max = lams[i];
  }
  const path = new Path2D();
  const shifts = [0];
  if (min < -180) shifts.push(360);
  if (max > 180) shifts.push(-360);
  for (const sh of shifts) {
    for (let i = 0; i < n; i++) {
      const [px, py] = ne1(lams[i] + sh, ll[2 * i + 1]);
      if (i) path.lineTo(px, py); else path.moveTo(px, py);
    }
    path.closePath();
  }
  return path;
}

/** 도시 상세창·정보 패널에 넣는 '도시 국가 영역' 막대 */
export function zoneBarHTML(city, myId = null) {
  const owners = (city.residents || []).filter((r) => Number(r.tiles) > 0)
    .sort((a, b) => Number(!!b.isHome) - Number(!!a.isHome) || Number(b.tiles) - Number(a.tiles));
  const total = owners.reduce((a, r) => a + Number(r.tiles), 0);
  if (!total) return '<div class="zone-box empty">🗺️ 아직 주인이 없는 도시 국가예요</div>';
  const who = (r) => (myId && r.id === myId ? '나' : esc(r.name || '친구'));
  return `
    <div class="zone-box">
      <div class="zone-head"><b>🗺️ 도시 국가 영역 ${fmt(total)}칸</b><small>칸이 늘면 지도 위 색칠한 땅이 넓어져요</small></div>
      <div class="zone-bar" role="img" aria-label="${owners.map((r) => `${who(r)} ${fmt(r.tiles)}칸`).join(', ')}">
        ${owners.map((r) => `<i style="flex:${Number(r.tiles)};background:${ownerColor(r, myId)}"></i>`).join('')}
      </div>
      <ul class="zone-owners">
        ${owners.map((r) => `<li><i style="background:${ownerColor(r, myId)}"></i>${who(r)} <b>${fmt(r.tiles)}칸</b>${Number(r.bought) > 0 ? `<small>(넓힌 땅 ${fmt(r.bought)})</small>` : ''}</li>`).join('')}
      </ul>
    </div>`;
}

/** 도시에 사는 학생 기준 상태: 내 영토 / 친구 영토 / 미개척 */
export function cityKind(city, studentId) {
  const res = city.residents || [];
  if (!res.length) return 'empty';
  return studentId && res.some((r) => r.id === studentId) ? 'mine' : 'friend';
}

/** 대륙 필터 (이스탄불은 유럽과 아시아에 걸쳐 있어 두 곳 모두에 포함) */
export function inContinent(city, filter) {
  if (!filter || filter === 'all') return true;
  return city.continent === filter || (city.id === 'istanbul' && filter === 'asia');
}

/** 북위 37.6° · 동경 127.0° */
export function coordText(city) {
  const lat = Number(city.lat), lon = Number(city.lon);
  return `${lat >= 0 ? '북위' : '남위'} ${Math.abs(lat).toFixed(1)}° · ${lon >= 0 ? '동경' : '서경'} ${Math.abs(lon).toFixed(1)}°`;
}

// ─────────────────────────── 지리 데이터 ───────────────────────────
let geoCache = null;
let geoPromise = null;

export function loadWorldGeo() {
  if (geoCache) return Promise.resolve(geoCache);
  if (!geoPromise) {
    geoPromise = fetch(GEO_URL)
      .then((r) => {
        if (!r.ok) throw new Error(`지도 데이터 HTTP ${r.status}`);
        return r.json();
      })
      .then((raw) => (geoCache = prepareGeo(raw)))
      .catch((e) => {
        geoPromise = null;
        throw e;
      });
  }
  return geoPromise;
}

function decode(arr, scale) {
  const out = new Float64Array(arr.length);
  let x = 0, y = 0;
  for (let i = 0; i < arr.length; i += 2) {
    x += arr[i];
    y += arr[i + 1];
    out[i] = x / scale;
    out[i + 1] = y / scale;
  }
  return out;
}

/** 위경도 목록 -> 구면 단위 벡터 + 앞/뒤 판정을 빠르게 하는 경계 원(중심, 반지름) */
function toShape(ll) {
  const n = ll.length / 2;
  const v = new Float64Array(n * 3);
  let mx = 0, my = 0, mz = 0;
  const bbox = [180, 90, -180, -90];
  for (let i = 0; i < n; i++) {
    const lonD = ll[2 * i], latD = ll[2 * i + 1];
    const lon = lonD * DEG, lat = latD * DEG, c = Math.cos(lat);
    const x = c * Math.cos(lon), y = c * Math.sin(lon), z = Math.sin(lat);
    v[3 * i] = x; v[3 * i + 1] = y; v[3 * i + 2] = z;
    mx += x; my += y; mz += z;
    if (lonD < bbox[0]) bbox[0] = lonD;
    if (latD < bbox[1]) bbox[1] = latD;
    if (lonD > bbox[2]) bbox[2] = lonD;
    if (latD > bbox[3]) bbox[3] = latD;
  }
  const m = Math.hypot(mx, my, mz) || 1;
  mx /= m; my /= m; mz /= m;
  let cosR = 1;
  for (let i = 0; i < n; i++) cosR = Math.min(cosR, v[3 * i] * mx + v[3 * i + 1] * my + v[3 * i + 2] * mz);
  return { ll, v, n, cx: mx, cy: my, cz: mz, cosR, sinR: Math.sqrt(Math.max(0, 1 - cosR * cosR)), bbox };
}

function prepareGeo(raw) {
  const s = raw.scale || 100;
  const countries = raw.countries.map((c) => {
    const rings = c.polys.map((p) => toShape(decode(p, s)));
    const bbox = rings.reduce((b, r) => [Math.min(b[0], r.bbox[0]), Math.min(b[1], r.bbox[1]), Math.max(b[2], r.bbox[2]), Math.max(b[3], r.bbox[3])], [180, 90, -180, -90]);
    return { id: c.id, name: c.name, en: c.en, top: !!c.top, color: c.id === 'ATA' ? ICE_COLOR : LAND_COLORS[(c.c - 1) % LAND_COLORS.length], rings, bbox };
  });
  // 같은 색끼리 모아 한 번에 칠한다. 다른 나라 안에 있는 나라(레소토)는 마지막에.
  const byColor = new Map();
  for (const c of countries.filter((x) => !x.top)) {
    if (!byColor.has(c.color)) byColor.set(c.color, []);
    byColor.get(c.color).push(...c.rings);
  }
  const fills = [...byColor].map(([color, rings]) => ({ color, rings }));
  for (const c of countries.filter((x) => x.top)) fills.push({ color: c.color, rings: c.rings });
  return {
    countries: [...countries.filter((x) => x.top), ...countries.filter((x) => !x.top)], // 마우스 판정은 안쪽 나라 먼저
    fills,
    coast: raw.coast.map((l) => toShape(decode(l, s))),
    borders: raw.borders.map((l) => toShape(decode(l, s))),
    lakes: raw.lakes.map((l) => toShape(decode(l.r, s))),
    flat: null,
  };
}

function pointInRing(ll, x, y) {
  let inside = false;
  const n = ll.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ll[2 * i], yi = ll[2 * i + 1], xj = ll[2 * j], yj = ll[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// 경위선 (위도·경도 선)
let GRATICULE = null;
function graticule() {
  if (GRATICULE) return GRATICULE;
  const lines = [];
  for (let lon = -180; lon < 180; lon += 30) {
    const ll = [];
    for (let lat = -80; lat <= 80; lat += 2) ll.push(lon, lat);
    lines.push(toShape(Float64Array.from(ll)));
  }
  for (const lat of [-60, -30, 30, 60]) {
    const ll = [];
    for (let lon = -180; lon <= 180; lon += 2) ll.push(lon, lat);
    lines.push(toShape(Float64Array.from(ll)));
  }
  const eq = [];
  for (let lon = -180; lon <= 180; lon += 2) eq.push(lon, 0);
  GRATICULE = { lines, equator: toShape(Float64Array.from(eq)) };
  return GRATICULE;
}

// ─────────────────────────── 평면 지도 (Natural Earth 도법) ───────────────────────────
function ne1(lamDeg, phiDeg) {
  const l = lamDeg * DEG, p = phiDeg * DEG, p2 = p * p, p4 = p2 * p2;
  return [
    l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
    p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))),
  ];
}

function ne1inv(x, y) {
  let p = y, delta, i = 25;
  do {
    const p2 = p * p, p4 = p2 * p2;
    delta = (p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4))) - y)
      / (1.007226 + p2 * (0.015085 * 3 + p4 * (-0.044475 * 7 + 0.028874 * 9 * p2 - 0.005916 * 11 * p4)));
    p -= delta;
  } while (Math.abs(delta) > 1e-9 && --i > 0);
  const p2 = p * p;
  const l = x / (0.8707 + p2 * (-0.131979 + p2 * (-0.013791 + p2 * p2 * p2 * (0.003971 - 0.001529 * p2))));
  if (Math.abs(p) > Math.PI / 2 + 1e-6 || Math.abs(l) > Math.PI + 1e-6) return null;
  return [l / DEG, p / DEG];
}

const CUT_LON = wrap180(FLAT_CENTER_LON + 180); // 평면 지도의 양 끝이 되는 경도
const flatLam = (lon) => wrap180(lon - FLAT_CENTER_LON);
// 자르는 선 동쪽(side 1)은 지도 왼쪽 끝(-180)에서, 서쪽(side -1)은 오른쪽 끝(+180)에서 이어진다
const lamOf = (lon, side) => (side > 0 ? lon - CUT_LON - 180 : lon - CUT_LON + 180);

/** 평면 다각형을 자르는 경도선의 한쪽만 남긴다 (Sutherland–Hodgman) */
function clipHalf(ll, keepEast) {
  const n = ll.length / 2, out = [];
  const inside = (lon) => (keepEast ? lon >= CUT_LON : lon < CUT_LON);
  for (let i = 0; i < n; i++) {
    const j = (i + n - 1) % n;
    const cx = ll[2 * i], cy = ll[2 * i + 1], px = ll[2 * j], py = ll[2 * j + 1];
    const cin = inside(cx), pin = inside(px);
    if (cin !== pin) {
      const t = (CUT_LON - px) / (cx - px);
      out.push(CUT_LON, py + t * (cy - py));
    }
    if (cin) out.push(cx, cy);
  }
  return out;
}

function cutRing(ll) {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < ll.length; i += 2) {
    if (ll[i] < min) min = ll[i];
    if (ll[i] > max) max = ll[i];
  }
  if (min >= CUT_LON) return [{ side: 1, pts: ll }];
  if (max < CUT_LON) return [{ side: -1, pts: ll }];
  const out = [];
  const east = clipHalf(ll, true);
  const west = clipHalf(ll, false);
  if (east.length >= 6) out.push({ side: 1, pts: east });
  if (west.length >= 6) out.push({ side: -1, pts: west });
  return out;
}

function addFlatRing(path, ll) {
  for (const { side, pts } of cutRing(ll)) {
    const n = pts.length / 2;
    let plon = 0, plat = 0;
    const edgeTo = (lon, lat, first) => {
      // 지도 끝(자르는 선)을 따라가는 변은 둥근 테두리를 따라가도록 잘게 나눈다
      if (!first && Math.abs(lon - CUT_LON) < 1e-9 && Math.abs(plon - CUT_LON) < 1e-9) {
        const steps = Math.ceil(Math.abs(lat - plat) / 2);
        for (let k = 1; k < steps; k++) {
          const [x, y] = ne1(lamOf(CUT_LON, side), plat + ((lat - plat) * k) / steps);
          path.lineTo(x, y);
        }
      }
      const [x, y] = ne1(lamOf(lon, side), lat);
      if (first) path.moveTo(x, y); else path.lineTo(x, y);
      plon = lon; plat = lat;
    };
    for (let i = 0; i < n; i++) edgeTo(pts[2 * i], pts[2 * i + 1], i === 0);
    edgeTo(pts[0], pts[1], false);
    path.closePath();
  }
}

function addFlatLine(path, ll) {
  const n = ll.length / 2;
  let plon = ll[0], plat = ll[1];
  let side = plon >= CUT_LON ? 1 : -1;
  let [x, y] = ne1(lamOf(plon, side), plat);
  path.moveTo(x, y);
  for (let i = 1; i < n; i++) {
    const lon = ll[2 * i], lat = ll[2 * i + 1];
    const s2 = lon >= CUT_LON ? 1 : -1;
    if (s2 !== side) {
      const la = plat + ((CUT_LON - plon) / (lon - plon)) * (lat - plat);
      [x, y] = ne1(lamOf(CUT_LON, side), la);
      path.lineTo(x, y);
      side = s2;
      [x, y] = ne1(lamOf(CUT_LON, side), la);
      path.moveTo(x, y);
    }
    [x, y] = ne1(lamOf(lon, side), lat);
    path.lineTo(x, y);
    plon = lon; plat = lat;
  }
}

let FLAT_STATIC = null;
function flatStatic() {
  if (FLAT_STATIC) return FLAT_STATIC;
  const outline = new Path2D();
  for (let lat = -90; lat <= 90; lat += 2) {
    const [x, y] = ne1(-180, lat);
    if (lat === -90) outline.moveTo(x, y); else outline.lineTo(x, y);
  }
  for (let lat = 90; lat >= -90; lat -= 2) {
    const [x, y] = ne1(180, lat);
    outline.lineTo(x, y);
  }
  outline.closePath();
  const grat = new Path2D();
  for (let lon = -180; lon < 180; lon += 30) {
    const lam = flatLam(lon);
    if (Math.abs(lam) > 179.9) continue;
    for (let lat = -90; lat <= 90; lat += 3) {
      const [x, y] = ne1(lam, lat);
      if (lat === -90) grat.moveTo(x, y); else grat.lineTo(x, y);
    }
  }
  for (const lat of [-60, -30, 30, 60]) {
    for (let lam = -180; lam <= 180; lam += 3) {
      const [x, y] = ne1(lam, lat);
      if (lam === -180) grat.moveTo(x, y); else grat.lineTo(x, y);
    }
  }
  const equator = new Path2D();
  for (let lam = -180; lam <= 180; lam += 3) {
    const [x, y] = ne1(lam, 0);
    if (lam === -180) equator.moveTo(x, y); else equator.lineTo(x, y);
  }
  FLAT_STATIC = { outline, grat, equator };
  return FLAT_STATIC;
}

function flatGeo(geo) {
  if (geo.flat) return geo.flat;
  const fills = geo.fills.map((g) => {
    const path = new Path2D();
    for (const s of g.rings) addFlatRing(path, s.ll);
    return { color: g.color, path };
  });
  const lakes = new Path2D();
  for (const s of geo.lakes) addFlatRing(lakes, s.ll);
  const coast = new Path2D();
  for (const s of geo.coast) addFlatLine(coast, s.ll);
  const borders = new Path2D();
  for (const s of geo.borders) addFlatLine(borders, s.ll);
  geo.flat = { fills, lakes, coast, borders, countries: new Map() };
  return geo.flat;
}

function flatCountryPath(geo, country) {
  const f = flatGeo(geo);
  if (!f.countries.has(country.id)) {
    const p = new Path2D();
    for (const s of country.rings) addFlatRing(p, s.ll);
    f.countries.set(country.id, p);
  }
  return f.countries.get(country.id);
}

// 지구본 투영용 작업 버퍼
let PX = new Float64Array(2048), PY = new Float64Array(2048), PZ = new Float64Array(2048);
function ensureScratch(n) {
  if (PX.length >= n) return;
  const m = Math.max(n, PX.length * 2);
  PX = new Float64Array(m); PY = new Float64Array(m); PZ = new Float64Array(m);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const overlaps = (a, list) => list.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const LABEL_FONT = '"Jua","Noto Sans KR",sans-serif';

// ─────────────────────────── 지도 컴포넌트 ───────────────────────────
export class WorldMap {
  /**
   * @param {HTMLElement} root 지도를 넣을 빈 상자
   * @param {object} opts { cities, currentStudentId, homeCityId, mode, modeKey, compact, interactive, autoRotate, stars, globeScale, onSelectCity, onClick }
   */
  constructor(root, opts = {}) {
    this.root = root;
    root.__worldMap = this; // 개발자 도구에서 살펴보기용
    this.o = { cities: [], currentStudentId: null, homeCityId: null, mode: 'globe', modeKey: null, compact: false, interactive: true, autoRotate: false, stars: true, globeScale: null, ...opts };
    this.cities = this.o.cities || [];
    this.compact = !!this.o.compact;
    this.reduced = reduceMotion();
    let saved = null;
    try { saved = this.o.modeKey ? localStorage.getItem(this.o.modeKey) : null; } catch { /* 저장소 사용 불가 */ }
    this.mode = saved === 'flat' || saved === 'globe' ? saved : this.o.mode === 'flat' ? 'flat' : 'globe';

    const home = this.cityById(this.o.homeCityId);
    this.homeView = home
      ? { lon: home.lon, lat: clamp(home.lat - 6, -45, 45), zoom: this.compact ? 1 : 1.05 }
      : { lon: 128, lat: 22, zoom: 1 };
    this.view = { ...this.homeView };     // 지구본: 화면 가운데 경도·위도, 확대 배율
    this.fview = { x: 0, y: 0, zoom: 1 }; // 평면 지도: 가운데 (도법 좌표), 확대 배율

    this.selectedId = null;
    this.hoverCity = null;
    this.hoverCountry = null;
    this.geo = geoCache;
    this.markers = [];
    this.zones = null;      // 도시 국가 영역 (도시 정보가 바뀌면 다시 계산)
    this.sprites = new Map();
    this.pointers = new Map();
    this.drag = null;
    this.pinch = null;
    this.anim = null;
    this.vel = null;
    this.idleAt = 0;
    this.raf = 0;
    this.lastT = 0;
    this.lastDraw = 0;
    this.baseDirty = true;
    this.dirty = true;
    this.visible = true;
    this.ac = new AbortController();
    this.stars = Array.from({ length: this.compact ? 36 : 90 }, () => ({
      x: Math.random(), y: Math.random(), r: Math.random() * 1.2 + 0.3, a: Math.random() * 0.6 + 0.2,
    }));

    this.buildDom();
    this.resize();
    if (!this.geo) {
      this.setStatus('세계지도를 불러오는 중…');
      loadWorldGeo()
        .then((g) => {
          if (this.destroyed) return;
          this.geo = g;
          this.setStatus('');
          this.invalidate();
        })
        .catch(() => {
          if (!this.destroyed) this.setStatus('지도 그림을 불러오지 못했어요. 도시는 그대로 고를 수 있어요.');
        });
    }
    document.fonts?.ready?.then(() => !this.destroyed && this.invalidate());
    this.kick();
  }

  // ---------- 화면 구성 ----------
  buildDom() {
    const o = this.o, r = this.root;
    const forTeacher = !o.currentStudentId;
    r.classList.add('wm');
    r.classList.toggle('wm-compact', this.compact);
    r.dataset.mode = this.mode;
    r.innerHTML = `
      <canvas class="wm-canvas" ${o.interactive ? 'tabindex="0"' : ''} role="img"
        aria-label="${this.compact ? '세계지도 미리보기' : '세계지도. 드래그해서 돌리고 도시를 눌러 보세요. 방향키로 움직이고 + − 키로 확대할 수 있어요.'}"></canvas>
      <div class="wm-tip" aria-hidden="true"></div>
      <div class="wm-status" role="status"></div>
      ${this.compact ? '' : `
      <div class="wm-mode" role="group" aria-label="지도 모양">
        <button type="button" data-mode="globe">🌐 지구본</button>
        <button type="button" data-mode="flat">🗺️ 세계지도</button>
      </div>
      <div class="wm-tools">
        <button type="button" class="wm-btn" data-act="in" title="확대" aria-label="확대">＋</button>
        <button type="button" class="wm-btn" data-act="out" title="축소" aria-label="축소">－</button>
        <button type="button" class="wm-btn" data-act="reset" title="처음 보기" aria-label="처음 보기">⟲</button>
        ${o.homeCityId ? '<button type="button" class="wm-btn" data-act="home" title="내 땅으로" aria-label="내 땅으로">🏠</button>' : ''}
      </div>
      <div class="wm-spin">
        <button type="button" class="wm-btn" data-act="west" title="서쪽 보기" aria-label="서쪽 보기">◀</button>
        <button type="button" class="wm-btn" data-act="east" title="동쪽 보기" aria-label="동쪽 보기">▶</button>
      </div>
      <div class="wm-legend" aria-label="범례">
        ${forTeacher ? '' : '<span><i class="wm-dot k-mine"></i>내 영토</span>'}
        <span><i class="wm-dot k-friend"></i>${forTeacher ? '학생 영토' : '친구 영토'}</span>
        <span><i class="wm-dot k-empty"></i>미개척</span>
        <span title="옅게 칠한 곳과 테두리는 도시 국가의 경계, 진하게 칠한 곳은 학생 영토예요. 영토 칸이 늘면 진한 땅이 넓어져요."><i class="wm-zone"></i>도시 국가<em class="wm-zone-more"> · 진한 땅 = 영토</em></span>
      </div>`}
      <div class="wm-credit">지도 데이터: Natural Earth</div>`;
    this.canvas = r.querySelector('.wm-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.tip = r.querySelector('.wm-tip');
    this.statusEl = r.querySelector('.wm-status');
    this.base = document.createElement('canvas');
    this.bctx = this.base.getContext('2d');
    this.syncModeButtons();

    const sig = { signal: this.ac.signal };
    r.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-mode], button[data-act]');
      if (!b || !r.contains(b)) return;
      if (b.dataset.mode) this.setMode(b.dataset.mode);
      else this.action(b.dataset.act);
    }, sig);

    const c = this.canvas;
    if (o.interactive) {
      c.addEventListener('pointerdown', (e) => this.onDown(e), sig);
      c.addEventListener('pointermove', (e) => this.onMove(e), sig);
      c.addEventListener('pointerup', (e) => this.onUp(e), sig);
      c.addEventListener('pointercancel', (e) => this.onUp(e), sig);
      c.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !this.drag) this.clearHover(); }, sig);
      c.addEventListener('wheel', (e) => this.onWheel(e), { passive: false, signal: this.ac.signal });
      c.addEventListener('keydown', (e) => this.onKey(e), sig);
    } else if (o.onClick) {
      c.style.cursor = 'pointer';
      c.addEventListener('click', () => o.onClick(), sig);
    }

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(r);
    if (o.autoRotate && 'IntersectionObserver' in window) {
      this.io = new IntersectionObserver((ents) => {
        this.visible = ents.some((x) => x.isIntersecting);
        if (this.visible) this.kick();
      });
      this.io.observe(r);
    }
  }

  syncModeButtons() {
    this.root.dataset.mode = this.mode;
    this.root.querySelectorAll('button[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === this.mode)));
  }

  setStatus(msg) {
    if (!this.statusEl) return;
    this.statusEl.textContent = msg;
    this.statusEl.classList.toggle('on', !!msg);
  }

  resize() {
    if (this.destroyed) return;
    const rect = this.root.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    if (dpr !== this.dpr) this.sprites.clear();
    this.w = w; this.h = h; this.dpr = dpr;
    for (const cv of [this.canvas, this.base]) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    if (this.mode === 'flat') this.clampFlat();
    this.baseDirty = true;
    this.render(performance.now());
  }

  // ---------- 바깥에서 쓰는 기능 ----------
  cityById(id) {
    return id ? this.cities.find((c) => c.id === id) || null : null;
  }

  setCities(cities) {
    this.cities = cities || [];
    this.zones = null;
    if (this.hoverCity) this.hoverCity = this.cityById(this.hoverCity.id);
    this.invalidate();
  }

  zoneList() {
    if (!this.zones) this.zones = buildZones(this.cities, this.o.currentStudentId);
    return this.zones;
  }

  /** 도시를 고르고 그 도시로 날아간다 (onSelectCity는 부르지 않음) */
  select(id, { fly = true } = {}) {
    this.selectedId = id || null;
    const c = this.cityById(id);
    if (c && fly) this.focus(c);
    this.invalidate(); // 고른 도시 국가의 경계를 금색으로 다시 그린다
  }

  focus(city, animate = true) {
    if (this.mode === 'globe') {
      this.animateTo({ lon: city.lon, lat: clamp(city.lat, -55, 55), zoom: Math.max(this.view.zoom, this.compact ? 1 : 1.45) }, animate);
    } else {
      const [x, y] = ne1(flatLam(city.lon), city.lat);
      this.animateTo({ x, y, zoom: Math.max(this.fview.zoom, 2.2) }, animate);
    }
  }

  setMode(mode) {
    if (mode !== 'globe' && mode !== 'flat') return;
    if (mode === this.mode) return;
    this.mode = mode;
    this.anim = null;
    this.vel = null;
    try { if (this.o.modeKey) localStorage.setItem(this.o.modeKey, mode); } catch { /* 무시 */ }
    this.syncModeButtons();
    this.hoverCountry = null;
    this.hideTip();
    // 모양을 바꾸면 세계 전체가 보이게 한다 (지구본은 고른 도시 쪽을 바라봄)
    const c = this.cityById(this.selectedId);
    if (mode === 'globe') this.view = c ? { lon: c.lon, lat: clamp(c.lat - 6, -45, 45), zoom: this.homeView.zoom } : { ...this.homeView };
    else this.fview = { x: 0, y: 0, zoom: 1 };
    this.invalidate();
  }

  resetView() {
    if (this.mode === 'globe') this.animateTo({ ...this.homeView });
    else this.animateTo({ x: 0, y: 0, zoom: 1 });
  }

  zoomBy(f) {
    if (this.mode === 'globe') this.animateTo({ ...this.view, zoom: clamp(this.view.zoom * f, 0.8, 3.2) }, true, 350);
    else this.animateTo({ ...this.fview, zoom: clamp(this.fview.zoom * f, 1, 6) }, true, 350);
  }

  action(act) {
    if (act === 'in') this.zoomBy(1.35);
    else if (act === 'out') this.zoomBy(1 / 1.35);
    else if (act === 'reset') this.resetView();
    else if (act === 'home') {
      const c = this.cityById(this.o.homeCityId);
      if (c) {
        this.select(c.id);
        this.o.onSelectCity?.(c);
      }
    } else if (act === 'west' || act === 'east') {
      const dir = act === 'east' ? 1 : -1;
      if (this.mode === 'globe') this.animateTo({ ...this.view, lon: this.view.lon + dir * 40 }, true, 600);
      else this.animateTo({ ...this.fview, x: this.fview.x + (dir * 1.2) / this.fview.zoom }, true, 500);
    }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.ac.abort();
    this.ro?.disconnect();
    this.io?.disconnect();
    clearTimeout(this.tipTimer);
  }

  // ---------- 애니메이션 ----------
  animateTo(to, animate = true, dur = 900) {
    this.vel = null;
    this.idleAt = performance.now() + 5000;
    const d = animate && !this.reduced ? dur : 0;
    if (this.mode === 'globe') {
      const from = { ...this.view };
      const target = { lon: to.lon, lat: clamp(to.lat, -80, 80), zoom: clamp(to.zoom, 0.8, 3.2) };
      const dLon = wrap180(target.lon - from.lon);
      if (!d) {
        this.view = { lon: wrap180(from.lon + dLon), lat: target.lat, zoom: target.zoom };
        this.anim = null;
      } else this.anim = { from, to: target, dLon, t0: performance.now(), dur: d };
    } else {
      const target = { x: to.x, y: to.y, zoom: clamp(to.zoom, 1, 6) };
      this.clampFlat(target);
      if (!d) {
        this.fview = target;
        this.anim = null;
      } else this.anim = { from: { ...this.fview }, to: target, t0: performance.now(), dur: d };
    }
    this.invalidate();
  }

  step(t, dt) {
    if (this.anim) {
      const a = this.anim;
      const k = Math.min(1, (t - a.t0) / a.dur);
      const e = easeInOut(Math.max(0, k));
      if (this.mode === 'globe') {
        this.view.lon = wrap180(a.from.lon + a.dLon * e);
        this.view.lat = a.from.lat + (a.to.lat - a.from.lat) * e;
        this.view.zoom = a.from.zoom + (a.to.zoom - a.from.zoom) * e;
      } else {
        this.fview.x = a.from.x + (a.to.x - a.from.x) * e;
        this.fview.y = a.from.y + (a.to.y - a.from.y) * e;
        this.fview.zoom = a.from.zoom + (a.to.zoom - a.from.zoom) * e;
      }
      if (k >= 1) this.anim = null;
      return true;
    }
    if (this.vel) {
      const f = Math.pow(0.93, dt / 16);
      if (this.mode === 'globe') {
        this.view.lon = wrap180(this.view.lon + this.vel.x * dt);
        this.view.lat = clamp(this.view.lat + this.vel.y * dt, -80, 80);
      } else {
        this.fview.x += this.vel.x * dt;
        this.fview.y += this.vel.y * dt;
        this.clampFlat();
      }
      this.vel.x *= f;
      this.vel.y *= f;
      if (Math.abs(this.vel.x) + Math.abs(this.vel.y) < (this.mode === 'globe' ? 0.0008 : 0.00002)) this.vel = null;
      return true;
    }
    if (this.o.autoRotate && !this.reduced && this.mode === 'globe' && this.visible && !this.drag && t > this.idleAt) {
      this.view.lon = wrap180(this.view.lon + dt * 0.006);
      return true;
    }
    return false;
  }

  invalidate(base = true) {
    if (base) this.baseDirty = true;
    this.dirty = true;
    this.kick();
  }

  kick() {
    if (!this.raf && !this.destroyed) this.raf = requestAnimationFrame(() => this.tick());
  }

  tick() {
    this.raf = 0;
    if (this.destroyed) return;
    // 애니메이션 시작 시각(animateTo)과 같은 시계를 쓴다. rAF 시각은 브라우저마다 기준이 다를 수 있다.
    const t = performance.now();
    const dt = this.lastT ? Math.min(50, t - this.lastT) : 16;
    this.lastT = t;
    const moving = this.step(t, dt);
    if (moving) this.baseDirty = true;
    const pulsing = !!this.selectedId && !this.reduced && !this.compact;
    // 작은 미리보기 지구본과 반짝임은 초당 30번만 그려 기기 부담을 줄인다
    const slow = (this.compact && moving && !this.drag) || (!moving && !this.baseDirty && !this.dirty);
    if ((this.baseDirty || this.dirty || pulsing) && (!slow || t - this.lastDraw >= 32)) {
      this.render(t);
      this.lastDraw = t;
    }
    if (moving || pulsing || this.baseDirty || this.dirty) this.kick();
    else this.lastT = 0;
  }

  // ---------- 좌표 계산 ----------
  globeFrame() {
    const R = Math.min(this.w, this.h) * (this.o.globeScale || (this.compact ? 0.44 : 0.42)) * this.view.zoom;
    const lam = this.view.lon * DEG, phi = this.view.lat * DEG;
    const cl = Math.cos(lam), sl = Math.sin(lam), cp = Math.cos(phi), sp = Math.sin(phi);
    return {
      cx: this.w / 2, cy: this.h / 2, R,
      fx: cp * cl, fy: cp * sl, fz: sp,   // 화면 쪽으로 향하는 방향
      ex: -sl, ey: cl,                     // 화면 오른쪽 (동쪽)
      nx: -sp * cl, ny: -sp * sl, nz: cp,  // 화면 위쪽 (북쪽)
    };
  }

  flatFrame(zoom = this.fview.zoom, v = this.fview) {
    const pad = this.compact ? 6 : 18;
    const base = Math.max(1, Math.min((this.w - pad * 2) / MAP_W, (this.h - pad * 2) / MAP_H));
    const s = base * zoom;
    return { base, s, tx: this.w / 2 - s * v.x, ty: this.h / 2 + s * v.y };
  }

  clampFlat(v = this.fview) {
    if (!this.w) return;
    const { s } = this.flatFrame(v.zoom, v);
    const mx = Math.max(0, MAP_W / 2 - this.w / 2 / s + 0.15);
    const my = Math.max(0, MAP_H / 2 - this.h / 2 / s + 0.1);
    v.x = clamp(v.x, -mx, mx);
    v.y = clamp(v.y, -my, my);
  }

  /** 위경도 -> 화면 좌표 (z가 0보다 크면 앞면) */
  projectLL(lon, lat) {
    if (this.mode === 'globe') {
      const F = this.frame;
      const la = lat * DEG, lo = lon * DEG, c = Math.cos(la);
      const x = c * Math.cos(lo), y = c * Math.sin(lo), z = Math.sin(la);
      const vx = x * F.ex + y * F.ey;
      const vy = x * F.nx + y * F.ny + z * F.nz;
      const vz = x * F.fx + y * F.fy + z * F.fz;
      return { x: F.cx + F.R * vx, y: F.cy - F.R * vy, z: vz };
    }
    const T = this.frame;
    const [x, y] = ne1(flatLam(lon), lat);
    return { x: T.tx + T.s * x, y: T.ty - T.s * y, z: 1 };
  }

  /** 화면 좌표 -> 위경도 (지도 밖이면 null) */
  unproject(px, py) {
    if (!this.frame) return null;
    if (this.mode === 'globe') {
      const F = this.frame;
      const x = (px - F.cx) / F.R, y = (F.cy - py) / F.R, r2 = x * x + y * y;
      if (r2 > 1) return null;
      const z = Math.sqrt(1 - r2);
      const X = x * F.ex + y * F.nx + z * F.fx;
      const Y = x * F.ey + y * F.ny + z * F.fy;
      const Z = y * F.nz + z * F.fz;
      return [Math.atan2(Y, X) / DEG, Math.asin(clamp(Z, -1, 1)) / DEG];
    }
    const T = this.frame;
    const r = ne1inv((px - T.tx) / T.s, (T.ty - py) / T.s);
    return r ? [wrap180(r[0] + FLAT_CENTER_LON), r[1]] : null;
  }

  countryAt(lon, lat) {
    if (!this.geo) return null;
    for (const c of this.geo.countries) {
      const b = c.bbox;
      if (lon < b[0] || lon > b[2] || lat < b[1] || lat > b[3]) continue;
      if (c.rings.some((s) => pointInRing(s.ll, lon, lat))) return c;
    }
    return null;
  }

  // ---------- 지구본: 구면 다각형을 보이는 반구에 맞춰 자르기 ----------
  /** 0: 모두 뒷면, 1: 걸쳐 있음, 2: 모두 앞면 */
  capState(s, F) {
    if (s.cosR < 0) return 1;
    const d = s.cx * F.fx + s.cy * F.fy + s.cz * F.fz;
    if (d < -s.sinR - 1e-6) return 0;
    if (d > s.sinR + 1e-6) return 2;
    return 1;
  }

  projectShape(s, F) {
    ensureScratch(s.n);
    const v = s.v;
    for (let i = 0; i < s.n; i++) {
      const x = v[3 * i], y = v[3 * i + 1], z = v[3 * i + 2];
      PX[i] = x * F.ex + y * F.ey;
      PY[i] = x * F.nx + y * F.ny + z * F.nz;
      PZ[i] = x * F.fx + y * F.fy + z * F.fz;
    }
  }

  /** 변 i→j가 지구 테두리(지평선)와 만나는 점 (단위원 위) */
  limb(i, j) {
    const t = PZ[i] / (PZ[i] - PZ[j]);
    const x = PX[i] + t * (PX[j] - PX[i]), y = PY[i] + t * (PY[j] - PY[i]);
    const m = Math.hypot(x, y) || 1;
    return [x / m, y / m];
  }

  /** 다각형(반시계 방향)을 앞면만 남겨 경로에 추가. 잘린 부분은 지구 테두리를 따라 잇는다 */
  globeRing(ctx, s, F) {
    const st = this.capState(s, F);
    if (st === 0) return;
    this.projectShape(s, F);
    const n = s.n, { cx, cy, R } = F;
    let start = -1, any = false;
    for (let i = 0; i < n; i++) {
      if (PZ[i] > 0) {
        any = true;
        if (start < 0 && PZ[(i + n - 1) % n] <= 0) start = i;
      }
    }
    if (!any) return;
    if (st === 2 || start < 0) {
      ctx.moveTo(cx + R * PX[0], cy - R * PY[0]);
      for (let i = 1; i < n; i++) ctx.lineTo(cx + R * PX[i], cy - R * PY[i]);
      ctx.closePath();
      return;
    }
    // 보이는 구간(run)들: 테두리에서 들어와(a0) 테두리로 나간다(a1)
    const runs = [];
    const h = (start + n - 1) % n;
    let p = this.limb(h, start);
    let run = { pts: [p[0], p[1]], a0: Math.atan2(p[1], p[0]) };
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n, j = (i + 1) % n;
      if (PZ[i] > 0) {
        run.pts.push(PX[i], PY[i]);
        if (PZ[j] <= 0) {
          p = this.limb(i, j);
          run.pts.push(p[0], p[1]);
          run.a1 = Math.atan2(p[1], p[0]);
          runs.push(run);
          run = null;
        }
      } else if (PZ[j] > 0) {
        p = this.limb(i, j);
        run = { pts: [p[0], p[1]], a0: Math.atan2(p[1], p[0]) };
      }
    }
    // 나간 점에서 테두리를 반시계 방향으로 돌아 가장 가까운 들어온 점으로 잇는다
    const used = new Uint8Array(runs.length);
    for (let r0 = 0; r0 < runs.length; r0++) {
      if (used[r0]) continue;
      let r = r0, guard = 0;
      ctx.moveTo(cx + R * runs[r0].pts[0], cy - R * runs[r0].pts[1]);
      for (;;) {
        used[r] = 1;
        const cur = runs[r], pts = cur.pts;
        for (let m = 0; m < pts.length; m += 2) ctx.lineTo(cx + R * pts[m], cy - R * pts[m + 1]);
        let best = -1, bestD = Infinity;
        for (let q = 0; q < runs.length; q++) {
          if (used[q] && q !== r0) continue;
          let d = runs[q].a0 - cur.a1;
          if (d < -1e-7) d += TAU;
          else if (d < 0) d = 0;
          if (d < bestD) { bestD = d; best = q; }
        }
        if (bestD > 1e-9 && bestD < Infinity) ctx.arc(cx, cy, R, -cur.a1, -(cur.a1 + bestD), true);
        if (best < 0 || best === r0 || ++guard > runs.length) break;
        r = best;
      }
      ctx.closePath();
    }
  }

  /** 선(해안선·국경·경위선)을 앞면만 남겨 경로에 추가 */
  globeLine(ctx, s, F, closed = false) {
    const st = this.capState(s, F);
    if (st === 0) return;
    this.projectShape(s, F);
    const n = s.n, { cx, cy, R } = F;
    const last = closed ? n : n - 1;
    let pen = false;
    for (let k = 0; k <= last; k++) {
      const i = k % n;
      if (PZ[i] > 0) {
        if (!pen) {
          if (k > 0) {
            const p = this.limb((i + n - 1) % n, i);
            ctx.moveTo(cx + R * p[0], cy - R * p[1]);
            ctx.lineTo(cx + R * PX[i], cy - R * PY[i]);
          } else ctx.moveTo(cx + R * PX[i], cy - R * PY[i]);
          pen = true;
        } else ctx.lineTo(cx + R * PX[i], cy - R * PY[i]);
      } else if (pen) {
        const p = this.limb((i + n - 1) % n, i);
        ctx.lineTo(cx + R * p[0], cy - R * p[1]);
        pen = false;
      }
    }
  }

  // ---------- 그리기 ----------
  render(t) {
    if (!this.w || this.destroyed) return;
    if (this.baseDirty) {
      this.drawBase();
      this.baseDirty = false;
    }
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.base, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawMarkers(ctx, t);
    this.dirty = false;
  }

  drawBase() {
    const ctx = this.bctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.base.width, this.base.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (this.mode === 'globe') {
      this.frame = this.globeFrame();
      this.drawGlobe(ctx, this.frame);
    } else {
      this.frame = this.flatFrame();
      this.drawFlat(ctx, this.frame);
    }
    this.layoutMarkers();
    this.drawGeoLabels(ctx);
  }

  drawGlobe(ctx, F) {
    const { cx, cy, R } = F;
    // 별
    ctx.fillStyle = '#fff';
    for (const s of this.o.stars ? this.stars : []) {
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(s.x * this.w, s.y * this.h, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 대기 빛
    const glow = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.24);
    glow.addColorStop(0, 'rgba(125, 205, 255, 0.55)');
    glow.addColorStop(0.3, 'rgba(90, 160, 255, 0.22)');
    glow.addColorStop(1, 'rgba(70, 90, 230, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.24, 0, TAU);
    ctx.fill();
    // 바다
    const ocean = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
    ocean.addColorStop(0, '#4ea5e8');
    ocean.addColorStop(0.55, '#2b70bf');
    ocean.addColorStop(1, '#143e80');
    ctx.fillStyle = ocean;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    // 경위선과 적도
    const g = graticule();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.13)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const s of g.lines) this.globeLine(ctx, s, F);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 232, 150, 0.4)';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    this.globeLine(ctx, g.equator, F);
    ctx.stroke();
    ctx.setLineDash([]);

    if (this.geo) {
      const geo = this.geo;
      const detail = !this.compact;
      // 해안을 감싸는 얕은 바다 빛
      ctx.strokeStyle = 'rgba(165, 228, 255, 0.3)';
      ctx.lineWidth = this.compact ? 3 : 5;
      ctx.beginPath();
      for (const s of geo.coast) this.globeLine(ctx, s, F);
      ctx.stroke();
      // 나라
      for (const grp of geo.fills) {
        ctx.fillStyle = grp.color;
        ctx.beginPath();
        for (const s of grp.rings) this.globeRing(ctx, s, F);
        ctx.fill();
      }
      // 호수
      ctx.fillStyle = '#3d89d2';
      ctx.beginPath();
      for (const s of geo.lakes) this.globeRing(ctx, s, F);
      ctx.fill();
      // 마우스를 올린 나라
      if (this.hoverCountry) {
        ctx.beginPath();
        for (const s of this.hoverCountry.rings) this.globeRing(ctx, s, F);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      // 국경과 해안선
      if (detail) {
        ctx.strokeStyle = 'rgba(52, 44, 100, 0.5)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (const s of geo.borders) this.globeLine(ctx, s, F);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(20, 50, 110, 0.6)';
      ctx.lineWidth = detail ? 0.9 : 0.7;
      ctx.beginPath();
      for (const s of geo.coast) this.globeLine(ctx, s, F);
      for (const s of geo.lakes) this.globeLine(ctx, s, F, true);
      ctx.stroke();
    }
    this.drawZonesGlobe(ctx, F);
    ctx.restore();

    // 햇빛과 그림자로 둥근 느낌
    const light = ctx.createRadialGradient(cx - R * 0.45, cy - R * 0.5, 0, cx - R * 0.15, cy - R * 0.15, R * 1.22);
    light.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    light.addColorStop(0.3, 'rgba(255, 255, 255, 0.06)');
    light.addColorStop(0.68, 'rgba(10, 20, 60, 0.1)');
    light.addColorStop(1, 'rgba(6, 10, 40, 0.62)');
    ctx.fillStyle = light;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(175, 225, 255, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  drawFlat(ctx, T) {
    const st = flatStatic();
    const dpr = this.dpr;
    const px = 1 / T.s; // 화면 1px의 도법 좌표 길이
    ctx.save();
    ctx.setTransform(dpr * T.s, 0, 0, -dpr * T.s, dpr * T.tx, dpr * T.ty);
    // 바다 + 바깥 빛
    const ocean = ctx.createRadialGradient(0, 0.2, 0, 0, 0, 3.1);
    ocean.addColorStop(0, '#4699de');
    ocean.addColorStop(0.6, '#2767b4');
    ocean.addColorStop(1, '#174684');
    ctx.shadowColor = 'rgba(90, 170, 255, 0.45)';
    ctx.shadowBlur = 26 * dpr;
    ctx.fillStyle = ocean;
    ctx.fill(st.outline);
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    ctx.save();
    ctx.clip(st.outline);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 0.8 * px;
    ctx.stroke(st.grat);
    ctx.strokeStyle = 'rgba(255, 232, 150, 0.42)';
    ctx.setLineDash([5 * px, 5 * px]);
    ctx.stroke(st.equator);
    ctx.setLineDash([]);
    if (this.geo) {
      const f = flatGeo(this.geo);
      ctx.strokeStyle = 'rgba(165, 228, 255, 0.3)';
      ctx.lineWidth = 5 * px;
      ctx.stroke(f.coast);
      for (const grp of f.fills) {
        ctx.fillStyle = grp.color;
        ctx.fill(grp.path);
      }
      ctx.fillStyle = '#3d89d2';
      ctx.fill(f.lakes);
      if (this.hoverCountry) {
        const p = flatCountryPath(this.geo, this.hoverCountry);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.34)';
        ctx.fill(p);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 1.5 * px;
        ctx.stroke(p);
      }
      ctx.strokeStyle = 'rgba(52, 44, 100, 0.5)';
      ctx.lineWidth = 0.7 * px;
      ctx.stroke(f.borders);
      ctx.strokeStyle = 'rgba(20, 50, 110, 0.6)';
      ctx.lineWidth = 0.9 * px;
      ctx.stroke(f.coast);
      ctx.stroke(f.lakes);
    }
    this.drawZonesFlat(ctx, px);
    ctx.restore();
    // 둥근 테두리
    ctx.strokeStyle = 'rgba(175, 225, 255, 0.65)';
    ctx.lineWidth = 1.3 * px;
    ctx.stroke(st.outline);
    ctx.restore();
  }

  // ---------- 도시 국가 영역 ----------
  /** 지구본: 앞면에 보이는 부분만 칠한다 (지구 테두리에서 자름) */
  drawZonesGlobe(ctx, F) {
    const zones = this.zoneList();
    const lw = this.compact ? 1.1 : 1.8;
    ctx.save();
    ctx.lineJoin = 'round';
    // 도시 국가: 옅게 칠한 땅 + 테두리 (주인이 없으면 점선)
    for (const z of zones) {
      ctx.beginPath();
      this.globeRing(ctx, z.domainShape, F);
      if (z.color) {
        ctx.globalAlpha = this.compact ? 0.16 : 0.2;
        ctx.fillStyle = z.color;
        ctx.fill();
      }
      if (this.compact) continue;
      ctx.beginPath();
      this.globeLine(ctx, z.domainShape, F, true);
      ctx.globalAlpha = z.color ? 0.85 : 0.55;
      ctx.strokeStyle = z.color || '#ffffff';
      ctx.lineWidth = 1.2;
      ctx.setLineDash(z.color ? [] : [4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    // 학생 영토: 칸 수만큼 넓어지는 진한 땅
    for (const z of zones) {
      for (const p of z.parts) {
        ctx.beginPath();
        this.globeRing(ctx, p.shape, F);
        ctx.globalAlpha = p.mine ? 0.66 : 0.55;
        ctx.fillStyle = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        this.globeLine(ctx, p.shape, F, true);
        ctx.strokeStyle = p.mine ? '#ffffff' : p.color;
        ctx.lineWidth = p.mine ? lw + 0.6 : lw;
        ctx.stroke();
      }
    }
    const sel = zones.find((z) => z.city.id === this.selectedId);
    if (sel && !this.compact) {
      ctx.beginPath();
      this.globeLine(ctx, sel.domainShape, F, true);
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2.6;
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 평면 지도: 도법 좌표로 만든 경로를 그대로 쓴다 (px = 화면 1px의 도법 좌표 길이) */
  drawZonesFlat(ctx, px) {
    const zones = this.zoneList();
    for (const z of zones) {
      if (!z.domainFlat) z.domainFlat = flatZonePath(z.domain, z.lon);
      for (const p of z.parts) if (!p.flat) p.flat = flatZonePath(p.ll, z.lon);
    }
    ctx.save();
    ctx.lineJoin = 'round';
    for (const z of zones) {
      if (z.color) {
        ctx.globalAlpha = this.compact ? 0.16 : 0.22;
        ctx.fillStyle = z.color;
        ctx.fill(z.domainFlat);
      }
      if (this.compact) continue;
      ctx.globalAlpha = z.color ? 0.85 : 0.55;
      ctx.strokeStyle = z.color || '#ffffff';
      ctx.lineWidth = 1.2 * px;
      ctx.setLineDash(z.color ? [] : [4 * px, 4 * px]);
      ctx.stroke(z.domainFlat);
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    const lw = this.compact ? 1.1 : 1.8;
    for (const z of zones) {
      for (const p of z.parts) {
        ctx.globalAlpha = p.mine ? 0.66 : 0.55;
        ctx.fillStyle = p.color;
        ctx.fill(p.flat);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = p.mine ? '#ffffff' : p.color;
        ctx.lineWidth = (p.mine ? lw + 0.6 : lw) * px;
        ctx.stroke(p.flat);
      }
    }
    const sel = zones.find((z) => z.city.id === this.selectedId);
    if (sel && !this.compact) {
      ctx.strokeStyle = '#ffd76a';
      ctx.lineWidth = 2.6 * px;
      ctx.stroke(sel.domainFlat);
    }
    ctx.restore();
  }

  drawGeoLabels(ctx) {
    if (this.compact) return;
    const blocked = this.markers.map((m) => ({ x: m.x - 18, y: m.y - 36, w: 36, h: 62 }));
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [text, lat, lon, sea] of GEO_LABELS) {
      const p = this.projectLL(lon, lat);
      let a = 1;
      if (this.mode === 'globe') {
        if (p.z < 0.3) continue;
        a = clamp((p.z - 0.3) / 0.25, 0, 1);
      } else if (p.x < 0 || p.y < 0 || p.x > this.w || p.y > this.h) continue;
      ctx.font = sea ? `italic 600 12px ${LABEL_FONT}` : `700 13px "Noto Sans KR",sans-serif`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = sea ? '3px' : '4px';
      const w = ctx.measureText(text).width;
      let at = null;
      for (const [dx, dy] of LABEL_NUDGE) {
        const box = { x: p.x + dx - w / 2 - 4, y: p.y + dy - 9, w: w + 8, h: 18 };
        if (!overlaps(box, blocked)) { at = { x: p.x + dx, y: p.y + dy, box }; break; }
      }
      if (!at) continue;
      blocked.push(at.box);
      if (sea) {
        ctx.globalAlpha = a * 0.78;
        ctx.fillStyle = '#d6ecff';
        ctx.fillText(text, at.x, at.y);
      } else {
        ctx.globalAlpha = a * 0.8;
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.strokeText(text, at.x, at.y);
        ctx.fillStyle = '#3a2f6b';
        ctx.fillText(text, at.x, at.y);
      }
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }

  layoutMarkers() {
    const out = [];
    for (const c of this.cities) {
      const p = this.projectLL(c.lon, c.lat);
      if (this.mode === 'globe') {
        if (p.z <= 0.05) continue;
      } else if (p.x < -40 || p.y < -40 || p.x > this.w + 40 || p.y > this.h + 40) continue;
      const kind = cityKind(c, this.o.currentStudentId);
      out.push({ city: c, kind, x: p.x, y: p.y, z: p.z, alpha: this.mode === 'globe' ? clamp((p.z - 0.05) / 0.2, 0, 1) : 1 });
    }
    this.markers = out.sort((a, b) => a.z - b.z);
  }

  markerEmoji(m) {
    const res = m.city.residents || [];
    if (!res.length) return m.city.emoji || '🏛️';
    const me = res.find((r) => r.id === this.o.currentStudentId);
    return (me || res[0]).animal?.emoji || '🐾';
  }

  sprite(emoji, color, r, count) {
    const key = `${emoji}|${color}|${r}|${count}|${this.dpr}`;
    let s = this.sprites.get(key);
    if (s) return s;
    const pad = 4, tail = Math.round(r * 0.7);
    const W = r * 2 + pad * 2 + 8, H = r * 2 + tail + pad * 2 + 4;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(W * this.dpr);
    cv.height = Math.ceil(H * this.dpr);
    const g = cv.getContext('2d');
    g.scale(this.dpr, this.dpr);
    const hx = pad + r, hy = pad + r + 4;
    g.shadowColor = 'rgba(0, 0, 20, 0.45)';
    g.shadowBlur = 5 * this.dpr;
    g.shadowOffsetY = 1.5 * this.dpr;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(hx - r * 0.56, hy + r * 0.62);
    g.lineTo(hx, hy + r + tail);
    g.lineTo(hx + r * 0.56, hy + r * 0.62);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(hx, hy, r, 0, TAU);
    g.fill();
    g.shadowColor = 'transparent';
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(hx, hy, r - 2.6, 0, TAU);
    g.fill();
    g.font = `${Math.round(r * 1.16)}px ${EMOJI_FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, hx, hy + r * 0.06);
    if (count > 1) {
      const bx = hx + r * 0.82, by = hy - r * 0.78, br = 7;
      g.fillStyle = '#1e1b4b';
      g.beginPath();
      g.arc(bx, by, br, 0, TAU);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#ffffff';
      g.font = '700 9px "Noto Sans KR",sans-serif';
      g.fillText(String(Math.min(count, 99)), bx, by + 0.5);
    }
    s = { cv, W, H, ax: hx, ay: hy + r + tail, hy: r + tail };
    this.sprites.set(key, s);
    return s;
  }

  drawMarkers(ctx, t) {
    const sel = this.selectedId, hov = this.hoverCity?.id;
    const homeId = this.o.homeCityId;
    const base = this.compact ? 9 : 13;
    const pulse = this.reduced ? 0.5 : ((t || 0) % 1600) / 1600;

    // 고른 도시 아래 퍼지는 빛
    for (const m of this.markers) {
      if (m.city.id !== sel) continue;
      ctx.globalAlpha = m.alpha * (1 - pulse) * 0.9;
      ctx.strokeStyle = KIND_COLOR[m.kind];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, 6 + pulse * 22, (6 + pulse * 22) * 0.55, 0, 0, TAU);
      ctx.stroke();
    }
    // 마커 (뒤에서 앞 순서)
    for (const m of this.markers) {
      const big = m.city.id === sel || m.city.id === hov;
      const r = base + (big ? 3 : 0);
      const s = this.sprite(this.markerEmoji(m), KIND_COLOR[m.kind], r, (m.city.residents || []).length);
      ctx.globalAlpha = m.alpha * 0.5;
      ctx.fillStyle = 'rgba(0, 0, 20, 0.6)';
      ctx.beginPath();
      ctx.ellipse(m.x, m.y, r * 0.5, r * 0.2, 0, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = m.alpha;
      ctx.drawImage(s.cv, m.x - s.ax, m.y - s.ay, s.W, s.H);
      m.r = r;
      m.hx = m.x;
      m.hy = m.y - s.hy;
    }
    ctx.globalAlpha = 1;

    // 도시 이름표 (겹치면 중요한 것만)
    const order = this.markers
      .filter((m) => m.alpha > 0.35)
      .map((m) => ({ m, pri: m.city.id === sel ? 4 : m.city.id === hov ? 3 : m.kind === 'mine' ? 2 : m.city.id === homeId ? 2 : 1 }))
      .sort((a, b) => b.pri - a.pri || b.m.z - a.m.z);
    const taken = this.markers.map((m) => ({ x: m.hx - m.r, y: m.hy - m.r, w: m.r * 2, h: m.r * 2 }));
    ctx.font = `${this.compact ? 12 : 13}px ${LABEL_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { m, pri } of order) {
      if (this.compact && pri < 2) continue;
      const own = { x: m.hx - m.r, y: m.hy - m.r, w: m.r * 2, h: m.r * 2 };
      const others = taken.filter((b) => !(b.x === own.x && b.y === own.y));
      const tiles = this.compact ? 0 : zoneTiles(m.city);
      const text = tiles ? `${m.city.name} · ${tiles}칸` : m.city.name;
      const w = ctx.measureText(text).width + 14, h = 20;
      const spots = [
        { x: m.x - w / 2, y: m.y + 5 },
        { x: m.x + m.r + 3, y: m.hy - h / 2 },
        { x: m.x - m.r - 3 - w, y: m.hy - h / 2 },
        { x: m.x - w / 2, y: m.hy - m.r - h - 3 },
      ];
      const inside = (b) => b.x >= 4 && b.y >= 4 && b.x + b.w <= this.w - 4 && b.y + b.h <= this.h - 4;
      let box = null;
      for (const sp of spots) {
        const b = { x: sp.x, y: sp.y, w, h };
        if (inside(b) && !overlaps(b, others)) { box = b; break; }
      }
      if (!box) {
        if (pri < 3) continue;
        box = { x: clamp(spots[0].x, 4, this.w - w - 4), y: clamp(spots[0].y, 4, this.h - h - 4), w, h };
      }
      taken.push(box);
      const on = pri >= 3;
      ctx.globalAlpha = m.alpha;
      roundRect(ctx, box.x, box.y, box.w, box.h, 10);
      ctx.fillStyle = on ? 'rgba(15, 12, 48, 0.95)' : 'rgba(12, 16, 44, 0.78)';
      ctx.fill();
      ctx.lineWidth = on ? 1.6 : 1;
      ctx.strokeStyle = on ? KIND_COLOR[m.kind] : 'rgba(255, 255, 255, 0.18)';
      ctx.stroke();
      ctx.fillStyle = m.city.id === sel ? '#ffd76a' : '#ffffff';
      ctx.fillText(text, box.x + box.w / 2, box.y + box.h / 2 + 0.5);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 마우스·터치 ----------
  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  markerAt(x, y) {
    let best = null, bd = Infinity;
    for (const m of this.markers) {
      if (m.alpha < 0.3 || m.hx === undefined) continue;
      const d1 = Math.hypot(x - m.hx, y - m.hy), d2 = Math.hypot(x - m.x, y - m.y);
      if (d1 <= m.r + 6 || d2 <= 10) {
        const d = Math.min(d1, d2) - m.z * 3;
        if (d < bd) { bd = d; best = m; }
      }
    }
    return best;
  }

  onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.canvas.setPointerCapture?.(e.pointerId);
    const p = this.local(e);
    this.pointers.set(e.pointerId, p);
    this.anim = null;
    this.vel = null;
    this.idleAt = performance.now() + 5000;
    if (this.pointers.size === 1) {
      this.drag = { x0: p.x, y0: p.y, x: p.x, y: p.y, moved: false, hist: [{ x: p.x, y: p.y, t: e.timeStamp }] };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: this.mode === 'globe' ? this.view.zoom : this.fview.zoom };
      if (this.drag) this.drag.moved = true;
    }
  }

  onMove(e) {
    const p = this.local(e);
    if (!this.pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse') this.hoverAt(p.x, p.y);
      return;
    }
    this.pointers.set(e.pointerId, p);
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const z = (this.pinch.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.d0;
      this.zoomAt(z / (this.mode === 'globe' ? this.view.zoom : this.fview.zoom), (a.x + b.x) / 2, (a.y + b.y) / 2);
      return;
    }
    const d = this.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) > 5) {
      d.moved = true;
      this.hideTip();
      this.root.classList.add('wm-grabbing');
    }
    if (d.moved) {
      this.panBy(p.x - d.x, p.y - d.y);
      d.hist.push({ x: p.x, y: p.y, t: e.timeStamp });
      if (d.hist.length > 6) d.hist.shift();
    }
    d.x = p.x;
    d.y = p.y;
  }

  onUp(e) {
    const p = this.local(e);
    const d = this.drag;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.pointers.size === 1) {
      // 두 손가락 중 하나만 떼면 남은 손가락으로 계속 끌기
      const q = [...this.pointers.values()][0];
      this.drag = { x0: q.x, y0: q.y, x: q.x, y: q.y, moved: true, hist: [] };
      return;
    }
    if (this.pointers.size > 0) return;
    this.root.classList.remove('wm-grabbing');
    this.drag = null;
    if (!d) return;
    if (!d.moved && e.type === 'pointerup') this.clickAt(p.x, p.y, e.pointerType);
    else if (d.moved && !this.reduced && d.hist.length > 1) this.fling(d.hist, e.timeStamp);
  }

  /** 손을 떼기 직전 0.1초 동안의 움직임으로 관성 속도를 정한다 */
  fling(hist, upT) {
    const b = hist[hist.length - 1];
    if (upT - b.t > 90) return; // 멈췄다가 놓으면 관성 없음
    const recent = hist.filter((h) => b.t - h.t <= 100);
    const a = recent[0];
    const dt = b.t - a.t;
    if (recent.length < 2 || dt <= 0) return;
    const vx = (b.x - a.x) / dt, vy = (b.y - a.y) / dt;
    if (this.mode === 'globe') {
      const R = this.frame?.R || 200;
      this.vel = { x: -vx / R / DEG, y: vy / R / DEG };
    } else {
      const { s } = this.flatFrame();
      this.vel = { x: -vx / s, y: vy / s };
    }
    this.kick();
  }

  panBy(dx, dy) {
    if (this.mode === 'globe') {
      const R = this.frame?.R || 200;
      this.view.lon = wrap180(this.view.lon - dx / R / DEG);
      this.view.lat = clamp(this.view.lat + dy / R / DEG, -80, 80);
    } else {
      const { s } = this.flatFrame();
      this.fview.x -= dx / s;
      this.fview.y += dy / s;
      this.clampFlat();
    }
    this.invalidate();
  }

  zoomAt(f, x, y) {
    this.anim = null;
    if (this.mode === 'globe') {
      this.view.zoom = clamp(this.view.zoom * f, 0.8, 3.2);
    } else {
      const T = this.flatFrame();
      const mx = (x - T.tx) / T.s, my = (T.ty - y) / T.s;
      const z = clamp(this.fview.zoom * f, 1, 6);
      const s1 = T.base * z;
      this.fview = { zoom: z, x: mx - (x - this.w / 2) / s1, y: my + (y - this.h / 2) / s1 };
      this.clampFlat();
    }
    this.idleAt = performance.now() + 5000;
    this.invalidate();
  }

  onWheel(e) {
    e.preventDefault();
    const p = this.local(e);
    const f = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
    this.zoomAt(f, p.x, p.y);
  }

  onKey(e) {
    const k = e.key;
    if (k === 'ArrowLeft') this.panBy(60, 0);
    else if (k === 'ArrowRight') this.panBy(-60, 0);
    else if (k === 'ArrowUp') this.panBy(0, 60);
    else if (k === 'ArrowDown') this.panBy(0, -60);
    else if (k === '+' || k === '=') this.zoomBy(1.25);
    else if (k === '-' || k === '_') this.zoomBy(0.8);
    else if (k === '0' || k === 'Home') this.resetView();
    else return;
    e.preventDefault();
  }

  clickAt(x, y, type) {
    const m = this.markerAt(x, y);
    if (m) {
      this.select(m.city.id);
      this.o.onSelectCity?.(m.city);
      return;
    }
    if (type !== 'mouse') {
      // 손가락으로 누르면 나라 이름을 잠깐 보여 준다
      this.hoverAt(x, y);
      clearTimeout(this.tipTimer);
      this.tipTimer = setTimeout(() => this.clearHover(), 2200);
    }
  }

  hoverAt(x, y) {
    const m = this.markerAt(x, y);
    const city = m ? m.city : null;
    let country = null;
    if (!city) {
      const ll = this.unproject(x, y);
      if (ll) country = this.countryAt(ll[0], ll[1]);
    }
    if (city !== this.hoverCity) {
      this.hoverCity = city;
      this.dirty = true;
    }
    if (country !== this.hoverCountry) {
      this.hoverCountry = country;
      this.baseDirty = true;
    }
    this.canvas.style.cursor = city ? 'pointer' : '';
    if (city) {
      const kind = cityKind(city, this.o.currentStudentId);
      const n = (city.residents || []).length;
      this.showTip(x, y, `<b>${city.emoji || '📍'} ${esc(city.name)}</b><span>${esc(city.country)} · ${esc(city.landmark)}</span>
        <span class="wm-tip-kind k-${kind}">${KIND_LABEL[kind]}${n ? ` · 동물 친구 ${n}` : ''}${zoneTiles(city) ? ` · 영토 ${zoneTiles(city)}칸` : ''}</span>`);
    } else if (country) {
      this.showTip(x, y, `<b>${esc(country.name)}</b><span>${esc(country.en)}</span>`);
    } else this.hideTip();
    this.kick();
  }

  clearHover() {
    if (this.hoverCity || this.hoverCountry) {
      this.hoverCity = null;
      this.hoverCountry = null;
      this.invalidate();
    }
    this.hideTip();
  }

  showTip(x, y, html) {
    const tip = this.tip;
    if (!tip) return;
    tip.innerHTML = html;
    tip.classList.add('on');
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const left = clamp(x + 16, 6, this.w - w - 6);
    const top = y + 18 + h > this.h - 6 ? y - h - 14 : y + 18;
    tip.style.transform = `translate(${Math.round(left)}px, ${Math.round(clamp(top, 6, this.h - h - 6))}px)`;
  }

  hideTip() {
    this.tip?.classList.remove('on');
  }
}

export function createWorldMap(root, opts) {
  return new WorldMap(root, opts);
}

// ─────────────────────────────────────────────────────────────
// 도시 상세창: 랜드마크 / 동물 친구
// ─────────────────────────────────────────────────────────────
export function openCityModal(city, { currentStudent = null, isTeacher = false, currencyName = '코인', claimCost = 200, onClaimCity, onGive, onInvade, tab = 'landmark' } = {}) {
  const root = $('#modal-root');
  if (!root) return null;
  const residents = city.residents || [];
  const myId = currentStudent?.id || null;
  const kind = cityKind(city, myId);
  const mine = residents.find((r) => r.id === myId);
  const status = kind === 'mine'
    ? '🚩 내가 깃발을 꽂은 도시예요'
    : kind === 'friend'
      ? `👥 ${isTeacher ? '학생' : '친구'} ${residents.length}명이 살고 있어요`
      : '✨ 아직 아무도 없는 미개척지예요';
  const cur = esc(currencyName);
  const balance = Number(currentStudent?.balance) || 0;
  // 침공: 다른 학생이 코인으로 넓힌 땅만 (처음 받은 시작 영토는 지킬 수 있다)
  const targets = !isTeacher && currentStudent && onInvade ? residents.filter((r) => r.id !== myId && Number(r.invadeCost) > 0) : [];

  const claim = isTeacher || !currentStudent ? '' : kind === 'mine'
    ? `<div class="claim-done">🚩 ${esc(mine?.animal?.name || '내 수호동물')}와 함께 지키는 내 영토예요 · 영토 ${mine?.tiles ?? 0}칸</div>`
    : `<div class="claim-box">
        <div>
          <b>✨ 이 도시에 깃발을 꽂아 볼까요?</b>
          <p>${fmt(claimCost)} ${cur}으로 영토 1칸을 넓히고, 이 도시 친구들과 이웃이 돼요.</p>
        </div>
        <button class="btn btn-gold" data-claim>🚩 ${fmt(claimCost)} ${cur}로 개척하기</button>
      </div>`;
  const invadeHint = targets.length ? `
    <div class="invade-box">
      <div>
        <b>⚔️ 이 도시에는 침공할 수 있는 영토가 있어요</b>
        <p>친구가 ${cur}으로 넓힌 땅은 그 친구가 낸 ${cur}의 2배보다 많이 내면 차지할 수 있어요. 낸 ${cur}은 돌려받지 못해요.</p>
      </div>
      <button class="btn btn-take" data-goto-animals>⚔️ 침공할 땅 보기</button>
    </div>` : '';

  const landLine = (r) => {
    const bought = Number(r.bought) || 0;
    if (!bought) return `<small class="resident-land">🛡️ 처음 받은 땅만 있어요 · 침공할 수 없어요</small>`;
    return `<small class="resident-land">🪙 ${cur}으로 넓힌 땅 ${fmt(bought)}칸 · 낸 ${cur} ${fmt(r.paid)} · 침공하려면 <b>${fmt(r.invadeCost)}</b> ${cur}</small>`;
  };
  const invadeBtn = (r) => {
    if (!targets.includes(r)) return '';
    const cost = Number(r.invadeCost);
    const short = balance < cost;
    return `<button class="btn btn-take btn-sm" data-invade="${esc(r.id)}" ${short ? `disabled title="${cur}이 ${fmt(cost - balance)}만큼 부족해요"` : ''}>⚔️ 침공 · ${fmt(cost)} ${cur}</button>`;
  };

  const people = residents.length ? `
    <div class="resident-grid">
      ${residents.map((r) => `
        <article class="resident ${r.id === myId ? 'mine' : ''}" style="--owner:${ownerColor(r, myId)}">
          <span class="resident-emoji" aria-hidden="true">${r.animal?.emoji || '🐾'}</span>
          <div class="resident-info">
            <div class="resident-name"><b>${esc(r.animal?.name || '동물 친구')}</b> <small>${esc(r.animal?.species || '')}</small> <span class="lv-pill">캐릭터 Lv.${Number(r.characterLevel) || 1}</span></div>
            <div class="resident-title">${esc(r.animal?.title || '숲의 지킴이')}</div>
            <small class="muted"><i class="owner-dot" aria-hidden="true"></i>${r.id === myId ? '나' : esc(r.name)} · ${r.isHome ? '🏡 시작 도시' : '🚩 개척한 도시'} · 영토 ${Number(r.tiles) || 0}칸</small>
            ${landLine(r)}
          </div>
          ${isTeacher && onGive ? `<button class="btn btn-give btn-sm" data-give="${esc(r.id)}">🎁 보상</button>` : invadeBtn(r)}
        </article>`).join('')}
    </div>` : `
    <div class="empty"><span class="emo">🌱</span>아직 이 도시에 사는 동물 친구가 없어요.<br>${isTeacher ? '' : '가장 먼저 깃발을 꽂아 첫 주인이 되어 보세요!'}</div>`;

  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal modal-city" role="dialog" aria-modal="true" aria-labelledby="city-modal-title" style="--city:${safeColor(city.color)}">
      <header class="city-hero">
        <span class="city-hero-emoji" aria-hidden="true">${city.emoji || '🏛️'}</span>
        <div class="city-hero-text">
          <span class="city-hero-kicker">${esc(city.country)} · ${CONTINENT_NAMES[city.continent] || ''}</span>
          <h2 id="city-modal-title">${esc(city.name)}</h2>
          <p>${esc(city.tagline)}</p>
        </div>
        <button class="modal-close" data-close aria-label="닫기">✕</button>
      </header>
      <div class="city-status k-${kind}"><span>${status}</span><span class="city-coord">📍 ${coordText(city)}</span></div>
      <div class="city-tabs" role="tablist">
        <button role="tab" id="city-tab-landmark" aria-selected="true" aria-controls="city-pane-landmark">🏛️ 랜드마크</button>
        <button role="tab" id="city-tab-animals" aria-selected="false" aria-controls="city-pane-animals">🐾 동물 친구 <b>${residents.length}</b></button>
      </div>
      <div class="modal-body city-body">
        <section id="city-pane-landmark" role="tabpanel" aria-labelledby="city-tab-landmark">
          <div class="landmark-card">
            <span class="landmark-icon" aria-hidden="true">${city.emoji || '🏛️'}</span>
            <div>
              <small>대표 랜드마크</small>
              <h3>${esc(city.landmark)}</h3>
              <p>${esc(city.landmarkDesc)}</p>
            </div>
          </div>
          <div class="city-tags">
            ${(city.tags || []).map((t) => `<span class="city-tag"># ${esc(t)}</span>`).join('')}
            ${city.wikiUrl ? `<a class="city-wiki" href="${esc(city.wikiUrl)}" target="_blank" rel="noopener noreferrer">📖 위키백과에서 더 알아보기 ↗</a>` : ''}
          </div>
          ${zoneBarHTML(city, myId)}
          ${claim}
          ${invadeHint}
        </section>
        <section id="city-pane-animals" role="tabpanel" aria-labelledby="city-tab-animals" hidden>${zoneBarHTML(city, myId)}${people}</section>
      </div>
    </div>`;
  root.appendChild(wrap);

  const prevFocus = document.activeElement;
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() {
    document.removeEventListener('keydown', onKey);
    wrap.remove();
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus?.();
  }
  document.addEventListener('keydown', onKey);
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  wrap.querySelector('[data-close]').addEventListener('click', close);

  const tabs = [...wrap.querySelectorAll('[role="tab"]')];
  const showTab = (tabEl) => tabs.forEach((t) => {
    const on = t === tabEl;
    t.setAttribute('aria-selected', String(on));
    wrap.querySelector(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  });
  tabs.forEach((t) => t.addEventListener('click', () => showTab(t)));
  if (tab === 'animals') showTab(tabs[1]);
  wrap.querySelector('[data-goto-animals]')?.addEventListener('click', () => showTab(tabs[1]));

  wrap.querySelector('[data-claim]')?.addEventListener('click', async () => {
    close();
    await onClaimCity?.(city);
  });
  wrap.querySelectorAll('[data-give]').forEach((b) => b.addEventListener('click', () => {
    close();
    onGive?.(b.dataset.give);
  }));
  wrap.querySelectorAll('[data-invade]').forEach((b) => b.addEventListener('click', () => {
    const target = residents.find((r) => r.id === b.dataset.invade);
    if (!target) return;
    close();
    onInvade?.(city, target);
  }));
  wrap.querySelector('[data-close]').focus();
  return { close };
}
