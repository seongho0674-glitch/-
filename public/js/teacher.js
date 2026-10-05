// ==========================================================
// 교사 화면: 학생(메인) / 3D 월드 현황 / 거래 내역 / 상점 관리 / 역할 관리 / 설정
// ==========================================================
import {
  $, $$, esc, fmt, fmtDate, todayKey, todayLabel, api, session, logout, toast, avatar,
  openModal, confirmModal, loadingHTML,
} from './core.js';
import { ClassimalGlobe3D, openCityModal } from './world3d.js';

const selected = new Set();   // 메인 화면에서 체크한 학생들 (화면을 옮겨도 유지)
let flashIds = [];            // 방금 지급·차감한 학생 줄 반짝이기
let teacherGlobeInstance = null;

const GIVE_REASONS = ['발표 참여', '숙제 완료', '1인 1역 수행', '친구 돕기', '수업 태도 우수', '모둠 활동 우수', '일기 쓰기'];
const TAKE_REASONS = ['숙제 미제출', '수업 방해', '지각', '정리 정돈 안 함', '약속 어기기'];
const ITEM_EMOJI = ['🎁', '🎟️', '🪑', '🎵', '📝', '🍽️', '🧑‍🏫', '✏️', '🍬', '📒', '🎮', '⚽', '🖍️', '🧸', '🍫', '⏰', '📚', '🎨'];
const ROLE_EMOJI = ['⭐', '🧽', '💡', '🪟', '📚', '🗑️', '🪴', '📮', '🍚', '📅', '🧹', '💻', '🏦', '🔔', '🎵', '🧴', '📏', '🐟'];

export async function renderTeacher(app, view) {
  app.innerHTML = loadingHTML();
  let st = await api('/teacher/state');
  let txs = ['history', 'shop'].includes(view) ? (await api('/teacher/transactions')).transactions : [];
  let worldData = view === 'world' ? (await api('/teacher/world')) : null;
  const cur = () => esc(st.settings.currencyName);
  let timer = null;
  let continentFilter = 'all';

  async function refresh() {
    st = await api('/teacher/state');
    if (['history', 'shop'].includes(view)) txs = (await api('/teacher/transactions')).transactions;
    if (view === 'world') worldData = await api('/teacher/world');
    paint();
  }

  function shell(content) {
    const nav = [
      ['home', '👩‍🎓', '학생', '#/teacher'],
      ['world', '🌐', '3D 월드 현황', '#/teacher/world'],
      ['history', '📒', '거래 내역', '#/teacher/history'],
      ['shop', '🏪', '상점 관리', '#/teacher/shop'],
      ['roles', '🧩', '1인 1역', '#/teacher/roles'],
      ['settings', '⚙️', '설정', '#/teacher/settings'],
    ];
    return `
      <header class="topbar">
        <div class="container topbar-inner">
          <div class="brand"><span class="brand-logo">🪙</span><div>학급경제<small>${esc(st.settings.className)} · 교사</small></div></div>
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

      <section class="stats-grid" aria-label="오늘의 요약">
        <div class="stat s1"><div class="stat-label">👩‍🎓 학생 수</div><div class="stat-value">${studs.length}<small>명</small></div></div>
        <div class="stat s2"><div class="stat-label">💰 학급 전체 잔액</div><div class="stat-value">${fmt(total)}<small>${cur()}</small></div></div>
        <div class="stat s3"><div class="stat-label">🎁 오늘 지급 / 차감</div><div class="stat-value"><span class="plus">+${fmt(st.today?.given ?? 0)}</span> <small>/</small> <span class="minus" style="font-size:22px">−${fmt(st.today?.taken ?? 0)}</span></div></div>
        <div class="stat s4"><div class="stat-label">⭐ 평균 레벨 · 오늘 구매</div><div class="stat-value">Lv.${avgLv} <small>· ${st.today?.purchases ?? 0}건</small></div></div>
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
            <th style="width:44px"></th><th>번호</th><th>이름</th><th>잔액</th><th>레벨</th><th>1인 1역</th><th style="text-align:right">화폐 지급·차감</th>
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
                <td><div class="lv-cell"><span class="lv-pill">Lv.${s.level}</span><span class="mini-bar" title="${s.expInLevel}/${s.expToNext} XP"><i style="width:${pct}%"></i></span></div></td>
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
  }

  // ---------- 지급·차감 창 ----------
  function openPay(ids, type) {
    const targets = st.students.filter((s) => ids.includes(s.id));
    if (!targets.length) return toast('학생을 먼저 골라 주세요.', 'error');
    let kind = type;
    let amount = 10;

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
          const reasons = kind === 'give' ? GIVE_REASONS : TAKE_REASONS;
          $('#reason-chips', el).innerHTML = reasons.map((r) => `<button type="button" class="chip ${reasonEl.value === r ? 'on' : ''}">${r}</button>`).join('');
          $$('#reason-chips .chip', el).forEach((c) => (c.onclick = () => { reasonEl.value = c.textContent; draw(); }));
          $$('#amount-chips .chip', el).forEach((c) => c.classList.toggle('on', Number(c.dataset.n) === amount));
          const who = targets.length === 1 ? esc(targets[0].name) : `${targets.length}명`;
          submit.className = `btn ${kind === 'give' ? 'btn-give' : 'btn-danger'}`;
          submit.textContent = `${who}에게 ${fmt(amount || 0)} ${st.settings.currencyName} ${kind === 'give' ? '지급' : '차감'}하기`;
          submit.disabled = !(amount > 0) || !reasonEl.value.trim();
          $('#pay-hint', el).textContent = kind === 'give'
            ? `⭐ 지급하면 경험치도 ${fmt(amount || 0)} XP 함께 올라가요.`
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
            const r = await api('/teacher/pay', { method: 'POST', body: { studentIds: targets.map((s) => s.id), type: kind, amount, reason: reasonEl.value.trim() } });
            close();
            toast(`${targets.length}명에게 ${fmt(amount)} ${st.settings.currencyName} ${kind === 'give' ? '지급' : '차감'} 완료`);
            r.results.filter((x) => x.levelUp).forEach((x, i) => setTimeout(() => toast(`🎉 ${x.name} 레벨 ${x.level} 달성!`), 400 + i * 300));
            flashIds = targets.map((s) => s.id);
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
    const shown = list.slice(0, 500);
    const TYPE = { give: '지급', take: '차감', buy: '구매' };
    return `
      <div class="page-head">
        <div><h1 class="page-title">📒 거래 내역</h1><p class="page-sub">모든 지급·차감·구매 기록이에요</p></div>
      </div>
      <div class="filter-row">
        <select class="select" id="f-student" aria-label="학생 선택">
          <option value="">전체 학생</option>
          ${st.students.map((s) => `<option value="${esc(s.id)}" ${filt.student === s.id ? 'selected' : ''}>${s.number}. ${esc(s.name)}</option>`).join('')}
        </select>
        <select class="select" id="f-type" aria-label="종류 선택">
          <option value="">전체 종류</option>
          ${Object.entries(TYPE).map(([k, v]) => `<option value="${k}" ${filt.type === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <input class="input" type="date" id="f-date" value="${filt.date}" aria-label="날짜 선택">
        <button class="btn btn-sm" id="f-today">오늘</button>
        <button class="btn btn-ghost btn-sm" id="f-reset">초기화</button>
        <span class="spacer"></span>
        <span class="row muted" style="font-weight:700">${list.length}건 ·
          <span class="plus">지급 +${fmt(sum('give'))}</span> ·
          <span class="minus">차감 −${fmt(sum('take'))}</span> ·
          <span class="gold">구매 ${fmt(sum('buy'))}</span></span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>날짜·시간</th><th>학생</th><th>종류</th><th>사유</th><th style="text-align:right">금액</th><th style="text-align:right">거래 후 잔액</th></tr></thead>
          <tbody>
            ${shown.map((t) => `
              <tr>
                <td class="muted" style="white-space:nowrap">${fmtDate(t.createdAt)}</td>
                <td style="font-weight:700;white-space:nowrap">${esc(t.studentName)}</td>
                <td><span class="badge ${t.type}">${TYPE[t.type]}</span></td>
                <td>${esc(t.reason)}</td>
                <td style="text-align:right" class="bal-cell ${t.type === 'give' ? 'plus' : 'minus'}">${t.type === 'give' ? '+' : '−'}${fmt(t.amount)}</td>
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
        <div><h1 class="page-title">🧩 1인 1역</h1><p class="page-sub">역할을 만들고 학생에게 직접 배정해요 (학생 1명 = 역할 1개)</p></div>
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
            <button class="btn btn-primary" id="set-save">저장하기</button>
          </div>
        </section>
        <div class="stack">
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
      const body = { className: $('#set-class').value, currencyName: $('#set-currency').value, teacherPin: $('#set-pin').value.trim() };
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
        a.download = `학급경제_백업_${todayKey()}.json`;
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

  // ======================= 3D 월드 현황 =======================
  function worldView() {
    const cities = worldData ? worldData.cities : [];
    const totalClaimedCities = cities.filter(c => c.residents && c.residents.length > 0).length;
    const totalTiles = cities.reduce((acc, c) => acc + (c.totalTiles || 0), 0);
    const filteredCities = (continentFilter === 'all') 
      ? cities 
      : cities.filter(c => c.continent === continentFilter || (continentFilter === 'europe' && c.id === 'istanbul') || (continentFilter === 'asia' && c.id === 'istanbul'));

    return `
      <div class="world-page-container teacher-world">
        <div class="world-topbar-card">
          <div class="world-title-box">
            <h1 class="world-title">🌐 Classimal World — 우리 반 3D 월드 현황</h1>
            <p class="world-sub">교실 전자칠판/대형 화면에서 25명 학생들의 수호동물과 21개 도시 개척도를 한눈에 보고 보상을 지급하세요.</p>
          </div>
          <div class="teacher-world-stats">
            <div class="stat-pill"><small>개척된 도시</small><b>${totalClaimedCities} / 21곳</b></div>
            <div class="stat-pill"><small>총 점유 영토</small><b>${totalTiles}칸</b></div>
            <div class="stat-pill"><small>학급 학생 수</small><b>${st.students.length}명</b></div>
          </div>
        </div>

        <!-- 3D 뷰포트 영역 -->
        <div class="globe-viewport-wrapper">
          <canvas id="teacher-globe-canvas" class="globe-canvas"></canvas>

          <!-- 온스크린 조작 버튼 -->
          <div class="globe-controls">
            <button class="globe-ctrl-btn" id="t-ctrl-reset" title="지구 전체 보기">🌍 전체 보기</button>
            <div class="globe-zoom-group">
              <button class="globe-ctrl-btn circle" id="t-ctrl-zoom-in" title="확대">+</button>
              <button class="globe-ctrl-btn circle" id="t-ctrl-zoom-out" title="축소">−</button>
            </div>
            <div class="globe-rotate-group">
              <button class="globe-ctrl-btn circle" id="t-ctrl-rot-left" title="서쪽 회전">◀</button>
              <button class="globe-ctrl-btn circle" id="t-ctrl-rot-right" title="동쪽 회전">▶</button>
            </div>
          </div>

          <div class="world-legend teacher-legend">
            <span class="legend-item"><span class="dot mine"></span> 학생 거주/개척 도시 (초록/보라)</span>
            <span class="legend-item"><span class="dot empty"></span> 미개척 도시 (골드)</span>
          </div>
        </div>

        <!-- 대륙 필터 바 -->
        <div class="continent-filter-bar">
          <span class="filter-label">대륙 필터:</span>
          ${[
            ['all', '전체 도시 (21)'],
            ['asia', '아시아'],
            ['europe', '유럽'],
            ['americas', '아메리카'],
            ['africa', '아프리카'],
            ['oceania', '오세아니아'],
          ].map(([k, label]) => `
            <button class="filter-chip ${continentFilter === k ? 'active' : ''}" data-cont="${k}">
              ${label}
            </button>
          `).join('')}
        </div>

        <!-- 21개 도시 현황 및 즉시 보상 지급 카드 그리드 -->
        <section class="teacher-cities-section">
          <div class="section-head-compact">
            <h3>🏙️ 도시별 학생 분포 현황 및 즉시 보상 지급</h3>
          </div>
          <div class="teacher-cities-grid">
            ${filteredCities.map(c => {
              const res = c.residents || [];
              return `
                <div class="card teacher-city-card ${res.length ? 'occupied' : 'vacant'}" data-city-id="${c.id}">
                  <div class="t-city-head">
                    <span class="t-city-icon">${c.emoji || '🏛️'}</span>
                    <div>
                      <h4 class="t-city-name">${esc(c.name)} <small class="muted">${esc(c.country)}</small></h4>
                      <div class="t-city-landmark gold">${esc(c.landmark)}</div>
                    </div>
                    <span class="badge ${res.length ? 'success' : 'badge-gold'}">${res.length ? `${res.length}명 거주` : '미개척'}</span>
                  </div>

                  <div class="t-city-body">
                    ${res.length === 0 ? `<p class="muted" style="font-size:13px;margin:8px 0">아직 입주한 학생이 없습니다.</p>` : `
                      <ul class="t-resident-list">
                        ${res.map(r => `
                          <li class="t-res-row">
                            <span class="t-res-animal">${r.animal?.emoji || '🐾'}</span>
                            <span class="t-res-info">
                              <b>${esc(r.name)}</b> <small class="gold">Lv.${r.level} ${esc(r.animal?.name || '')}</small>
                            </span>
                            <button class="btn btn-primary btn-sm t-give-btn" data-student-id="${r.id}">
                              🎁 보상 지급
                            </button>
                          </li>
                        `).join('')}
                      </ul>
                    `}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      </div>
    `;
  }

  function bindWorld() {
    const canvas = $('#teacher-globe-canvas');
    if (!canvas) return;

    teacherGlobeInstance = new ClassimalGlobe3D(canvas, {
      currentStudentId: null,
      isTeacher: true,
      onSelectCity: (city) => {
        openCityModal(city, {
          currentStudent: null,
          isTeacher: true
        });
      }
    });

    if (worldData && worldData.cities) {
      teacherGlobeInstance.setCities(worldData.cities);
    }

    $('#t-ctrl-reset').onclick = () => {
      teacherGlobeInstance.targetRotX = -0.35;
      teacherGlobeInstance.targetRotY = -2.25;
      teacherGlobeInstance.targetZoom = 1.0;
    };
    $('#t-ctrl-zoom-in').onclick = () => {
      teacherGlobeInstance.targetZoom = Math.min(2.2, teacherGlobeInstance.targetZoom + 0.2);
    };
    $('#t-ctrl-zoom-out').onclick = () => {
      teacherGlobeInstance.targetZoom = Math.max(0.65, teacherGlobeInstance.targetZoom - 0.2);
    };
    $('#t-ctrl-rot-left').onclick = () => {
      teacherGlobeInstance.targetRotY += 0.35;
    };
    $('#t-ctrl-rot-right').onclick = () => {
      teacherGlobeInstance.targetRotY -= 0.35;
    };

    // 대륙 필터
    $$('.filter-chip').forEach(btn => {
      btn.onclick = () => {
        continentFilter = btn.dataset.cont;
        paint();
      };
    });

    // 즉시 보상 지급 버튼
    $$('.t-give-btn').forEach(btn => {
      btn.onclick = () => {
        const sId = btn.dataset.studentId;
        openPay([sId], 'give');
      };
    });
  }

  // ======================= 그리기 =======================
  function paint() {
    if (teacherGlobeInstance) {
      teacherGlobeInstance.stop();
      teacherGlobeInstance = null;
    }
    const views = { 
      home: homeView, 
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
      world: bindWorld, 
      history: bindHistory, 
      shop: bindShop, 
      roles: bindRoles, 
      settings: bindSettings 
    }[view] || bindHome)();
  }

  paint();

  // 학생 구매가 바로 보이도록 30초마다 갱신 (창이 열려 있거나 입력 중이면 건너뜀)
  timer = setInterval(async () => {
    if (document.hidden || $('.modal-backdrop') || view === 'settings') return;
    if (document.activeElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
    try { await refresh(); } catch { /* 다음에 다시 */ }
  }, 30000);
  return () => {
    clearInterval(timer);
    if (teacherGlobeInstance) teacherGlobeInstance.stop();
  };
}
