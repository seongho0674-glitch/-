// ==========================================================
// 앱 시작점: 화면 이동(라우팅), 시작 화면, 학생 선택, PIN 입력
// ==========================================================
import { $, $$, esc, api, session, classCode, toast, avatar, loadingHTML, errorHTML, getAppMode } from './core.js';
import { renderStudent } from './student.js';
import { renderTeacher } from './teacher.js';
import { createWorldMap } from './world3d.js';

const app = $('#app');
let cleanup = null;
let routeSeq = 0;

async function route() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  $('#modal-root').innerHTML = '';
  window.scrollTo(0, 0);
  const seq = ++routeSeq;
  // 화면을 그리는 사이 다른 화면으로 옮겨 갔다면, 늦게 끝난 화면은 바로 정리한다
  const keep = (fn) => {
    if (seq === routeSeq) cleanup = fn;
    else if (typeof fn === 'function') fn();
  };

  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [area, sub, extra] = parts;
  const s = session.get();

  try {
    if (area === 'student') {
      if (s?.role !== 'student') return go('#/');
      keep(await renderStudent(app, sub || 'home'));
    } else if (area === 'teacher') {
      if (s?.role !== 'teacher') return go('#/');
      keep(await renderTeacher(app, sub || 'home'));
    } else if (area === 'login' && sub === 'student') {
      await renderStudentPick();
    } else if (area === 'login' && sub === 'pin' && extra) {
      await renderStudentPin(extra);
    } else if (area === 'login' && sub === 'teacher') {
      renderTeacherPin();
    } else {
      if (s?.role === 'student') return go('#/student');
      if (s?.role === 'teacher') return go('#/teacher');
      keep(await renderStart());
    }
  } catch (e) {
    app.innerHTML = errorHTML(e.message);
  }
}

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// ---------- 시작 화면 ----------
async function renderStart() {
  app.innerHTML = loadingHTML();
  const info = await api('/public/info');
  document.title = `서초롱 민주시민 경제교육 · ${info.className}`;
  app.innerHTML = `
    <section class="start">
      <div class="start-inner">
        <div class="hero-globe" aria-hidden="true"><div id="start-globe"></div><span class="hero-coin-badge">🪙</span></div>
        <span class="class-tag">🏫 ${esc(info.className)} · 함께 만드는 우리 반</span>
        <h1 class="hero-title"><span class="grad">서초롱<br>민주시민 경제교육</span></h1>
        <p class="hero-sub">과제를 풀고 ${esc(info.currencyName)}을 모아 세금을 내고, 내 캐릭터와 영토를 키워 보세요!</p>
        <div class="choice-grid">
          <a class="choice-card student" href="#/login/student" id="choose-student">
            <span class="choice-arrow">→</span>
            <span class="choice-emoji">🎒</span>
            <div class="choice-title">학생으로 들어가기</div>
            <p class="choice-desc">선생님 과제 · 내 ${esc(info.currencyName)} · 캐릭터 키우기 · 1인 1역</p>
          </a>
          <a class="choice-card teacher" href="#/login/teacher" id="choose-teacher">
            <span class="choice-arrow">→</span>
            <span class="choice-emoji">🧑‍🏫</span>
            <div class="choice-title">선생님으로 들어가기</div>
            <p class="choice-desc">과제·PDF 업로드 · 답안 확인 · 상점 관리 · 1인 1역</p>
          </a>
        </div>
        ${getAppMode() === 'mock' ? `
          <p class="mode-note" role="note">🧪 <b>체험 모드</b> · 기록은 이 브라우저에만 저장돼요. 교실에서 함께 쓰려면 교실 PC에서 <b>실행하기.bat</b>으로 서버를 켜 주세요. (선생님·학생 처음 PIN 0000)</p>` : ''}
      </div>
    </section>`;

  // 동물 친구들이 사는 지구본 (도시 정보는 로그인 없이 볼 수 있음)
  let cities = [];
  try { cities = (await api('/world/cities')).cities || []; } catch { /* 지구본만 보여 줌 */ }
  const el = $('#start-globe');
  if (!el) return null;
  const globe = createWorldMap(el, { cities, compact: true, interactive: false, autoRotate: true, stars: false, globeScale: 0.34 });
  return () => globe.destroy();
}

// ---------- 학생 선택 ----------
async function renderStudentPick() {
  app.innerHTML = loadingHTML();
  const info = await api('/public/info');
  if (info.needCode) return renderClassCode(info);   // 웹 버전: 학급 코드를 아는 기기에서만 이름 목록
  app.innerHTML = `
    <section class="login-wrap">
      <div class="login-head">
        <a class="btn btn-ghost" href="#/" id="back-start">← 처음으로</a>
        <h1>내 이름을 눌러 주세요</h1>
        ${classCode.get() ? '<button class="btn btn-ghost btn-sm" id="change-code" type="button">학급 코드 바꾸기</button>' : ''}
      </div>
      <div class="pick-grid">
        ${info.students.map((s, i) => `
          <a class="pick-btn" id="pick-${esc(s.id)}" href="#/login/pin/${encodeURIComponent(s.id)}" style="animation-delay:${i * 18}ms">
            <span class="pick-num">${s.number}</span>
            <span class="pick-name">${esc(s.name)}</span>
          </a>`).join('')}
      </div>
      ${info.students.length ? '' : '<div class="empty"><span class="emo">🙈</span>아직 등록된 학생이 없어요. 선생님께 말씀드려 주세요.</div>'}
    </section>`;
  $('#change-code')?.addEventListener('click', () => { classCode.clear(); repaintPick(); });
}

// ---------- 학급 코드 (웹 버전) ----------
function renderClassCode(info) {
  app.innerHTML = `
    <section class="pin-screen">
      <form class="card pin-card" id="code-card" autocomplete="off">
        <div class="row" style="margin-bottom:6px"><a class="btn btn-ghost btn-sm" href="#/" id="code-back">← 처음으로</a></div>
        <span class="avatar pin-avatar" style="background:linear-gradient(135deg,#34d399,#0ea5e9)">🏫</span>
        <h1 class="pin-title">학급 코드</h1>
        <p class="muted">선생님이 알려 준 학급 코드를 입력해 주세요.<br>이 기기에서는 처음 한 번만 입력하면 돼요.</p>
        <input class="input" id="class-code" maxlength="8" autocapitalize="characters" spellcheck="false" placeholder="예: K7P4QX" aria-label="학급 코드"
          style="text-align:center;font-size:26px;letter-spacing:6px;text-transform:uppercase;margin:14px 0 4px">
        <div class="pin-msg" id="code-msg" role="alert">${info.codeWrong ? '학급 코드가 맞지 않아요. 다시 확인해 주세요.' : ''}</div>
        <button class="btn btn-primary btn-lg" type="submit" id="code-ok" style="width:100%">확인</button>
      </form>
    </section>`;
  const input = $('#class-code');
  input.focus();
  $('#code-card').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!input.value.trim()) { $('#code-msg').textContent = '학급 코드를 입력해 주세요.'; return; }
    classCode.set(input.value);
    repaintPick();
  });
}

function repaintPick() {
  renderStudentPick().catch((err) => { app.innerHTML = errorHTML(err.message); });
}

// ---------- PIN 입력 (학생/교사 공통) ----------
function pinScreen({ title, sub, avatarHtml, back, onSubmit }) {
  app.innerHTML = `
    <section class="pin-screen">
      <div class="card pin-card" id="pin-card">
        <div class="row" style="margin-bottom:6px"><a class="btn btn-ghost btn-sm" href="${back}" id="pin-back">← 뒤로</a></div>
        ${avatarHtml}
        <h1 class="pin-title">${title}</h1>
        <p class="muted">${sub}</p>
        <div class="pin-dots" aria-hidden="true">${'<span class="dot"></span>'.repeat(4)}</div>
        <div class="pin-msg" id="pin-msg" role="alert"></div>
        <div class="pin-pad">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}" id="pin-key-${n}">${n}</button>`).join('')}
          <button data-k="clear" class="key-fn" id="pin-key-clear">지우기</button>
          <button data-k="0" id="pin-key-0">0</button>
          <button data-k="back" class="key-fn" id="pin-key-back">⌫</button>
        </div>
      </div>
    </section>`;

  let pin = '';
  let busy = false;
  const dots = $$('.pin-dots .dot');
  const msg = $('#pin-msg');
  const card = $('#pin-card');
  const paint = () => dots.forEach((d, i) => d.classList.toggle('filled', i < pin.length));

  async function press(k) {
    if (busy) return;
    if (k === 'back') pin = pin.slice(0, -1);
    else if (k === 'clear') pin = '';
    else if (/^\d$/.test(k) && pin.length < 4) pin += k;
    msg.textContent = '';
    paint();
    if (pin.length === 4) {
      busy = true;
      try {
        await onSubmit(pin);
      } catch (e) {
        msg.textContent = e.message;
        card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
        pin = '';
        paint();
      } finally {
        busy = false;
      }
    }
  }
  $$('.pin-pad button').forEach((b) => b.addEventListener('click', () => press(b.dataset.k)));
  const onKey = (e) => {
    if (!$('#pin-card')) return document.removeEventListener('keydown', onKey);
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('back');
  };
  document.addEventListener('keydown', onKey);
  cleanup = () => document.removeEventListener('keydown', onKey);
}

async function renderStudentPin(studentId) {
  app.innerHTML = loadingHTML();
  const info = await api('/public/info');
  const st = info.students.find((s) => s.id === decodeURIComponent(studentId));
  if (!st) return go('#/login/student');
  pinScreen({
    title: `${esc(st.name)}`,
    sub: '비밀번호 숫자 4자리를 눌러 주세요',
    avatarHtml: avatar(st.name, st.number, 'pin-avatar'),
    back: '#/login/student',
    onSubmit: async (pin) => {
      const r = await api('/login/student', { method: 'POST', body: { studentId: st.id, pin } });
      session.set(r);
      toast(`${st.name}, 반가워요! 👋`);
      go('#/student');
    },
  });
}

function renderTeacherPin() {
  pinScreen({
    title: '선생님 확인',
    sub: '선생님 PIN 4자리를 입력해 주세요',
    avatarHtml: '<span class="avatar pin-avatar" style="background:linear-gradient(135deg,#38bdf8,#6366f1)">🧑‍🏫</span>',
    back: '#/',
    onSubmit: async (pin) => {
      const r = await api('/login/teacher', { method: 'POST', body: { pin } });
      session.set(r);
      toast('선생님, 환영합니다!');
      go('#/teacher');
    },
  });
}

window.addEventListener('hashchange', route);
route();
