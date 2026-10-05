// ==========================================================
// 학생 화면: 메인(잔액·레벨·수호동물) / 3D 월드 / 상점 / 내 기록
// ==========================================================
import {
  $, $$, esc, fmt, fmtDate, todayKey, todayLabel, api, session, logout, toast,
  avatar, confirmModal, countUp, coinBurst, celebrateLevelUp, loadingHTML,
} from './core.js';
import { ClassimalGlobe3D, openCityModal } from './world3d.js';

const TX_ICON = { give: '🎁', take: '⚠️', buy: '🛍️' };

let lastBalance = null; // 새로 받은 화폐 알림용
let globeInstance = null; // 3D 지구본 인스턴스

export async function renderStudent(app, view) {
  app.innerHTML = loadingHTML();
  let me = await api('/student/me');
  let items = view === 'shop' ? (await api('/student/shop')).items : [];
  let worldData = (view === 'world' || view === 'home') ? (await api('/world/cities')) : null;
  let timer = null;
  let continentFilter = 'all';

  const cur = () => esc(me.settings.currencyName);

  function shell(content) {
    const s = me.student;
    const a = s.animal || { name: '모리', emoji: '🦊', title: '숲의 수호자' };
    const nav = [
      ['home', '🏠', '메인', '#/student'],
      ['world', '🌐', '3D 월드', '#/student/world'],
      ['shop', '🛒', '상점', '#/student/shop'],
      ['history', '📜', '내 기록', '#/student/history'],
    ];
    return `
      <header class="topbar">
        <div class="container topbar-inner">
          <div class="brand">
            <span class="brand-logo">🪙</span>
            <div>학급경제 & 3D 월드<small>${esc(me.settings.className)}</small></div>
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

  // ---------- 메인 ----------
  function homeView() {
    const s = me.student;
    const a = s.animal || { name: '모리', species: '여우', emoji: '🦊', title: '숲의 수호자', friends: ['토끼 토리', '곰 밤이'] };
    const pct = Math.round((s.expInLevel / s.expToNext) * 100);
    const role = me.role;
    const doneKey = `cm_tasks_${s.id}_${todayKey()}`;
    const done = new Set(JSON.parse(localStorage.getItem(doneKey) || '[]'));
    const recent = me.transactions.slice(0, 5);
    const claimedCount = (s.claimedCities || [s.homeCity || 'seoul']).length;

    return `
      <div class="page-head">
        <div>
          <h1 class="page-title">안녕, ${esc(s.name)}! 👋</h1>
          <p class="page-sub">${todayLabel()} · 수호동물 <b>${a.emoji} ${esc(a.name)}</b>와 함께하는 즐거운 하루</p>
        </div>
        <div class="head-actions">
          <a class="btn btn-primary" href="#/student/world">🌐 3D 세계지도 탐험하기</a>
        </div>
      </div>

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

        <article class="card animal-hero-card" aria-label="수호동물과 탐험">
          <div class="card-head">
            <span class="card-label">🐾 나의 수호동물</span>
            <span class="badge success">🚩 개척 도시 ${claimedCount}곳</span>
          </div>
          <div class="animal-hero-content">
            <div class="animal-big-emoji">${a.emoji}</div>
            <div class="animal-details">
              <div class="animal-name">${esc(a.name)} <small class="muted">(${esc(a.species)})</small></div>
              <div class="animal-title gold">${esc(a.title)}</div>
              <div class="animal-sub muted" style="margin-top:4px">점유 영토: <b>${s.claimedTiles || 6}칸</b> · 탐험 에너지: <b>${s.energy ?? 2}⚡</b></div>
              <div class="animal-sub muted" style="font-size:12px;margin-top:2px">함께 지내는 친구: ${esc((a.friends || []).join(', '))}</div>
            </div>
          </div>
          <div style="margin-top:14px">
            <a class="btn btn-outline-cyan w-full" href="#/student/world">🌐 세계지도로 이동하기</a>
          </div>
        </article>
      </section>

      <section class="grid-2">
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
            <p class="hint" style="margin-top:12px">💡 다 한 일은 눌러서 스스로 체크해 보세요.</p>
          ` : `<div class="empty"><span class="emo">🧩</span>아직 맡은 역할이 없어요.<br>선생님이 곧 정해 주실 거예요!</div>`}
        </article>

        <article class="card" aria-label="최근 활동">
          <div class="card-head">
            <h2 class="card-title">🕒 최근 활동</h2>
            <a class="btn btn-ghost btn-sm" href="#/student/history" id="see-all">전체 보기 →</a>
          </div>
          ${txList(recent)}
        </article>
      </section>`;
  }

  // ---------- 3D 월드 (Classimal World) ----------
  function worldView() {
    const s = me.student;
    const a = s.animal || { name: '모리', emoji: '🦊', title: '숲의 수호자' };
    const cities = worldData ? worldData.cities : [];
    const myHomeCity = cities.find(c => c.id === (s.homeCity || 'seoul')) || cities[0];

    const filteredCities = (continentFilter === 'all') 
      ? cities 
      : cities.filter(c => c.continent === continentFilter || (continentFilter === 'europe' && c.id === 'istanbul') || (continentFilter === 'asia' && c.id === 'istanbul'));

    return `
      <div class="world-page-container">
        <div class="world-topbar-card">
          <div class="world-title-box">
            <h1 class="world-title">🌐 Classimal World — 3D 세계지도</h1>
            <p class="world-sub">마우스나 터치로 지구본을 360° 돌려보고, 21개 글로벌 도시의 랜드마크와 동물 친구들을 만나보세요!</p>
          </div>
          <div class="world-legend">
            <span class="legend-item"><span class="dot mine"></span> 내 영토 (초록색)</span>
            <span class="legend-item"><span class="dot friend"></span> 친구의 영토 (보라색)</span>
            <span class="legend-item"><span class="dot empty"></span> 미개척 탐험지 (골드)</span>
          </div>
        </div>

        <!-- 3D 뷰포트 영역 -->
        <div class="globe-viewport-wrapper">
          <canvas id="world-globe-canvas" class="globe-canvas"></canvas>

          <!-- 온스크린 조작 버튼 -->
          <div class="globe-controls">
            <button class="globe-ctrl-btn" id="ctrl-home" title="내 시작 도시로 이동">🏠 내 땅으로</button>
            <button class="globe-ctrl-btn" id="ctrl-reset" title="지구 전체 보기">🌍 전체 보기</button>
            <div class="globe-zoom-group">
              <button class="globe-ctrl-btn circle" id="ctrl-zoom-in" title="확대">+</button>
              <button class="globe-ctrl-btn circle" id="ctrl-zoom-out" title="축소">−</button>
            </div>
            <div class="globe-rotate-group">
              <button class="globe-ctrl-btn circle" id="ctrl-rot-left" title="서쪽 회전">◀</button>
              <button class="globe-ctrl-btn circle" id="ctrl-rot-right" title="동쪽 회전">▶</button>
            </div>
          </div>

          <!-- 내 상태 플로팅 칩 -->
          <div class="globe-student-chip">
            <span class="chip-avatar">${a.emoji}</span>
            <div>
              <div class="chip-name">${esc(s.name)} · ${esc(a.name)}</div>
              <div class="chip-sub">홈: ${esc(myHomeCity ? myHomeCity.name : '서울')} · 잔액: <b class="gold">${fmt(s.balance)} ${cur()}</b></div>
            </div>
          </div>
        </div>

        <!-- 대륙 필터 바 -->
        <div class="continent-filter-bar">
          <span class="filter-label">대륙 선택:</span>
          ${[
            ['all', '전체 (21)'],
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

        <!-- 21개 도시 캐러셀 카드 목록 -->
        <section class="cities-carousel-section">
          <div class="section-head-compact">
            <h3>🏙️ 21개 도시 둘러보기 <small class="muted">(카드를 누르면 지구본이 회전해요)</small></h3>
          </div>
          <div class="cities-carousel">
            ${filteredCities.map(c => {
              const isMine = c.residents && c.residents.some(r => r.id === s.id);
              const hasFriend = c.residents && c.residents.length > 0;
              return `
                <div class="city-card-item ${isMine ? 'mine' : (hasFriend ? 'friend' : 'empty')}" data-city-id="${c.id}">
                  <div class="city-card-icon">${c.emoji || '🏛️'}</div>
                  <div class="city-card-info">
                    <div class="city-card-name">${esc(c.name)} <small>${esc(c.country)}</small></div>
                    <div class="city-card-landmark muted">${esc(c.landmark)}</div>
                    <div class="city-card-residents">
                      ${isMine ? `<span class="badge success">🚩 내 영토</span>` : (hasFriend ? `<span class="badge badge-friend">👥 친구 ${c.residents.length}명</span>` : `<span class="badge badge-gold">✨ 미개척</span>`)}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </section>
      </div>
    `;
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
                  ${afford ? '구매하기' : `${cur()} 부족`}
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
      const plus = t.type === 'give';
      return `
        <div class="tx-item">
          <span class="tx-icon ${t.type}">${t.type === 'buy' ? esc(t.itemEmoji || '🛍️') : TX_ICON[t.type]}</span>
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
    if (globeInstance) {
      globeInstance.stop();
      globeInstance = null;
    }

    const content = view === 'shop' 
      ? shopView() 
      : view === 'history' 
        ? historyView() 
        : view === 'world' 
          ? worldView() 
          : homeView();

    app.innerHTML = shell(content);
    $('#btn-logout').onclick = logout;

    if (view === 'home') {
      const s = me.student;
      countUp($('#balance-num'), s.balance);
      requestAnimationFrame(() => setTimeout(() => {
        const f = $('#xp-fill'); if (f) f.style.width = `${(s.expInLevel / s.expToNext) * 100}%`;
      }, 80));
      bindTasks();
    }
    if (view === 'world') {
      bindWorldEvents();
    }
    if (view === 'shop') {
      $$('.buy-btn').forEach((b) => (b.onclick = (e) => buy(b.dataset.id, e)));
    }
    if (view === 'history') {
      $$('.tab').forEach((t) => (t.onclick = () => { historyTab = t.dataset.tab; paint(); }));
    }
    lastBalance = me.student.balance;
  }

  // 3D 지구본 이벤트 바인딩
  function bindWorldEvents() {
    const canvas = $('#world-globe-canvas');
    if (!canvas) return;

    globeInstance = new ClassimalGlobe3D(canvas, {
      currentStudentId: me.student.id,
      isTeacher: false,
      onSelectCity: (city) => {
        openCityModal(city, {
          currentStudent: me.student,
          isTeacher: false,
          onClaimCity: handleClaimCity
        });
      }
    });

    if (worldData && worldData.cities) {
      globeInstance.setCities(worldData.cities);
    }

    // 온스크린 컨트롤
    const s = me.student;
    const cities = worldData ? worldData.cities : [];
    const myHome = cities.find(c => c.id === (s.homeCity || 'seoul')) || cities[0];

    $('#ctrl-home').onclick = () => {
      if (myHome) {
        globeInstance.rotateTo(myHome.lat, myHome.lon, 1.35);
        toast(`내 시작 도시 [${myHome.name}]로 이동했어요!`);
      }
    };
    $('#ctrl-reset').onclick = () => {
      globeInstance.targetRotX = -0.35;
      globeInstance.targetRotY = -2.25;
      globeInstance.targetZoom = 1.0;
    };
    $('#ctrl-zoom-in').onclick = () => {
      globeInstance.targetZoom = Math.min(2.2, globeInstance.targetZoom + 0.2);
    };
    $('#ctrl-zoom-out').onclick = () => {
      globeInstance.targetZoom = Math.max(0.65, globeInstance.targetZoom - 0.2);
    };
    $('#ctrl-rot-left').onclick = () => {
      globeInstance.targetRotY += 0.35;
    };
    $('#ctrl-rot-right').onclick = () => {
      globeInstance.targetRotY -= 0.35;
    };

    // 대륙 필터
    $$('.filter-chip').forEach(btn => {
      btn.onclick = () => {
        continentFilter = btn.dataset.cont;
        paint();
      };
    });

    // 도시 캐러셀 아이템 클릭 시 지구본 회전 & 모달
    $$('.city-card-item').forEach(card => {
      card.onclick = () => {
        const cId = card.dataset.cityId;
        const targetCity = cities.find(c => c.id === cId);
        if (targetCity) {
          globeInstance.selectCity(targetCity);
          openCityModal(targetCity, {
            currentStudent: me.student,
            isTeacher: false,
            onClaimCity: handleClaimCity
          });
        }
      };
    });
  }

  // 도시 탐험 및 개척 처리
  async function handleClaimCity(city) {
    const s = me.student;
    const ok = await confirmModal({
      emoji: '🚩',
      title: `${city.name} 영토 개척`,
      html: `<b>${esc(city.name)} (${esc(city.country)})</b>을(를) 탐험하고 깃발을 꽂을까요?<br>
             <span class="gold">필요 화폐: 30 ${cur()}</span> (보유: ${fmt(s.balance)} ${cur()})<br>
             <span class="muted">영토 4칸이 추가되고 3D 세계지도에 내 깃발이 빛나요!</span>`,
      okText: '개척하기!',
      okClass: 'btn-gold'
    });
    if (!ok) return;

    try {
      const res = await api('/student/claim-city', {
        method: 'POST',
        body: { cityId: city.id }
      });
      coinBurst(innerWidth / 2, innerHeight / 2, 20, '🚩');
      toast(res.message);
      me = await api('/student/me');
      worldData = await api('/world/cities');
      paint();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function bindTasks() {
    const s = me.student;
    const key = `cm_tasks_${s.id}_${todayKey()}`;
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
        if (done.has(i) && done.size === me.role.tasks.length) toast('오늘 할 일을 모두 끝냈어요! 최고예요 🌟');
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

  function signature(d) {
    return JSON.stringify([d.student, d.role, d.transactions.length, d.settings]);
  }

  // 새로 받은 화폐 알림
  if (lastBalance !== null && me.student.balance > lastBalance) {
    toast(`${fmt(me.student.balance - lastBalance)} ${me.settings.currencyName}을 받았어요!`);
  }
  paint();
  checkLevelUp();

  // 10초마다 새 정보 동기화
  timer = setInterval(async () => {
    if (document.hidden || $('.modal-backdrop')) return;
    try {
      const fresh = await api('/student/me');
      if (signature(fresh) !== signature(me)) {
        const gained = fresh.student.balance - me.student.balance;
        me = fresh;
        if (view === 'shop') items = (await api('/student/shop')).items;
        if (view === 'world') worldData = await api('/world/cities');
        if (gained > 0) toast(`${fmt(gained)} ${me.settings.currencyName}을 받았어요! 🎉`);
        paint();
        checkLevelUp();
      }
    } catch { /* 주기적 갱신 실패는 무시 */ }
  }, 10000);

  return () => {
    clearInterval(timer);
    if (globeInstance) globeInstance.stop();
  };
}
