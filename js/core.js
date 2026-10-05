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

import { handleMockAPI } from './mock-storage.js';

let isMockMode = null; // null: unknown, true: mock, false: server

export function getAppMode() {
  return isMockMode ? 'mock' : 'server';
}

// ---------- 서버 통신 ----------
export async function api(path, { method = 'GET', body } = {}) {
  const s = session.get();

  // 1. 호스팅 환경 감지: Vercel, GitHub Pages, Netlify 등 온라인 웹 환경에서는 즉시 브라우저 로컬 저장소 모드 사용
  if (isMockMode === null) {
    const host = location.hostname.toLowerCase();
    const isLocalServer = host === 'localhost' || host === '127.0.0.1' || host.startsWith('192.168.') || host.startsWith('10.');
    if (!isLocalServer || location.protocol === 'file:') {
      isMockMode = true;
      console.log(`Classimal World: 웹 호스팅(${host}) 감지 -> 브라우저 로컬 저장소 모드로 작동합니다.`);
    }
  }

  if (isMockMode === true) {
    return await handleMockAPI(path, { method, body, token: s?.token });
  }

  // 2. 로컬 서버 연결 시도
  const headers = { 'Content-Type': 'application/json' };
  if (s?.token) headers.Authorization = `Bearer ${s.token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    // 백엔드 서버가 켜져 있지 않은 경우 자동으로 브라우저 로컬 모드로 전환
    console.warn(`Classimal World: 백엔드 서버 연결 불가. 브라우저 로컬 저장소 모드로 전환합니다.`);
    isMockMode = true;
    return await handleMockAPI(path, { method, body, token: s?.token });
  }

  // 3. API 경로가 없는 정적 호스팅(404)일 경우 로컬 모드로 즉시 전환
  if (res.status === 404) {
    console.warn(`Classimal World: API 라우트 없음(404). 브라우저 로컬 저장소 모드로 전환합니다.`);
    isMockMode = true;
    return await handleMockAPI(path, { method, body, token: s?.token });
  }

  let data = null;
  try { data = await res.json(); } catch { /* 비어 있는 응답 */ }
  if (res.status === 401) {
    session.clear();
    toast('다시 들어와 주세요.', 'error');
    location.hash = '#/';
    throw new Error(data?.error || '다시 들어와 주세요.');
  }
  if (!res.ok) {
    if (res.status >= 500) {
      isMockMode = true;
      return await handleMockAPI(path, { method, body, token: s?.token });
    }
    throw new Error(data?.error || '오류가 발생했어요.');
  }

  isMockMode = false;
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
export function openModal({ title, body, foot = '', wide = false, onMount }) {
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
  function close() { document.removeEventListener('keydown', onKey); wrap.remove(); }
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(); });
  $('#modal-close', wrap).addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  const modal = { el: wrap, close };
  onMount?.(modal);
  return modal;
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
