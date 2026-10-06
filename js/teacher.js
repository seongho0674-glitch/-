// ==========================================================
// 교사 화면: 학생(메인·자율 체육 회의) / 미션 / 세계지도 현황 / 거래 내역 / 상점 관리 / 역할 관리 / 설정
// ==========================================================
import {
  $, $$, esc, fmt, fmtDate, todayKey, todayLabel, api, logout, toast, avatar,
  openModal, confirmModal, coinBurst, loadingHTML, readPdfFile, openAssignmentPdf,
} from './core.js';
import { createWorldMap, openCityModal, cityKind, inContinent, coordText, CONTINENT_NAMES } from './world3d.js';

const selected = new Set();   // 메인 화면에서 체크한 학생들 (화면을 옮겨도 유지)
let flashIds = [];            // 방금 지급·차감한 학생 줄 반짝이기
let teacherMap = null;        // 세계지도 (화면을 다시 그릴 때 새로 만든다)
let worldSelectedId = null;   // 세계지도에서 고른 도시 (화면을 옮겨도 유지)

const CONTINENT_FILTERS = [['all', '전체'], ['asia', '아시아'], ['europe', '유럽'], ['americas', '아메리카'], ['africa', '아프리카'], ['oceania', '오세아니아']];
const T_KIND_LABEL = { friend: '학생이 사는 도시', empty: '미개척' };

const GIVE_REASONS = ['발표 참여', '숙제 완료', '1인 1역 수행', '친구 돕기', '수업 태도 우수', '모둠 활동 우수', '일기 쓰기'];
const TAKE_REASONS = ['숙제 미제출', '수업 방해', '지각', '정리 정돈 안 함', '약속 어기기'];
const ITEM_EMOJI = ['🎁', '🎟️', '🪑', '🎵', '📝', '🍽️', '🧑‍🏫', '✏️', '🍬', '📒', '🎮', '⚽', '🖍️', '🧸', '🍫', '⏰', '📚', '🎨'];
const ROLE_EMOJI = ['⭐', '🧽', '💡', '🪟', '📚', '🗑️', '🪴', '📮', '🍚', '📅', '🧹', '💻', '🏦', '🔔', '🎵', '🧴', '📏', '🐟'];
const MISSION_EMOJI = ['🎯', '🧩', '🗂️', '💡', '📖', '📒', '🎒', '🔎', '🧮', '✍️', '🧪', '🎨', '🏃', '🎤', '🌱', '🤝', '📝', '🌍'];
const TX_TYPE = { give: '지급', take: '차감', buy: '구매', luck: '행운의 게임', class: '자율 체육', tax: '세금', upgrade: '캐릭터 성장', territory: '영토 확장' };
const txTypeLabel = (t) => t.type === 'tax' && /재산세|소득세/.test(t.reason || '') ? (t.reason.includes('재산세') ? '재산세' : '소득세') : (TX_TYPE[t.type] || t.type);
const isPlus = (t) => t.type === 'give' || (t.type === 'luck' && t.win);

export async function renderTeacher(app, view) {
  app.innerHTML = loadingHTML();
  let st = await api('/teacher/state');
  let txs = ['history', 'shop'].includes(view) ? (await api('/teacher/transactions')).transactions : [];
  let worldData = view === 'world' ? (await api('/teacher/world')) : null;
  let ms = view === 'missions' ? (await api('/teacher/missions')) : null;
  let assignments = view === 'assignments' ? (await api('/teacher/assignments')).assignments : [];
  const assignmentDraft = { title: '', instructions: '', reward: 10, target: 'all', studentIds: [], pdfName: '', pdfData: '' };
  let publishingAssignment = false;
  let readingPdf = false;
  const cur = () => esc(st.settings.currencyName);
  let timer = null;
  let continentFilter = 'all';

  async function refresh() {
    st = await api('/teacher/state');
    if (['history', 'shop'].includes(view)) txs = (await api('/teacher/transactions')).transactions;
    if (view === 'missions') ms = await api('/teacher/missions');
    if (view === 'assignments') assignments = (await api('/teacher/assignments')).assignments;
    if (view === 'world') {
      worldData = await api('/teacher/world');
      if (teacherMap) return refreshWorldInPlace(); // 지도 시점을 그대로 두고 내용만 바꾼다
    }
    paint();
  }

  function shell(content) {
    const pending = st.pendingCount ? ` <span class="nav-badge" aria-label="확인 기다리는 미션 ${st.pendingCount}건">${st.pendingCount}</span>` : '';
    const nav = [
      ['home', '👩‍🎓', '학생', '#/teacher'],
      ['missions', '🎯', `미션${pending}`, '#/teacher/missions'],
      ['assignments', '🧑‍🏫', '교사 관리자', '#/teacher/assignments'],
      ['world', '🌍', '세계지도', '#/teacher/world'],
      ['history', '📒', '거래 내역', '#/teacher/history'],
      ['shop', '🏪', '상점 관리', '#/teacher/shop'],
      ['roles', '🧩', '1인 1역', '#/teacher/roles'],
      ['settings', '⚙️', '설정', '#/teacher/settings'],
    ];
    return `
      <header class="topbar">
        <div class="container topbar-inner">
          <div class="brand"><span class="brand-logo">🪙</span><div>서초롱 민주시민 경제교육<small>${esc(st.settings.className)} · 교사</small></div></div>
          <nav class="nav" aria-label="교사 메뉴">
            ${nav.map(([k, ic, label, href]) => `<a href="${href}" id="nav-${k}" class="${view === k ? 'active' : ''}">${ic} ${label}</a>`).join('')}
          </nav>
          <div class="user-chip">
            <span class="avatar" style="background:linear-gradient(135deg,#38bdf8,#6366f1)">🧑‍🏫</span>
            <span class="user-name">선생님</span>
            <button class="btn btn-ghost btn-sm" id="btn-logout">나가기</button>
          </div>
        </div>
      </header>
      <div class="container page">
        ${st.settings.defaultPin ? `<div class="banner-warn">🔐 선생님 PIN이 처음 값(0000)이에요. 학생들이 들어오지 못하도록 <a href="#/teacher/settings" style="text-decoration:underline;font-weight:700">설정</a>에서 꼭 바꿔 주세요.</div>` : ''}
        ${content}
      </div>`;
  }

  const roleOf = (s) => st.roles.find((r) => r.id === s.roleId);

  // ======================= 학생(메인) =======================
  let search = '';
  function homeView() {
    const studs = st.students;
    const total = studs.reduce((a, s) => a + s.balance, 0);
    const avgLv = studs.length ? (studs.reduce((a, s) => a + s.level, 0) / studs.length).toFixed(1) : 0;
    // 지워진 학생은 선택에서 제외
    [...selected].forEach((id) => { if (!studs.some((s) => s.id === id)) selected.delete(id); });

    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">우리 반 학생</h1>
          <p class="page-sub">${todayLabel()} · 학생을 체크해서 한 번에 지급·차감할 수 있어요</p>
        </div>
      </div>

      ${st.pendingCount ? `
        <a class="banner-info" href="#/teacher/missions" id="pending-banner">
          🎯 학생들이 신청한 미션 <b>${st.pendingCount}</b>건이 확인을 기다려요 <span>확인하러 가기 →</span>
        </a>` : ''}

      <section class="card goal-card teacher-goal" id="t-goal" aria-label="자율 체육 저금통">${teacherGoalHTML()}</section>

      <section class="stats-grid" aria-label="오늘의 요약">
        <div class="stat s1"><div class="stat-label">👩‍🎓 학생 수</div><div class="stat-value">${studs.length}<small>명</small></div></div>
        <div class="stat s2"><div class="stat-label">💰 학급 전체 잔액</div><div class="stat-value">${fmt(total)}<small>${cur()}</small></div></div>
        <div class="stat s3"><div class="stat-label">🎁 오늘 지급 / 차감</div><div class="stat-value"><span class="plus">+${fmt(st.today?.given ?? 0)}</span> <small>/</small> <span class="minus" style="font-size:22px">−${fmt(st.today?.taken ?? 0)}</span></div></div>
        <div class="stat s4"><div class="stat-label">⭐ 평균 경험치 레벨 · 오늘 구매</div><div class="stat-value">Lv.${avgLv} <small>· ${st.today?.purchases ?? 0}건</small></div></div>
      </section>

      <div class="toolbar" role="toolbar" aria-label="일괄 지급 도구">
        <input type="checkbox" class="chk" id="chk-all" aria-label="전체 선택">
        <label for="chk-all" style="font-weight:700;cursor:pointer">전체</label>
        <span class="sel-count" id="sel-count"></span>
        <button class="btn btn-give" id="bulk-give">＋ 선택 학생 지급</button>
        <button class="btn btn-take" id="bulk-take">－ 선택 학생 차감</button>
        <button class="btn btn-ghost btn-sm" id="sel-clear">선택 해제</button>
        <span class="spacer"></span>
        <div class="search"><input type="search" id="student-search" placeholder="이름 검색" value="${esc(search)}" aria-label="학생 이름 검색"></div>
      </div>

      <div class="table-wrap">
        <table class="table" id="student-table">
          <thead><tr>
            <th style="width:44px"></th><th>번호</th><th>이름</th><th>잔액</th><th>성장 / 경험치</th><th>1인 1역</th><th style="text-align:right">화폐 지급·차감</th>
          </tr></thead>
          <tbody>
            ${studs.map((s) => {
              const r = roleOf(s);
              const expIn = s.expInLevel || 0;
              const expTo = s.expToNext || 100;
              const pct = Math.round((expIn / expTo) * 100);
              return `
              <tr data-id="${esc(s.id)}" data-name="${esc(s.name)}" class="${selected.has(s.id) ? 'selected' : ''} ${flashIds.includes(s.id) ? 'flash' : ''}">
                <td><input type="checkbox" class="chk row-chk" ${selected.has(s.id) ? 'checked' : ''} aria-label="${esc(s.name)} 선택"></td>
                <td class="num-cell">${s.number}</td>
                <td><div class="name-cell">${avatar(s.name, s.number)}${esc(s.name)}</div></td>
                <td class="bal-cell ${s.balance < 0 ? 'minus' : ''}">${fmt(s.balance)} <span class="faint" style="font-size:14px">${cur()}</span></td>
                <td><div class="lv-cell"><span class="lv-pill" title="코인으로 키운 캐릭터">캐릭터 Lv.${Number(s.characterLevel) || 1}</span></div><div class="lv-cell"><small class="faint">경험치 Lv.${s.level}</small><span class="mini-bar" title="${s.expInLevel}/${s.expToNext} XP"><i style="width:${pct}%"></i></span></div></td>
                <td>${r ? `<span class="role-chip">${esc(r.emoji)} ${esc(r.name)}</span>` : '<span class="role-chip none">없음</span>'}</td>
                <td><div class="act-cell">
                  <button class="btn btn-give btn-sm act-give" id="give-${esc(s.id)}">＋ 지급</button>
                  <button class="btn btn-take btn-sm act-take" id="take-${esc(s.id)}">－ 차감</button>
                </div></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${studs.length ? '' : '<div class="empty"><span class="emo">🙋</span>학생이 없어요. 설정에서 학생을 추가해 주세요.</div>'}
      </div>`;
  }

  function bindHome() {
    const rows = $$('#student-table tbody tr');
    const sync = () => {
      const visible = rows.filter((r) => !r.classList.contains('hidden'));
      $('#sel-count').innerHTML = `<b>${selected.size}</b>명 선택`;
      $('#bulk-give').disabled = $('#bulk-take').disabled = selected.size === 0;
      const allOn = visible.length > 0 && visible.every((r) => selected.has(r.dataset.id));
      $('#chk-all').checked = allOn;
      rows.forEach((r) => {
        const on = selected.has(r.dataset.id);
        r.classList.toggle('selected', on);
        $('.row-chk', r).checked = on;
      });
    };
    rows.forEach((r) => {
      const id = r.dataset.id;
      r.addEventListener('click', (e) => {
        if (e.target.closest('.act-cell')) return;
        selected.has(id) ? selected.delete(id) : selected.add(id);
        sync();
      });
      $('.act-give', r).onclick = () => openPay([id], 'give');
      $('.act-take', r).onclick = () => openPay([id], 'take');
    });
    $('#chk-all').onchange = (e) => {
      rows.filter((r) => !r.classList.contains('hidden')).forEach((r) => {
        e.target.checked ? selected.add(r.dataset.id) : selected.delete(r.dataset.id);
      });
      sync();
    };
    $('#sel-clear').onclick = () => { selected.clear(); sync(); };
    $('#bulk-give').onclick = () => openPay([...selected], 'give');
    $('#bulk-take').onclick = () => openPay([...selected], 'take');
    const applySearch = () => {
      const q = search.trim();
      rows.forEach((r) => r.classList.toggle('hidden', !!q && !r.dataset.name.includes(q)));
      sync();
    };
    $('#student-search').oninput = (e) => { search = e.target.value; applySearch(); };
    applySearch();
    flashIds = [];
    bindGoal();
  }

  // ---------- 자율 체육 저금통 · 학급 회의 ----------
  function teacherGoalHTML() {
    const g = st.classGoal;
    if (!g) return '';
    const pct = Math.min(100, Math.round((g.total / g.goal) * 100));
    const v = g.vote;
    const open = v?.status === 'open';
    const needed = Math.ceil((g.studentCount * g.passRate) / 100);
    const spendPct = g.total > 0 ? Math.min(100, Math.round((g.goal / g.total) * 100)) : 100;
    const last = g.lastEvent;
    const pill = open ? ['k-friend', '🗳️ 회의 중'] : g.ready ? ['k-mine', '🎉 목표 달성'] : ['k-empty', `${pct}% 모음`];
    let action;
    if (open) {
      const yesPct = g.studentCount ? (v.yes / g.studentCount) * 100 : 0;
      const noPct = g.studentCount ? (v.no / g.studentCount) * 100 : 0;
      action = `
        <div class="vote-tally big">찬성 <b class="plus">${v.yes}</b> · 반대 <b class="minus">${v.no}</b> · 아직 <b>${v.notVoted?.length ?? 0}</b>명</div>
        <div class="vote-meter" title="찬성 ${Math.round(yesPct)}%"><i class="yes" style="width:${yesPct}%"></i><i class="no" style="width:${noPct}%"></i><span class="vote-line" style="left:${g.passRate}%"><em>${g.passRate}%</em></span></div>
        <p class="hint">${needed}명(${g.passRate}%) 이상 찬성하면 통과 · 통과하면 모두의 잔액에서 약 ${spendPct}%씩, 모두 ${fmt(g.goal)} ${cur()}을 써요 · 누가 무엇을 골랐는지는 보이지 않아요(비밀 투표)</p>
        ${v.notVoted?.length ? `<details class="vote-missing"><summary>아직 투표하지 않은 학생 ${v.notVoted.length}명</summary><p>${v.notVoted.map(esc).join(', ')}</p></details>` : ''}
        <div class="row"><button class="btn btn-primary" id="vote-close">✅ 회의 마치고 결과 확정</button><button class="btn btn-ghost" id="vote-cancel">회의 취소</button></div>`;
    } else if (g.ready) {
      action = `
        <button class="btn btn-gold btn-lg" id="vote-open">🗳️ 학급 회의 열기</button>
        <p class="hint">회의를 열면 학생들이 자기 기기에서 찬성·반대를 눌러요. 전체 학생의 ${g.passRate}% 이상이 찬성하면 자율 체육을 하고 화폐를 함께 써요.</p>`;
    } else {
      action = `<p class="goal-msg">목표까지 <b>${fmt(g.goal - g.total)}</b> ${cur()} 남았어요. 다 모이면 학급 회의를 열 수 있어요.</p>`;
    }
    return `
      <div class="card-head">
        <h2 class="card-title">🏃 자율 체육 저금통</h2>
        <span class="status-pill ${pill[0]}">${pill[1]}</span>
      </div>
      <div class="goal-row">
        <div class="goal-main">
          <div class="goal-amount"><b>${fmt(g.total)}</b> / ${fmt(g.goal)} <span>${cur()}</span></div>
          <div class="goal-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
          <p class="goal-note">${g.studentCount}명 × 하루 ${fmt(g.perDay)} ${cur()}(매일 미션 보상) × ${g.days}일 = ${fmt(g.goal)} ${cur()} · 목표 일수는 <a href="#/teacher/settings">설정</a>에서 바꿀 수 있어요</p>
          ${last ? `<p class="goal-last">지난 자율 체육: ${fmtDate(last.date, false)} · 찬성 ${last.rate}% · ${fmt(last.spent)} ${cur()} 사용</p>` : ''}
          ${v && v.status !== 'open' && v.closedAt?.slice(0, 10) === todayKey() ? `<p class="goal-msg ${v.status === 'passed' ? 'ok' : ''}">${v.status === 'passed' ? '🎉 오늘 회의 통과!' : v.status === 'failed' ? '오늘 회의는 부결됐어요.' : '오늘 회의를 취소했어요.'}${v.result ? ` (찬성 ${v.result.yes}명 · ${v.result.rate}%)` : ''}</p>` : ''}
        </div>
        <div class="goal-actions">${action}</div>
      </div>`;
  }

  function bindGoal() {
    const box = $('#t-goal');
    if (!box) return;
    const run = async (path, msg) => {
      try {
        const r = await api(path, { method: 'POST', body: {} });
        if (r.result) {
          const { passed, rate, yes, spent } = r.result;
          if (passed) {
            coinBurst(innerWidth / 2, innerHeight / 3, 24, '🏃');
            toast(`🎉 찬성 ${yes}명(${rate}%)으로 통과! 자율 체육을 해요 (${fmt(spent)} ${st.settings.currencyName} 사용)`);
          } else toast(`찬성 ${rate}%로 부결됐어요. 다음에 다시 이야기해요.`);
        } else if (msg) toast(msg);
        await refresh();
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    $('#vote-open', box)?.addEventListener('click', () => run('/teacher/vote/open', '학급 회의를 열었어요. 학생들이 투표할 수 있어요 🗳️'));
    $('#vote-cancel', box)?.addEventListener('click', async () => {
      const ok = await confirmModal({ emoji: '🗳️', title: '회의 취소', html: '학급 회의를 취소할까요?<br><span class="muted">투표 결과는 사라지고 화폐도 그대로예요.</span>', okText: '취소하기', okClass: 'btn-danger' });
      if (ok) run('/teacher/vote/cancel', '학급 회의를 취소했어요.');
    });
    $('#vote-close', box)?.addEventListener('click', async () => {
      const g = st.classGoal;
      const v = g.vote;
      const rate = g.studentCount ? Math.round((v.yes * 100) / g.studentCount) : 0;
      const pass = v.yes * 100 >= g.passRate * g.studentCount;
      const ok = await confirmModal({
        emoji: pass ? '🏃' : '🗳️',
        title: '회의 결과 확정',
        html: `지금 결과로 회의를 마칠까요?<br>찬성 <b>${v.yes}</b>명 / 전체 ${g.studentCount}명 (<b>${rate}%</b>)<br>
               ${pass ? `<span class="plus">통과 → 모두의 잔액에서 같은 비율로 ${fmt(g.goal)} ${cur()}을 써요.</span>` : `<span class="minus">${g.passRate}%가 안 돼서 부결돼요. 화폐는 그대로예요.</span>`}`,
        okText: pass ? '통과 확정!' : '결과 확정',
        okClass: pass ? 'btn-gold' : 'btn-primary',
      });
      if (ok) run('/teacher/vote/close');
    });
  }

  // ---------- 지급·차감 창 ----------
  function openPay(ids, type) {
    const targets = st.students.filter((s) => ids.includes(s.id));
    if (!targets.length) return toast('학생을 먼저 골라 주세요.', 'error');
    let kind = type;
    let amount = 10;
    let missionId = null;   // 미션 버튼으로 고르면 그 미션을 오늘 받은 것으로 기록
    const missionList = (st.missions || []).filter((m) => m.active !== false && m.kind !== 'assignment');

    openModal({
      title: '💸 화폐 지급·차감',
      body: `
        <div class="field">
          <span class="field-label">대상 학생 (${targets.length}명)</span>
          <div class="chips target-chips">${targets.map((s) => `<span class="chip">${s.number}. ${esc(s.name)}</span>`).join('')}</div>
        </div>
        <div class="seg" role="radiogroup" aria-label="지급 또는 차감">
          <button type="button" id="pay-kind-give" data-k="give">＋ 지급</button>
          <button type="button" id="pay-kind-take" data-k="take">－ 차감</button>
        </div>
        <div class="field">
          <label for="pay-amount">금액 (${cur()})</label>
          <input class="input input-xl" type="number" id="pay-amount" min="1" max="100000" value="${amount}" inputmode="numeric">
          <div class="chips" id="amount-chips">${[1, 5, 10, 20, 30, 50, 100].map((n) => `<button type="button" class="chip" data-n="${n}">${n}</button>`).join('')}</div>
        </div>
        <div class="field" id="mission-field">
          <span class="field-label">🎯 미션으로 주기 <small class="faint">(누르면 사유와 금액이 채워지고, 오늘 그 미션을 받은 것으로 기록돼요)</small></span>
          <div class="chips" id="mission-chips"></div>
        </div>
        <div class="field">
          <label for="pay-reason">사유 <span class="minus">*</span></label>
          <input class="input" id="pay-reason" maxlength="60" placeholder="예: 발표 참여" autocomplete="off">
          <div class="chips" id="reason-chips"></div>
        </div>
        <p class="hint" id="pay-hint"></p>`,
      foot: `<button class="btn btn-ghost" id="pay-cancel">취소</button><button class="btn" id="pay-submit"></button>`,
      onMount: ({ el, close }) => {
        const amountEl = $('#pay-amount', el);
        const reasonEl = $('#pay-reason', el);
        const submit = $('#pay-submit', el);
        const draw = () => {
          $('#pay-kind-give', el).className = kind === 'give' ? 'on-give' : '';
          $('#pay-kind-take', el).className = kind === 'take' ? 'on-take' : '';
          // 사유를 직접 고치면 미션 기록은 하지 않는다
          const picked = missionList.find((m) => m.id === missionId);
          if (!picked || kind !== 'give' || reasonEl.value.trim() !== picked.name) missionId = null;
          $('#mission-field', el).hidden = kind !== 'give' || !missionList.length;
          $('#mission-chips', el).innerHTML = missionList.map((m) => `<button type="button" class="chip mission-chip ${missionId === m.id ? 'on' : ''}" data-mid="${esc(m.id)}">${esc(m.emoji)} ${esc(m.name)} <b>+${fmt(m.reward)}</b></button>`).join('');
          $$('#mission-chips .chip', el).forEach((c) => (c.onclick = () => {
            const m = missionList.find((x) => x.id === c.dataset.mid);
            reasonEl.value = m.name;
            amount = m.reward;
            amountEl.value = amount;
            missionId = m.id;
            draw();
          }));
          const reasons = kind === 'give' ? GIVE_REASONS : TAKE_REASONS;
          $('#reason-chips', el).innerHTML = reasons.map((r) => `<button type="button" class="chip ${reasonEl.value === r ? 'on' : ''}">${r}</button>`).join('');
          $$('#reason-chips .chip', el).forEach((c) => (c.onclick = () => { reasonEl.value = c.textContent; draw(); }));
          $$('#amount-chips .chip', el).forEach((c) => c.classList.toggle('on', Number(c.dataset.n) === amount));
          const who = targets.length === 1 ? esc(targets[0].name) : `${targets.length}명`;
          submit.className = `btn ${kind === 'give' ? 'btn-give' : 'btn-danger'}`;
          submit.textContent = `${who}에게 ${fmt(amount || 0)} ${st.settings.currencyName} ${kind === 'give' ? '지급' : '차감'}하기`;
          submit.disabled = !(amount > 0) || !reasonEl.value.trim();
          $('#pay-hint', el).textContent = kind === 'give'
            ? `⭐ 지급하면 경험치도 ${fmt(amount || 0)} XP 함께 올라가요.${missionId ? ' 오늘 이미 이 미션을 받은 학생은 건너뛰어요.' : ''}`
            : '차감해도 경험치는 줄지 않아요. 잔액은 마이너스가 될 수 있어요.';
        };
        $$('.seg button', el).forEach((b) => (b.onclick = () => { kind = b.dataset.k; reasonEl.value = ''; draw(); }));
        $$('#amount-chips .chip', el).forEach((c) => (c.onclick = () => { amount = Number(c.dataset.n); amountEl.value = amount; draw(); }));
        amountEl.oninput = () => { amount = Math.floor(Number(amountEl.value)); draw(); };
        reasonEl.oninput = draw;
        reasonEl.onkeydown = (e) => { if (e.key === 'Enter' && !submit.disabled) submit.click(); };
        $('#pay-cancel', el).onclick = close;
        submit.onclick = async () => {
          submit.disabled = true;
          try {
            const r = await api('/teacher/pay', { method: 'POST', body: { studentIds: targets.map((s) => s.id), type: kind, amount, reason: reasonEl.value.trim(), missionId } });
            close();
            const paid = r.results.length;
            if (paid) toast(`${paid}명에게 ${fmt(amount)} ${st.settings.currencyName} ${kind === 'give' ? '지급' : '차감'} 완료`);
            if (r.skipped?.length) toast(`${r.skipped.length}명은 오늘 이미 이 미션을 받아서 건너뛰었어요: ${r.skipped.join(', ')}`, paid ? 'success' : 'error');
            r.results.filter((x) => x.levelUp).forEach((x, i) => setTimeout(() => toast(`🎉 ${x.name} 레벨 ${x.level} 달성!`), 400 + i * 300));
            flashIds = r.results.map((x) => x.id);
            if (targets.length > 1) selected.clear();
            await refresh();
          } catch (e) {
            toast(e.message, 'error');
            submit.disabled = false;
          }
        };
        draw();
        setTimeout(() => reasonEl.focus(), 50);
      },
    });
  }

  // ======================= 거래 내역 =======================
  const filt = { student: '', type: '', date: '' };
  function historyView() {
    const list = txs.filter((t) =>
      (!filt.student || t.studentId === filt.student) &&
      (!filt.type || t.type === filt.type) &&
      (!filt.date || t.createdAt.startsWith(filt.date)));
    const sum = (k) => list.filter((t) => t.type === k).reduce((a, t) => a + t.amount, 0);
    const luckNet = list.filter((t) => t.type === 'luck').reduce((a, t) => a + (t.win ? t.amount : -t.amount), 0);
    const shown = list.slice(0, 500);
    return `
      <div class="page-head">
        <div><h1 class="page-title">📒 거래 내역</h1><p class="page-sub">지급·차감·구매·세금·캐릭터 성장·영토 확장 등 화폐를 쓴 기록이에요</p></div>
      </div>
      <div class="filter-row">
        <select class="select" id="f-student" aria-label="학생 선택">
          <option value="">전체 학생</option>
          ${st.students.map((s) => `<option value="${esc(s.id)}" ${filt.student === s.id ? 'selected' : ''}>${s.number}. ${esc(s.name)}</option>`).join('')}
        </select>
        <select class="select" id="f-type" aria-label="종류 선택">
          <option value="">전체 종류</option>
          ${Object.entries(TX_TYPE).map(([k, v]) => `<option value="${k}" ${filt.type === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <input class="input" type="date" id="f-date" value="${filt.date}" aria-label="날짜 선택">
        <button class="btn btn-sm" id="f-today">오늘</button>
        <button class="btn btn-ghost btn-sm" id="f-reset">초기화</button>
        <span class="spacer"></span>
        <span class="row muted" style="font-weight:700">${list.length}건 ·
          <span class="plus">지급 +${fmt(sum('give'))}</span> ·
          <span class="minus">차감 −${fmt(sum('take'))}</span> ·
          <span class="gold">구매 ${fmt(sum('buy'))}</span>
          ${sum('luck') ? ` · <span class="${luckNet < 0 ? 'minus' : 'plus'}">행운의 게임 ${luckNet < 0 ? '−' : '+'}${fmt(Math.abs(luckNet))}</span>` : ''}
          ${sum('class') ? ` · <span class="sky">자율 체육 ${fmt(sum('class'))}</span>` : ''}
          ${sum('tax') ? ` · <span class="minus">세금 ${fmt(sum('tax'))}</span>` : ''}
          ${sum('upgrade') ? ` · <span class="gold">캐릭터 성장 ${fmt(sum('upgrade'))}</span>` : ''}
          ${sum('territory') ? ` · <span class="sky">영토 확장 ${fmt(sum('territory'))}</span>` : ''}</span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>날짜·시간</th><th>학생</th><th>종류</th><th>사유</th><th style="text-align:right">금액</th><th style="text-align:right">거래 후 잔액</th></tr></thead>
          <tbody>
            ${shown.map((t) => `
              <tr>
                <td class="muted" style="white-space:nowrap">${fmtDate(t.createdAt)}</td>
                <td style="font-weight:700;white-space:nowrap">${esc(t.studentName)}</td>
                <td><span class="badge ${t.type}">${esc(txTypeLabel(t))}</span></td>
                <td>${esc(t.reason)}</td>
                <td style="text-align:right" class="bal-cell ${isPlus(t) ? 'plus' : 'minus'}">${isPlus(t) ? '+' : '−'}${fmt(t.amount)}</td>
                <td style="text-align:right" class="muted">${fmt(t.balanceAfter)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${list.length ? '' : '<div class="empty"><span class="emo">📭</span>기록이 없어요.</div>'}
        ${list.length > 500 ? '<p class="hint" style="padding:12px">최근 500건만 보여요. 학생이나 날짜로 좁혀 보세요.</p>' : ''}
      </div>`;
  }
  function bindHistory() {
    $('#f-student').onchange = (e) => { filt.student = e.target.value; paint(); };
    $('#f-type').onchange = (e) => { filt.type = e.target.value; paint(); };
    $('#f-date').onchange = (e) => { filt.date = e.target.value; paint(); };
    $('#f-today').onclick = () => { filt.date = todayKey(); paint(); };
    $('#f-reset').onclick = () => { filt.student = filt.type = filt.date = ''; paint(); };
  }

  // ======================= 상점 관리 =======================
  function shopView() {
    const buys = txs.filter((t) => t.type === 'buy').slice(0, 100);
    return `
      <div class="page-head">
        <div><h1 class="page-title">🏪 상점 관리</h1><p class="page-sub">상품을 등록하고 학생들의 구매 기록을 확인해요</p></div>
        <button class="btn btn-primary" id="item-add">＋ 상품 추가</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th></th><th>상품</th><th>종류</th><th>가격</th><th>설명</th><th>상태</th><th style="text-align:right">관리</th></tr></thead>
          <tbody>
            ${st.items.map((it) => `
              <tr data-id="${esc(it.id)}" style="${it.active ? '' : 'opacity:.55'}">
                <td style="font-size:28px;width:50px">${esc(it.emoji)}</td>
                <td style="font-weight:700">${esc(it.name)}</td>
                <td><span class="badge ${it.type}">${it.type === 'coupon' ? '🎟️ 쿠폰' : '📦 물건'}</span></td>
                <td class="bal-cell gold">${fmt(it.price)}</td>
                <td class="muted" style="font-size:14px;max-width:280px">${esc(it.description || '')}</td>
                <td><button class="btn btn-sm item-toggle" id="toggle-${esc(it.id)}">${it.active ? '🟢 판매 중' : '⏸️ 판매 중지'}</button></td>
                <td><div class="act-cell">
                  <button class="btn btn-sm item-edit" id="edit-${esc(it.id)}">수정</button>
                  <button class="btn btn-take btn-sm item-del" id="del-${esc(it.id)}">삭제</button>
                </div></td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${st.items.length ? '' : '<div class="empty"><span class="emo">🏪</span>상품이 없어요. 상품을 추가해 주세요.</div>'}
      </div>

      <section class="card section-gap">
        <div class="card-head"><h2 class="card-title">🧾 구매 기록</h2><span class="muted" style="font-size:14px">최근 100건</span></div>
        ${buys.length ? `<div class="tx-list">${buys.map((t) => `
          <div class="tx-item">
            <span class="tx-icon buy">${esc(t.itemEmoji || '🛍️')}</span>
            <div class="tx-main">
              <div class="tx-reason">${esc(t.studentName)} · ${esc(t.itemName)} <span class="badge ${t.itemType}" style="margin-left:4px">${t.itemType === 'coupon' ? '쿠폰' : '물건'}</span></div>
              <div class="tx-meta">${fmtDate(t.createdAt)}</div>
            </div>
            <div class="tx-amount gold">${fmt(t.amount)}<small>${cur()}</small></div>
          </div>`).join('')}</div>` : '<div class="empty"><span class="emo">🧾</span>아직 구매 기록이 없어요.</div>'}
      </section>`;
  }
  function bindShop() {
    $('#item-add').onclick = () => openItem(null);
    $$('tr[data-id]').forEach((tr) => {
      const it = st.items.find((x) => x.id === tr.dataset.id);
      if (!it) return;
      $('.item-edit', tr).onclick = () => openItem(it);
      $('.item-toggle', tr).onclick = async () => {
        try {
          await api(`/teacher/items/${it.id}`, { method: 'PUT', body: { ...it, active: !it.active } });
          toast(it.active ? '판매를 멈췄어요.' : '판매를 시작했어요.');
          await refresh();
        } catch (e) { toast(e.message, 'error'); }
      };
      $('.item-del', tr).onclick = async () => {
        const ok = await confirmModal({ emoji: '🗑️', title: '상품 삭제', html: `<b>${esc(it.name)}</b>을(를) 삭제할까요?<br><span class="muted">이미 산 학생의 기록은 그대로 남아요.</span>`, okText: '삭제', okClass: 'btn-danger' });
        if (!ok) return;
        try { await api(`/teacher/items/${it.id}`, { method: 'DELETE' }); toast('삭제했어요.'); await refresh(); }
        catch (e) { toast(e.message, 'error'); }
      };
    });
  }
  function openItem(it) {
    const d = it || { emoji: '🎁', name: '', type: 'coupon', price: 30, description: '', active: true };
    let emoji = d.emoji, type = d.type;
    openModal({
      title: it ? '상품 수정' : '＋ 상품 추가',
      body: `
        <div class="field"><span class="field-label">아이콘</span>
          <div class="emoji-pick" id="emoji-pick">${ITEM_EMOJI.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>
        </div>
        <div class="form-grid">
          <div class="field full"><label for="it-name">상품 이름</label><input class="input" id="it-name" maxlength="30" value="${esc(d.name)}" placeholder="예: 자리 바꾸기 쿠폰"></div>
          <div class="field"><span class="field-label">종류</span>
            <div class="seg"><button type="button" data-t="goods" id="it-type-goods">📦 물건</button><button type="button" data-t="coupon" id="it-type-coupon">🎟️ 쿠폰</button></div>
          </div>
          <div class="field"><label for="it-price">가격 (${cur()})</label><input class="input" type="number" id="it-price" min="1" value="${d.price}"></div>
          <div class="field full"><label for="it-desc">설명</label><input class="input" id="it-desc" maxlength="100" value="${esc(d.description)}" placeholder="학생에게 보여 줄 설명"></div>
          <label class="row full" style="cursor:pointer"><input type="checkbox" class="chk" id="it-active" ${d.active ? 'checked' : ''}> 판매 중으로 보이기</label>
        </div>`,
      foot: `<button class="btn btn-ghost" id="it-cancel">취소</button><button class="btn btn-primary" id="it-save">저장</button>`,
      onMount: ({ el, close }) => {
        const draw = () => {
          $$('#emoji-pick button', el).forEach((b) => b.classList.toggle('on', b.dataset.e === emoji));
          $$('.seg button', el).forEach((b) => (b.className = b.dataset.t === type ? 'on' : ''));
        };
        if (!ITEM_EMOJI.includes(emoji)) ITEM_EMOJI.unshift(emoji);
        $$('#emoji-pick button', el).forEach((b) => (b.onclick = () => { emoji = b.dataset.e; draw(); }));
        $$('.seg button', el).forEach((b) => (b.onclick = () => { type = b.dataset.t; draw(); }));
        $('#it-cancel', el).onclick = close;
        $('#it-save', el).onclick = async () => {
          const body = { emoji, type, name: $('#it-name', el).value, price: $('#it-price', el).value, description: $('#it-desc', el).value, active: $('#it-active', el).checked };
          try {
            await api(it ? `/teacher/items/${it.id}` : '/teacher/items', { method: it ? 'PUT' : 'POST', body });
            close(); toast(it ? '수정했어요.' : '상품을 추가했어요.'); await refresh();
          } catch (e) { toast(e.message, 'error'); }
        };
        draw();
      },
    });
  }

  // ======================= 1인 1역 =======================
  function rolesView() {
    const holder = (r) => st.students.find((s) => s.roleId === r.id);
    const noRole = st.students.filter((s) => !s.roleId || !st.roles.some((r) => r.id === s.roleId));
    const assigned = st.roles.filter(holder).length;
    return `
      <div class="page-head">
        <div><h1 class="page-title">🧩 1인 1역</h1><p class="page-sub">10개 부서의 장관·차관 등 21명 역할과 할 일을 확인하고 배정해요.</p></div>
        <button class="btn btn-primary" id="role-add">＋ 역할 추가</button>
      </div>
      <section class="stats-grid" style="grid-template-columns:repeat(3,minmax(0,1fr))">
        <div class="stat s1"><div class="stat-label">🧩 전체 역할</div><div class="stat-value">${st.roles.length}<small>개</small></div></div>
        <div class="stat s3"><div class="stat-label">✅ 배정된 역할</div><div class="stat-value">${assigned}<small>개</small></div></div>
        <div class="stat s4"><div class="stat-label">🙋 역할 없는 학생</div><div class="stat-value">${noRole.length}<small>명</small></div></div>
      </section>
      ${noRole.length ? `<div class="card" style="margin-bottom:18px;padding:16px 18px">
        <div class="card-label" style="margin-bottom:10px">역할이 아직 없는 학생</div>
        <div class="unassigned-list">${noRole.map((s) => `<span class="chip">${s.number}. ${esc(s.name)}</span>`).join('')}</div>
      </div>` : ''}
      <div class="role-grid">
        ${st.roles.map((r, i) => {
          const h = holder(r);
          return `
          <article class="role-card ${h ? '' : 'unassigned'}" data-id="${esc(r.id)}" style="animation-delay:${i * 30}ms">
            <div class="role-card-head">
              <span class="role-emoji">${esc(r.emoji)}</span>
              <div style="flex:1;min-width:0"><div class="role-name" style="font-size:20px">${esc(r.name)}</div></div>
              <button class="btn btn-ghost btn-sm role-edit" id="role-edit-${esc(r.id)}" aria-label="수정">✏️</button>
              <button class="btn btn-ghost btn-sm role-del" id="role-del-${esc(r.id)}" aria-label="삭제">🗑️</button>
            </div>
            <ul>${r.tasks.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
            <select class="select role-assign" id="assign-${esc(r.id)}" aria-label="${esc(r.name)} 담당 학생">
              <option value="">— 담당 학생 없음 —</option>
              ${st.students.map((s) => {
                const other = s.roleId && s.roleId !== r.id ? st.roles.find((x) => x.id === s.roleId) : null;
                return `<option value="${esc(s.id)}" ${h && h.id === s.id ? 'selected' : ''}>${s.number}. ${esc(s.name)}${other ? ` (현재: ${esc(other.name)})` : ''}</option>`;
              }).join('')}
            </select>
          </article>`;
        }).join('')}
      </div>
      ${st.roles.length ? '' : '<div class="card empty"><span class="emo">🧩</span>역할이 없어요. 역할을 추가해 주세요.</div>'}`;
  }
  function bindRoles() {
    $('#role-add').onclick = () => openRole(null);
    $$('.role-card').forEach((card) => {
      const r = st.roles.find((x) => x.id === card.dataset.id);
      $('.role-edit', card).onclick = () => openRole(r);
      $('.role-del', card).onclick = async () => {
        const ok = await confirmModal({ emoji: '🗑️', title: '역할 삭제', html: `<b>${esc(r.name)}</b> 역할을 삭제할까요?<br><span class="muted">담당 학생은 역할 없음이 돼요.</span>`, okText: '삭제', okClass: 'btn-danger' });
        if (!ok) return;
        try { await api(`/teacher/roles/${r.id}`, { method: 'DELETE' }); toast('삭제했어요.'); await refresh(); }
        catch (e) { toast(e.message, 'error'); }
      };
      $('.role-assign', card).onchange = async (e) => {
        const sid = e.target.value || null;
        const s = st.students.find((x) => x.id === sid);
        try {
          await api('/teacher/assign', { method: 'PUT', body: { roleId: r.id, studentId: sid } });
          toast(s ? `${s.name} → ${r.name} 배정 완료` : `${r.name} 담당을 비웠어요.`);
          await refresh();
        } catch (err) { toast(err.message, 'error'); }
      };
    });
  }
  function openRole(r) {
    const d = r || { emoji: '⭐', name: '', tasks: [] };
    let emoji = d.emoji;
    openModal({
      title: r ? '역할 수정' : '＋ 역할 추가',
      body: `
        <div class="field"><span class="field-label">아이콘</span>
          <div class="emoji-pick" id="emoji-pick">${ROLE_EMOJI.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>
        </div>
        <div class="field"><label for="role-name">역할 이름</label><input class="input" id="role-name" maxlength="20" value="${esc(d.name)}" placeholder="예: 칠판 지킴이"></div>
        <div class="field"><label for="role-tasks">할 일 (한 줄에 하나씩)</label>
          <textarea class="textarea" id="role-tasks" placeholder="쉬는 시간마다 칠판 지우기&#10;분필 정리하기">${esc(d.tasks.join('\n'))}</textarea>
          <span class="hint">학생 메인 화면의 '오늘 할 일'에 그대로 보여요. (최대 10개)</span>
        </div>`,
      foot: `<button class="btn btn-ghost" id="role-cancel">취소</button><button class="btn btn-primary" id="role-save">저장</button>`,
      onMount: ({ el, close }) => {
        if (!ROLE_EMOJI.includes(emoji)) ROLE_EMOJI.unshift(emoji);
        const draw = () => $$('#emoji-pick button', el).forEach((b) => b.classList.toggle('on', b.dataset.e === emoji));
        $$('#emoji-pick button', el).forEach((b) => (b.onclick = () => { emoji = b.dataset.e; draw(); }));
        $('#role-cancel', el).onclick = close;
        $('#role-save', el).onclick = async () => {
          const body = { emoji, name: $('#role-name', el).value, tasks: $('#role-tasks', el).value };
          try {
            await api(r ? `/teacher/roles/${r.id}` : '/teacher/roles', { method: r ? 'PUT' : 'POST', body });
            close(); toast(r ? '수정했어요.' : '역할을 추가했어요.'); await refresh();
          } catch (e) { toast(e.message, 'error'); }
        };
        draw();
      },
    });
  }

  // ======================= 설정 =======================
  function settingsView() {
    return `
      <div class="page-head">
        <div><h1 class="page-title">⚙️ 설정</h1><p class="page-sub">학급 정보, 학생 명단, PIN, 백업을 관리해요</p></div>
      </div>
      <div class="grid-2">
        <section class="card">
          <div class="card-head"><h2 class="card-title">🏫 학급 설정</h2></div>
          <div class="stack">
            <div class="field"><label for="set-class">학급 이름</label><input class="input" id="set-class" maxlength="20" value="${esc(st.settings.className)}"></div>
            <div class="field"><label for="set-currency">화폐 이름</label><input class="input" id="set-currency" maxlength="10" value="${esc(st.settings.currencyName)}"></div>
            <div class="field"><label for="set-pin">새 선생님 PIN (바꿀 때만 입력)</label><input class="input" id="set-pin" maxlength="4" inputmode="numeric" placeholder="숫자 4자리" autocomplete="off"></div>
            <div class="field">
              <label for="set-pe-days">🏃 자율 체육 목표 (며칠치를 모을까요?)</label>
              <input class="input" id="set-pe-days" type="number" min="1" max="60" value="${st.settings.peGoalDays ?? 10}" inputmode="numeric">
              <span class="hint">하루치 = 학생 수 × 매일 미션 보상 합계(지금 ${fmt(st.classGoal?.perDay ?? 0)} ${cur()}) → 지금 목표 ${fmt(st.classGoal?.goal ?? 0)} ${cur()}</span>
            </div>
            <label class="row" style="cursor:pointer;font-weight:700">
              <input type="checkbox" class="chk" id="set-luck" ${st.settings.luckEnabled !== false ? 'checked' : ''}> 🍀 행운의 게임 켜기
              <span class="hint" style="font-weight:500">(하루 5번 · 10 걸기 · 수수료 10%)</span>
            </label>
            <button class="btn btn-primary" id="set-save">저장하기</button>
          </div>
        </section>
        <div class="stack">
          <section class="card">
            <div class="card-head"><h2 class="card-title">🍀 행운의 게임 현황</h2><span class="status-pill ${st.settings.luckEnabled !== false ? 'k-mine' : 'k-empty'}">${st.settings.luckEnabled !== false ? '켜짐' : '꺼짐'}</span></div>
            <div class="luck-stats">
              <div><b>${fmt(st.luck?.todayPlays ?? 0)}</b><small>오늘 한 번수</small></div>
              <div><b>${fmt(st.luck?.classPlays ?? 0)}</b><small>전체 한 번수</small></div>
              <div><b>${fmt(st.luck?.classFees ?? 0)}</b><small>사라진 수수료</small></div>
              <div><b class="${(st.luck?.classNet ?? 0) <= 0 ? 'minus' : 'plus'}">${(st.luck?.classNet ?? 0) <= 0 ? '−' : '+'}${fmt(Math.abs(st.luck?.classNet ?? 0))}</b><small>학생들 손익 합계</small></div>
            </div>
            <p class="hint" style="margin-top:10px">맞히면 2배, 틀리면 0배에 수수료 10%가 있어 오래 할수록 줄어들어요. 사라진 수수료는 학급 화폐 총량을 줄여 물가 오름(인플레이션)도 막아요.</p>
          </section>
          <section class="card">
            <div class="card-head"><h2 class="card-title">📱 학생 접속 주소</h2></div>
            <p class="muted" style="font-size:14px;margin-bottom:10px">학생 태블릿·크롬북 인터넷 주소창에 아래 주소를 입력하세요. (같은 와이파이에 연결돼 있어야 해요)</p>
            <div class="stack" style="gap:8px">${(st.addresses || []).map((a) => `<div class="server-link">${esc(a)}</div>`).join('') || '<div class="muted">주소를 찾지 못했어요. 서버 창에 표시된 주소를 확인해 주세요.</div>'}</div>
          </section>
          <section class="card">
            <div class="card-head"><h2 class="card-title">💾 백업</h2></div>
            <p class="muted" style="font-size:14px;margin-bottom:12px">모든 데이터를 파일로 저장하거나, 저장한 파일로 되돌릴 수 있어요. 일주일에 한 번 백업을 권해요.</p>
            <div class="row">
              <button class="btn btn-gold" id="backup-down">⬇️ 백업 파일 내보내기</button>
              <label class="btn" for="backup-file" style="cursor:pointer">⬆️ 백업 불러오기</label>
              <input type="file" id="backup-file" accept=".json,application/json" class="hidden">
            </div>
          </section>
        </div>
      </div>

      <section class="card section-gap">
        <div class="card-head">
          <h2 class="card-title">👩‍🎓 학생 명단 · PIN 관리</h2>
          <span class="muted" style="font-size:14px">학생이 PIN을 잊으면 여기서 확인하거나 바꿔 주세요</span>
        </div>
        <div class="table-wrap">
          <table class="table" id="roster">
            <thead><tr><th style="width:100px">번호</th><th>이름</th><th style="width:140px">PIN (4자리)</th><th>잔액 / 레벨</th><th style="text-align:right">관리</th></tr></thead>
            <tbody>
              ${st.students.map((s) => `
                <tr data-id="${esc(s.id)}">
                  <td><input class="input r-num" type="number" min="1" max="99" value="${s.number}" aria-label="번호" style="height:38px"></td>
                  <td><input class="input r-name" maxlength="12" value="${esc(s.name)}" aria-label="이름" style="height:38px"></td>
                  <td><input class="input r-pin" maxlength="4" inputmode="numeric" value="${esc(s.pin)}" aria-label="PIN" style="height:38px;letter-spacing:4px"></td>
                  <td class="muted">${fmt(s.balance)} ${cur()} · Lv.${s.level}</td>
                  <td><div class="act-cell">
                    <button class="btn btn-sm r-save" id="r-save-${esc(s.id)}">저장</button>
                    <button class="btn btn-take btn-sm r-del" id="r-del-${esc(s.id)}">삭제</button>
                  </div></td>
                </tr>`).join('')}
              <tr>
                <td><input class="input" id="new-num" type="number" min="1" max="99" value="${(Math.max(0, ...st.students.map((s) => s.number)) + 1)}" aria-label="새 학생 번호" style="height:38px"></td>
                <td><input class="input" id="new-name" maxlength="12" placeholder="새 학생 이름" aria-label="새 학생 이름" style="height:38px"></td>
                <td><input class="input" id="new-pin" maxlength="4" inputmode="numeric" value="1234" aria-label="새 학생 PIN" style="height:38px;letter-spacing:4px"></td>
                <td class="faint">처음 0 ${cur()} · Lv.1</td>
                <td><div class="act-cell"><button class="btn btn-primary btn-sm" id="new-add">＋ 학생 추가</button></div></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>`;
  }
  function bindSettings() {
    $('#set-save').onclick = async () => {
      const body = {
        className: $('#set-class').value, currencyName: $('#set-currency').value, teacherPin: $('#set-pin').value.trim(),
        peGoalDays: $('#set-pe-days').value, luckEnabled: $('#set-luck').checked,
      };
      try { await api('/teacher/settings', { method: 'PUT', body }); toast('설정을 저장했어요.'); await refresh(); }
      catch (e) { toast(e.message, 'error'); }
    };
    $$('#roster tr[data-id]').forEach((tr) => {
      const s = st.students.find((x) => x.id === tr.dataset.id);
      $('.r-save', tr).onclick = async () => {
        const body = { number: $('.r-num', tr).value, name: $('.r-name', tr).value, pin: $('.r-pin', tr).value };
        try { await api(`/teacher/students/${s.id}`, { method: 'PUT', body }); toast(`${body.name} 정보를 저장했어요.`); await refresh(); }
        catch (e) { toast(e.message, 'error'); }
      };
      $('.r-del', tr).onclick = async () => {
        const ok = await confirmModal({ emoji: '⚠️', title: '학생 삭제', html: `<b>${esc(s.name)}</b> 학생을 삭제할까요?<br><span class="muted">잔액·레벨이 사라져요. (거래 기록은 남아요)</span>`, okText: '삭제', okClass: 'btn-danger' });
        if (!ok) return;
        try { await api(`/teacher/students/${s.id}`, { method: 'DELETE' }); toast('삭제했어요.'); await refresh(); }
        catch (e) { toast(e.message, 'error'); }
      };
    });
    $('#new-add').onclick = async () => {
      const body = { number: $('#new-num').value, name: $('#new-name').value, pin: $('#new-pin').value };
      try { await api('/teacher/students', { method: 'POST', body }); toast(`${body.name} 학생을 추가했어요.`); await refresh(); }
      catch (e) { toast(e.message, 'error'); }
    };
    $('#backup-down').onclick = async () => {
      try {
        const data = await api('/teacher/backup');
        const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `서초롱_민주시민_경제교육_백업_${todayKey()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast('백업 파일을 저장했어요.');
      } catch (e) { toast(e.message, 'error'); }
    };
    $('#backup-file').onchange = async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { return toast('파일을 읽을 수 없어요.', 'error'); }
      const ok = await confirmModal({ emoji: '♻️', title: '백업 불러오기', html: `<b>${esc(file.name)}</b> 파일로 되돌릴까요?<br><span class="minus">지금 데이터는 모두 바뀌어요.</span>`, okText: '불러오기', okClass: 'btn-danger' });
      if (!ok) return;
      try { await api('/teacher/restore', { method: 'POST', body: { db: data } }); toast('백업을 불러왔어요.'); await refresh(); }
      catch (err) { toast(err.message, 'error'); }
    };
  }

  // ======================= 세계지도 현황 =======================
  const worldCities = () => (worldData && worldData.cities) || [];
  const worldSelected = () => worldCities().find((c) => c.id === worldSelectedId) || null;

  function worldStatsHTML() {
    const cities = worldCities();
    const claimed = cities.filter((c) => (c.residents || []).length).length;
    const tiles = cities.reduce((acc, c) => acc + (c.totalTiles || 0), 0);
    return `
      <div class="stat-pill"><small>학생이 사는 도시</small><b>${claimed} / ${cities.length}곳</b></div>
      <div class="stat-pill"><small>우리 반 총 영토</small><b>${fmt(tiles)}칸</b></div>
      <div class="stat-pill"><small>학생 수</small><b>${st.students.length}명</b></div>`;
  }

  function worldView() {
    return `
      <div class="world-page">
        <div class="world-head">
          <div>
            <h1 class="page-title">🌍 우리 반 세계지도</h1>
            <p class="page-sub">전자칠판에 띄워 학생들의 수호동물이 사는 도시를 함께 보고, 도시를 눌러 바로 보상을 줄 수 있어요.</p>
          </div>
          <div class="world-head-stats" id="tw-stats">${worldStatsHTML()}</div>
        </div>
        <div class="world-layout">
          <div class="world-map-card"><div id="teacher-map"></div></div>
          <aside class="world-side" id="world-side" aria-label="도시 정보">${worldSideHTML()}</aside>
        </div>
        <section class="teacher-cities-section">
          <div class="section-head-compact">
            <h3>🏙️ 도시별 학생 분포</h3>
            <span class="muted" style="font-size:13.5px">📍를 누르면 지도가 그 도시로 이동해요</span>
          </div>
          <div class="teacher-cities-grid" id="tw-grid">${worldGridHTML()}</div>
        </section>
      </div>`;
  }

  function worldSideHTML() {
    const sel = worldSelected();
    const shown = worldCities().filter((c) => inContinent(c, continentFilter));
    return `
      ${sel ? worldCityCardHTML(sel) : `
        <section class="ws-card">
          <div class="ws-label">🧭 이렇게 써 보세요</div>
          <p class="muted" style="font-size:14px;line-height:1.7">지도나 아래 목록에서 도시를 고르면 그 도시에 사는 학생과 수호동물이 여기에 나와요. 🎁 버튼으로 바로 보상을 줄 수 있어요.</p>
        </section>`}
      <section class="ws-card ws-list" aria-label="도시 목록">
        <div class="ws-list-head"><h3>🏙️ 도시 목록</h3><span>${shown.length}곳</span></div>
        <div class="ws-filters" role="group" aria-label="대륙 고르기">
          ${CONTINENT_FILTERS.map(([k, label]) => `<button type="button" class="ws-chip" data-cont="${k}" aria-pressed="${continentFilter === k}">${label}</button>`).join('')}
        </div>
        <ul class="ws-cities">
          ${shown.map((c) => {
            const kind = cityKind(c, null);
            const n = (c.residents || []).length;
            return `
              <li><button type="button" class="ws-row" data-city="${esc(c.id)}" aria-current="${worldSelectedId === c.id}">
                <span class="ws-row-emoji" aria-hidden="true">${c.emoji || '🏛️'}</span>
                <span class="ws-row-main"><b>${esc(c.name)}</b><small>${esc(c.country)} · ${esc(c.landmark)}</small></span>
                <span class="ws-row-side">${n ? `👩‍🎓 ${n}` : ''}<i class="ws-row-dot k-${kind}" title="${T_KIND_LABEL[kind]}"></i></span>
              </button></li>`;
          }).join('')}
        </ul>
      </section>`;
  }

  function worldCityCardHTML(c) {
    const res = c.residents || [];
    const kind = cityKind(c, null);
    const color = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#6366f1';
    return `
      <section class="ws-card ws-city" aria-label="${esc(c.name)} 정보" style="--city-soft:${color}55;--city-line:${color}99">
        <div class="ws-city-head">
          <span class="ws-city-emoji" aria-hidden="true">${c.emoji || '🏛️'}</span>
          <div class="ws-city-title"><h2>${esc(c.name)}</h2><small>${esc(c.country)} · ${CONTINENT_NAMES[c.continent] || ''}</small></div>
          <span class="status-pill k-${kind}">${res.length ? `${res.length}명` : '미개척'}</span>
        </div>
        <p class="ws-tagline">“${esc(c.tagline)}”</p>
        <div class="ws-landmark"><span aria-hidden="true">🏛️</span><div><b>${esc(c.landmark)}</b><p>${esc(c.landmarkDesc)}</p></div></div>
        <div class="ws-coord">📍 ${coordText(c)}</div>
        ${res.length ? `
          <ul class="ws-people">
            ${res.map((r) => `
              <li class="ws-person">
                <span class="ws-person-emoji" aria-hidden="true">${r.animal?.emoji || '🐾'}</span>
                <span class="ws-person-main"><b>${esc(r.name)}</b><small>Lv.${Number(r.level) || 1} · ${esc(r.animal?.name || '')} · ${r.isHome ? '시작 도시' : '개척한 도시'}</small></span>
                <button type="button" class="btn btn-give btn-sm" data-give="${esc(r.id)}">🎁 보상</button>
              </li>`).join('')}
          </ul>` : '<p class="muted" style="margin-top:12px;font-size:13.5px">아직 이 도시에 사는 학생이 없어요.</p>'}
        <div class="ws-actions"><button type="button" class="btn btn-primary btn-sm" data-act="detail">🔍 랜드마크 크게 보기</button></div>
      </section>`;
  }

  function worldGridHTML() {
    const shown = worldCities().filter((c) => inContinent(c, continentFilter));
    if (!shown.length) return '<div class="empty card"><span class="emo">🗺️</span>이 대륙에는 도시가 없어요.</div>';
    return shown.map((c) => {
      const res = c.residents || [];
      return `
        <article class="card teacher-city-card ${res.length ? 'occupied' : 'vacant'}">
          <div class="t-city-head">
            <span class="t-city-icon" aria-hidden="true">${c.emoji || '🏛️'}</span>
            <div>
              <h4 class="t-city-name">${esc(c.name)} <small class="muted">${esc(c.country)}</small></h4>
              <div class="t-city-landmark gold">${esc(c.landmark)}</div>
            </div>
            <span class="status-pill k-${cityKind(c, null)}">${res.length ? `${res.length}명` : '미개척'}</span>
            <button type="button" class="btn btn-ghost btn-sm t-city-locate" data-locate="${esc(c.id)}" title="지도에서 보기" aria-label="${esc(c.name)} 지도에서 보기">📍</button>
          </div>
          ${res.length ? `
            <ul class="t-resident-list">
              ${res.map((r) => `
                <li class="t-res-row">
                  <span class="t-res-animal" aria-hidden="true">${r.animal?.emoji || '🐾'}</span>
                  <span class="t-res-info"><b>${esc(r.name)}</b> <small class="gold">Lv.${Number(r.level) || 1} ${esc(r.animal?.name || '')}</small></span>
                  <button type="button" class="btn btn-give btn-sm" data-give="${esc(r.id)}">🎁 보상</button>
                </li>`).join('')}
            </ul>` : '<p class="muted" style="font-size:13px;margin-top:10px">아직 사는 학생이 없어요.</p>'}
        </article>`;
    }).join('');
  }

  function renderWorldSide() {
    const side = $('#world-side');
    if (!side) return;
    const active = document.activeElement;
    const focusKey = active && side.contains(active)
      ? (active.dataset.city ? `[data-city="${active.dataset.city}"]` : active.dataset.cont ? `[data-cont="${active.dataset.cont}"]` : null)
      : null;
    const top = side.scrollTop;
    side.innerHTML = worldSideHTML();
    side.scrollTop = top;
    if (focusKey) side.querySelector(focusKey)?.focus();
  }

  function refreshWorldInPlace() {
    teacherMap?.setCities(worldCities());
    const stats = $('#tw-stats');
    if (stats) stats.innerHTML = worldStatsHTML();
    renderWorldSide();
    const grid = $('#tw-grid');
    if (grid) grid.innerHTML = worldGridHTML();
  }

  function bindWorld() {
    const el = $('#teacher-map');
    if (!el) return;
    if (worldSelectedId && !worldSelected()) worldSelectedId = null;
    teacherMap = createWorldMap(el, {
      cities: worldCities(),
      currentStudentId: null,
      mode: 'flat', // 전자칠판에서 21개 도시를 한눈에 보도록 평면 지도로 시작
      modeKey: 'cw_map_mode_teacher',
      onSelectCity: (c) => {
        worldSelectedId = c.id;
        renderWorldSide();
      },
    });
    if (worldSelectedId) teacherMap.select(worldSelectedId);

    $('.world-page').addEventListener('click', (e) => {
      const give = e.target.closest('[data-give]');
      if (give) {
        openPay([give.dataset.give], 'give');
        return;
      }
      const chip = e.target.closest('[data-cont]');
      if (chip) {
        continentFilter = chip.dataset.cont;
        renderWorldSide();
        $('#tw-grid').innerHTML = worldGridHTML();
        return;
      }
      const pick = e.target.closest('[data-city], [data-locate]');
      if (pick) {
        worldSelectedId = pick.dataset.city || pick.dataset.locate;
        teacherMap?.select(worldSelectedId);
        renderWorldSide();
        if (pick.dataset.locate) $('.world-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (e.target.closest('[data-act="detail"]')) {
        const c = worldSelected();
        if (c) openCityModal(c, { isTeacher: true, currencyName: st.settings.currencyName, onGive: (id) => openPay([id], 'give') });
      }
    });
  }

  // ======================= 교사 관리자 · 선생님 과제 =======================
  function assignmentTargetLabel(a) {
    if (!a.studentIds?.length) return '우리 반 전체';
    return a.studentIds.map((id) => {
      const s = st.students.find((student) => student.id === id);
      return s ? `${s.number}. ${s.name}` : '삭제된 학생';
    }).join(', ');
  }

  function assignmentCard(a) {
    const instructionPreview = (a.instructions || '').slice(0, 220);
    return `
      <article class="card assignment-card ${a.active === false ? 'off' : ''}" data-assignment="${esc(a.id)}">
        <div class="card-head"><h3 class="card-title">📝 ${esc(a.title)}</h3><span class="status-pill ${a.active === false ? 'k-empty' : 'k-mine'}">${a.active === false ? '마감' : '진행 중'}</span></div>
        <p class="assignment-answer">${esc(instructionPreview)}${(a.instructions || '').length > 220 ? '…' : ''}</p>
        <p class="hint">${esc(assignmentTargetLabel(a))} · 보상 <b class="gold">${fmt(a.reward)} ${cur()}</b><br>${fmtDate(a.createdAt)}</p>
        ${a.pdfName ? `<p class="hint">📄 ${esc(a.pdfName)}</p>` : ''}
        <div class="economy-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-assignment-detail="${esc(a.id)}">과제 자세히</button>
          ${a.pdfName ? `<button type="button" class="btn btn-primary btn-sm" data-assignment-pdf="${esc(a.id)}">📄 학습지 열기</button>` : ''}
          ${a.active !== false ? `<button type="button" class="btn btn-take btn-sm" data-assignment-archive="${esc(a.id)}">과제 마감</button>` : ''}
        </div>
      </article>`;
  }

  function assignmentsView() {
    const active = assignments.filter((a) => a.active !== false);
    const archived = assignments.filter((a) => a.active === false);
    const d = assignmentDraft;
    return `
      <div class="page-head">
        <div><h1 class="page-title">🧑‍🏫 교사 관리자</h1><p class="page-sub">학습지와 과제를 올리면 학생의 미션에 '선생님 과제'로 바로 나타나요. 학생이 풀이를 적고 인증하면 보상을 승인할 수 있어요.</p></div>
        <a class="btn btn-primary" href="#/teacher/missions">제출 답안 확인${st.pendingCount ? ` (${st.pendingCount})` : ''}</a>
      </div>
      <section class="card" aria-label="선생님 과제 만들기">
        <div class="card-head"><h2 class="card-title">＋ 선생님 과제 만들기</h2><span class="muted">게시 즉시 학생에게 배부</span></div>
        <form id="assignment-form">
          <div class="form-grid">
            <div class="field"><label for="assignment-title">과제 제목</label><input class="input" id="assignment-title" maxlength="100" required value="${esc(d.title)}" placeholder="예: 오늘의 수학 학습지"></div>
            <div class="field"><label for="assignment-reward">완료 보상 (${cur()})</label><input class="input" type="number" id="assignment-reward" min="1" max="1000" required value="${esc(d.reward)}"></div>
            <div class="field full"><label for="assignment-instructions">과제 내용 · 풀이 안내</label><textarea class="textarea" id="assignment-instructions" maxlength="3000" rows="6" placeholder="문제를 직접 적거나, PDF 학습지에서 풀 문제와 답안을 적는 방법을 안내해 주세요.">${esc(d.instructions)}</textarea></div>
            <div class="field full"><label for="assignment-pdf">PDF 학습지 업로드</label><input class="input" id="assignment-pdf" type="file" accept="application/pdf,.pdf" ${readingPdf ? 'disabled' : ''}><p class="hint">PDF 파일은 5MB까지 올릴 수 있어요. 학생은 과제 화면에서 바로 열어 문제를 보고 답안을 제출해요.</p><div id="assignment-file-status">${assignmentFileHTML()}</div></div>
            <div class="field full"><label for="assignment-target">과제를 받을 학생</label><select class="select" id="assignment-target"><option value="all" ${d.target === 'all' ? 'selected' : ''}>우리 반 전체</option><option value="selected" ${d.target === 'selected' ? 'selected' : ''}>선택한 학생</option></select></div>
            <div class="field full ${d.target === 'all' ? 'hidden' : ''}" id="assignment-students"><div class="chips">${st.students.map((s) => `<label class="chip"><input type="checkbox" class="chk" data-assignment-student="${esc(s.id)}" ${d.studentIds.includes(s.id) ? 'checked' : ''}> ${s.number}. ${esc(s.name)}</label>`).join('')}</div>${st.students.length ? '' : '<p class="hint">설정에서 학생을 먼저 추가해 주세요.</p>'}</div>
          </div>
          <div class="economy-actions"><button class="btn btn-primary" type="submit" id="assignment-publish" ${publishingAssignment || readingPdf ? 'disabled' : ''}>${publishingAssignment ? '게시 중…' : readingPdf ? 'PDF 읽는 중…' : '📝 과제 게시하기'}</button></div>
        </form>
      </section>
      <section class="section-gap" aria-label="진행 중인 선생님 과제">
        <div class="page-head"><h2 class="card-title">📋 진행 중인 과제 (${active.length})</h2></div>
        ${active.length ? `<div class="assignment-grid">${active.map(assignmentCard).join('')}</div>` : '<div class="empty card"><span class="emo">📝</span>아직 과제가 없어요. 내용을 입력하거나 PDF 학습지를 올려 주세요.</div>'}
      </section>
      ${archived.length ? `<details class="section-gap"><summary>마감한 과제 (${archived.length})</summary><div class="assignment-grid section-gap">${archived.map(assignmentCard).join('')}</div></details>` : ''}`;
  }

  function assignmentFileHTML() {
    if (readingPdf) return '<p class="hint">PDF 파일을 읽고 있어요…</p>';
    if (!assignmentDraft.pdfName) return '<p class="hint">첨부한 PDF가 없어요.</p>';
    return `<p class="hint">📄 ${esc(assignmentDraft.pdfName)} <button type="button" class="btn btn-ghost btn-sm" id="assignment-pdf-remove">첨부 제거</button></p>`;
  }

  function syncAssignmentFile() {
    const box = $('#assignment-file-status');
    if (!box) return;
    box.innerHTML = assignmentFileHTML();
    $('#assignment-pdf-remove')?.addEventListener('click', () => {
      assignmentDraft.pdfName = assignmentDraft.pdfData = '';
      $('#assignment-pdf').value = '';
      syncAssignmentFile();
    });
    const publish = $('#assignment-publish');
    publish.disabled = publishingAssignment || readingPdf;
    publish.textContent = publishingAssignment ? '게시 중…' : readingPdf ? 'PDF 읽는 중…' : '📝 과제 게시하기';
  }

  function openAssignmentDetails(a) {
    openModal({
      title: `📝 ${esc(a.title)}`,
      body: `<p class="hint">${esc(assignmentTargetLabel(a))} · 보상 ${fmt(a.reward)} ${cur()}</p><div class="assignment-answer">${esc(a.instructions || '첨부한 PDF 학습지를 풀어 주세요.')}</div>${a.pdfName ? `<p class="hint">📄 ${esc(a.pdfName)}</p>` : ''}`,
      foot: `${a.pdfName ? '<button class="btn btn-primary" id="assignment-detail-pdf">📄 학습지 열기</button>' : ''}<button class="btn btn-ghost" id="assignment-detail-close">닫기</button>`,
      onMount: ({ el, close }) => {
        $('#assignment-detail-close', el).onclick = close;
        $('#assignment-detail-pdf', el)?.addEventListener('click', () => { close(); openAssignmentPdf(a, { role: 'teacher' }); });
      },
    });
  }

  function bindAssignments() {
    const d = assignmentDraft;
    $('#assignment-title').oninput = (e) => { d.title = e.target.value; };
    $('#assignment-instructions').oninput = (e) => { d.instructions = e.target.value; };
    $('#assignment-reward').oninput = (e) => { d.reward = e.target.value; };
    $('#assignment-target').onchange = (e) => { d.target = e.target.value; $('#assignment-students').classList.toggle('hidden', d.target === 'all'); };
    $$('[data-assignment-student]').forEach((checkbox) => { checkbox.onchange = () => { d.studentIds = $$('[data-assignment-student]:checked').map((input) => input.dataset.assignmentStudent); }; });
    $('#assignment-pdf').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      readingPdf = true;
      e.target.disabled = true;
      syncAssignmentFile();
      try {
        const pdf = await readPdfFile(file);
        d.pdfName = pdf.pdfName;
        d.pdfData = pdf.pdfData;
      } catch (error) { toast(error.message, 'error'); e.target.value = ''; }
      finally { readingPdf = false; e.target.disabled = false; syncAssignmentFile(); }
    };
    $('#assignment-form').onsubmit = async (e) => {
      e.preventDefault();
      if (publishingAssignment || readingPdf) return;
      if (!d.title.trim()) return toast('과제 제목을 적어 주세요.', 'error');
      if (!d.instructions.trim() && !d.pdfData) return toast('과제 내용이나 PDF 학습지를 넣어 주세요.', 'error');
      if (!Number.isInteger(Number(d.reward)) || Number(d.reward) < 1 || Number(d.reward) > 1000) return toast('완료 보상은 1부터 1000까지 정수로 적어 주세요.', 'error');
      const studentIds = d.studentIds.filter((id) => st.students.some((s) => s.id === id));
      if (d.target === 'selected' && !studentIds.length) return toast('과제를 받을 학생을 골라 주세요.', 'error');
      publishingAssignment = true;
      syncAssignmentFile();
      try {
        await api('/teacher/assignments', { method: 'POST', body: { title: d.title.trim(), instructions: d.instructions.trim(), reward: Number(d.reward), studentIds: d.target === 'all' ? [] : studentIds, pdfName: d.pdfName, pdfData: d.pdfData } });
        Object.assign(d, { title: '', instructions: '', reward: 10, target: 'all', studentIds: [], pdfName: '', pdfData: '' });
        toast('과제를 게시했어요. 학생들이 바로 풀고 인증할 수 있어요 📝');
        await refresh();
      } catch (error) { toast(error.message, 'error'); }
      finally { publishingAssignment = false; syncAssignmentFile(); }
    };
    $$('[data-assignment-detail]').forEach((button) => { button.onclick = () => openAssignmentDetails(assignments.find((a) => a.id === button.dataset.assignmentDetail)); });
    $$('[data-assignment-pdf]').forEach((button) => { button.onclick = () => openAssignmentPdf(assignments.find((a) => a.id === button.dataset.assignmentPdf), { role: 'teacher' }); });
    $$('[data-assignment-archive]').forEach((button) => { button.onclick = async () => {
      const a = assignments.find((assignment) => assignment.id === button.dataset.assignmentArchive);
      const ok = await confirmModal({ emoji: '📝', title: '과제 마감', html: `<b>${esc(a.title)}</b> 과제를 마감할까요?<br><span class="muted">학생의 새 제출을 멈추고, 이미 받은 답안과 보상 기록은 남겨요.</span>`, okText: '마감하기', okClass: 'btn-primary' });
      if (!ok) return;
      try { await api(`/teacher/assignments/${encodeURIComponent(a.id)}`, { method: 'DELETE' }); toast('과제를 마감했어요.'); await refresh(); }
      catch (error) { toast(error.message, 'error'); }
    }; });
    syncAssignmentFile();
  }

  // ======================= 그리기 =======================
  // ======================= 미션 =======================
  const studentNo = (id) => st.students.find((s) => s.id === id)?.number ?? 0;

  function missionsView() {
    const pend = ms.pending || [];
    const list = ms.missions || [];
    return `
      <div class="page-head">
        <div><h1 class="page-title">🎯 미션</h1><p class="page-sub">학생이 신청한 미션을 확인하고 보상을 줘요. 여러 학생에게 한 번에 줄 때는 학생 화면의 '선택 학생 지급'에서 미션 버튼을 누르세요.</p></div>
        <button class="btn btn-primary" id="mission-add">＋ 미션 추가</button>
      </div>
      <a class="banner-info" href="#/teacher/assignments">🧑‍🏫 선생님 과제와 PDF 학습지는 교사 관리자에서 만들 수 있어요 <span>과제 게시하기 →</span></a>
      <section class="stats-grid" aria-label="미션 요약">
        <div class="stat s1"><div class="stat-label">⏳ 확인 기다림</div><div class="stat-value">${pend.length}<small>건</small></div></div>
        <div class="stat s3"><div class="stat-label">✅ 오늘 승인</div><div class="stat-value">${fmt(ms.today?.approved ?? 0)}<small>건</small></div></div>
        <div class="stat s2"><div class="stat-label">🎁 오늘 미션 보상</div><div class="stat-value">${fmt(ms.today?.coins ?? 0)}<small>${cur()}</small></div></div>
        <div class="stat s4"><div class="stat-label">🎯 미션</div><div class="stat-value">${list.filter((m) => m.active !== false).length}<small>개 진행 중</small></div></div>
      </section>

      <section class="card" aria-label="확인 기다리는 미션">
        <div class="card-head">
          <h2 class="card-title">⏳ 확인 기다리는 미션</h2>
          ${pend.length ? `<button class="btn btn-give btn-sm" id="approve-all">✅ 모두 승인 (${pend.length})</button>` : ''}
        </div>
        ${pend.length ? `<div class="review-list">${pend.map((x) => `
          <div class="review-row" data-id="${esc(x.id)}">
            ${avatar(x.studentName, studentNo(x.studentId))}
            <div class="review-main">
              <div><b>${esc(x.studentName)}</b> <span class="review-mission">${esc(x.missionEmoji)} ${esc(x.missionName)}</span></div>
              <small>${x.assignmentId ? '선생님 과제 답안 제출 · ' : x.note ? `“${esc(x.note.slice(0, 120))}${x.note.length > 120 ? '…' : ''}” · ` : ''}${fmtDate(x.createdAt)}</small>
            </div>
            <span class="review-reward">+${fmt(x.reward)}</span>
            ${x.assignmentId ? `<button class="btn btn-primary btn-sm" data-answer="${esc(x.id)}">답안 보기</button>` : ''}
            <button class="btn btn-give btn-sm" data-approve="${esc(x.id)}">승인</button>
            <button class="btn btn-take btn-sm" data-reject="${esc(x.id)}">반려</button>
          </div>`).join('')}</div>` : '<div class="empty"><span class="emo">🎉</span>확인할 미션이 없어요.</div>'}
      </section>

      <section class="card section-gap" aria-label="미션 목록">
        <div class="card-head"><h2 class="card-title">📋 미션 목록</h2><span class="muted" style="font-size:14px">📅 매일 미션의 보상 합계가 자율 체육 '하루치'가 돼요</span></div>
        <div class="mission-admin-grid">
          ${list.map((m) => `
            <article class="mission-admin ${m.active === false ? 'off' : ''}" data-id="${esc(m.id)}">
              <span class="mission-emoji" aria-hidden="true">${esc(m.emoji)}</span>
              <div class="mission-admin-main">
                <div class="mission-admin-name"><b>${esc(m.name)}</b> <span class="gold">+${fmt(m.reward)}</span></div>
                <small>${esc(m.desc || '')}</small>
                <div class="mission-tags">
                  ${m.daily ? '<span class="tag">📅 매일</span>' : ''}
                  ${m.prompt ? `<span class="tag">✏️ ${esc(m.prompt)}</span>` : ''}
                  ${m.kind === 'role' ? '<span class="tag">🧩 역할이 있는 학생만</span>' : ''}
                  ${m.active === false ? '<span class="tag warn">⏸️ 쉬는 중</span>' : ''}
                </div>
              </div>
              <div class="mission-admin-act">
                ${m.id === 'm_teacher' ? '<a class="btn btn-primary btn-sm" href="#/teacher/assignments">과제 관리</a>' : `<button class="btn btn-ghost btn-sm" data-edit="${esc(m.id)}" aria-label="${esc(m.name)} 수정">✏️</button><button class="btn btn-ghost btn-sm" data-del="${esc(m.id)}" aria-label="${esc(m.name)} 삭제">🗑️</button>`}
              </div>
            </article>`).join('')}
        </div>
        ${list.length ? '' : '<div class="empty"><span class="emo">🎯</span>미션이 없어요. 미션을 추가해 주세요.</div>'}
      </section>

      <section class="card section-gap" aria-label="최근 처리한 미션">
        <div class="card-head"><h2 class="card-title">🕒 최근 처리한 미션</h2><span class="muted" style="font-size:14px">최근 30건</span></div>
        ${(ms.recent || []).length ? `<div class="tx-list">${ms.recent.map((x) => `
          <div class="tx-item">
            <span class="tx-icon ${x.status === 'approved' ? 'give' : 'take'}">${esc(x.missionEmoji)}</span>
            <div class="tx-main">
              <div class="tx-reason">${esc(x.studentName)} · ${esc(x.missionName)}${!x.assignmentId && x.note ? ` <span class="muted">· ${esc(x.note.slice(0, 120))}${x.note.length > 120 ? '…' : ''}</span>` : ''}</div>
              <div class="tx-meta">${fmtDate(x.reviewedAt || x.createdAt)} · ${x.status === 'approved' ? '✅ 승인' : '↩️ 반려'}</div>
            </div>
            ${x.assignmentId ? `<button class="btn btn-ghost btn-sm" data-answer="${esc(x.id)}">답안 보기</button>` : ''}
            <div class="tx-amount ${x.status === 'approved' ? 'plus' : 'faint'}">${x.status === 'approved' ? '+' : ''}${fmt(x.reward)}</div>
          </div>`).join('')}</div>` : '<div class="empty"><span class="emo">🧾</span>아직 처리한 미션이 없어요.</div>'}
      </section>`;
  }

  function bindMissions() {
    const review = async (ids, action) => {
      try {
        const r = await api('/teacher/missions/review', { method: 'POST', body: { ids, action } });
        toast(action === 'approve' ? `${r.results.length}건 승인했어요. 보상을 줬어요 🎁` : '반려했어요. 학생이 다시 신청할 수 있어요.');
        r.results.filter((x) => x.levelUp).forEach((x, i) => setTimeout(() => toast(`🎉 ${x.name} 레벨 ${x.level} 달성!`), 400 + i * 300));
        await refresh();
      } catch (e) { toast(e.message, 'error'); }
    };
    $('#approve-all')?.addEventListener('click', () => review((ms.pending || []).map((x) => x.id), 'approve'));
    $$('[data-approve]').forEach((b) => (b.onclick = () => review([b.dataset.approve], 'approve')));
    $$('[data-reject]').forEach((b) => (b.onclick = () => review([b.dataset.reject], 'reject')));
    $$('[data-answer]').forEach((button) => { button.onclick = () => {
      const submission = [...(ms.pending || []), ...(ms.recent || [])].find((x) => x.id === button.dataset.answer);
      if (submission) openAssignmentAnswer(submission, review);
    }; });
    $('#mission-add').onclick = () => openMission(null);
    $$('[data-edit]').forEach((b) => (b.onclick = () => openMission(ms.missions.find((m) => m.id === b.dataset.edit))));
    $$('[data-del]').forEach((b) => (b.onclick = async () => {
      const m = ms.missions.find((x) => x.id === b.dataset.del);
      const ok = await confirmModal({ emoji: '🗑️', title: '미션 삭제', html: `<b>${esc(m.name)}</b> 미션을 삭제할까요?<br><span class="muted">이미 준 보상과 기록은 그대로 남아요. 잠시 멈추려면 '수정'에서 쉬게 할 수도 있어요.</span>`, okText: '삭제', okClass: 'btn-danger' });
      if (!ok) return;
      try { await api(`/teacher/missions/${encodeURIComponent(m.id)}`, { method: 'DELETE' }); toast('삭제했어요.'); await refresh(); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }

  function openAssignmentAnswer(submission, review) {
    const pending = (ms.pending || []).some((x) => x.id === submission.id);
    openModal({
      title: `📝 ${esc(submission.missionName)}`,
      body: `<p class="hint"><b>${esc(submission.studentName)}</b> · ${fmtDate(submission.createdAt)} · 보상 ${fmt(submission.reward)} ${cur()}</p><h3 class="card-title">학생이 제출한 풀이</h3><div class="assignment-answer">${esc(submission.note || '작성한 답안이 없어요.')}</div>`,
      foot: `${submission.assignmentPdfName || submission.assignmentHasPdf ? '<button class="btn btn-ghost" id="answer-pdf">📄 과제 학습지</button>' : ''}${pending ? '<button class="btn btn-take" id="answer-reject">반려</button><button class="btn btn-give" id="answer-approve">승인</button>' : ''}<button class="btn btn-ghost" id="answer-close">닫기</button>`,
      onMount: ({ el, close }) => {
        $('#answer-close', el).onclick = close;
        $('#answer-pdf', el)?.addEventListener('click', () => { close(); openAssignmentPdf({ id: submission.assignmentId, title: submission.missionName }, { role: 'teacher' }); });
        $('#answer-approve', el)?.addEventListener('click', () => { close(); review([submission.id], 'approve'); });
        $('#answer-reject', el)?.addEventListener('click', () => { close(); review([submission.id], 'reject'); });
      },
    });
  }

  function openMission(m) {
    const d = m || { emoji: '🎯', name: '', reward: 10, desc: '', prompt: '', daily: false, active: true };
    let emoji = d.emoji;
    const emojis = MISSION_EMOJI.includes(emoji) ? MISSION_EMOJI : [emoji, ...MISSION_EMOJI];
    openModal({
      title: m ? '미션 수정' : '＋ 미션 추가',
      body: `
        <div class="field"><span class="field-label">아이콘</span>
          <div class="emoji-pick" id="emoji-pick">${emojis.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('')}</div>
        </div>
        <div class="form-grid">
          <div class="field"><label for="ms-name">미션 이름</label><input class="input" id="ms-name" maxlength="20" value="${esc(d.name)}" placeholder="예: 수학익힘"></div>
          <div class="field"><label for="ms-reward">보상 (${cur()} · 경험치)</label><input class="input" type="number" id="ms-reward" min="1" max="1000" value="${d.reward}"></div>
          <div class="field full"><label for="ms-desc">설명</label><input class="input" id="ms-desc" maxlength="60" value="${esc(d.desc || '')}" placeholder="학생에게 보여 줄 설명"></div>
          <div class="field full"><label for="ms-prompt">신청할 때 학생이 적을 내용 <small class="faint">(비우면 적지 않아요)</small></label><input class="input" id="ms-prompt" maxlength="40" value="${esc(d.prompt || '')}" placeholder="예: 읽은 책 제목"></div>
          <label class="row full" style="cursor:pointer"><input type="checkbox" class="chk" id="ms-daily" ${d.daily ? 'checked' : ''}> 📅 매일 하는 미션 <span class="hint">(자율 체육 '하루치' 계산에 들어가요)</span></label>
          <label class="row full" style="cursor:pointer"><input type="checkbox" class="chk" id="ms-active" ${d.active !== false ? 'checked' : ''}> 학생에게 보이기 (끄면 잠시 쉬어요)</label>
        </div>`,
      foot: '<button class="btn btn-ghost" id="ms-cancel">취소</button><button class="btn btn-primary" id="ms-save">저장</button>',
      onMount: ({ el, close }) => {
        const draw = () => $$('#emoji-pick button', el).forEach((b) => b.classList.toggle('on', b.dataset.e === emoji));
        $$('#emoji-pick button', el).forEach((b) => (b.onclick = () => { emoji = b.dataset.e; draw(); }));
        $('#ms-cancel', el).onclick = close;
        $('#ms-save', el).onclick = async () => {
          const body = {
            emoji, name: $('#ms-name', el).value, reward: $('#ms-reward', el).value, desc: $('#ms-desc', el).value,
            prompt: $('#ms-prompt', el).value, daily: $('#ms-daily', el).checked, active: $('#ms-active', el).checked,
          };
          try {
            await api(m ? `/teacher/missions/${encodeURIComponent(m.id)}` : '/teacher/missions', { method: m ? 'PUT' : 'POST', body });
            close(); toast(m ? '미션을 수정했어요.' : '미션을 추가했어요.'); await refresh();
          } catch (e) { toast(e.message, 'error'); }
        };
        draw();
      },
    });
  }

  function paint() {
    teacherMap?.destroy();
    teacherMap = null;
    const views = { 
      home: homeView, 
      missions: missionsView,
      assignments: assignmentsView,
      world: worldView, 
      history: historyView, 
      shop: shopView, 
      roles: rolesView, 
      settings: settingsView 
    };
    const y = window.scrollY;
    app.innerHTML = shell((views[view] || homeView)());
    window.scrollTo(0, y);
    $('#btn-logout').onclick = logout;
    ({ 
      home: bindHome, 
      missions: bindMissions,
      assignments: bindAssignments,
      world: bindWorld, 
      history: bindHistory, 
      shop: bindShop, 
      roles: bindRoles, 
      settings: bindSettings 
    }[view] || bindHome)();
  }

  paint();

  // 학생 구매·미션 신청이 보이도록 30초마다 갱신 (창이 열려 있거나 입력 중이면 건너뜀)
  // 학급 회의 중에는 투표 현황만 4초마다 새로 그린다
  let stopped = false;
  let lastFull = Date.now();
  const voting = () => view === 'home' && st.classGoal?.vote?.status === 'open';
  const tick = async () => {
    const typing = document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (!document.hidden && !$('.modal-backdrop') && view !== 'settings' && !typing && !publishingAssignment && !readingPdf) {
      try {
        if (voting() && Date.now() - lastFull < 30000) {
          st = await api('/teacher/state');
          const box = $('#t-goal');
          if (box) { box.innerHTML = teacherGoalHTML(); bindGoal(); }
        } else {
          await refresh();
          lastFull = Date.now();
        }
      } catch { /* 다음에 다시 */ }
    }
    if (!stopped) timer = setTimeout(tick, voting() ? 4000 : 30000);
  };
  timer = setTimeout(tick, voting() ? 4000 : 30000);
  return () => {
    stopped = true;
    clearTimeout(timer);
    teacherMap?.destroy();
    teacherMap = null;
  };
}
