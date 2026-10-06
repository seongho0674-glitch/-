// ==========================================================
// 학생 화면: 메인 / 미션 / 세계지도 / 상점 / 행운의 게임 / 내 기록
// ==========================================================
import {
  $, $$, esc, fmt, fmtDate, todayKey, todayLabel, api, logout, toast,
  avatar, openModal, confirmModal, countUp, coinBurst, celebrateLevelUp, loadingHTML,
  getAssignmentPdfUrl, openAssignmentPdf,
} from './core.js';
import { createWorldMap, openCityModal, cityKind, inContinent, coordText, CONTINENT_NAMES, KIND_LABEL } from './world3d.js';

const TX_ICON = { give: '🎁', take: '⚠️', buy: '🛍️', luck: '🍀', class: '🏃', tax: '🏛️', upgrade: '🐾', territory: '🗺️' };
const isPlus = (t) => t.type === 'give' || (t.type === 'luck' && t.win);
const CONTINENT_FILTERS = [['all', '전체'], ['asia', '아시아'], ['europe', '유럽'], ['americas', '아메리카'], ['africa', '아프리카'], ['oceania', '오세아니아']];
const DEFAULT_ANIMAL = { name: '모리', species: '여우', emoji: '🦊', title: '숲의 수호자' };
const BIG_MISSION = 30; // 이만큼 이상 주는 미션은 '보상이 큰 미션'으로 강조

let lastBalance = null;     // 새로 받은 화폐 알림용
let worldMap = null;        // 지금 화면의 지도 (메인 미리보기 또는 세계지도)
let selectedCityId = null;  // 세계지도에서 고른 도시 (화면을 옮겨도 유지)
let selectedFor = null;     // 위 선택이 어느 학생의 것인지
let continentFilter = 'all';

export async function renderStudent(app, view) {
  app.innerHTML = loadingHTML();
  let me = await api('/student/me');
  let items = view === 'shop' ? (await api('/student/shop')).items : [];
  let worldData = (view === 'world' || view === 'home') ? (await api('/world/cities')) : null;
  let timer = null;
  let luckBusy = false;
  let economyBusy = false;

  if (selectedFor !== me.student.id) {
    selectedFor = me.student.id;
    selectedCityId = null;
    continentFilter = 'all';
  }

  const cur = () => esc(me.settings.currencyName);
  const cities = () => (worldData && worldData.cities) || [];
  const animalOf = (s) => s.animal || DEFAULT_ANIMAL;
  const homeCityOf = (s) => cities().find((c) => c.id === (s.homeCity || 'seoul')) || null;

  function shell(content) {
    const s = me.student;
    const a = animalOf(s);
    const nav = [
      ['home', '🏠', '메인', '#/student'],
      ['missions', '🎯', '미션', '#/student/missions'],
      ['world', '🌍', '세계지도', '#/student/world'],
      ['shop', '🛒', '상점', '#/student/shop'],
      ['luck', '🍀', '행운의 게임', '#/student/luck'],
      ['history', '📜', '내 기록', '#/student/history'],
    ];
    return `
      <header class="topbar">
        <div class="container topbar-inner">
          <div class="brand">
            <span class="brand-logo">🪙</span>
            <div>서초롱 민주시민 경제교육<small>${esc(me.settings.className)}</small></div>
          </div>
          <nav class="nav" aria-label="학생 메뉴">
            ${nav.map(([k, ic, label, href]) => `<a href="${href}" id="nav-${k}" class="${view === k ? 'active' : ''}">${ic} ${label}</a>`).join('')}
          </nav>
          <div class="user-chip">
            <span class="animal-avatar-badge" title="${esc(a.title)}">${a.emoji}</span>
            ${avatar(s.name, s.number)}
            <span class="user-name">${esc(s.name)}</span>
            <button class="btn btn-ghost btn-sm" id="btn-logout">나가기</button>
          </div>
        </div>
      </header>
      <div class="container page">${content}</div>`;
  }

  // ---------- 미션 상태 ----------
  const missions = () => me.missions || [];
  /** 오늘 이 미션의 상태: done(받음) / pending(확인 중) / retry(반려) / none(아직) / off(역할 없음) */
  function missionState(m) {
    const list = (me.mySubmissions || []).filter((x) => x.missionId === m.id);
    if (list.some((x) => x.status === 'approved')) return 'done';
    if (list.some((x) => x.status === 'pending')) return 'pending';
    if (m.kind === 'role' && !me.role) return 'off';
    if (list.some((x) => x.status === 'rejected')) return 'retry';
    return 'none';
  }
  const roleMission = () => missions().find((m) => m.kind === 'role') || null;
  const todayMissionCoins = () => [...(me.mySubmissions || []), ...(me.myAssignmentSubmissions || []).filter((x) => (x.reviewedAt || '').startsWith(todayKey()))].filter((x) => x.status === 'approved').reduce((a, x) => a + x.reward, 0);

  // ---------- 메인 ----------
  function homeView() {
    const s = me.student;
    const a = animalOf(s);
    const pct = Math.round((s.expInLevel / s.expToNext) * 100);
    const home = homeCityOf(s);
    const claimedCount = (s.claimedCities || [s.homeCity || 'seoul']).length;
    const friends = s.friends || a.friends || [];
    const vote = me.classGoal?.vote;
    const voteOpen = vote?.status === 'open';

    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">안녕, ${esc(s.name)}! 👋</h1>
          <p class="page-sub">${todayLabel()} · 수호동물 <b>${a.emoji} ${esc(a.name)}</b>와 함께하는 즐거운 하루</p>
        </div>
        <div class="head-actions">
          <a class="btn btn-primary" href="#/student/missions" id="go-missions">🎯 오늘의 미션</a>
        </div>
      </div>

      ${voteOpen ? `<a class="vote-banner" href="#goal-card" id="vote-banner">${voteBannerInner()}</a>` : ''}

      <section class="student-hero">
        <article class="card balance-card" aria-label="내 잔액">
          <div class="balance-top"><span class="card-label">💰 내 잔액</span></div>
          <div class="balance-amount">
            <span class="coin" aria-hidden="true">🪙</span>
            <span><span class="big-number ${s.balance < 0 ? 'negative' : ''}" id="balance-num" data-from="${lastBalance ?? 0}">${fmt(s.balance)}</span><span class="unit">${cur()}</span></span>
          </div>
          <div class="balance-foot">
            <a class="btn btn-gold" href="#/student/shop" id="go-shop">🛒 상점 가기</a>
            <a class="btn" href="#/student/history" id="go-history">📜 내 기록</a>
          </div>
        </article>

        <article class="card level-card" aria-label="내 레벨">
          <div>
            <span class="card-label">⭐ 내 레벨 & 경험치</span>
            <div class="level-row" style="margin-top:12px">
              <div class="level-badge"><span><small>LEVEL</small><b>${s.level}</b></span></div>
              <div>
                <div class="level-name">레벨 ${s.level}</div>
                <div class="muted" style="font-size:14px;margin-top:4px">누적 경험치 ${fmt(s.exp)} XP</div>
              </div>
            </div>
          </div>
          <div>
            <div class="xp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
              <div class="xp-fill" id="xp-fill" style="width:0%"></div>
            </div>
            <div class="xp-text">
              <span>${fmt(s.expInLevel)} / ${fmt(s.expToNext)} XP</span>
              <span>다음 레벨까지 <b class="gold">${fmt(s.expToNext - s.expInLevel)}</b></span>
            </div>
          </div>
        </article>
      </section>

      <section class="grid-2 home-row economy-row">
        ${taxCardHTML()}
        ${growthCardHTML()}
      </section>

      <section class="grid-2 home-row">
        ${missionSummaryHTML()}
        <article class="card goal-card" id="goal-card" aria-label="자율 체육 저금통">${goalCardHTML()}</article>
      </section>

      <section class="card home-world" aria-label="나의 수호동물과 세계지도">
        <div class="home-world-map"><div id="home-globe"></div></div>
        <div class="home-world-info">
          <span class="card-label">🐾 나의 수호동물</span>
          <div class="home-animal">
            <span class="home-animal-emoji" aria-hidden="true">${a.emoji}</span>
            <div>
              <div class="home-animal-name">${esc(a.name)}<small>${esc(a.species || '')} · 캐릭터 Lv.${fmt(s.characterLevel || 1)}</small></div>
              <div class="home-animal-title">${esc(a.title || '')}</div>
            </div>
          </div>
          ${home ? `
            <div class="home-world-home">
              <span aria-hidden="true">${home.emoji || '🏛️'}</span>
              <div><b>시작 도시 · ${esc(home.name)}</b><small>${esc(home.country)} · ${esc(home.landmark)}</small></div>
            </div>` : ''}
          <div class="home-world-stats">
            <div class="ws-stat"><b>${claimedCount}곳</b><small>개척 도시</small></div>
            <div class="ws-stat"><b>${fmt(s.claimedTiles ?? 6)}칸</b><small>내 영토</small></div>
            <div class="ws-stat"><b>${fmt(s.energy ?? 0)}⚡</b><small>탐험 에너지</small></div>
          </div>
          ${friends.length ? `<p class="home-world-friends">함께 지내는 친구: ${esc(friends.join(', '))}</p>` : ''}
          <a class="btn btn-outline-cyan" href="#/student/world" id="home-go-world">🌍 세계지도에서 탐험하기</a>
        </div>
      </section>

      <section class="grid-2">
        ${roleTasksHTML()}
        <article class="card" aria-label="최근 활동">
          <div class="card-head">
            <h2 class="card-title">🕒 최근 활동</h2>
            <a class="btn btn-ghost btn-sm" href="#/student/history" id="see-all">전체 보기 →</a>
          </div>
          ${txList(me.transactions.slice(0, 5))}
        </article>
      </section>`;
  }

  function taxCardHTML() {
    const tax = me.taxInfo || {};
    const balance = me.student.balance;
    return `<article class="card" aria-label="오늘의 세금">
      <div class="card-head"><h2 class="card-title">🏛️ 오늘의 세금</h2><span class="tag">하루 한 번</span></div>
      <p class="muted">소득세는 매일 10 ${cur()}, 재산세는 잔액이 100 ${cur()}을 넘으면 10 ${cur()}을 납부해요.</p>
      <div class="economy-actions">
        <button class="btn btn-primary" data-tax="income" ${tax.incomePaid || balance < 10 ? 'disabled' : ''}>${tax.incomePaid ? '✅ 소득세 납부 완료' : `소득세 10 ${cur()} 납부`}</button>
        <button class="btn" data-tax="property" ${tax.propertyPaid || !tax.propertyDue ? 'disabled' : ''}>${tax.propertyPaid ? '✅ 재산세 납부 완료' : `재산세 10 ${cur()} 납부`}</button>
      </div>
      <p class="hint">${balance < 10 && !tax.incomePaid ? '소득세를 낼 코인이 부족해요. 미션으로 코인을 모아 주세요.' : !tax.propertyDue && !tax.propertyPaid ? '현재 잔액은 재산세 납부 대상이 아니에요.' : '납부 내역은 내 기록에 남아요.'}</p>
    </article>`;
  }

  function growthCardHTML(compact = false) {
    const s = me.student;
    const level = s.characterLevel || 1;
    const upgradeCost = s.nextUpgradeCost;
    const territoryCost = s.nextTerritoryCost || ((s.territoryPurchases || 0) + 1) * 200;
    return `<section class="${compact ? 'ws-card' : 'card'} growth-card" aria-label="캐릭터와 영토 키우기">
      <div class="card-head"><h2 class="card-title">🐾 내 캐릭터 키우기</h2><span class="tag">Lv.${fmt(level)}</span></div>
      <div class="character-growth" style="--character-scale:${1 + Math.min(level - 1, 100) / 200}"><span aria-hidden="true">${esc(animalOf(s).emoji)}</span><div><b>${esc(animalOf(s).name)}</b><small>영토 ${fmt(s.claimedTiles ?? 6)}칸</small></div></div>
      <p class="muted">레벨업 비용은 10·20·30…1,000 ${cur()}이에요. 코인으로 키운 캐릭터는 최고 101레벨까지 자라요.</p>
      <div class="economy-actions">
        <button class="btn btn-gold" data-economy="upgrade" ${upgradeCost == null || s.balance < upgradeCost ? 'disabled' : ''}>${upgradeCost == null ? '🌟 최고 레벨 달성' : `Lv.${level + 1}로 키우기 · ${fmt(upgradeCost)} ${cur()}`}</button>
        <button class="btn btn-outline-cyan" data-economy="territory" ${s.balance < territoryCost ? 'disabled' : ''}>영토 1칸 확장 · ${fmt(territoryCost)} ${cur()}</button>
      </div>
      <p class="hint">영토는 200 ${cur()}부터 시작해 한 번 확장할 때마다 비용이 200 ${cur()}씩 늘어요.</p>
    </section>`;
  }

  function bindEconomy() {
    $$('[data-tax]').forEach((button) => { button.onclick = () => spendEconomy('tax', button.dataset.tax); });
    $$('[data-economy]').forEach((button) => { button.onclick = () => spendEconomy(button.dataset.economy); });
  }

  async function spendEconomy(kind, taxType) {
    if (economyBusy) return;
    const s = me.student;
    const cost = kind === 'tax' ? 10 : kind === 'upgrade' ? s.nextUpgradeCost : s.nextTerritoryCost;
    const label = kind === 'tax' ? (taxType === 'income' ? '소득세 납부' : '재산세 납부') : kind === 'upgrade' ? '캐릭터 레벨업' : '영토 1칸 확장';
    let pendingButtons = [];
    economyBusy = true;
    try {
      const ok = await confirmModal({ emoji: kind === 'tax' ? '🏛️' : '🐾', title: label, html: `${fmt(cost)} ${cur()}을 사용해 ${label}할까요?`, okText: label });
      if (!ok) return;
      pendingButtons = $$('[data-tax], [data-economy]').map((button) => [button, button.disabled]);
      pendingButtons.forEach(([button]) => { button.disabled = true; });
      const path = kind === 'tax' ? '/student/taxes' : kind === 'upgrade' ? '/student/upgrade-character' : '/student/expand-territory';
      await api(path, { method: 'POST', body: kind === 'tax' ? { type: taxType } : {} });
      me = await api('/student/me');
      if (view === 'home' || view === 'world') worldData = await api('/world/cities');
      paint();
      toast(`${label} 완료!`);
      if (kind === 'upgrade') celebrateLevelUp(me.student.characterLevel);
    } catch (e) { toast(e.message, 'error'); }
    finally {
      pendingButtons.forEach(([button, disabled]) => { if (button.isConnected) button.disabled = disabled; });
      economyBusy = false;
    }
  }

  function voteBannerInner() {
    const my = me.classGoal?.vote?.myVote;
    return `
      <span class="vote-banner-icon">🗳️</span>
      <span><b>학급 회의가 열렸어요!</b> ${my ? `자율 체육에 <b>${my === 'yes' ? '찬성' : '반대'}</b>했어요. 회의가 끝나기 전까지 바꿀 수 있어요.` : '자율 체육을 할지 찬성·반대를 눌러 투표해 주세요.'}</span>
      <span class="vote-banner-go">${my ? '투표 바꾸기 ↓' : '투표하러 가기 ↓'}</span>`;
  }

  function missionSummaryHTML() {
    const list = missions().filter((m) => m.kind !== 'assignment');
    const done = list.filter((m) => missionState(m) === 'done').length;
    const waiting = list.filter((m) => missionState(m) === 'pending').length;
    const icon = { done: '✅', pending: '⏳', retry: '↩️', none: '', off: '🔒' };
    return `
      <article class="card" aria-label="오늘의 미션">
        <div class="card-head">
          <h2 class="card-title">🎯 오늘의 미션</h2>
          <span class="badge goods">${done} / ${list.length} 완료</span>
        </div>
        <ul class="mission-mini">
          ${list.map((m) => {
            const st = missionState(m);
            return `
              <li class="mm-${st}">
                <span class="mm-emoji" aria-hidden="true">${esc(m.emoji)}</span>
                <span class="mm-name">${esc(m.name)}${m.reward >= BIG_MISSION ? ' <i class="mm-big">보상 큼</i>' : ''}</span>
                <span class="mm-reward">+${fmt(m.reward)}</span>
                <span class="mm-state" aria-label="${st}">${icon[st]}</span>
              </li>`;
          }).join('')}
        </ul>
        <div class="mission-mini-foot">
          <span class="muted">오늘 받은 미션 보상 <b class="gold">+${fmt(todayMissionCoins())}</b>${waiting ? ` · 확인 기다림 ${waiting}개` : ''}</span>
          <a class="btn btn-primary btn-sm" href="#/student/missions">미션 · 선생님 과제 ${fmt((me.assignments || []).length)}개 →</a>
        </div>
      </article>`;
  }

  function goalCardHTML() {
    const g = me.classGoal;
    if (!g) return '';
    const pct = Math.min(100, Math.round((g.total / g.goal) * 100));
    const v = g.vote;
    const voteOpen = v?.status === 'open';
    const needed = Math.ceil((g.studentCount * g.passRate) / 100);
    const spendPct = g.total > 0 ? Math.min(100, Math.round((g.goal / g.total) * 100)) : 100;
    const closedToday = v && v.closedAt && v.closedAt.slice(0, 10) === todayKey() && ['passed', 'failed'].includes(v.status);
    const pill = voteOpen ? ['k-friend', '🗳️ 회의 중'] : g.ready ? ['k-mine', '🎉 목표 달성'] : ['k-empty', `${pct}%`];
    return `
      <div class="card-head">
        <h2 class="card-title">🏃 자율 체육 저금통</h2>
        <span class="status-pill ${pill[0]}">${pill[1]}</span>
      </div>
      <div class="goal-amount"><b>${fmt(g.total)}</b> / ${fmt(g.goal)} <span>${cur()}</span></div>
      <div class="goal-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div>
      <p class="goal-note">우리 반 ${g.studentCount}명이 하루 ${fmt(g.perDay)} ${cur()}씩 ${g.days}일 모으면 자율 체육을 할 수 있어요.</p>
      ${voteOpen ? `
        <div class="vote-box">
          <div class="vote-q">🗳️ 학급 회의 · 자율 체육을 할까요?</div>
          <div class="vote-btns">
            <button type="button" class="vote-btn yes ${v.myVote === 'yes' ? 'on' : ''}" data-vote="yes" aria-pressed="${v.myVote === 'yes'}">👍 찬성</button>
            <button type="button" class="vote-btn no ${v.myVote === 'no' ? 'on' : ''}" data-vote="no" aria-pressed="${v.myVote === 'no'}">👎 반대</button>
          </div>
          <div class="vote-tally">찬성 <b>${v.yes}</b> · 반대 <b>${v.no}</b> · 전체 ${v.total}명 — <b>${needed}명(${g.passRate}%)</b> 이상 찬성하면 통과</div>
          <p class="hint">통과하면 우리 반 모두의 잔액에서 같은 비율(약 ${spendPct}%)로 ${fmt(g.goal)} ${cur()}을 함께 써요.</p>
        </div>`
        : g.ready ? `<p class="goal-msg ok">🎉 목표를 모았어요! 선생님이 학급 회의를 열면 투표할 수 있어요.</p>`
          : `<p class="goal-msg">목표까지 <b>${fmt(g.goal - g.total)}</b> ${cur()} 남았어요. 상점에서 쓰기 전에 한 번 더 생각해 봐요!</p>`}
      ${closedToday ? (v.status === 'passed'
        ? `<p class="goal-msg ok">🎉 오늘 학급 회의 통과! 찬성 ${v.result?.rate ?? 0}%로 자율 체육을 해요.</p>`
        : `<p class="goal-msg">오늘 학급 회의는 찬성 ${v.result?.rate ?? 0}%로 다음에 다시 이야기하기로 했어요.</p>`) : ''}`;
  }

  function roleTasksHTML() {
    const s = me.student;
    const role = me.role;
    const doneKey = `cm_tasks_${s.id}_${todayKey()}`;
    const done = new Set(JSON.parse(localStorage.getItem(doneKey) || '[]'));
    const rm = roleMission();
    const st = rm ? missionState(rm) : null;
    return `
      <article class="card" aria-label="오늘 할 일">
        <div class="card-head">
          <h2 class="card-title">✅ 오늘 할 일</h2>
          ${role ? `<span class="badge goods" id="task-progress">${done.size} / ${role.tasks.length} 완료</span>` : ''}
        </div>
        ${role ? `
          <div class="role-banner">
            <span class="role-emoji">${esc(role.emoji)}</span>
            <div>
              <div class="muted" style="font-size:13px;font-weight:700">나의 1인 1역</div>
              <div class="role-name">${esc(role.name)}</div>
            </div>
          </div>
          <ul class="task-list">
            ${role.tasks.map((t, i) => `
              <li class="task-item ${done.has(i) ? 'done' : ''}" data-i="${i}" id="task-${i}" role="checkbox" aria-checked="${done.has(i)}" tabindex="0">
                <span class="task-check">✓</span><span class="task-text">${esc(t)}</span>
              </li>`).join('')}
          </ul>
          ${rm ? (st === 'done' ? `<p class="role-mission done">✅ 오늘 1인 1역 미션 보상 +${fmt(rm.reward)} 받았어요</p>`
            : st === 'pending' ? `<p class="role-mission">⏳ 1인 1역 미션을 선생님이 확인하고 있어요</p>`
              : `<button class="btn btn-primary w-full role-mission-btn" id="role-mission-btn" ${done.size === role.tasks.length ? '' : 'disabled'}>🎯 다 했어요! 1인 1역 미션 신청 (+${fmt(rm.reward)})</button>
                 <p class="hint" style="margin-top:8px">💡 할 일을 모두 체크하면 미션을 신청할 수 있어요.</p>`) : ''}
        ` : `<div class="empty"><span class="emo">🧩</span>아직 맡은 역할이 없어요.<br>선생님이 곧 정해 주실 거예요!</div>`}
      </article>`;
  }

  // ---------- 미션 ----------
  function missionsView() {
    const list = missions();
    const today = me.mySubmissions || [];
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">🎯 미션</h1>
          <p class="page-sub">미션을 하고 신청하면 선생님이 확인한 뒤 ${cur()}과 경험치를 같이 줘요. 일반 미션은 하루 한 번, 선생님 과제는 과제마다 한 번 보상을 받아요.</p>
        </div>
        <div class="shop-balance-pill">
          <span>오늘 받은 보상</span>
          <b class="big-number gold">+${fmt(todayMissionCoins())}</b>
          <span class="unit">${cur()}</span>
        </div>
      </div>

      <div class="mission-grid">
        ${list.map((m) => missionCardHTML(m)).join('')}
        ${list.length ? '' : '<div class="empty card col-full"><span class="emo">🎯</span>선생님이 아직 미션을 만들지 않았어요.</div>'}
      </div>

      ${assignmentsHTML()}

      <section class="card section-gap" aria-label="오늘 신청한 미션">
        <div class="card-head"><h2 class="card-title">📋 오늘 신청한 미션</h2><span class="muted" style="font-size:14px">${today.length}개</span></div>
        ${today.length ? `<div class="tx-list">${[...today].reverse().map((x) => `
          <div class="tx-item">
            <span class="tx-icon ${x.status === 'approved' ? 'give' : x.status === 'rejected' ? 'take' : 'buy'}">${esc(x.missionEmoji)}</span>
            <div class="tx-main">
              <div class="tx-reason">${esc(x.missionName)}${x.note ? ` · <span class="muted">${esc(x.note)}</span>` : ''}</div>
              <div class="tx-meta">${fmtDate(x.createdAt)} · ${x.status === 'approved' ? '✅ 받았어요' : x.status === 'rejected' ? '↩️ 선생님이 다시 해 보래요' : '⏳ 확인 기다리는 중'}</div>
            </div>
            <div class="tx-amount ${x.status === 'approved' ? 'plus' : 'faint'}">+${fmt(x.reward)}</div>
          </div>`).join('')}</div>` : '<div class="empty"><span class="emo">🌱</span>오늘은 아직 신청한 미션이 없어요.</div>'}
      </section>`;
  }

  function missionCardHTML(m) {
    if (m.kind === 'assignment') {
      return `<article class="card mission-card"><div class="mission-top"><span class="mission-emoji">📝</span><span class="tag">PDF · 학습지 · 과제</span></div><h2 class="mission-name">선생님 과제</h2><p class="mission-desc">선생님이 올린 학습지를 보고 문제를 풀어요. 답안을 제출하고 완료를 인증하면 선생님이 보상을 줘요.</p><div class="mission-foot"><a class="btn btn-primary w-full" href="#teacher-assignments" data-assignment-anchor>과제 ${fmt((me.assignments || []).length)}개 확인하기 ↓</a></div></article>`;
    }
    const st = missionState(m);
    const role = m.kind === 'role' ? me.role : null;
    const foot = {
      none: `<button class="btn btn-primary w-full" data-mission="${esc(m.id)}">✋ 했어요! 신청하기</button>`,
      retry: `<button class="btn w-full" data-mission="${esc(m.id)}">↩️ 다시 신청하기</button>`,
      pending: '<span class="mission-state pending">⏳ 선생님이 확인하고 있어요</span>',
      done: `<span class="mission-state done">✅ +${fmt(m.reward)} 받았어요</span>`,
      off: '<span class="mission-state off">🔒 역할을 받으면 할 수 있어요</span>',
    }[st];
    return `
      <article class="card mission-card st-${st} ${m.reward >= BIG_MISSION ? 'is-big' : ''}">
        <div class="mission-top">
          <span class="mission-emoji" aria-hidden="true">${esc(m.emoji)}</span>
          <span class="mission-reward"><b>+${fmt(m.reward)}</b><small>${cur()} · XP</small></span>
        </div>
        <h2 class="mission-name">${esc(m.name)}</h2>
        <p class="mission-desc">${esc(m.desc || '')}</p>
        <div class="mission-tags">
          ${m.reward >= BIG_MISSION ? '<span class="tag big">⭐ 보상이 큰 미션</span>' : ''}
          ${m.daily ? '<span class="tag">📅 매일</span>' : ''}
          ${m.prompt ? '<span class="tag">✏️ 기록 적기</span>' : ''}
          ${role ? `<span class="tag">${esc(role.emoji)} ${esc(role.name)}</span>` : ''}
          ${st === 'retry' ? '<span class="tag warn">↩️ 다시 해 보기</span>' : ''}
        </div>
        <div class="mission-foot">${foot}</div>
      </article>`;
  }

  function assignmentSubmission(assignment) {
    return [...(me.myAssignmentSubmissions || [])].reverse().find((x) => x.assignmentId === assignment.id);
  }

  function assignmentsHTML() {
    const assignments = me.assignments || [];
    return `<section class="card section-gap" id="teacher-assignments" aria-label="선생님 과제">
      <div class="card-head"><h2 class="card-title">📝 선생님 과제</h2><span class="tag">${assignments.length}개</span></div>
      <p class="muted">PDF를 읽고 아래 답안 칸에 풀어 제출해 주세요. 선생님 확인 후 코인이 들어와요.</p>
      <div class="assignment-grid">${assignments.map((assignment) => {
        const sub = assignmentSubmission(assignment);
        const status = sub?.status;
        const pending = status === 'pending';
        const approved = status === 'approved';
        return `<article class="assignment-card">
          <div class="row"><h3>${esc(assignment.title)}</h3><span class="gold">+${fmt(assignment.reward)} ${cur()}</span></div>
          <p class="assignment-instructions">${esc(assignment.instructions || '')}</p>
          ${assignment.pdfName ? `<p class="hint">📄 ${esc(assignment.pdfName)}</p>` : ''}
          <span class="mission-state ${approved ? 'done' : pending ? 'pending' : ''}">${approved ? '✅ 인증 완료 · 보상 받았어요' : pending ? '⏳ 선생님 확인을 기다리고 있어요' : status === 'rejected' ? '↩️ 다시 풀고 인증해 주세요' : '✏️ 풀고 인증할 수 있어요'}</span>
          <div class="economy-actions">${assignment.pdfName ? `<button class="btn btn-ghost btn-sm" data-assignment-pdf="${esc(assignment.id)}">PDF 보기</button>` : ''}<button class="btn ${pending || approved ? 'btn-ghost' : 'btn-primary'}" data-assignment="${esc(assignment.id)}">${pending || approved ? '내 답안 보기' : status === 'rejected' ? '다시 풀고 인증하기' : '풀고 인증하기'}</button></div>
        </article>`;
      }).join('')}</div>
      ${assignments.length ? '' : '<div class="empty"><span class="emo">📚</span>아직 배정된 과제가 없어요. 선생님이 올리면 여기에 나타나요.</div>'}
    </section>`;
  }

  async function openAssignment(assignment) {
    let pdfUrl = null;
    try {
      if (assignment.pdfName) pdfUrl = await getAssignmentPdfUrl(assignment);
      const sub = assignmentSubmission(assignment);
      const readOnly = sub && ['pending', 'approved'].includes(sub.status);
      openModal({
        title: `📝 ${esc(assignment.title)}`,
        wide: true,
        body: `<p class="assignment-instructions">${esc(assignment.instructions || '')}</p>
          ${pdfUrl ? `<div class="row"><a class="btn btn-ghost btn-sm" href="${pdfUrl}" target="_blank" rel="noopener">PDF 새 창에서 보기</a><a class="btn btn-ghost btn-sm" href="${pdfUrl}" download="${esc(assignment.pdfName)}">PDF 내려받기</a></div><iframe class="pdf-frame" title="${esc(assignment.title)} 학습지" src="${pdfUrl}"></iframe>` : ''}
          <div class="field"><label for="assignment-answer">내 답안 · 풀이</label><textarea class="textarea assignment-answer" id="assignment-answer" maxlength="10000" ${readOnly ? 'readonly' : ''} placeholder="문제 번호와 답, 풀이 과정을 적어 주세요.">${esc(sub?.note || '')}</textarea></div>
          ${readOnly ? `<p class="hint">${sub.status === 'approved' ? '인증을 마치고 보상을 받은 과제예요.' : '선생님이 답안을 확인하고 있어요.'}</p>` : `<label class="row"><input type="checkbox" class="chk" id="assignment-certify">스스로 과제를 풀었어요. 완료를 인증합니다.</label><p class="hint">선생님 확인 후 +${fmt(assignment.reward)} ${cur()}과 경험치를 받아요.</p>`}`,
        foot: `<button class="btn btn-ghost" id="assignment-close">닫기</button>${readOnly ? '' : '<button class="btn btn-primary" id="assignment-submit" disabled>답안 제출 · 완료 인증</button>'}`,
        onClose: () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); },
        onMount: ({ el, close }) => {
          $('#assignment-close', el).onclick = close;
          if (readOnly) return;
          const input = $('#assignment-answer', el);
          const checkbox = $('#assignment-certify', el);
          const button = $('#assignment-submit', el);
          const update = () => { button.disabled = !input.value.trim() || !checkbox.checked; };
          input.oninput = update;
          checkbox.onchange = update;
          button.onclick = async () => {
            button.disabled = true;
            try {
              await api(`/student/assignments/${encodeURIComponent(assignment.id)}/submit`, { method: 'POST', body: { answer: input.value } });
              close();
              me = await api('/student/me');
              paint();
              toast('과제 답안과 완료 인증을 제출했어요. 선생님이 확인해 주세요.');
            } catch (e) { toast(e.message, 'error'); update(); }
          };
        },
      });
    } catch (e) { if (pdfUrl) URL.revokeObjectURL(pdfUrl); toast(e.message, 'error'); }
  }

  /** 기록이 필요한 미션은 짧게 적게 한다. 취소하면 null */
  function askNote(m) {
    return new Promise((resolve) => {
      let sent = false;
      const modal = openModal({
        title: `${esc(m.emoji)} ${esc(m.name)} 신청`,
        body: `
          <p class="muted" style="font-size:14.5px">${esc(m.desc || '')}</p>
          <div class="field">
            <label for="mission-note">${esc(m.prompt)}</label>
            <input class="input" id="mission-note" maxlength="80" autocomplete="off" placeholder="짧게 적어 주세요">
          </div>
          <p class="hint">선생님이 확인하면 +${fmt(m.reward)} ${cur()}과 경험치를 받아요.</p>`,
        foot: '<button class="btn btn-ghost" id="note-cancel">취소</button><button class="btn btn-primary" id="note-ok" disabled>신청하기</button>',
        onMount: ({ el, close }) => {
          const input = $('#mission-note', el);
          const ok = $('#note-ok', el);
          input.oninput = () => { ok.disabled = !input.value.trim(); };
          input.onkeydown = (e) => { if (e.key === 'Enter' && !ok.disabled) ok.click(); };
          $('#note-cancel', el).onclick = close;
          ok.onclick = () => { sent = true; close(); resolve(input.value.trim()); };
          setTimeout(() => input.focus(), 50);
        },
      });
      const obs = new MutationObserver(() => {
        if (!document.body.contains(modal.el)) { obs.disconnect(); if (!sent) resolve(null); }
      });
      obs.observe($('#modal-root'), { childList: true });
    });
  }

  async function submitMission(m) {
    let note = '';
    if (m.prompt) {
      note = await askNote(m);
      if (note === null) return;
    }
    try {
      await api('/student/missions', { method: 'POST', body: { missionId: m.id, note } });
      toast(`${m.name} 신청 완료! 선생님이 확인하면 +${m.reward} ${me.settings.currencyName}`);
      me = await api('/student/me');
      paint();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ---------- 행운의 게임 ----------
  function luckView() {
    const L = me.luck;
    if (!L) { // 예전 버전 서버가 켜져 있을 때
      return `<div class="empty card"><span class="emo">🍀</span>행운의 게임을 하려면 선생님이 교실 서버를 새 버전으로 다시 켜야 해요.</div>`;
    }
    const canPay = me.student.balance >= L.bet + L.fee;
    const block = !L.enabled ? '선생님이 지금은 행운의 게임을 쉬게 했어요.'
      : L.remaining <= 0 ? `오늘은 ${L.daily}번을 다 했어요. 내일 다시 만나요!`
        : !canPay ? `${me.settings.currencyName}이(가) 부족해요. 한 번 하려면 ${L.bet + L.fee} ${me.settings.currencyName}이 필요해요.` : '';
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">🍀 행운의 게임</h1>
          <p class="page-sub">손 안의 구슬은 홀수 개일까요, 짝수 개일까요? 맞히면 2배, 틀리면 0배예요. 단, 할 때마다 수수료가 있어요.</p>
        </div>
        <div class="shop-balance-pill">
          <span>내 잔액</span>
          <b class="big-number gold" id="luck-balance">${fmt(me.student.balance)}</b>
          <span class="unit">${cur()}</span>
        </div>
      </div>

      <div class="luck-layout">
        <section class="card luck-stage" aria-label="홀짝 게임">
          <div class="luck-hand" id="luck-hand" aria-hidden="true">✊</div>
          <div class="luck-marbles" id="luck-marbles" aria-hidden="true"></div>
          <div class="luck-result" id="luck-result" role="status">${block || '홀과 짝 중 하나를 골라 보세요'}</div>
          <div class="luck-picks">
            <button type="button" class="luck-pick odd" data-pick="odd" ${block ? 'disabled' : ''}><b>홀</b><small>1 · 3 · 5 · 7 · 9</small></button>
            <button type="button" class="luck-pick even" data-pick="even" ${block ? 'disabled' : ''}><b>짝</b><small>2 · 4 · 6 · 8 · 10</small></button>
          </div>
          <div class="luck-rules">
            <span>거는 ${cur()} <b>${fmt(L.bet)}</b></span>
            <span>수수료 <b>${fmt(L.fee)}</b> (10%)</span>
            <span>맞히면 <b>${fmt(L.bet * 2)}</b> 받기</span>
            <span>오늘 남은 기회 <b id="luck-left">${L.remaining}</b> / ${L.daily}</span>
          </div>
        </section>

        <aside class="luck-side">
          <section class="card" aria-label="나의 기록" id="luck-stats">${luckStatsHTML()}</section>
          <section class="card luck-lesson" aria-label="오래 하면 왜 줄어들까요">
            <h2 class="card-title">🤔 오래 하면 왜 줄어들까요?</h2>
            <p>맞힐 확률은 반반(50%)이에요. 그런데</p>
            <ul>
              <li>맞히면 <b class="plus">+${fmt(L.bet - L.fee)}</b> <small class="muted">(${fmt(L.bet * 2)} 받고, 건 ${fmt(L.bet)}과 수수료 ${fmt(L.fee)}를 냄)</small></li>
              <li>틀리면 <b class="minus">−${fmt(L.bet + L.fee)}</b> <small class="muted">(건 ${fmt(L.bet)}과 수수료 ${fmt(L.fee)})</small></li>
            </ul>
            <p class="luck-ev">평균을 내면 한 번 할 때마다 <b class="minus">−${fmt(L.fee)}</b> ${cur()}! 100번 하면 평균 ${fmt(L.fee * 100)} ${cur()}이 사라져요.</p>
            <p class="muted" style="font-size:13.5px">사라진 수수료는 우리 반 시장에서 빠져서 물가가 오르는 것(인플레이션)도 막아 줘요. 확실하게 모으는 방법은 역시 미션이에요 🎯</p>
            <div class="luck-class" id="luck-class">${luckClassHTML()}</div>
          </section>
        </aside>
      </div>`;
  }

  function luckStatsHTML() {
    const L = me.luck;
    return `
      <h2 class="card-title">📊 나의 기록</h2>
      <div class="luck-stats">
        <div><b>${fmt(L.plays)}</b><small>한 번수</small></div>
        <div><b class="plus">${fmt(L.wins)}</b><small>맞힘</small></div>
        <div><b class="minus">${fmt(L.losses)}</b><small>틀림</small></div>
        <div><b>${fmt(L.fees)}</b><small>낸 수수료</small></div>
      </div>
      <p class="luck-net">지금까지 행운의 게임으로 <b class="${L.net >= 0 ? 'plus' : 'minus'}">${L.net >= 0 ? '+' : '−'}${fmt(Math.abs(L.net))}</b> ${cur()}</p>`;
  }

  function luckClassHTML() {
    const L = me.luck;
    if (!L.classPlays) return '우리 반은 아직 행운의 게임을 하지 않았어요.';
    return `우리 반 전체 ${fmt(L.classPlays)}번 · ${L.classNet <= 0 ? '사라진' : '늘어난'} ${cur()} <b class="${L.classNet <= 0 ? 'minus' : 'plus'}">${fmt(Math.abs(L.classNet))}</b> (수수료 ${fmt(L.classFees)})`;
  }

  async function playLuck(pick) {
    if (luckBusy) return;
    luckBusy = true;
    const hand = $('#luck-hand');
    const marbles = $('#luck-marbles');
    const result = $('#luck-result');
    const picks = $$('.luck-pick');
    picks.forEach((b) => { b.disabled = true; b.classList.toggle('chosen', b.dataset.pick === pick); });
    hand.textContent = '✊';
    hand.className = 'luck-hand shaking';
    marbles.innerHTML = '';
    result.className = 'luck-result';
    result.textContent = `${pick === 'odd' ? '홀' : '짝'}! 구슬을 세는 중…`;
    const started = performance.now();
    try {
      const r = await api('/student/luck', { method: 'POST', body: { pick } });
      await new Promise((ok) => setTimeout(ok, Math.max(0, 1100 - (performance.now() - started))));
      const { marbles: n, win, net, bet, fee } = r.result;
      hand.className = 'luck-hand open';
      hand.textContent = '🖐️';
      marbles.innerHTML = Array.from({ length: n }, (_, i) => `<i class="marble m${i % 4}" style="animation-delay:${i * 60}ms"></i>`).join('');
      result.className = `luck-result ${win ? 'win' : 'lose'}`;
      result.innerHTML = win
        ? `🎉 맞혔어요! 구슬 <b>${n}</b>개 (${n % 2 ? '홀' : '짝'}) · ${fmt(bet * 2)} 받고 수수료 ${fmt(fee)} → <b class="plus">+${fmt(net)}</b>`
        : `😢 아쉬워요… 구슬 <b>${n}</b>개 (${n % 2 ? '홀' : '짝'}) · 건 ${fmt(bet)}과 수수료 ${fmt(fee)} → <b class="minus">−${fmt(-net)}</b>`;
      me.student = r.student;
      me.luck = r.luck;
      lastBalance = me.student.balance;
      $('#luck-balance').textContent = fmt(me.student.balance);
      $('#luck-left').textContent = r.luck.remaining;
      $('#luck-stats').innerHTML = luckStatsHTML();
      $('#luck-class').innerHTML = luckClassHTML();
      // 최신 정보로 맞춰 두면 다음 자동 동기화 때 결과 화면(펼친 손·구슬)이 지워지지 않는다
      me = await api('/student/me');
    } catch (e) {
      hand.className = 'luck-hand';
      result.textContent = e.message;
      toast(e.message, 'error');
    } finally {
      const L = me.luck;
      const off = !L.enabled || L.remaining <= 0 || me.student.balance < L.bet + L.fee;
      picks.forEach((b) => { b.disabled = off; b.classList.remove('chosen'); });
      if (off && L.remaining <= 0) result.insertAdjacentHTML('beforeend', `<br><small class="muted">오늘 기회를 다 썼어요. 내일 다시 만나요!</small>`);
      luckBusy = false;
    }
  }

  // ---------- 세계지도 (Classimal World) ----------
  function worldView() {
    return `
      <div class="world-page">
        <div class="world-head">
          <div>
            <h1 class="page-title">🌍 우리 반 세계지도</h1>
            <p class="page-sub">지구본을 돌리거나 평면 세계지도로 바꿔 21개 도시를 찾아보세요. 나라 위에 마우스를 올리면 나라 이름이 나와요!</p>
          </div>
        </div>
        <div class="world-layout">
          <div class="world-map-card"><div id="world-map"></div></div>
          <aside class="world-side" id="world-side" aria-label="도시 정보">${worldSideHTML()}</aside>
        </div>
      </div>`;
  }

  function selectedCity() {
    return cities().find((c) => c.id === selectedCityId) || homeCityOf(me.student) || cities()[0] || null;
  }

  function worldSideHTML() {
    const s = me.student;
    const a = animalOf(s);
    const list = cities();
    const mineCount = list.filter((c) => cityKind(c, s.id) === 'mine').length;
    const sel = selectedCity();
    const shown = list.filter((c) => inContinent(c, continentFilter));
    return `
      <section class="ws-card ws-me" aria-label="나의 수호동물">
        <span class="ws-me-emoji" aria-hidden="true">${a.emoji}</span>
        <div>
          <div class="ws-me-name">${esc(a.name)}<small>${esc(s.name)}</small></div>
          <div class="ws-me-title">${esc(a.title || '')}</div>
        </div>
        <div class="ws-stats">
          <div class="ws-stat"><b>${mineCount}/${list.length}</b><small>개척 도시</small></div>
          <div class="ws-stat"><b>${fmt(s.claimedTiles ?? 6)}</b><small>영토 칸</small></div>
          <div class="ws-stat"><b>${fmt(s.energy ?? 0)}⚡</b><small>에너지</small></div>
          <div class="ws-stat"><b class="gold">${fmt(s.balance)}</b><small>${cur()}</small></div>
        </div>
      </section>
      ${growthCardHTML(true)}
      ${sel ? cityCardHTML(sel) : ''}
      <section class="ws-card ws-list" aria-label="도시 목록">
        <div class="ws-list-head"><h3>🏙️ 도시 둘러보기</h3><span>${shown.length}곳</span></div>
        <div class="ws-filters" role="group" aria-label="대륙 고르기">
          ${CONTINENT_FILTERS.map(([k, label]) => `<button type="button" class="ws-chip" data-cont="${k}" aria-pressed="${continentFilter === k}">${label}</button>`).join('')}
        </div>
        <ul class="ws-cities">
          ${shown.map((c) => {
            const kind = cityKind(c, s.id);
            const n = (c.residents || []).length;
            return `
              <li><button type="button" class="ws-row" data-city="${esc(c.id)}" aria-current="${sel && sel.id === c.id}">
                <span class="ws-row-emoji" aria-hidden="true">${c.emoji || '🏛️'}</span>
                <span class="ws-row-main"><b>${esc(c.name)}</b><small>${esc(c.country)} · ${esc(c.landmark)}</small></span>
                <span class="ws-row-side">${n ? `🐾 ${n}` : ''}<i class="ws-row-dot k-${kind}" title="${KIND_LABEL[kind]}"></i></span>
              </button></li>`;
          }).join('')}
        </ul>
      </section>`;
  }

  function cityCardHTML(c) {
    const s = me.student;
    const kind = cityKind(c, s.id);
    const res = c.residents || [];
    const color = /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#6366f1';
    return `
      <section class="ws-card ws-city" aria-label="${esc(c.name)} 정보" style="--city-soft:${color}55;--city-line:${color}99">
        <div class="ws-city-head">
          <span class="ws-city-emoji" aria-hidden="true">${c.emoji || '🏛️'}</span>
          <div class="ws-city-title"><h2>${esc(c.name)}</h2><small>${esc(c.country)} · ${CONTINENT_NAMES[c.continent] || ''}</small></div>
          <span class="status-pill k-${kind}">${KIND_LABEL[kind]}</span>
        </div>
        <p class="ws-tagline">“${esc(c.tagline)}”</p>
        <div class="ws-landmark"><span aria-hidden="true">🏛️</span><div><b>${esc(c.landmark)}</b><p>${esc(c.landmarkDesc)}</p></div></div>
        <div class="ws-coord">📍 ${coordText(c)}</div>
        ${res.length ? `
          <div class="ws-res">
            <span class="ws-res-label">사는 동물</span>
            ${res.slice(0, 7).map((r) => `<span class="res-chip ${r.id === s.id ? 'me' : ''}" title="${esc(r.animal?.name || '동물 친구')}">${r.animal?.emoji || '🐾'}</span>`).join('')}
            ${res.length > 7 ? `<span class="res-more">+${res.length - 7}</span>` : ''}
          </div>` : ''}
        <div class="ws-actions">
          <button type="button" class="btn btn-primary btn-sm" data-act="detail">🔍 자세히 보기</button>
          ${kind === 'mine'
            ? '<span class="ws-owned">🚩 내 영토예요</span>'
            : `<button type="button" class="btn btn-gold btn-sm" data-act="claim">🚩 ${fmt(s.nextTerritoryCost)} ${cur()}로 1칸 개척</button>`}
        </div>
      </section>`;
  }

  function renderSide() {
    const side = $('#world-side');
    if (!side) return;
    const active = document.activeElement;
    const focusKey = active && side.contains(active)
      ? (active.dataset.city ? `[data-city="${active.dataset.city}"]` : active.dataset.cont ? `[data-cont="${active.dataset.cont}"]` : null)
      : null;
    const top = side.scrollTop;
    side.innerHTML = worldSideHTML();
    bindEconomy();
    side.scrollTop = top;
    if (focusKey) side.querySelector(focusKey)?.focus();
  }

  function openDetail(c) {
    openCityModal(c, {
      currentStudent: me.student,
      currencyName: me.settings.currencyName,
      claimCost: me.student.nextTerritoryCost,
      onClaimCity: handleClaimCity,
    });
  }

  function bindWorld() {
    const s = me.student;
    const home = homeCityOf(s);
    if (!cities().some((c) => c.id === selectedCityId)) selectedCityId = home ? home.id : null;
    const narrow = () => window.matchMedia('(max-width: 1060px)').matches;
    worldMap = createWorldMap($('#world-map'), {
      cities: cities(),
      currentStudentId: s.id,
      homeCityId: home?.id || null,
      modeKey: 'cw_map_mode_student',
      onSelectCity: (c) => {
        selectedCityId = c.id;
        renderSide();
        if (narrow()) openDetail(c); // 작은 화면에서는 정보 패널이 지도 아래에 있어 바로 상세창을 연다
      },
    });
    worldMap.select(selectedCityId, { fly: !!selectedCityId && selectedCityId !== home?.id });

    $('#world-side').addEventListener('click', (e) => {
      const chip = e.target.closest('[data-cont]');
      if (chip) {
        continentFilter = chip.dataset.cont;
        renderSide();
        return;
      }
      const row = e.target.closest('[data-city]');
      if (row) {
        selectedCityId = row.dataset.city;
        worldMap?.select(selectedCityId);
        renderSide();
        if (narrow()) $('.world-map-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const act = e.target.closest('[data-act]');
      const c = selectedCity();
      if (!act || !c) return;
      if (act.dataset.act === 'detail') openDetail(c);
      else if (act.dataset.act === 'claim') handleClaimCity(c);
    });
  }

  function mountHomeGlobe() {
    const el = $('#home-globe');
    if (!el) return;
    const s = me.student;
    const home = homeCityOf(s);
    worldMap = createWorldMap(el, {
      cities: cities(),
      currentStudentId: s.id,
      homeCityId: home?.id || null,
      compact: true,
      interactive: false,
      autoRotate: true,
      onClick: () => { location.hash = '#/student/world'; },
    });
  }

  // ---------- 상점 ----------
  function shopView() {
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">🛒 학급 상점</h1>
          <p class="page-sub">열심히 모은 ${cur()}으로 원하는 물건이나 쿠폰을 구매해요</p>
        </div>
        <div class="shop-balance-pill">
          <span>내 잔액</span>
          <b class="big-number gold">${fmt(me.student.balance)}</b>
          <span class="unit">${cur()}</span>
        </div>
      </div>

      <div class="shop-grid">
        ${items.length === 0 ? `<div class="empty card col-full"><span class="emo">📦</span>지금은 판매 중인 상품이 없어요.</div>` : ''}
        ${items.map((it) => {
          const afford = me.student.balance >= it.price;
          return `
            <article class="card item-card ${afford ? '' : 'cant-afford'}" id="item-${it.id}">
              <div class="item-head">
                <span class="item-emoji">${esc(it.emoji)}</span>
                <span class="badge ${it.type}">${it.type === 'coupon' ? '🎟️ 쿠폰' : '🎁 물건'}</span>
              </div>
              <h2 class="item-name">${esc(it.name)}</h2>
              <p class="item-desc">${esc(it.description || '선생님이 준비한 상품이에요.')}</p>
              <div class="item-foot">
                <div class="item-price"><b>${fmt(it.price)}</b><small>${cur()}</small></div>
                <button class="btn btn-gold buy-btn" data-id="${it.id}" ${afford ? '' : 'disabled'} id="buy-${it.id}">
                  ${afford ? '구매하기' : '잔액 부족'}
                </button>
              </div>
            </article>`;
        }).join('')}
      </div>`;
  }

  // ---------- 내 기록 ----------
  let historyTab = 'all';
  function historyView() {
    const list = historyTab === 'bought' ? me.purchases : me.transactions;
    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">📜 내 기록</h1>
          <p class="page-sub">내가 받고 쓴 화폐 내역과 구매한 쿠폰을 확인해요</p>
        </div>
      </div>

      <div class="tabs" role="tablist">
        <button class="tab ${historyTab === 'all' ? 'active' : ''}" data-tab="all">전체 거래 내역 (${me.transactions.length})</button>
        <button class="tab ${historyTab === 'bought' ? 'active' : ''}" data-tab="bought">내가 산 물건·쿠폰 (${me.purchases.length})</button>
      </div>

      <article class="card" style="margin-top:16px">${txList(list)}</article>`;
  }

  function txList(list) {
    if (!list.length) return `<div class="empty"><span class="emo">🌱</span>아직 기록이 없어요.</div>`;
    return `<div class="tx-list">${list.map((t) => {
      const plus = isPlus(t);
      return `
        <div class="tx-item">
          <span class="tx-icon ${t.type}">${t.type === 'buy' ? esc(t.itemEmoji || '🛍️') : TX_ICON[t.type] || '•'}</span>
          <div class="tx-main">
            <div class="tx-reason">${esc(t.reason)}</div>
            <div class="tx-meta">${fmtDate(t.createdAt)}</div>
          </div>
          <div class="tx-amount ${plus ? 'plus' : 'minus'}">${plus ? '+' : '−'}${fmt(t.amount)}
            <small>잔액 ${fmt(t.balanceAfter)}</small></div>
        </div>`;
    }).join('')}</div>`;
  }

  // ---------- 화면 그리기 & 바인딩 ----------
  function paint() {
    worldMap?.destroy();
    worldMap = null;

    const views = { shop: shopView, history: historyView, world: worldView, missions: missionsView, luck: luckView };
    app.innerHTML = shell((views[view] || homeView)());
    $('#btn-logout').onclick = logout;
    bindEconomy();

    if (view === 'home' || !views[view]) {
      const s = me.student;
      countUp($('#balance-num'), s.balance);
      requestAnimationFrame(() => setTimeout(() => {
        const f = $('#xp-fill'); if (f) f.style.width = `${(s.expInLevel / s.expToNext) * 100}%`;
      }, 80));
      bindTasks();
      bindGoal();
      $('#vote-banner')?.addEventListener('click', (e) => {
        e.preventDefault();
        $('#goal-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      mountHomeGlobe();
    }
    if (view === 'missions') {
      $$('[data-assignment-anchor]').forEach((button) => { button.onclick = (e) => { e.preventDefault(); $('#teacher-assignments')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }; });
      $$('[data-assignment]').forEach((button) => { button.onclick = () => {
        const assignment = (me.assignments || []).find((x) => x.id === button.dataset.assignment);
        if (assignment) openAssignment(assignment);
      }; });
      $$('[data-assignment-pdf]').forEach((button) => { button.onclick = async () => {
        const assignment = (me.assignments || []).find((x) => x.id === button.dataset.assignmentPdf);
        if (!assignment) return;
        try { await openAssignmentPdf(assignment); } catch (e) { toast(e.message, 'error'); }
      }; });
      $$('[data-mission]').forEach((b) => (b.onclick = () => {
        const m = missions().find((x) => x.id === b.dataset.mission);
        if (m) submitMission(m);
      }));
    }
    if (view === 'luck') {
      $$('.luck-pick').forEach((b) => (b.onclick = () => playLuck(b.dataset.pick)));
    }
    if (view === 'world') {
      bindWorld();
    }
    if (view === 'shop') {
      $$('.buy-btn').forEach((b) => (b.onclick = (e) => buy(b.dataset.id, e)));
    }
    if (view === 'history') {
      $$('.tab').forEach((t) => (t.onclick = () => { historyTab = t.dataset.tab; paint(); }));
    }
    lastBalance = me.student.balance;
  }

  function bindGoal() {
    $$('#goal-card [data-vote]').forEach((b) => (b.onclick = async () => {
      try {
        const r = await api('/student/vote', { method: 'POST', body: { choice: b.dataset.vote } });
        me.classGoal = r.classGoal;
        toast(b.dataset.vote === 'yes' ? '찬성에 투표했어요 👍' : '반대에 투표했어요 👎');
        $('#goal-card').innerHTML = goalCardHTML();
        const banner = $('#vote-banner');
        if (banner) banner.innerHTML = voteBannerInner();
        bindGoal();
      } catch (e) {
        toast(e.message, 'error');
      }
    }));
  }

  /** 세계지도 화면은 지도를 새로 만들지 않고 마커와 정보 패널만 바꾼다 */
  function refreshWorldInPlace() {
    worldMap?.setCities(cities());
    renderSide();
    lastBalance = me.student.balance;
  }

  // 도시 탐험 및 개척 처리
  async function handleClaimCity(city) {
    const s = me.student;
    const claimCost = s.nextTerritoryCost;
    const cn = me.settings.currencyName;
    if (s.balance < claimCost) {
      toast(`${cn}이(가) ${fmt(claimCost - s.balance)}만큼 더 필요해요. (개척 비용 ${fmt(claimCost)} ${cn})`, 'error');
      return;
    }
    const ok = await confirmModal({
      emoji: '🚩',
      title: `${city.name} 영토 개척`,
      html: `<b>${esc(city.name)} (${esc(city.country)})</b>에 깃발을 꽂을까요?<br>
             <span class="gold">필요한 ${cur()}: ${fmt(claimCost)}</span> (지금 ${fmt(s.balance)} ${cur()})<br>
             <span class="muted">영토 1칸이 늘어나고 세계지도에 내 깃발이 빛나요!</span>`,
      okText: '개척하기!',
      okClass: 'btn-gold',
    });
    if (!ok) return;

    try {
      const res = await api('/student/claim-city', { method: 'POST', body: { cityId: city.id } });
      coinBurst(innerWidth / 2, innerHeight / 2, 18, '🚩');
      toast(res.message || `${city.name}에 깃발을 꽂았어요! 🚩`);
      me = await api('/student/me');
      worldData = await api('/world/cities');
      selectedCityId = city.id;
      if (view === 'world' && worldMap) {
        refreshWorldInPlace();
        worldMap.select(city.id, { fly: false });
      } else paint();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function bindTasks() {
    const s = me.student;
    const key = `cm_tasks_${s.id}_${todayKey()}`;
    const btn = $('#role-mission-btn');
    if (btn) btn.onclick = () => { const m = roleMission(); if (m) submitMission(m); };
    $$('.task-item').forEach((el) => {
      const toggle = () => {
        const done = new Set(JSON.parse(localStorage.getItem(key) || '[]'));
        const i = Number(el.dataset.i);
        done.has(i) ? done.delete(i) : done.add(i);
        localStorage.setItem(key, JSON.stringify([...done]));
        el.classList.toggle('done', done.has(i));
        el.setAttribute('aria-checked', done.has(i));
        const prog = $('#task-progress');
        if (prog) prog.textContent = `${done.size} / ${me.role.tasks.length} 완료`;
        const all = done.size === me.role.tasks.length;
        if (btn) btn.disabled = !all;
        if (done.has(i) && all) toast('오늘 할 일을 모두 끝냈어요! 1인 1역 미션을 신청해 보세요 🌟');
      };
      el.onclick = toggle;
      el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } };
    });
  }

  async function buy(id, ev) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const after = me.student.balance - it.price;
    const ok = await confirmModal({
      emoji: it.emoji,
      title: '구매할까요?',
      html: `<b>${esc(it.name)}</b>을(를) <b class="gold">${fmt(it.price)} ${cur()}</b>에 살까요?<br>
             <span class="muted">구매 후 잔액: ${fmt(after)} ${cur()}</span>`,
      okText: '살게요!',
      okClass: 'btn-gold',
    });
    if (!ok) return;
    try {
      await api('/student/buy', { method: 'POST', body: { itemId: id } });
      coinBurst(ev.clientX || innerWidth / 2, ev.clientY || innerHeight / 2, 12, it.emoji);
      toast(`${it.name} 구매 완료! 🎉`);
      me = await api('/student/me');
      paint();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function checkLevelUp() {
    const s = me.student;
    const key = `cm_lv_${s.id}`;
    const prev = Number(localStorage.getItem(key) || 0);
    if (prev && s.level > prev) setTimeout(() => celebrateLevelUp(s.level), 400);
    localStorage.setItem(key, s.level);
  }

  // 학급 화폐 합계는 친구들이 받을 때마다 바뀌므로, 화면 전체가 아니라 저금통 카드만 다시 그린다
  function signature(d) {
    const v = d.classGoal?.vote;
    return JSON.stringify([d.student, d.role, d.transactions.length, d.settings, d.missions,
      (d.mySubmissions || []).map((x) => x.id + x.status), d.assignments,
      (d.myAssignmentSubmissions || []).map((x) => x.id + x.status), d.taxInfo,
      d.classGoal?.ready, v && [v.status, v.myVote], d.luck?.enabled]);
  }
  function goalSignature(d) {
    const g = d.classGoal || {};
    return JSON.stringify([g.total, g.goal, g.vote && [g.vote.yes, g.vote.no, g.vote.status]]);
  }
  function worldSignature(d) {
    return JSON.stringify((d?.cities || []).map((c) => [c.id, (c.residents || []).map((r) => `${r.id}:${r.level}:${r.animal?.emoji}`)]));
  }

  // 새로 받은 화폐 알림
  if (lastBalance !== null && me.student.balance > lastBalance) {
    toast(`${fmt(me.student.balance - lastBalance)} ${me.settings.currencyName}을 받았어요!`);
  }
  paint();
  checkLevelUp();

  // 10초마다 새 정보 동기화 (세계지도에서는 친구들이 새로 개척한 도시도 바로 보여 준다)
  timer = setInterval(async () => {
    if (document.hidden || $('.modal-backdrop') || luckBusy || economyBusy) return;
    try {
      const fresh = await api('/student/me');
      const freshWorld = view === 'world' ? await api('/world/cities') : null;
      const meChanged = signature(fresh) !== signature(me);
      const goalChanged = goalSignature(fresh) !== goalSignature(me);
      const worldChanged = !!freshWorld && worldSignature(freshWorld) !== worldSignature(worldData);
      if (!meChanged && !goalChanged && !worldChanged) return;
      const gained = fresh.student.balance - me.student.balance;
      me = fresh;
      if (freshWorld) worldData = freshWorld;
      if (gained > 0) toast(`${fmt(gained)} ${me.settings.currencyName}을 받았어요! 🎉`);
      if (!meChanged && !worldChanged) {
        const card = $('#goal-card');
        if (card) { card.innerHTML = goalCardHTML(); bindGoal(); }
        return;
      }
      if (view === 'world' && worldMap) {
        refreshWorldInPlace();
      } else {
        if (view === 'shop') items = (await api('/student/shop')).items;
        if (view === 'home') worldData = await api('/world/cities');
        paint();
      }
      checkLevelUp();
    } catch { /* 주기적 갱신 실패는 무시 */ }
  }, 10000);

  return () => {
    clearInterval(timer);
    worldMap?.destroy();
    worldMap = null;
  };
}
