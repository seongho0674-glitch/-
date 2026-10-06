// ==========================================================
// 공통 도구: 서버 통신, 세션, 토스트, 모달, 애니메이션
// ==========================================================

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** HTML 특수문자 처리 (학생 이름 등 사용자가 입력한 글자를 안전하게 표시) */
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export function fmtDate(iso, withTime = true) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const base = `${d.getMonth() + 1}/${d.getDate()}(${WEEK[d.getDay()]})`;
  if (!withTime) return base;
  return `${base} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayLabel() {
  const d = new Date();
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;
}

// ---------- 아바타 ----------
const AVATAR_GRADS = [
  'linear-gradient(135deg,#f472b6,#a855f7)', 'linear-gradient(135deg,#38bdf8,#6366f1)',
  'linear-gradient(135deg,#34d399,#0ea5e9)', 'linear-gradient(135deg,#fbbf24,#f97316)',
  'linear-gradient(135deg,#a78bfa,#ec4899)', 'linear-gradient(135deg,#2dd4bf,#22c55e)',
  'linear-gradient(135deg,#fb7185,#f59e0b)', 'linear-gradient(135deg,#818cf8,#22d3ee)',
];
export function avatar(name, seed = 0, cls = '') {
  const n = String(name || '?').replace(/^\d+번\s*/, '') || String(name || '?');
  const ch = n.trim().charAt(0) || '?';
  const bg = AVATAR_GRADS[Math.abs(Number(seed) || 0) % AVATAR_GRADS.length];
  return `<span class="avatar ${cls}" style="background:${bg}">${esc(ch)}</span>`;
}

// ---------- 세션 ----------
const SKEY = 'cm_session';
export const session = {
  get() { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } },
  set(v) { localStorage.setItem(SKEY, JSON.stringify(v)); },
  clear() { localStorage.removeItem(SKEY); },
};

// ---------- 학급 코드 (웹 버전: 학생 이름은 학급 코드를 아는 기기에서만 보인다) ----------
const CODE_KEY = 'cm_class_code';
export const classCode = {
  get() { try { return localStorage.getItem(CODE_KEY) || ''; } catch { return ''; } },
  set(v) { try { localStorage.setItem(CODE_KEY, String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '')); } catch { /* 저장 안 됨 */ } },
  clear() { try { localStorage.removeItem(CODE_KEY); } catch { /* 무시 */ } },
};

let isMockMode = null; // null: 아직 모름, true: 브라우저 저장소(체험 모드), false: 서버(교실 PC 또는 Vercel + Neon)
let modeProbe = null;
let mockApi = null;    // 체험 모드일 때만 불러온다 (서버 모드에서는 체험용 명단 파일을 받지 않게)
// 서버 기능이 없는 정적 호스팅 주소는 확인 없이 바로 체험 모드 (Vercel은 /api 서버가 있어 확인한다)
const STATIC_HOSTS = /(\.github\.io|\.netlify\.app|\.pages\.dev)$/i;

export function getAppMode() {
  return isMockMode ? 'mock' : 'server';
}

/** 처음 한 번만 서버가 있는지 확인한다. 한 번 정한 모드는 바꾸지 않는다. */
function detectMode() {
  if (isMockMode !== null) return Promise.resolve(isMockMode);
  if (location.protocol === 'file:' || STATIC_HOSTS.test(location.hostname)) {
    isMockMode = true;
    return Promise.resolve(true);
  }
  if (!modeProbe) {
    modeProbe = fetch('/api/public/info', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async (r) => {
        const isJson = (r.headers.get('content-type') || '').includes('application/json');
        let data = null;
        if (isJson) { try { data = await r.json(); } catch { data = null; } }
        // 404·index.html 같은 응답이면 서버가 없는 정적 호스팅, DB가 아직 연결되지 않은 웹 서버도 체험 모드.
        // 서버가 있는데 잠시 오류(5xx)면 체험 모드로 바꾸지 않는다 (기록이 서버와 브라우저로 나뉘지 않게)
        isMockMode = isJson ? data?.code === 'DB_NOT_CONFIGURED' : r.status < 500;
      })
      .catch(() => { isMockMode = true; })
      .then(() => {
        if (isMockMode) console.info('Classimal World: 서버(데이터베이스)가 없어 체험 모드(이 브라우저에만 저장)로 작동합니다.');
      });
  }
  return modeProbe.then(() => isMockMode);
}

// ---------- 서버 통신 ----------
export async function api(path, { method = 'GET', body } = {}) {
  const s = session.get();
  if (await detectMode()) {
    if (!mockApi) mockApi = (await import('./mock-storage.js')).handleMockAPI;
    return await mockApi(path, { method, body, token: s?.token });
  }

  const headers = { 'Content-Type': 'application/json' };
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  const code = classCode.get();
  if (code) headers['X-Class-Code'] = code;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    // 서버 모드에서 연결이 끊겨도 체험 모드로 바꾸지 않는다 (기록이 서버와 브라우저로 나뉘지 않게)
    throw new Error('교실 서버에 연결할 수 없어요. 와이파이와 서버 창이 켜져 있는지 확인해 주세요.');
  }

  let data = null;
  try { data = await res.json(); } catch { /* 비어 있는 응답 */ }
  if (res.status === 401) {
    session.clear();
    toast('다시 들어와 주세요.', 'error');
    location.hash = '#/';
    throw new Error(data?.error || '다시 들어와 주세요.');
  }
  if (!res.ok) throw new Error(data?.error || '오류가 발생했어요.');
  return data;
}

export async function logout() {
  try { await api('/logout', { method: 'POST' }); } catch { /* 무시 */ }
  session.clear();
  location.hash = '#/';
}

// ---------- 토스트 ----------
export function toast(msg, type = 'success') {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span><span>${esc(msg)}</span>`;
  root.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, type === 'error' ? 3600 : 2600);
}

// ---------- 모달 ----------
export function openModal({ title, body, foot = '', wide = false, onMount, onClose }) {
  const root = $('#modal-root');
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop';
  wrap.innerHTML = `
    <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" id="modal-close" aria-label="닫기">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
    </div>`;
  root.appendChild(wrap);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  let closed = false;
  const observer = new MutationObserver(() => { if (!wrap.isConnected) close(); });
  observer.observe(root, { childList: true });
  function close() {
    if (closed) return;
    closed = true;
    observer.disconnect();
    document.removeEventListener('keydown', onKey);
    wrap.remove();
    onClose?.();
  }
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  $('#modal-close', wrap).addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  const modal = { el: wrap, close };
  onMount?.(modal);
  return modal;
}

// ---------- PDF 과제 ----------
// 웹(Vercel)은 한 번에 4.5MB까지만 주고받을 수 있어서, 글자로 바꾸면 4/3배가 되는 PDF는 3MB까지
export const MAX_PDF_BYTES = 3 * 1024 * 1024;
export async function readPdfFile(file) {
  if (!file) return { pdfName: '', pdfData: '' };
  if (!/\.pdf$/i.test(file.name)) throw new Error('PDF 파일을 선택해 주세요.');
  if (file.size > MAX_PDF_BYTES) throw new Error('PDF는 3MB까지 올릴 수 있어요. 쪽수를 나누거나 용량을 줄여 주세요.');
  const signature = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
  if (signature !== '%PDF-') throw new Error('올바른 PDF 파일인지 확인해 주세요.');
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요. 다시 선택해 주세요.'));
    reader.readAsDataURL(file);
  });
  return { pdfName: file.name, pdfData: `data:application/pdf;base64,${data.split(',')[1]}` };
}

export async function getAssignmentPdfUrl(assignment, role = 'student') {
  const data = await api(`/${role}/assignments/${encodeURIComponent(assignment.id)}/pdf`);
  const match = /^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(data.pdfData || '');
  if (!match) throw new Error('과제 PDF를 불러올 수 없어요.');
  const decoded = atob(match[1]);
  if (!decoded.startsWith('%PDF-') || decoded.length > MAX_PDF_BYTES) throw new Error('올바른 PDF 파일이 아니에요.');
  const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
  return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
}

export async function openAssignmentPdf(assignment, { role = 'student' } = {}) {
  let url = null;
  try {
    url = await getAssignmentPdfUrl(assignment, role);
    return openModal({
      title: `📄 ${esc(assignment.title || assignment.pdfName || '과제 PDF')}`,
      wide: true,
      body: `<div class="row"><a class="btn btn-ghost btn-sm" href="${url}" target="_blank" rel="noopener">새 창에서 보기</a><a class="btn btn-ghost btn-sm" href="${url}" download="${esc(assignment.pdfName || '과제.pdf')}">PDF 내려받기</a></div><iframe class="pdf-frame" title="과제 PDF" src="${url}"></iframe>`,
      onClose: () => URL.revokeObjectURL(url),
    });
  } catch (e) { if (url) URL.revokeObjectURL(url); toast(e.message, 'error'); return null; }
}

export function confirmModal({ emoji = '❓', title = '확인', html = '', okText = '확인', okClass = 'btn-primary' }) {
  return new Promise((resolve) => {
    let done = false;
    const m = openModal({
      title,
      body: `<div class="confirm-emoji">${emoji}</div><div class="confirm-text">${html}</div>`,
      foot: `<button class="btn btn-ghost" id="confirm-no">취소</button>
             <button class="btn ${okClass}" id="confirm-yes">${esc(okText)}</button>`,
      onMount: ({ el, close }) => {
        $('#confirm-no', el).onclick = () => { done = true; close(); resolve(false); };
        $('#confirm-yes', el).onclick = () => { done = true; close(); resolve(true); };
        $('#confirm-yes', el).focus();
      },
    });
    // 바깥 클릭/ESC로 닫으면 취소로 처리
    const obs = new MutationObserver(() => {
      if (!document.body.contains(m.el)) { obs.disconnect(); if (!done) resolve(false); }
    });
    obs.observe($('#modal-root'), { childList: true });
  });
}

// ---------- 애니메이션 ----------
export function countUp(el, to, duration = 900) {
  if (!el) return;
  const from = Number(el.dataset.from || 0);
  const start = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = fmt(Math.round(from + (to - from) * eased));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function coinBurst(x, y, count = 10, emoji = '🪙') {
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'coin-burst';
    el.textContent = emoji;
    const ang = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const dist = 60 + Math.random() * 80;
    el.style.left = `${x - 15}px`;
    el.style.top = `${y - 15}px`;
    el.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
    el.style.setProperty('--dy', `${Math.sin(ang) * dist - 40}px`);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }
}

export function celebrateLevelUp(level) {
  const el = document.createElement('div');
  el.className = 'levelup';
  const colors = ['#ffcb47', '#f472b6', '#8b5cf6', '#2dd4bf', '#38bdf8', '#fb7185', '#34d399'];
  let confetti = '';
  for (let i = 0; i < 90; i++) {
    confetti += `<i class="confetti" style="left:${Math.random() * 100}%;background:${colors[i % colors.length]};
      animation-duration:${2.2 + Math.random() * 2.2}s;animation-delay:${Math.random() * 0.8}s;
      transform:rotate(${Math.random() * 360}deg)"></i>`;
  }
  el.innerHTML = `${confetti}
    <div class="levelup-inner">
      <div class="levelup-title">LEVEL UP!</div>
      <div class="level-badge"><span><small>LEVEL</small><b>${level}</b></span></div>
      <p class="levelup-sub">축하해요! 레벨 ${level}이 되었어요 🎉</p>
      <button class="btn btn-gold btn-lg" id="levelup-ok">좋아요!</button>
    </div>`;
  document.body.appendChild(el);
  const close = () => el.remove();
  $('#levelup-ok', el).onclick = close;
  setTimeout(() => document.body.contains(el) && close(), 8000);
}

export function loadingHTML() {
  return `<div class="loading"><div class="spinner" aria-label="불러오는 중"></div></div>`;
}

export function errorHTML(msg) {
  return `<div class="loading"><div class="empty"><span class="emo">🔌</span>${esc(msg)}<br><br>
    <button class="btn btn-primary" onclick="location.reload()">다시 시도</button></div></div>`;
}
