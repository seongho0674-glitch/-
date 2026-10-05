// ==========================================================
// Classimal World 3D 지구본 엔진 (HTML5 Canvas 3D Projection)
// - 21개 도시 마커, 대륙 지형 투영, 회전/줌 조작, 랜드마크 상세창
// ==========================================================
import { $, $$, esc, fmt, api, toast, confirmModal, avatar } from './core.js';

// 간소화된 대륙 지형 다각형 좌표 (경도 lon, 위도 lat)
const CONTINENT_POLYGONS = [
  // 유라시아 & 아프리카
  [[ -9, 36 ], [ -5, 43 ], [ 2, 51 ], [ 10, 54 ], [ 30, 70 ], [ 60, 70 ], [ 100, 75 ], [ 170, 66 ], [ 140, 50 ], [ 130, 32 ], [ 105, 20 ], [ 80, 15 ], [ 70, 24 ], [ 50, 28 ], [ 35, 31 ], [ 26, 40 ], [ 15, 38 ], [ -5, 36 ]],
  // 아프리카
  [[ -17, 15 ], [ -5, 36 ], [ 12, 37 ], [ 32, 31 ], [ 43, 12 ], [ 51, 10 ], [ 40, -10 ], [ 32, -28 ], [ 18, -34 ], [ 12, -18 ], [ 9, 4 ], [ -17, 15 ]],
  // 북아메리카
  [[ -168, 65 ], [ -140, 70 ], [ -90, 73 ], [ -60, 60 ], [ -65, 45 ], [ -75, 35 ], [ -80, 25 ], [ -97, 18 ], [ -105, 23 ], [ -120, 34 ], [ -125, 48 ], [ -160, 55 ], [ -168, 65 ]],
  // 남아메리카
  [[ -78, 10 ], [ -60, 8 ], [ -35, -5 ], [ -38, -13 ], [ -40, -22 ], [ -52, -33 ], [ -65, -55 ], [ -75, -50 ], [ -75, -15 ], [ -81, -5 ], [ -78, 10 ]],
  // 오스트레일리아
  [[ 114, -22 ], [ 125, -15 ], [ 142, -11 ], [ 153, -28 ], [ 150, -37 ], [ 138, -35 ], [ 115, -34 ], [ 114, -22 ]],
  // 한반도 & 일본 열도 강조
  [[ 124, 40 ], [ 130, 42 ], [ 130, 35 ], [ 126, 34 ], [ 124, 38 ]],
  [[ 131, 33 ], [ 141, 43 ], [ 143, 40 ], [ 136, 34 ], [ 131, 33 ]],
  // 영국 섬
  [[ -5, 50 ], [ -1, 58 ], [ 1, 52 ], [ -5, 50 ]]
];

export class ClassimalGlobe3D {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.options = options; // { onSelectCity, currentStudentId, isTeacher }
    this.cities = [];
    
    // 시점 및 회전 각도 (라디안)
    // 서울(경도 127, 위도 37.5) 중심 초기값
    this.rotX = -0.35; // 위도 회전 (위아래)
    this.rotY = -2.25; // 경도 회전 (좌우)
    this.targetRotX = this.rotX;
    this.targetRotY = this.rotY;
    
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.radius = 160;
    
    this.isDragging = false;
    this.lastMousePos = { x: 0, y: 0 };
    this.hoveredCity = null;
    this.selectedCity = null;
    this.animId = null;
    this.pulsePhase = 0;
    
    // 별무리 배경 데이터 생성
    this.stars = Array.from({ length: 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.5 + 0.5,
      alpha: Math.random() * 0.7 + 0.3,
      speed: Math.random() * 0.02 + 0.005
    }));

    this.initEvents();
    this.resize();
    this.startLoop();
  }

  setCities(cities) {
    this.cities = cities;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width || 600;
    this.height = rect.height || 420;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.radius = Math.min(this.width, this.height) * 0.38;
  }

  initEvents() {
    const c = this.canvas;
    
    // 마우스 드래그
    c.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.lastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    window.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMousePos.x;
        const dy = e.clientY - this.lastMousePos.y;
        this.targetRotY += dx * 0.007;
        this.targetRotX = Math.max(-1.3, Math.min(1.3, this.targetRotX + dy * 0.007));
        this.lastMousePos = { x: e.clientX, y: e.clientY };
      } else {
        const rect = c.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        this.checkHover(mx, my);
      }
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // 터치 조작
    c.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    c.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        const dx = e.touches[0].clientX - this.lastMousePos.x;
        const dy = e.touches[0].clientY - this.lastMousePos.y;
        this.targetRotY += dx * 0.009;
        this.targetRotX = Math.max(-1.3, Math.min(1.3, this.targetRotX + dy * 0.009));
        this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    }, { passive: true });

    c.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // 휠 줌
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.12 : -0.12;
      this.targetZoom = Math.max(0.65, Math.min(2.2, this.targetZoom + delta));
    }, { passive: false });

    // 클릭 시 도시 선택
    c.addEventListener('click', (e) => {
      const rect = c.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = this.getHitCity(mx, my);
      if (hit) {
        this.selectCity(hit);
      }
    });
  }

  // 위경도 -> 3D 구면 좌표 -> 2D 캔버스 투영
  project(lat, lon) {
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    const r = this.radius * this.zoom;

    // 3차원 기본 좌표
    let x = r * Math.cos(latRad) * Math.sin(lonRad);
    let y = -r * Math.sin(latRad);
    let z = r * Math.cos(latRad) * Math.cos(lonRad);

    // Y축 회전 (경도)
    const cosY = Math.cos(this.rotY);
    const sinY = Math.sin(this.rotY);
    const x1 = x * cosY + z * sinY;
    const z1 = -x * sinY + z * cosY;

    // X축 회전 (위도)
    const cosX = Math.cos(this.rotX);
    const sinX = Math.sin(this.rotX);
    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const cx = this.width / 2;
    const cy = this.height / 2;

    return {
      x: cx + x1,
      y: cy + y2,
      z: z2,
      visible: z2 > -r * 0.08 // 앞면 및 약간의 측면까지 투영
    };
  }

  checkHover(mx, my) {
    const hit = this.getHitCity(mx, my);
    if (hit !== this.hoveredCity) {
      this.hoveredCity = hit;
      this.canvas.style.cursor = hit ? 'pointer' : 'grab';
    }
  }

  getHitCity(mx, my) {
    let closest = null;
    let minD = 22; // 클릭 반경 22px
    for (const city of this.cities) {
      const p = this.project(city.lat, city.lon);
      if (!p.visible || p.z < 0) continue;
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < minD) {
        minD = d;
        closest = city;
      }
    }
    return closest;
  }

  rotateTo(lat, lon, zoom = 1.25) {
    // 해당 위경도가 카메라 정면(0, 0, z > 0)에 오도록 각도 계산
    const latRad = (lat * Math.PI) / 180;
    const lonRad = (lon * Math.PI) / 180;
    this.targetRotX = -latRad;
    this.targetRotY = -lonRad - Math.PI / 2;
    this.targetZoom = zoom;
  }

  selectCity(city) {
    this.selectedCity = city;
    this.rotateTo(city.lat, city.lon);
    if (this.options.onSelectCity) {
      this.options.onSelectCity(city);
    }
  }

  startLoop() {
    const loop = () => {
      // 부드러운 카메라 보간 (Lerp)
      this.rotX += (this.targetRotX - this.rotX) * 0.1;
      this.rotY += (this.targetRotY - this.rotY) * 0.1;
      this.zoom += (this.targetZoom - this.zoom) * 0.1;
      this.pulsePhase = (this.pulsePhase + 0.05) % (Math.PI * 2);

      this.render();
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = this.radius * this.zoom;

    ctx.clearRect(0, 0, w, h);

    // 1. 별빛 우주 배경
    ctx.save();
    for (const s of this.stars) {
      s.alpha += Math.sin(this.pulsePhase + s.x * 10) * 0.01;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(0.9, s.alpha))})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 2. 대기광 외곽 글로우 (Atmospheric Rim Glow)
    const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 1.35);
    glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    glowGrad.addColorStop(0.5, 'rgba(99, 102, 241, 0.12)');
    glowGrad.addColorStop(1, 'rgba(15, 11, 46, 0)');
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.35, 0, Math.PI * 2);
    ctx.fill();

    // 3. 지구 본체 (해양 바다 베이스)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();

    const oceanGrad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    oceanGrad.addColorStop(0, '#1e3a8a');
    oceanGrad.addColorStop(0.65, '#0f2356');
    oceanGrad.addColorStop(1, '#071129');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    // 4. 경위도 그리드선
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    for (let lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath();
      let first = true;
      for (let lon = -180; lon <= 180; lon += 10) {
        const p = this.project(lat, lon);
        if (p.z > 0) {
          if (first) { ctx.moveTo(p.x, p.y); first = false; }
          else ctx.lineTo(p.x, p.y);
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }
    for (let lon = -180; lon < 180; lon += 45) {
      ctx.beginPath();
      let first = true;
      for (let lat = -80; lat <= 80; lat += 10) {
        const p = this.project(lat, lon);
        if (p.z > 0) {
          if (first) { ctx.moveTo(p.x, p.y); first = false; }
          else ctx.lineTo(p.x, p.y);
        } else {
          first = true;
        }
      }
      ctx.stroke();
    }

    // 5. 대륙 지형 다각형 렌더링
    ctx.fillStyle = 'rgba(34, 197, 94, 0.28)';
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.55)';
    ctx.lineWidth = 1.5;

    for (const poly of CONTINENT_POLYGONS) {
      ctx.beginPath();
      let visibleCount = 0;
      let first = true;
      for (let i = 0; i < poly.length; i++) {
        const [lon, lat] = poly[i];
        const p = this.project(lat, lon);
        if (p.z > -r * 0.1) visibleCount++;
        if (first) {
          ctx.moveTo(p.x, p.y);
          first = false;
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.closePath();
      if (visibleCount > 2) {
        ctx.fill();
        ctx.stroke();
      }
    }

    // 6. 구체 음영 (3D 입체감 Shading)
    const shadeGrad = ctx.createRadialGradient(cx - r * 0.4, cy - r * 0.45, r * 0.2, cx, cy, r);
    shadeGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    shadeGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.05)');
    shadeGrad.addColorStop(1, 'rgba(3, 7, 18, 0.7)');
    ctx.fillStyle = shadeGrad;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

    ctx.restore(); // Clip 해제

    // 7. 21개 도시 핀 및 라벨 렌더링
    const curId = this.options.currentStudentId;
    const pulse = (Math.sin(this.pulsePhase) + 1) / 2;

    for (const city of this.cities) {
      const p = this.project(city.lat, city.lon);
      if (!p.visible || p.z < -10) continue;

      const isHover = (this.hoveredCity && this.hoveredCity.id === city.id);
      const isSelect = (this.selectedCity && this.selectedCity.id === city.id);

      // 범례 구분:
      // 초록색: 내 땅/내 홈도시
      // 보라색: 친구의 땅
      // 골드: 비어 있는 게임용 땅(탐험 가능)
      let kind = 'empty'; // 'mine' | 'friend' | 'empty'
      let resCount = city.residents ? city.residents.length : 0;
      if (resCount > 0) {
        const hasMe = city.residents.some(r => r.id === curId);
        kind = hasMe ? 'mine' : 'friend';
      }

      let baseColor = '#eab308'; // 골드 (미개척지)
      if (kind === 'mine') baseColor = '#10b981'; // 에메랄드 초록
      else if (kind === 'friend') baseColor = '#a855f7'; // 신비한 보라

      const pinR = isSelect ? 8 : (isHover ? 7 : 5.5);

      // 펄스 링 애니메이션
      ctx.beginPath();
      ctx.arc(p.x, p.y, pinR + pulse * 7, 0, Math.PI * 2);
      ctx.strokeStyle = baseColor;
      ctx.globalAlpha = 0.5 - pulse * 0.4;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // 핀 본체
      ctx.beginPath();
      ctx.arc(p.x, p.y, pinR, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 마커 중앙 아이콘/점
      ctx.beginPath();
      ctx.arc(p.x, p.y, pinR * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // 도시 이름 및 동물 이모지 라벨
      ctx.save();
      ctx.font = isSelect ? 'bold 13px Jua, sans-serif' : '11px Jua, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';

      let labelText = `${city.name}`;
      if (city.residents && city.residents.length > 0) {
        const em = city.residents[0].animal?.emoji || '🐾';
        labelText = `${em} ${city.name}`;
      }

      const textWidth = ctx.measureText(labelText).width;
      const tagX = p.x;
      const tagY = p.y - pinR - 4;

      // 반투명 태그 배경
      ctx.fillStyle = isSelect ? 'rgba(15, 23, 42, 0.92)' : 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(tagX - textWidth / 2 - 6, tagY - 14, textWidth + 12, 16, 4);
      ctx.fill();
      if (isSelect || isHover) {
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      ctx.fillStyle = isSelect ? '#fde047' : '#ffffff';
      ctx.fillText(labelText, tagX, tagY);
      ctx.restore();
    }
  }
}

// ─────────────────────────────────────────────────────────────
// 랜드마크 상세 모달 및 동물 친구 탭 렌더링 헬퍼
// ─────────────────────────────────────────────────────────────
export function openCityModal(city, { currentStudent, onClaimCity, isTeacher } = {}) {
  const modalRoot = $('#modal-root');
  if (!modalRoot) return;

  const curId = currentStudent ? currentStudent.id : null;
  const isMine = city.residents && city.residents.some(r => r.id === curId);
  const residents = city.residents || [];

  // 대륙 레이블
  const contMap = {
    asia: '아시아',
    europe: '유럽',
    americas: '아메리카',
    africa: '아프리카',
    oceania: '오세아니아'
  };

  modalRoot.innerHTML = `
    <div class="modal-backdrop" id="city-modal-backdrop">
      <div class="modal-card modal-lg city-modal-card">
        <div class="city-modal-header">
          <div class="city-title-group">
            <span class="city-flag-badge">${city.emoji || '🏛️'}</span>
            <div>
              <h2 class="city-modal-title">${esc(city.name)} <small class="city-country">${esc(city.country)} · ${contMap[city.continent] || ''}</small></h2>
              <p class="city-tagline">"${esc(city.tagline)}"</p>
            </div>
          </div>
          <button class="modal-close-btn" id="btn-close-city-modal" aria-label="닫기">✕</button>
        </div>

        <!-- 탭 헤더: 랜드마크 & 도시 탐색 / 동물 친구 -->
        <div class="city-modal-tabs">
          <button class="city-tab-btn active" id="tab-btn-landmark">🏛️ 랜드마크 & 도시 안내</button>
          <button class="city-tab-btn" id="tab-btn-animals">🐾 동물 친구 & 영토 (${residents.length})</button>
        </div>

        <div class="city-modal-body">
          <!-- 탭 1: 랜드마크 & 도시 정보 -->
          <div class="city-tab-pane active" id="pane-landmark">
            <div class="landmark-hero-banner" style="background: linear-gradient(135deg, ${city.color}22, rgba(15, 23, 42, 0.8));">
              <div class="landmark-big-icon">${city.emoji || '🏛️'}</div>
              <div class="landmark-hero-info">
                <span class="badge ${isMine ? 'success' : (residents.length ? 'badge-friend' : 'badge-gold')}">
                  ${isMine ? '🚩 내 영토' : (residents.length ? `👥 친구들의 영토 (${residents.length}명)` : '✨ 미개척 탐험지')}
                </span>
                <h3 class="landmark-name">${esc(city.landmark)}</h3>
                <p class="landmark-desc">${esc(city.landmarkDesc)}</p>
              </div>
            </div>

            <div class="landmark-tags-row">
              ${(city.tags || []).map(t => `<span class="city-tag"># ${esc(t)}</span>`).join('')}
              <a href="${city.wikiUrl}" target="_blank" rel="noopener noreferrer" class="city-wiki-link">
                📖 위키백과 정보 보기 ↗
              </a>
            </div>

            <!-- 개척 액션 바 -->
            ${!isTeacher && currentStudent ? `
              <div class="city-claim-box">
                ${isMine ? `
                  <div class="claimed-banner mine">
                    <span>🚩 이미 내가 개척한 자랑스러운 도시예요! (점유 영토: ${currentStudent.claimedTiles || 6}칸)</span>
                  </div>
                ` : `
                  <div class="claim-prompt-banner">
                    <div>
                      <strong>✨ 이 도시를 탐험하고 깃발을 꽂을까요?</strong>
                      <p class="muted">새 도시를 개척하면 영토 +4칸을 획득하고 친구들과 교류할 수 있어요!</p>
                    </div>
                    <button class="btn btn-gold btn-lg" id="btn-claim-city">
                      🪙 30 코인으로 영토 개척
                    </button>
                  </div>
                `}
              </div>
            ` : ''}
          </div>

          <!-- 탭 2: 동물 친구 & 영토 현황 -->
          <div class="city-tab-pane" id="pane-animals" style="display:none">
            ${residents.length === 0 ? `
              <div class="empty-state" style="padding:40px 20px">
                <span style="font-size:48px">🌱</span>
                <h3>아직 살고 있는 동물 친구가 없어요</h3>
                <p class="muted">가장 먼저 이 도시에 깃발을 꽂고 첫 번째 주인이 되어보세요!</p>
              </div>
            ` : `
              <div class="residents-grid">
                ${residents.map(r => `
                  <div class="resident-card ${r.id === curId ? 'mine' : ''}">
                    <div class="resident-avatar">
                      <span class="animal-avatar">${r.animal?.emoji || '🦊'}</span>
                      <span class="res-lvl">Lv.${r.level}</span>
                    </div>
                    <div class="resident-info">
                      <div class="res-name-row">
                        <strong>${esc(r.animal?.name || '동물')}</strong>
                        <small class="muted">(${esc(r.name)})</small>
                      </div>
                      <div class="res-title gold">${esc(r.animal?.title || '숲의 지킴이')}</div>
                      <div class="res-meta muted">
                        <span>🏡 ${r.isHome ? '시작 고향' : '탐험 개척'}</span> · 
                        <span>영토 ${r.tiles || 4}칸</span>
                      </div>
                      ${r.animal?.friends ? `
                        <div class="animal-friends-list">
                          <small>함께 지내는 친구:</small> ${esc(r.animal.friends.join(', '))}
                        </div>
                      ` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </div>

        <div class="modal-foot">
          <button class="btn btn-ghost" id="btn-close-city-foot">닫기</button>
        </div>
      </div>
    </div>
  `;

  // 탭 전환 이벤트
  const tabLandmark = $('#tab-btn-landmark');
  const tabAnimals = $('#tab-btn-animals');
  const paneLandmark = $('#pane-landmark');
  const paneAnimals = $('#pane-animals');

  tabLandmark.addEventListener('click', () => {
    tabLandmark.classList.add('active');
    tabAnimals.classList.remove('active');
    paneLandmark.style.display = 'block';
    paneAnimals.style.display = 'none';
  });

  tabAnimals.addEventListener('click', () => {
    tabAnimals.classList.add('active');
    tabLandmark.classList.remove('active');
    paneLandmark.style.display = 'none';
    paneAnimals.style.display = 'block';
  });

  const closeModal = () => {
    modalRoot.innerHTML = '';
  };

  $('#btn-close-city-modal').addEventListener('click', closeModal);
  $('#btn-close-city-foot').addEventListener('click', closeModal);
  $('#city-modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'city-modal-backdrop') closeModal();
  });

  // 개척 버튼
  const btnClaim = $('#btn-claim-city');
  if (btnClaim && onClaimCity) {
    btnClaim.addEventListener('click', async () => {
      closeModal();
      await onClaimCity(city);
    });
  }
}
