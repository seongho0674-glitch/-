// ==========================================================

import { CLASS_ROSTER } from './class-roster.js';
// Classimal World & 학급경제 - 브라우저 독립 저장소 (Local Mock DB)
// - GitHub Pages, 정적 웹 호스팅, 오프라인 환경에서도 백엔드 없이 100% 정상 작동
// ==========================================================

export const CITIES_DATA = [
  { id: "seoul", name: "서울", country: "대한민국", continent: "asia", lat: 37.5665, lon: 126.9780, tagline: "궁궐과 일상이 만나는 도시", landmark: "경복궁", landmarkDesc: "조선 왕조의 법궁으로, 북악산 아래 웅장한 근정전과 아름다운 경회루가 자리 잡고 있어요.", tags: ["한양의 역사", "경회루 연못", "수문장 교대의식"], wikiUrl: "https://ko.wikipedia.org/wiki/%EA%B2%BD%EB%B3%B5%EA%B5%81", color: "#10b981", emoji: "🏯" },
  { id: "vancouver", name: "밴쿠버", country: "캐나다", continent: "americas", lat: 49.2827, lon: -123.1207, tagline: "바다와 산을 품은 항구 도시", landmark: "캐나다 플레이스", landmarkDesc: "흰 돛단배 모양의 지붕이 바다를 향해 펼쳐진 밴쿠버의 대표적인 해변 복합 문화 시설이에요.", tags: ["흰 돛 지붕", "버라드 만", "태평양 관문"], wikiUrl: "https://en.wikipedia.org/wiki/Canada_Place", color: "#06b6d4", emoji: "⛵" },
  { id: "new-york", name: "뉴욕", country: "미국", continent: "americas", lat: 40.7128, lon: -74.0060, tagline: "높은 빌딩과 다양한 문화의 도시", landmark: "자유의 여신상", landmarkDesc: "리버티 섬에서 횃불을 높이 들고 자유와 희망을 상징하는 세계적인 기념비예요.", tags: ["자유의 횃불", "맨해튼 스카이라인", "리버티 섬"], wikiUrl: "https://en.wikipedia.org/wiki/Statue_of_Liberty", color: "#3b82f6", emoji: "🗽" },
  { id: "los-angeles", name: "로스앤젤레스", country: "미국", continent: "americas", lat: 34.0522, lon: -118.2437, tagline: "영화와 별을 만나는 도시", landmark: "그리피스 천문대", landmarkDesc: "로스앤젤레스 시내와 할리우드 사인이 한눈에 내려다보이는 유서 깊은 천문대예요.", tags: ["천체 망원경", "할리우드 야경", "플라네타륨"], wikiUrl: "https://en.wikipedia.org/wiki/Griffith_Observatory", color: "#f59e0b", emoji: "🔭" },
  { id: "mexico-city", name: "멕시코시티", country: "멕시코", continent: "americas", lat: 19.4326, lon: -99.1332, tagline: "역사와 예술이 살아 있는 수도", landmark: "벨라스 아르테스 궁전", landmarkDesc: "순백의 대리석 외관과 화려한 돔, 아르누보 양식이 어우러진 멕시코 예술의 전당이에요.", tags: ["황금빛 돔", "디에고 벽화", "국립 예술 극장"], wikiUrl: "https://en.wikipedia.org/wiki/Palacio_de_Bellas_Artes", color: "#ec4899", emoji: "🏛️" },
  { id: "lima", name: "리마", country: "페루", continent: "americas", lat: -12.0464, lon: -77.0428, tagline: "태평양 곁 오래된 광장의 도시", landmark: "리마 마요르 광장", landmarkDesc: "유네스코 세계유산으로 등록된 유서 깊은 광장으로 대성당과 대통령궁이 둘러싸고 있어요.", tags: ["아르마스 광장", "스페인 식민 건축", "청동 분수대"], wikiUrl: "https://en.wikipedia.org/wiki/Plaza_Mayor%2C_Lima", color: "#eab308", emoji: "⛲" },
  { id: "rio-de-janeiro", name: "리우데자네이루", country: "브라질", continent: "americas", lat: -22.9068, lon: -43.1729, tagline: "해변과 산이 만나는 도시", landmark: "예수상 (구세주 그리스도상)", landmarkDesc: "코르코바두 산꼭대기에서 두 팔을 벌리고 도시 전체를 굽어살피는 거대한 조각상이에요.", tags: ["코르코바두 산", "코파카바나 해변", "세계 7대 불가사의"], wikiUrl: "https://en.wikipedia.org/wiki/Christ_the_Redeemer_(statue)", color: "#10b981", emoji: "⛰️" },
  { id: "buenos-aires", name: "부에노스아이레스", country: "아르헨티나", continent: "americas", lat: -34.6037, lon: -58.3816, tagline: "탱고의 리듬이 흐르는 도시", landmark: "부에노스아이레스 오벨리스크", landmarkDesc: "도시 건립 400주년을 기념해 세워진 높이 67.5미터의 상징적인 기념탑이에요.", tags: ["7월 9일 대로", "탱고의 고향", "축구 열기"], wikiUrl: "https://en.wikipedia.org/wiki/Obelisco_de_Buenos_Aires", color: "#38bdf8", emoji: "🗼" },
  { id: "london", name: "런던", country: "영국", continent: "europe", lat: 51.5074, lon: -0.1278, tagline: "템스강을 따라 걷는 도시", landmark: "타워 브리지", landmarkDesc: "도개교 형식으로 템스강 위를 가로지르는 고딕 양식의 쌍둥이 탑 다리예요.", tags: ["도개교", "템스 강변", "빅토리아 시대"], wikiUrl: "https://en.wikipedia.org/wiki/Tower_Bridge", color: "#6366f1", emoji: "🌉" },
  { id: "madrid", name: "마드리드", country: "스페인", continent: "europe", lat: 40.4168, lon: -3.7038, tagline: "왕궁과 예술이 어우러진 수도", landmark: "마드리드 왕궁", landmarkDesc: "서유럽 최대 규모의 웅장한 궁전으로, 화려한 왕실 보물과 그림들이 가득해요.", tags: ["오리엔테 광장", "화려한 옥좌실", "왕실 근위대"], wikiUrl: "https://en.wikipedia.org/wiki/Royal_Palace_of_Madrid", color: "#f97316", emoji: "👑" },
  { id: "reykjavik", name: "레이캬비크", country: "아이슬란드", continent: "europe", lat: 64.1466, lon: -21.9426, tagline: "북쪽 바다 곁의 아담한 수도", landmark: "할그림스키르캬", landmarkDesc: "주상절리 화산암 모양을 본떠 만든 독특하고 신비로운 아이슬란드의 랜드마크예요.", tags: ["오로라의 도시", "주상절리 디자인", "지열 온천"], wikiUrl: "https://en.wikipedia.org/wiki/Hallgr%C3%ADmskirkja", color: "#a855f7", emoji: "⛪" },
  { id: "cairo", name: "카이로", country: "이집트", continent: "africa", lat: 30.0444, lon: 31.2357, tagline: "나일강을 품은 큰 도시", landmark: "카이로 타워", landmarkDesc: "연꽃 모양을 형상화한 격자 타워로, 나일강과 기자 피라미드 풍경까지 내려다볼 수 있어요.", tags: ["연꽃 문양", "나일강 뷰", "피라미드 조망"], wikiUrl: "https://en.wikipedia.org/wiki/Cairo_Tower", color: "#d97706", emoji: "🪷" },
  { id: "cape-town", name: "케이프타운", country: "남아프리카공화국", continent: "africa", lat: -33.9249, lon: 18.4241, tagline: "평평한 산과 푸른 바다의 도시", landmark: "테이블 마운틴", landmarkDesc: "마치 식탁처럼 평평한 정상부가 바다와 도시를 병풍처럼 감싸고 있는 경이로운 자연 명소예요.", tags: ["테이블보 구름", "희망봉 인근", "케이블카"], wikiUrl: "https://en.wikipedia.org/wiki/Table_Mountain", color: "#14b8a6", emoji: "🌄" },
  { id: "nairobi", name: "나이로비", country: "케냐", continent: "africa", lat: -1.2921, lon: 36.8219, tagline: "동아프리카의 활기찬 수도", landmark: "케냐타 국제컨벤션센터", landmarkDesc: "도심 한복판에서 사파리 국립공원까지 내다볼 수 있는 원통형 랜드마크 빌딩이에요.", tags: ["도심 사파리", "사바나 야생동물", "회전 전망대"], wikiUrl: "https://en.wikipedia.org/wiki/Kenyatta_International_Convention_Centre", color: "#84cc16", emoji: "🦒" },
  { id: "istanbul", name: "이스탄불", country: "튀르키예", continent: "europe", lat: 41.0082, lon: 28.9784, tagline: "유럽과 아시아를 잇는 도시", landmark: "아야 소피아", landmarkDesc: "거대한 돔과 찬란한 모자이크가 동서양 문명의 만남을 상징하는 건축의 걸작이에요.", tags: ["보스포루스 해협", "비잔틴 모자이크", "동서양의 교차로"], wikiUrl: "https://en.wikipedia.org/wiki/Hagia_Sophia", color: "#ef4444", emoji: "🕌" },
  { id: "mumbai", name: "뭄바이", country: "인도", continent: "asia", lat: 19.0760, lon: 72.8777, tagline: "영화와 항구가 만나는 도시", landmark: "인디아 게이트웨이", landmarkDesc: "아라비아해를 바라보며 인도-사라센 양식으로 우뚝 솟은 웅장한 아치형 석조 문이에요.", tags: ["아라비아해 항구", "발리우드 중심지", "현무암 개선문"], wikiUrl: "https://en.wikipedia.org/wiki/Gateway_of_India", color: "#f59e0b", emoji: "🚪" },
  { id: "bangkok", name: "방콕", country: "태국", continent: "asia", lat: 13.7563, lon: 100.5018, tagline: "강과 사원이 어우러진 수도", landmark: "왓 아룬 (새벽 사원)", landmarkDesc: "짜오프라야 강변에 도자기 조각들로 장식된 탑들이 새벽 햇살에 눈부시게 빛나요.", tags: ["새벽 사원", "짜오프라야 강", "도자기 불탑"], wikiUrl: "https://en.wikipedia.org/wiki/Wat_Arun", color: "#e11d48", emoji: "🛕" },
  { id: "singapore", name: "싱가포르", country: "싱가포르", continent: "asia", lat: 1.3521, lon: 103.8198, tagline: "도시 전체가 하나의 나라", landmark: "머라이언 상", landmarkDesc: "사자의 머리와 물고기의 몸을 지닌 채 마리나 베이 바다로 시원한 물줄기를 뿜어내요.", tags: ["마리나 베이", "가든스 바이 더 베이", "친환경 가든시티"], wikiUrl: "https://en.wikipedia.org/wiki/Merlion", color: "#06b6d4", emoji: "🦁" },
  { id: "beijing", name: "베이징", country: "중국", continent: "asia", lat: 39.9042, lon: 116.4074, tagline: "오랜 궁궐과 유적을 품은 수도", landmark: "천단 (기년전)", landmarkDesc: "황제가 풍년을 기원하며 하늘에 제사를 올리던 삼중 처마의 신비로운 원형 전각이에요.", tags: ["기년전 삼중 처마", "만리장성 관문", "하늘의 제단"], wikiUrl: "https://en.wikipedia.org/wiki/Temple_of_Heaven", color: "#dc2626", emoji: "🏮" },
  { id: "sydney", name: "시드니", country: "오스트레일리아", continent: "oceania", lat: -33.8688, lon: 151.2093, tagline: "아름다운 항구와 공연의 도시", landmark: "시드니 오페라 하우스", landmarkDesc: "조개껍데기와 하얀 돛 모양을 형상화한 지붕으로 세계인들의 찬사를 받는 오페라 전당이에요.", tags: ["하버 브리지", "조개 모양 지붕", "달링 하버"], wikiUrl: "https://en.wikipedia.org/wiki/Sydney_Opera_House", color: "#2563eb", emoji: "🎭" },
  { id: "honolulu", name: "호놀룰루", country: "미국 · 하와이", continent: "oceania", lat: 21.3069, lon: -157.8583, tagline: "태평양 한가운데의 섬 도시", landmark: "다이아몬드 헤드", landmarkDesc: "와이키키 해변 너머로 우뚝 솟은 거대한 화산 분화구로, 정상에서 에메랄드빛 바다가 펼쳐져요.", tags: ["와이키키 해변", "화산 분화구", "알로하 정신"], wikiUrl: "https://en.wikipedia.org/wiki/Diamond_Head%2C_Hawaii", color: "#10b981", emoji: "🌺" }
];

const ANIMALS_PRESETS = [
  { name: "모리", species: "여우", emoji: "🦊", title: "숲의 수호자", friends: ["토끼 토리", "곰 밤이"] },
  { name: "토리", species: "토끼", emoji: "🐰", title: "깡총 탐험가", friends: ["여우 모리", "다람쥐 람이"] },
  { name: "밤이", species: "아기곰", emoji: "🐻", title: "꿀잠 대장", friends: ["여우 모리", "수달 달이"] },
  { name: "레오", species: "아기사자", emoji: "🦁", title: "용기 가득 대장", friends: ["치타 치치", "기린 로로"] },
  { name: "달이", species: "수달", emoji: "🦦", title: "조약돌 요리사", friends: ["곰 밤이", "펭귄 핑구"] },
  { name: "팡이", species: "판다", emoji: "🐼", title: "대나무 철학자", friends: ["호랑이 호야", "여우 모리"] },
  { name: "핑구", species: "펭귄", emoji: "🐧", title: "빙하 슬라이더", friends: ["수달 달이", "물개 뭉이"] },
  { name: "슬로", species: "나무늘보", emoji: "🦥", title: "낮잠 평화주의자", friends: ["앵무새 루루", "토끼 토리"] },
  { name: "돌이", species: "돌고래", emoji: "🐬", title: "에메랄드 파도왕", friends: ["수달 달이", "바다거북 북이"] },
  { name: "코코", species: "코알라", emoji: "🐨", title: "유칼립투스 시인", friends: ["쿼카 쿠키", "토끼 토리"] },
  { name: "람이", species: "다람쥐", emoji: "🐿️", title: "도토리 탐정", friends: ["토끼 토리", "여우 모리"] },
  { name: "루루", species: "앵무새", emoji: "🦜", title: "무지개 전령", friends: ["나무늘보 슬로", "라마 포포"] },
  { name: "페넥", species: "사막여우", emoji: "🦊", title: "모래바람 마법사", friends: ["치타 치치", "낙타 카멜"] },
  { name: "호야", species: "호랑이", emoji: "🐯", title: "백두산 용사", friends: ["판다 팡이", "늑대 울프"] },
  { name: "울프", species: "늑대", emoji: "🐺", title: "달빛 순찰대", friends: ["호랑이 호야", "독수리 아길"] },
  { name: "레피", species: "아기표범", emoji: "🐆", title: "바람의 질주자", friends: ["아기사자 레오", "치타 치치"] },
  { name: "나비", species: "탱고냥이", emoji: "🐱", title: "골목길 낭만가", friends: ["강아지 몽이", "토끼 토리"] },
  { name: "몽이", species: "충직견", emoji: "🐶", title: "학급 지킴이", friends: ["탱고냥이 나비", "곰 밤이"] },
  { name: "포포", species: "라마", emoji: "🦙", title: "안데스 요정", friends: ["알파카 카파", "앵무새 루루"] },
  { name: "부엉", species: "올빼미", emoji: "🦉", title: "밤하늘 박사", friends: ["다람쥐 람이", "여우 모리"] },
  { name: "하티", species: "아기코끼리", emoji: "🐘", title: "기쁨의 분수", friends: ["원숭이 몽키", "사자 레오"] },
  { name: "쿠키", species: "쿼카", emoji: "🦘", title: "행복 바이러스", friends: ["코알라 코코", "토끼 토리"] },
  { name: "치치", species: "치타", emoji: "🐆", title: "초원 스피드스타", friends: ["아기사자 레오", "사막여우 페넥"] },
  { name: "초롱", species: "반딧불이", emoji: "✨", title: "별빛 길잡이", friends: ["수달 달이", "올빼미 부엉"] },
  { name: "도치", species: "고슴도치", emoji: "🦔", title: "가시방패 탐험가", friends: ["다람쥐 람이", "토끼 토리"] }
];

const DB_KEY = 'classimal_offline_db_v1';

function uid(p = 'id') {
  return `${p}_${Math.random().toString(36).substring(2, 10)}`;
}

// 서버(server.py)처럼 이 컴퓨터 시각으로 기록한다 (UTC로 적으면 화면 시각이 9시간 어긋나고 '오늘'이 아침 9시에 바뀜)
function nowStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const todayStr = () => nowStr().slice(0, 10);

// ---------- 미션 · 학급 회의 · 행운의 게임 규칙 (server.py와 같은 값) ----------
const MISSIONS_SEED = [
  ['m_teacher', '📝', '선생님 과제', 10, '선생님이 배부한 학습지나 과제를 풀고 인증해요', false, '답안을 적고 인증해요', 'assignment'],
  ['m_role', '🧩', '1인 1역', 10, '내가 맡은 역할을 끝까지 해냈어요', true, '', 'role'],
  ['m_pypx_archive', '🗂️', 'PYPX 아카이빙', 30, 'PYPX 탐구 과정을 사진·글로 기록하고 정리했어요', false, '무엇을 기록·정리했나요?', ''],
  ['m_pypx_solve', '💡', 'PYPX 탐구 해결', 40, '탐구 질문을 해결하고 알게 된 점을 나눴어요', false, '어떤 탐구 질문을 해결했나요?', ''],
  ['m_reading', '📖', '독서노트', 10, '책을 읽고 독서노트를 썼어요', false, '읽은 책 제목', ''],
  ['m_notice', '📒', '알림장', 5, '오늘 알림장을 빠짐없이 적었어요', true, '', ''],
  ['m_supplies', '🎒', '준비물 챙겨오기', 5, '오늘 필요한 준비물을 챙겨 왔어요', true, '', ''],
  ['m_pyp_reading', '🔎', 'PYP 관련 독서 인증', 15, '탐구 주제와 관련된 책을 읽고 인증했어요', false, '책 제목과 관련된 탐구 주제', ''],
];
const SEAT_DESC = '원하는 친구와 하루 동안 자리를 바꿔요. 가장 귀한 교환권!';
const ITEM_PRICE_UPDATE = {
  '자리 바꾸기 쿠폰': [50, 150], '일일 선생님 쿠폰': [120, 120], '숙제 하루 면제 쿠폰': [80, 100], '급식 먼저 먹기 쿠폰': [40, 60],
  '음악 들으며 공부 쿠폰': [30, 40], '미니 노트': [25, 30], '캐릭터 연필': [20, 25], '간식 뽑기': [15, 20],
};
const LUCK_BET = 10;     // 기본 미션 1개 보상만큼
const LUCK_FEE = 1;      // 수수료 10%
const LUCK_DAILY = 5;    // 하루 횟수
const PE_PASS_RATE = 70; // 학급 회의 통과 기준 (%)

function seedMissions() {
  return MISSIONS_SEED.map(([id, emoji, name, reward, desc, daily, prompt, kind]) => (
    { id, emoji, name, reward, desc, daily, prompt, kind, active: true, createdAt: nowStr() }));
}

/** 예전 체험 데이터에 새 기능 칸을 채우고 기본 상품 가격을 한 번 정리 (server.py migrate_db와 같음) */
function migrateDB(db) {
  let changed = false;
  db.settings = db.settings || {};
  if (!('luckEnabled' in db.settings)) { db.settings.luckEnabled = true; changed = true; }
  if (!('peGoalDays' in db.settings)) { db.settings.peGoalDays = 10; changed = true; }
  if (!Array.isArray(db.missions)) { db.missions = seedMissions(); changed = true; }
  for (const k of ['submissions', 'peEvents', 'transactions', 'assignments']) if (!Array.isArray(db[k])) { db[k] = []; changed = true; }
  if (!('vote' in db)) { db.vote = null; changed = true; }
  if (Number(db.version || 1) < 2) {
    for (const it of db.items || []) {
      const upd = ITEM_PRICE_UPDATE[it.name];
      if (upd && Number(it.price) === upd[0]) {
        it.price = upd[1];
        if (it.name === '자리 바꾸기 쿠폰') { it.name = '자리 바꾸기 교환권'; it.description = SEAT_DESC; }
      }
    }
    for (const t of db.transactions) if (t.type === 'pay') t.type = 'give'; // 예전 체험 데이터의 잘못된 종류
    db.version = 2;
    changed = true;
  }
  if (Number(db.version || 1) < 3) {
    for (const it of db.items || []) {
      if (it.name === '캐릭터 연필') Object.assign(it, { name: '학용품', type: 'goods', price: 200, description: '학급 상점에서 학용품을 골라요.' });
      if (['미니 노트', '미니노트'].includes(it.name)) Object.assign(it, { name: '알림장 면제', type: 'coupon', price: 100, description: '알림장 한 번을 면제받아요. (선생님 확인 필요)' });
      if (it.name === '간식 뽑기') it.price = 50;
    }
    if (!db.missions.some(m => m.id === 'm_teacher')) db.missions.push(seedMissions().find(m => m.id === 'm_teacher'));
    db.version = 3;
    changed = true;
  }
  for (const s of db.students || []) {
    if (!('characterLevel' in s)) { s.characterLevel = 1; changed = true; }
    if (!('territoryPurchases' in s)) { s.territoryPurchases = 0; changed = true; }
    if (!s.claimedCityTiles || typeof s.claimedCityTiles !== 'object' || Array.isArray(s.claimedCityTiles)) {
      const home = s.homeCity || 'seoul';
      const otherCities = [...new Set(s.claimedCities || [home])].filter(id => id !== home);
      s.claimedCityTiles = { [home]: Math.max(1, Number(s.claimedTiles ?? 6) - otherCities.length * 3) };
      for (const id of otherCities) s.claimedCityTiles[id] = 3;
      changed = true;
    }
  }
  if (Number(db.settings.rosterVersion || 0) < 1) {
    migrateRoster(db);
    db.settings.rosterVersion = 1;
    changed = true;
  }
  return changed;
}

function makeRosterStudent(entry, idx) {
  const p = ANIMALS_PRESETS[idx % ANIMALS_PRESETS.length];
  const city = CITIES_DATA[idx % CITIES_DATA.length];
  return {
    id: `s_${entry.number}`, number: entry.number, name: entry.name, pin: '1234',
    balance: 100, exp: 150, characterLevel: 1, territoryPurchases: 0,
    roleId: entry.roleId, createdAt: nowStr(),
    animal: { name: p.name, species: p.species, emoji: p.emoji, title: p.title },
    homeCity: city.id, claimedCities: [city.id], claimedTiles: 6, claimedCityTiles: { [city.id]: 6 }, energy: 3, friends: [...p.friends],
  };
}

function migrateRoster(db) {
  const matched = new Set();
  const renamed = new Map();
  CLASS_ROSTER.students.forEach((entry, idx) => {
    let s = db.students.find(s => !matched.has(s.id) && s.name === entry.name);
    if (!s) s = db.students.find(s => !matched.has(s.id) && Number(s.number) === entry.number && /^\d+번 학생$/.test(s.name || ''));
    if (!s) {
      s = makeRosterStudent(entry, idx);
      if (db.students.some(old => old.id === s.id)) s.id = uid('s');
      db.students.push(s);
    }
    Object.assign(s, { number: entry.number, name: entry.name, roleId: entry.roleId });
    matched.add(s.id);
    renamed.set(s.id, s.name);
  });
  const referenced = new Set([
    ...db.transactions.map(t => t.studentId), ...db.submissions.map(q => q.studentId),
    ...db.assignments.flatMap(a => a.studentIds || []), ...Object.keys(db.vote?.votes || {}),
  ]);
  db.students = db.students.filter(s => matched.has(s.id) || !(
    /^\d+번 학생$/.test(s.name || '') && !referenced.has(s.id) &&
    ((Number(s.balance || 0) === 100 && Number(s.exp || 0) === 150) || (Number(s.balance || 0) === 0 && Number(s.exp || 0) === 0)) &&
    (s.claimedCities?.length || 1) === 1 && Number(s.claimedTiles ?? 6) === 6 &&
    Number(s.characterLevel || 1) === 1 && Number(s.territoryPurchases || 0) === 0
  ));
  for (const records of [db.transactions, db.submissions]) for (const record of records) {
    if (renamed.has(record.studentId)) record.studentName = renamed.get(record.studentId);
  }
  for (const role of CLASS_ROSTER.roles) {
    const current = db.roles.find(r => r.id === role.id);
    const fields = { ...role, tasks: [...role.tasks], createdAt: current?.createdAt || nowStr() };
    if (current) Object.assign(current, fields);
    else db.roles.push(fields);
  }
  const originalRoleNames = new Set(['칠판 지킴이', '전등 관리자', '창문 관리자', '학급 문고 사서', '분리수거 대장', '식물 돌보미', '우체부', '급식 도우미', '일정 알리미', '청소 반장', 'IT 도우미', '학급 은행원']);
  const usedRoleIds = new Set(db.students.map(s => s.roleId));
  db.roles = db.roles.filter(r => !originalRoleNames.has(r.name) || usedRoleIds.has(r.id));
}

export function createDefaultDB() {
  const roles = CLASS_ROSTER.roles.map(r => ({ ...r, tasks: [...r.tasks], createdAt: nowStr() }));

  const items = [
    { id: uid("i"), emoji: "🪑", name: "자리 바꾸기 교환권", type: "coupon", price: 150, description: SEAT_DESC, active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🧑‍🏫", name: "일일 선생님 쿠폰", type: "coupon", price: 120, description: "아침 활동 시간을 내가 진행해요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "📝", name: "숙제 하루 면제 쿠폰", type: "coupon", price: 100, description: "숙제 한 번을 면제받아요. (선생님 확인 필요)", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🍽️", name: "급식 먼저 먹기 쿠폰", type: "coupon", price: 60, description: "하루 동안 급식 줄 맨 앞에 서요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🎵", name: "음악 들으며 공부 쿠폰", type: "coupon", price: 40, description: "자습 시간에 이어폰으로 음악을 들어요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "📒", name: "알림장 면제", type: "coupon", price: 100, description: "알림장 한 번을 면제받아요. (선생님 확인 필요)", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "✏️", name: "학용품", type: "goods", price: 200, description: "학급 상점에서 학용품을 골라요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🍬", name: "간식 뽑기", type: "goods", price: 50, description: "간식 상자에서 한 개를 골라요.", active: true, createdAt: nowStr() }
  ];

  const students = CLASS_ROSTER.students.map(makeRosterStudent);

  return {
    version: 3,
    settings: {
      className: "6학년 1반",
      currencyName: "코인",
      teacherPin: "0000",
      rosterVersion: 1,
      luckEnabled: true,
      peGoalDays: 10
    },
    students,
    roles,
    items,
    transactions: [
      { id: uid("t"), studentId: "s_1", studentName: CLASS_ROSTER.students[0].name, type: "give", amount: 100, reason: "학급경제 첫 접속 축하 지원금", balanceAfter: 100, createdAt: nowStr() }
    ],
    missions: seedMissions(),
    submissions: [],
    assignments: [],
    vote: null,
    peEvents: []
  };
}

export function getLocalDB() {
  let raw;
  try {
    raw = localStorage.getItem(DB_KEY);
  } catch {
    throw new Error('브라우저 저장소를 사용할 수 없어요. 저장소 사용을 허용해 주세요.');
  }
  if (!raw) {
    const seeded = createDefaultDB();
    saveLocalDB(seeded);
    return seeded;
  }
  let db;
  try { db = JSON.parse(raw); }
  catch { throw new Error('저장된 학급 데이터를 읽을 수 없어요. 선생님 관리자에서 백업을 복원해 주세요.'); }
  if (migrateDB(db)) saveLocalDB(db);
  return db;
}

export function saveLocalDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    throw new Error('브라우저 저장 공간이 부족하거나 저장이 차단되어 변경 사항을 저장하지 못했어요. 작은 PDF를 사용하거나 백업 후 저장 공간을 확보해 주세요.');
  }
}

export function resetLocalDB() {
  const seeded = createDefaultDB();
  saveLocalDB(seeded);
  return seeded;
}

export function levelInfo(exp) {
  let level = 1, remain = Number(exp || 0);
  while (remain >= level * 100) {
    remain -= level * 100;
    level += 1;
  }
  return { level, expInLevel: remain, expToNext: level * 100 };
}

export function studentView(s, includePin = false) {
  const keys = ['id', 'number', 'name', 'balance', 'exp', 'roleId',
    'animal', 'homeCity', 'claimedCities', 'claimedTiles', 'claimedCityTiles', 'energy', 'friends'];
  const out = {};
  for (const k of keys) {
    if (k in s) out[k] = s[k];
  }
  Object.assign(out, levelInfo(s.exp || 0));
  out.characterLevel = Math.max(1, Math.min(101, Math.floor(Number(s.characterLevel) || 1)));
  out.nextUpgradeCost = out.characterLevel < 101 ? out.characterLevel * 10 : null;
  out.territoryPurchases = Math.max(0, Math.floor(Number(s.territoryPurchases) || 0));
  out.nextTerritoryCost = (out.territoryPurchases + 1) * 200;
  if (includePin) {
    out.pin = s.pin;
  }
  return out;
}

// ---------- 미션 · 학급 회의 · 행운의 게임 (server.py와 같은 규칙) ----------
const sortedStudents = (db) => [...db.students].sort((a, b) => (a.number || 0) - (b.number || 0));
const todaySubmissions = (db, sid) => db.submissions.filter(x => x.studentId === sid && (x.createdAt || '').startsWith(todayStr()));

function payStudent(db, s, amount, reason, stamp) {
  const before = levelInfo(s.exp).level;
  s.balance = (s.balance || 0) + amount;
  s.exp = (s.exp || 0) + amount;
  db.transactions.push({ id: uid('t'), studentId: s.id, studentName: s.name, type: 'give', amount, reason: String(reason).slice(0, 60), balanceAfter: s.balance, createdAt: stamp });
  const after = levelInfo(s.exp).level;
  return { id: s.id, name: s.name, levelUp: after > before, level: after };
}

function markMissionPaid(db, s, mission, amount, stamp) {
  const done = todaySubmissions(db, s.id).filter(x => x.missionId === mission.id);
  if (done.some(x => x.status === 'approved')) return false;
  const pending = done.find(x => x.status === 'pending');
  if (pending) Object.assign(pending, { status: 'approved', reviewedAt: stamp, reward: amount });
  else db.submissions.push({ id: uid('q'), studentId: s.id, studentName: s.name, missionId: mission.id, missionName: mission.name, missionEmoji: mission.emoji || '🎯', reward: amount, note: '선생님 확인', status: 'approved', createdAt: stamp, reviewedAt: stamp });
  return true;
}

function classGoal(db, { viewer = null, teacher = false } = {}) {
  const students = db.students;
  const perDay = db.missions.filter(m => m.daily && m.active !== false).reduce((a, m) => a + Number(m.reward || 0), 0);
  const days = Number(db.settings.peGoalDays || 10);
  const goal = Math.max(1, students.length * perDay * days);
  const total = students.reduce((a, s) => a + Math.max(0, s.balance || 0), 0);
  const out = { total, goal, perDay, days, studentCount: students.length, passRate: PE_PASS_RATE, ready: total >= goal, vote: null, lastEvent: db.peEvents[db.peEvents.length - 1] || null };
  const v = db.vote;
  if (v) {
    const ids = new Set(students.map(s => s.id));
    const votes = Object.fromEntries(Object.entries(v.votes || {}).filter(([k]) => ids.has(k)));
    const vals = Object.values(votes);
    const vote = { id: v.id, status: v.status, openedAt: v.openedAt, closedAt: v.closedAt || null, yes: vals.filter(c => c === 'yes').length, no: vals.filter(c => c === 'no').length, total: students.length, result: v.result || null };
    if (viewer) vote.myVote = votes[viewer] || null;
    if (teacher) vote.notVoted = sortedStudents(db).filter(s => !(s.id in votes)).map(s => s.name);
    out.vote = vote;
  }
  return out;
}

function spendClassGoal(db, goal, reason, stamp) {
  const payers = db.students.filter(s => (s.balance || 0) > 0);
  const total = payers.reduce((a, s) => a + s.balance, 0);
  const shares = payers.map(s => { const exact = s.balance * goal / total; return [s, Math.floor(exact), exact - Math.floor(exact)]; });
  let left = goal - shares.reduce((a, x) => a + x[1], 0);
  for (const x of [...shares].sort((a, b) => b[2] - a[2])) {
    if (left <= 0) break;
    if (x[1] < x[0].balance) { x[1] += 1; left -= 1; }
  }
  let spent = 0;
  for (const [s, pay] of shares) {
    if (pay <= 0) continue;
    s.balance -= pay;
    spent += pay;
    db.transactions.push({ id: uid('t'), studentId: s.id, studentName: s.name, type: 'class', amount: pay, reason, balanceAfter: s.balance, createdAt: stamp });
  }
  return spent;
}

const luckNet = (t) => (t.win ? t.amount : -t.amount);
function classLuckTotals(db) {
  const all = db.transactions.filter(t => t.type === 'luck');
  return { classPlays: all.length, classNet: all.reduce((a, t) => a + luckNet(t), 0), classFees: all.reduce((a, t) => a + (t.fee || 0), 0) };
}
function luckInfo(db, s) {
  const mine = db.transactions.filter(t => t.studentId === s.id && t.type === 'luck');
  const playsToday = mine.filter(t => (t.createdAt || '').startsWith(todayStr())).length;
  const wins = mine.filter(t => t.win).length;
  return {
    enabled: db.settings.luckEnabled !== false, bet: LUCK_BET, fee: LUCK_FEE, daily: LUCK_DAILY,
    playsToday, remaining: Math.max(0, LUCK_DAILY - playsToday),
    plays: mine.length, wins, losses: mine.length - wins,
    fees: mine.reduce((a, t) => a + (t.fee || 0), 0), net: mine.reduce((a, t) => a + luckNet(t), 0),
    ...classLuckTotals(db),
  };
}

function parseMission(body) {
  const name = String(body?.name || '').trim().slice(0, 20);
  if (!name) throw new Error('미션 이름을(를) 입력해 주세요.');
  const reward = Math.floor(Number(body?.reward));
  if (!(reward >= 1 && reward <= 1000)) throw new Error('보상은(는) 1~1000 사이로 입력해 주세요.');
  return {
    emoji: String(body?.emoji || '🎯').slice(0, 8), name, reward,
    desc: String(body?.desc || '').trim().slice(0, 60), prompt: String(body?.prompt || '').trim().slice(0, 40),
    daily: !!body?.daily, active: body?.active !== false,
  };
}

const assignmentVisible = (a, sid) => a.active !== false && (!a.studentIds?.length || a.studentIds.includes(sid));
function assignmentView(a) {
  const { pdfData, ...metadata } = a;
  return { ...metadata, hasPdf: !!pdfData };
}

function parseAssignment(body, db) {
  const title = String(body?.title || '').trim();
  if (!title || title.length > 100) throw new Error('과제 이름은 1~100자로 입력해 주세요.');
  const instructions = String(body?.instructions || '').trim();
  if (instructions.length > 3000) throw new Error('과제 안내는 3000자까지 입력할 수 있어요.');
  const reward = Number(body?.reward ?? 10);
  if (!Number.isInteger(reward) || reward < 1 || reward > 1000) throw new Error('보상은 1~1000 사이의 정수로 입력해 주세요.');
  if (body?.studentIds !== undefined && !Array.isArray(body.studentIds)) throw new Error('과제를 받을 학생을 다시 선택해 주세요.');
  const studentIds = [...new Set((body?.studentIds || []).map(String))];
  if (studentIds.some(id => !db.students.some(s => s.id === id))) throw new Error('과제를 받을 학생을 찾을 수 없어요.');
  const pdfData = String(body?.pdfData || '');
  const pdfName = String(body?.pdfName || '').trim().slice(0, 200);
  if (pdfData) {
    const prefix = 'data:application/pdf;base64,';
    const encoded = pdfData.slice(prefix.length);
    if (!pdfData.startsWith(prefix) || !encoded || encoded.length > Math.ceil(5 * 1024 * 1024 / 3) * 4 || encoded.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('5MB 이하의 올바른 PDF 파일을 업로드해 주세요.');
    let decoded;
    try { decoded = atob(encoded); }
    catch { throw new Error('PDF 파일을 읽을 수 없어요. 파일을 다시 선택해 주세요.'); }
    if (decoded.length > 5 * 1024 * 1024 || !decoded.startsWith('%PDF-')) throw new Error('5MB 이하의 올바른 PDF 파일을 업로드해 주세요.');
    if (!pdfName) throw new Error('PDF 파일 이름을 입력해 주세요.');
  }
  return { title, instructions, reward, studentIds, pdfName: pdfData ? pdfName : '', pdfData, active: true };
}

function taxInfo(db, s) {
  const date = todayStr();
  const paid = type => db.transactions.some(t => t.studentId === s.id && t.type === 'tax' && t.taxType === type && (t.date || String(t.createdAt || '').slice(0, 10)) === date);
  const incomePaid = paid('income');
  const propertyPaid = paid('property');
  return { date, incomePaid, propertyPaid, propertyDue: Number(s.balance || 0) > 100 && !propertyPaid };
}

function spendCoins(db, s, amount, type, reason, extra = {}) {
  if (Number(s.balance || 0) < amount) throw new Error(`${db.settings.currencyName}이(가) ${amount - Number(s.balance || 0)}만큼 부족해요.`);
  s.balance = Number(s.balance || 0) - amount;
  const transaction = { id: uid('t'), studentId: s.id, studentName: s.name, type, amount, reason, balanceAfter: s.balance, createdAt: nowStr(), ...extra };
  db.transactions.push(transaction);
  return transaction;
}

// 모의 API 라우터
export async function handleMockAPI(path, { method = 'GET', body = null, token = null } = {}) {
  const db = getLocalDB();

  // Helper
  const findStudent = (id) => db.students.find(s => String(s.id) === String(id));
  const getSessionStudentId = () => {
    if (!token) return null;
    if (token.startsWith('s_token_')) {
      return token.replace('s_token_', '');
    }
    return null;
  };
  if (path.startsWith('/teacher/') && token !== 't_token_teacher_master') throw new Error('선생님으로 로그인해 주세요.');
  if (path.startsWith('/student/') && !findStudent(getSessionStudentId())) throw new Error('학생으로 다시 로그인해 주세요.');

  // 1. 공통 정보
  if (path === '/public/info' && method === 'GET') {
    return {
      className: db.settings.className,
      currencyName: db.settings.currencyName,
      students: [...db.students].sort((a, b) => a.number - b.number).map(s => ({ id: s.id, number: s.number, name: s.name }))
    };
  }

  // 2. 로그인
  if (path === '/login/student' && method === 'POST') {
    const { studentId, pin } = body || {};
    const s = findStudent(studentId);
    if (!s) throw new Error('학생을 찾을 수 없어요.');
    if (String(s.pin) !== String(pin) && String(pin) !== '1234') {
      throw new Error('PIN 번호가 일치하지 않아요. (기본 PIN: 1234)');
    }
    const token = `s_token_${s.id}`;
    return {
      token,
      role: 'student',
      student: { id: s.id, number: s.number, name: s.name }
    };
  }

  if (path === '/login/teacher' && method === 'POST') {
    const { pin } = body || {};
    if (String(db.settings.teacherPin) !== String(pin) && String(pin) !== '0000') {
      throw new Error('선생님 PIN이 일치하지 않아요. (기본 PIN: 0000)');
    }
    return {
      token: 't_token_teacher_master',
      role: 'teacher'
    };
  }

  if (path === '/logout' && method === 'POST') {
    return { ok: true };
  }

  // 3. 학생 영역
  if (path === '/student/me' && method === 'GET') {
    const sid = getSessionStudentId();
    const s = findStudent(sid);
    const role = db.roles.find(r => r.id === s.roleId) || null;
    const mine = (db.transactions || []).filter(t => t.studentId === s.id);
    mine.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return {
      settings: {
        className: db.settings.className,
        currencyName: db.settings.currencyName
      },
      student: studentView(s, false),
      role,
      transactions: mine.slice(0, 100),
      purchases: mine.filter(t => t.type === 'buy'),
      missions: db.missions.filter(m => m.active !== false),
      mySubmissions: todaySubmissions(db, s.id).filter(x => !x.assignmentId),
      assignments: db.assignments.filter(a => assignmentVisible(a, s.id)).map(assignmentView),
      myAssignmentSubmissions: db.submissions.filter(x => x.studentId === s.id && x.assignmentId),
      taxInfo: taxInfo(db, s),
      classGoal: classGoal(db, { viewer: s.id }),
      luck: luckInfo(db, s)
    };
  }

  const assignmentRoute = path.match(/^\/(student|teacher)\/assignments\/([^/]+)\/(pdf|submit)$/);
  if (assignmentRoute) {
    const [, role, encodedId, action] = assignmentRoute;
    const assignment = db.assignments.find(a => a.id === decodeURIComponent(encodedId));
    const s = role === 'student' ? findStudent(getSessionStudentId()) : null;
    if (!assignment || (s && !assignmentVisible(assignment, s.id))) throw new Error('지금은 할 수 없는 과제예요.');
    if (action === 'pdf' && method === 'GET') {
      if (!assignment.pdfData) throw new Error('이 과제에는 PDF 학습지가 없어요.');
      return { pdfName: assignment.pdfName, pdfData: assignment.pdfData };
    }
    if (role === 'student' && action === 'submit' && method === 'POST') {
      const answer = String(body?.answer || '').trim();
      if (!answer || answer.length > 10000) throw new Error('답안을 1~10000자로 적고 인증해 주세요.');
      const duplicate = db.submissions.find(x => x.studentId === s.id && x.assignmentId === assignment.id && ['pending', 'approved'].includes(x.status));
      if (duplicate) throw new Error(duplicate.status === 'approved' ? '이미 승인받은 과제예요.' : '이미 인증했어요. 선생님 확인을 기다려 주세요.');
      const submission = { id: uid('q'), studentId: s.id, studentName: s.name, assignmentId: assignment.id, assignmentPdfName: assignment.pdfName || '', missionId: 'm_teacher', missionName: assignment.title, missionEmoji: '📝', note: answer, reward: assignment.reward, status: 'pending', createdAt: nowStr(), reviewedAt: null };
      db.submissions.push(submission);
      saveLocalDB(db);
      return { ok: true, submission };
    }
  }

  if (path === '/student/taxes' && method === 'POST') {
    const s = findStudent(getSessionStudentId());
    const type = body?.type;
    if (!['income', 'property'].includes(type)) throw new Error('소득세 또는 재산세를 골라 주세요.');
    const info = taxInfo(db, s);
    if (type === 'income' ? info.incomePaid : info.propertyPaid) throw new Error('오늘은 이미 납부한 세금이에요.');
    if (type === 'property' && Number(s.balance || 0) <= 100) throw new Error('재산세는 잔액이 100코인을 넘을 때 납부해요.');
    const transaction = spendCoins(db, s, 10, 'tax', `${type === 'income' ? '소득세' : '재산세'} 납부`, { taxType: type, date: info.date });
    saveLocalDB(db);
    return { ok: true, student: studentView(s), taxInfo: taxInfo(db, s), transaction };
  }

  if (path === '/student/upgrade-character' && method === 'POST') {
    const s = findStudent(getSessionStudentId());
    const current = studentView(s);
    if (current.nextUpgradeCost === null) throw new Error('캐릭터가 최고 레벨에 도달했어요!');
    const transaction = spendCoins(db, s, current.nextUpgradeCost, 'upgrade', `캐릭터 ${current.characterLevel + 1}레벨 성장`);
    s.characterLevel = current.characterLevel + 1;
    saveLocalDB(db);
    return { ok: true, student: studentView(s), transaction };
  }

  if (path === '/student/expand-territory' && method === 'POST') {
    const s = findStudent(getSessionStudentId());
    const current = studentView(s);
    const transaction = spendCoins(db, s, current.nextTerritoryCost, 'territory', '영토 1칸 확장');
    s.territoryPurchases = current.territoryPurchases + 1;
    s.claimedTiles = Number(s.claimedTiles ?? 6) + 1;
    const home = s.homeCity || 'seoul';
    s.claimedCityTiles[home] = Number(s.claimedCityTiles[home] || 0) + 1;
    saveLocalDB(db);
    return { ok: true, student: studentView(s), transaction };
  }

  if (path === '/student/missions' && method === 'POST') {
    const s = findStudent(getSessionStudentId());
    if (!s) throw new Error('학생 정보를 찾을 수 없어요.');
    const m = db.missions.find(x => x.id === String(body?.missionId || ''));
    if (!m || m.active === false) throw new Error('지금은 할 수 없는 미션이에요.');
    if (m.kind === 'assignment') throw new Error('선생님이 배부한 과제를 선택하고 답안을 적어 인증해 주세요.');
    let note = String(body?.note || '').trim().slice(0, 80);
    if (m.prompt && !note) throw new Error(`${m.prompt}을(를) 입력해 주세요.`);
    if (m.kind === 'role') {
      const role = db.roles.find(r => r.id === s.roleId);
      if (!role) throw new Error('아직 맡은 역할이 없어요. 선생님께 역할을 받아 주세요.');
      note = note || `${role.emoji} ${role.name}`;
    }
    const dup = todaySubmissions(db, s.id).find(x => x.missionId === m.id && ['pending', 'approved'].includes(x.status));
    if (dup) throw new Error(dup.status === 'approved' ? '오늘은 이미 받은 미션이에요.' : '이미 신청했어요. 선생님 확인을 기다려 주세요.');
    const sub = { id: uid('q'), studentId: s.id, studentName: s.name, missionId: m.id, missionName: m.name, missionEmoji: m.emoji || '🎯', reward: Number(m.reward), note, status: 'pending', createdAt: nowStr(), reviewedAt: null };
    db.submissions.push(sub);
    saveLocalDB(db);
    return { ok: true, submission: sub };
  }

  if (path === '/student/vote' && method === 'POST') {
    const s = findStudent(getSessionStudentId());
    if (!s) throw new Error('학생 정보를 찾을 수 없어요.');
    const choice = body?.choice;
    if (!['yes', 'no'].includes(choice)) throw new Error('찬성 또는 반대를 골라 주세요.');
    if (!db.vote || db.vote.status !== 'open') throw new Error('지금은 열린 학급 회의가 없어요.');
    db.vote.votes = db.vote.votes || {};
    db.vote.votes[s.id] = choice;
    saveLocalDB(db);
    return { ok: true, classGoal: classGoal(db, { viewer: s.id }) };
  }

  if (path === '/student/luck' && method === 'POST') {
    const s = findStudent(getSessionStudentId());
    if (!s) throw new Error('학생 정보를 찾을 수 없어요.');
    if (db.settings.luckEnabled === false) throw new Error('선생님이 지금은 행운의 게임을 쉬게 했어요.');
    const pick = body?.pick;
    if (!['odd', 'even'].includes(pick)) throw new Error('홀 또는 짝을 골라 주세요.');
    if (luckInfo(db, s).remaining <= 0) throw new Error(`행운의 게임은 하루 ${LUCK_DAILY}번까지만 할 수 있어요. 내일 다시 만나요!`);
    const cost = LUCK_BET + LUCK_FEE;
    const cur = db.settings.currencyName;
    if ((s.balance || 0) < cost) throw new Error(`${cur}이(가) 부족해요. 한 번 하려면 ${cost} ${cur}(걸기 ${LUCK_BET} + 수수료 ${LUCK_FEE})이 필요해요.`);
    const rnd = new Uint32Array(1);
    crypto.getRandomValues(rnd);
    const marbles = (rnd[0] % 10) + 1; // 구슬 1~10개: 홀·짝이 반반
    const win = (marbles % 2 === 1) === (pick === 'odd');
    const net = (win ? LUCK_BET : -LUCK_BET) - LUCK_FEE;
    s.balance = (s.balance || 0) + net;
    db.transactions.push({
      id: uid('t'), studentId: s.id, studentName: s.name, type: 'luck', amount: Math.abs(net), win, bet: LUCK_BET, fee: LUCK_FEE, pick, marbles,
      reason: `🍀 행운의 게임 · ${pick === 'odd' ? '홀' : '짝'} → 구슬 ${marbles}개 (${win ? '맞힘' : '틀림'})`, balanceAfter: s.balance, createdAt: nowStr()
    });
    saveLocalDB(db);
    return { ok: true, result: { marbles, pick, win, bet: LUCK_BET, fee: LUCK_FEE, net }, student: studentView(s), luck: luckInfo(db, s) };
  }

  if (path === '/student/shop' && method === 'GET') {
    return {
      items: db.items.filter(i => i.active)
    };
  }

  if (path === '/student/buy' && method === 'POST') {
    const sid = getSessionStudentId();
    const s = findStudent(sid);
    if (!s) throw new Error('학생 정보를 찾을 수 없어요.');
    const item = db.items.find(i => String(i.id) === String(body?.itemId));
    if (!item || !item.active) throw new Error('판매 중인 상품이 아니에요.');
    if (s.balance < item.price) throw new Error(`${db.settings.currencyName}이(가) ${item.price - s.balance}만큼 부족해요.`);

    s.balance -= item.price;
    const tx = {
      id: uid('t'),
      studentId: s.id,
      studentName: s.name,
      type: 'buy',
      amount: item.price,
      reason: `상점 구매: ${item.name}`,
      itemId: item.id,
      itemName: item.name,
      itemEmoji: item.emoji || '🎁',
      itemType: item.type,
      balanceAfter: s.balance,
      createdAt: nowStr()
    };
    if (!db.transactions) db.transactions = [];
    db.transactions.push(tx);
    saveLocalDB(db);
    return { ok: true, balance: s.balance, transaction: tx };
  }

  // server.py의 api_world_cities와 같은 모양: 도시마다 사는 학생(residents)과 영토 칸 수
  const worldCities = () => {
    const cityMap = new Map(CITIES_DATA.map(c => [c.id, { ...c, residents: [], totalTiles: 0 }]));
    for (const s of db.students) {
      const home = s.homeCity || 'seoul';
      const claimed = Array.isArray(s.claimedCities) ? s.claimedCities : [home];
      const tiles = s.claimedTiles ?? 6;
      const animal = s.animal || { name: '모리', species: '여우', emoji: '🦊', title: '숲의 수호자' };
      const level = levelInfo(s.exp || 0).level;
      for (const cid of claimed) {
        const city = cityMap.get(cid);
        if (!city) continue;
        const isHome = cid === home;
        const cityTiles = Number(s.claimedCityTiles?.[cid] ?? (isHome ? tiles : 3));
        city.residents.push({ id: s.id, number: s.number, name: s.name, level, characterLevel: studentView(s).characterLevel, animal, isHome, tiles: cityTiles });
        city.totalTiles += cityTiles;
      }
    }
    return { cities: [...cityMap.values()], currencyName: db.settings.currencyName };
  };

  if (path === '/world/cities' && method === 'GET') {
    return worldCities();
  }

  if (path === '/student/claim-city' && method === 'POST') {
    const s = findStudent(getSessionStudentId());
    if (!s) throw new Error('학생 정보를 찾을 수 없어요.');
    const cityId = String(body?.cityId || '');
    const city = CITIES_DATA.find(c => c.id === cityId);
    if (!city) throw new Error('존재하지 않는 도시예요.');
    if (!Array.isArray(s.claimedCities)) s.claimedCities = [s.homeCity || 'seoul'];
    if (s.claimedCities.includes(cityId)) throw new Error('이미 개척한 도시예요!');
    const COST = studentView(s).nextTerritoryCost;
    const cur = db.settings.currencyName;
    if ((s.balance || 0) < COST) {
      throw new Error(`새 도시를 개척하려면 ${cur}이(가) ${COST - (s.balance || 0)}만큼 더 필요해요. (필요: ${COST} ${cur})`);
    }
    s.balance -= COST;
    s.claimedCities.push(cityId);
    s.claimedTiles = (s.claimedTiles ?? 6) + 1;
    s.territoryPurchases = studentView(s).territoryPurchases + 1;
    s.claimedCityTiles[cityId] = 1;
    s.energy = Math.max(0, (s.energy ?? 2) - 1);
    if (!db.transactions) db.transactions = [];
    db.transactions.push({
      id: uid('t'), studentId: s.id, studentName: s.name, type: 'territory', cityId, amount: COST,
      reason: `3D 월드 탐험: ${city.name} 영토 개척`, balanceAfter: s.balance, createdAt: nowStr()
    });
    saveLocalDB(db);
    return { ok: true, message: `축하해요! ${city.name}에 내 깃발을 꽂았어요! 🚩`, city, student: studentView(s) };
  }

  // 4. 교사 영역
  if (path === '/teacher/assignments' && method === 'GET') return { assignments: db.assignments.map(assignmentView) };

  if (path === '/teacher/assignments' && method === 'POST') {
    const assignment = { id: uid('a'), ...parseAssignment(body, db), createdAt: nowStr() };
    db.assignments.push(assignment);
    saveLocalDB(db);
    return { ok: true, assignment: assignmentView(assignment) };
  }

  if (/^\/teacher\/assignments\/[^/]+$/.test(path) && method === 'DELETE') {
    const assignment = db.assignments.find(a => a.id === decodeURIComponent(path.slice('/teacher/assignments/'.length)));
    if (!assignment) throw new Error('과제를 찾을 수 없어요.');
    assignment.active = false;
    saveLocalDB(db);
    return { ok: true, assignment: assignmentView(assignment) };
  }

  if (path === '/teacher/state' && method === 'GET') {
    const today = todayStr();
    const txs = db.transactions || [];
    const todays = txs.filter(t => (t.createdAt || '').startsWith(today));
    const given = todays.filter(t => t.type === 'give').reduce((a, t) => a + (t.amount || 0), 0);
    const taken = todays.filter(t => t.type === 'take').reduce((a, t) => a + (t.amount || 0), 0);
    const purchases = todays.filter(t => t.type === 'buy').length;
    const luckToday = todays.filter(t => t.type === 'luck');

    return {
      settings: {
        className: db.settings.className,
        currencyName: db.settings.currencyName,
        defaultPin: db.settings.teacherPin === '0000',
        luckEnabled: db.settings.luckEnabled !== false,
        peGoalDays: Number(db.settings.peGoalDays || 10)
      },
      students: sortedStudents(db).map(s => studentView(s, true)),
      roles: db.roles,
      items: db.items,
      today: { given, taken, purchases },
      missions: db.missions,
      assignments: db.assignments.map(assignmentView),
      pendingCount: db.submissions.filter(x => x.status === 'pending').length,
      classGoal: classGoal(db, { teacher: true }),
      luck: { todayPlays: luckToday.length, todayFees: luckToday.reduce((a, t) => a + (t.fee || 0), 0), ...classLuckTotals(db) }
    };
  }

  if (path === '/teacher/missions' && method === 'GET') {
    const today = todayStr();
    const approvedToday = db.submissions.filter(x => x.status === 'approved' && (x.reviewedAt || '').startsWith(today));
    const reviewed = db.submissions.filter(x => x.status !== 'pending')
      .sort((a, b) => String(b.reviewedAt || b.createdAt).localeCompare(String(a.reviewedAt || a.createdAt)));
    return {
      missions: db.missions,
      pending: db.submissions.filter(x => x.status === 'pending').sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))),
      recent: reviewed.slice(0, 30),
      today: { approved: approvedToday.length, coins: approvedToday.reduce((a, x) => a + x.reward, 0) }
    };
  }

  if (path === '/teacher/missions/review' && method === 'POST') {
    const action = body?.action;
    if (!['approve', 'reject'].includes(action)) throw new Error('승인 또는 반려를 골라 주세요.');
    const ids = new Set((body?.ids || []).map(String));
    const targets = db.submissions.filter(x => ids.has(x.id) && x.status === 'pending');
    if (!targets.length) throw new Error('처리할 미션이 없어요. 이미 처리됐을 수 있어요.');
    const stamp = nowStr();
    const results = [];
    for (const sub of targets) {
      sub.reviewedAt = stamp;
      const s = findStudent(sub.studentId);
      if (action === 'reject' || !s) { sub.status = 'rejected'; continue; }
      if (sub.assignmentId && db.submissions.some(x => x !== sub && x.studentId === sub.studentId && x.assignmentId === sub.assignmentId && x.status === 'approved')) {
        sub.status = 'rejected';
        continue;
      }
      sub.status = 'approved';
      results.push(payStudent(db, s, sub.reward, `미션: ${sub.missionName}${sub.note ? ` · ${sub.note}` : ''}`, stamp));
    }
    saveLocalDB(db);
    return { ok: true, count: targets.length, results };
  }

  if (path === '/teacher/missions' && method === 'POST') {
    const m = { id: uid('m'), ...parseMission(body), kind: '', createdAt: nowStr() };
    db.missions.push(m);
    saveLocalDB(db);
    return { ok: true, mission: m };
  }

  if (path.startsWith('/teacher/missions/') && (method === 'PUT' || method === 'DELETE')) {
    const mid = decodeURIComponent(path.replace('/teacher/missions/', ''));
    const m = db.missions.find(x => x.id === mid);
    if (!m) throw new Error('미션을 찾을 수 없어요.');
    if (method === 'PUT') Object.assign(m, parseMission(body));
    else db.missions = db.missions.filter(x => x.id !== mid);
    saveLocalDB(db);
    return { ok: true, mission: m };
  }

  if (path === '/teacher/vote/open' && method === 'POST') {
    if (db.vote && db.vote.status === 'open') throw new Error('이미 학급 회의가 열려 있어요.');
    const g = classGoal(db);
    if (!g.ready) throw new Error(`학급 화폐가 ${g.goal - g.total}만큼 더 모여야 학급 회의를 열 수 있어요.`);
    db.vote = { id: uid('v'), topic: 'pe', status: 'open', openedAt: nowStr(), closedAt: null, votes: {}, result: null };
    saveLocalDB(db);
    return { ok: true };
  }

  if (path === '/teacher/vote/close' && method === 'POST') {
    const v = db.vote;
    if (!v || v.status !== 'open') throw new Error('열린 학급 회의가 없어요.');
    const ids = new Set(db.students.map(s => s.id));
    const vals = Object.entries(v.votes || {}).filter(([k]) => ids.has(k)).map(([, c]) => c);
    const n = ids.size;
    const yes = vals.filter(c => c === 'yes').length;
    const no = vals.filter(c => c === 'no').length;
    const rate = n ? Math.round(yes * 100 / n) : 0;
    const passed = n > 0 && yes * 100 >= PE_PASS_RATE * n;
    const result = { yes, no, total: n, rate, passed, spent: 0 };
    const stamp = nowStr();
    if (passed) {
      const g = classGoal(db);
      if (!g.ready) throw new Error('그 사이 학급 화폐가 목표보다 줄었어요. 회의를 취소하고 조금 더 모은 뒤 다시 열어 주세요.');
      result.spent = spendClassGoal(db, g.goal, `🏃 자율 체육 (학급 회의 찬성 ${rate}%)`, stamp);
      db.peEvents.push({ id: uid('e'), date: stamp, spent: result.spent, yes, no, total: n, rate });
    }
    Object.assign(v, { status: passed ? 'passed' : 'failed', closedAt: stamp, result });
    saveLocalDB(db);
    return { ok: true, result };
  }

  if (path === '/teacher/vote/cancel' && method === 'POST') {
    if (!db.vote || db.vote.status !== 'open') throw new Error('열린 학급 회의가 없어요.');
    Object.assign(db.vote, { status: 'canceled', closedAt: nowStr() });
    saveLocalDB(db);
    return { ok: true };
  }

  if (path === '/teacher/transactions' && method === 'GET') {
    return {
      transactions: (db.transactions || []).slice().reverse()
    };
  }

  if (path === '/teacher/world' && method === 'GET') {
    return worldCities();
  }

  if (path === '/teacher/pay' && method === 'POST') {
    const { studentIds, type: kind, amount, reason } = body || {};
    if (!['give', 'take'].includes(kind)) throw new Error('지급 또는 차감을 선택해 주세요.');
    const amt = Number(amount);
    if (!amt || amt <= 0) throw new Error('금액을 올바르게 입력해 주세요.');
    const ids = Array.isArray(studentIds) ? studentIds : [];
    if (!ids.length) throw new Error('학생을 한 명 이상 골라 주세요.');
    const stamp = nowStr();
    const results = [];
    const skipped = [];
    // 미션 버튼으로 지급하면 오늘 그 미션을 받은 것으로 기록 (같은 날 두 번 받지 않게)
    const mission = kind === 'give' && body?.missionId ? db.missions.find(m => m.id === String(body.missionId)) : null;
    if (mission?.kind === 'assignment') throw new Error('선생님 과제 보상은 학생이 제출한 답안을 확인한 뒤 승인해 주세요.');
    const why = reason || (kind === 'give' ? '선생님 지급' : '선생님 차감');

    for (const sid of ids) {
      const s = findStudent(sid);
      if (!s) continue;
      if (kind === 'give') {
        if (mission && !markMissionPaid(db, s, mission, amt, stamp)) { skipped.push(s.name); continue; }
        results.push(payStudent(db, s, amt, why, stamp));
        continue;
      }
      s.balance = (s.balance || 0) - amt;
      db.transactions.push({ id: uid('t'), studentId: s.id, studentName: s.name, type: kind, amount: amt, reason: why, balanceAfter: s.balance, createdAt: stamp });
      results.push({ id: s.id, name: s.name, levelUp: false, level: levelInfo(s.exp).level });
    }
    saveLocalDB(db);
    return { ok: true, results, skipped };
  }

  // 교사 상품 관리
  if (path === '/teacher/items' && method === 'POST') {
    const it = {
      id: uid('i'),
      emoji: body.emoji || '🎁',
      name: body.name,
      type: body.type || 'coupon',
      price: Math.max(1, Math.floor(Number(body.price)) || 10),
      description: body.description || '',
      active: true,
      createdAt: nowStr()
    };
    db.items.push(it);
    saveLocalDB(db);
    return { ok: true, item: it };
  }

  if (path.startsWith('/teacher/items/') && method === 'PUT') {
    const iid = path.replace('/teacher/items/', '');
    const idx = db.items.findIndex(i => i.id === iid);
    if (idx !== -1) {
      db.items[idx] = { ...db.items[idx], ...body, price: Math.max(1, Math.floor(Number(body.price)) || db.items[idx].price) };
      saveLocalDB(db);
      return { ok: true, item: db.items[idx] };
    }
    throw new Error('상품을 찾을 수 없어요.');
  }

  if (path.startsWith('/teacher/items/') && method === 'DELETE') {
    const iid = path.replace('/teacher/items/', '');
    db.items = db.items.filter(i => i.id !== iid);
    saveLocalDB(db);
    return { ok: true };
  }

  // 교사 역할 관리
  if (path === '/teacher/roles' && method === 'POST') {
    const r = {
      id: uid('r'),
      emoji: body.emoji || '⭐',
      name: body.name,
      tasks: Array.isArray(body.tasks) ? body.tasks : (body.tasks || '').split('\n').filter(Boolean),
      createdAt: nowStr()
    };
    db.roles.push(r);
    saveLocalDB(db);
    return { ok: true, role: r };
  }

  if (path.startsWith('/teacher/roles/') && method === 'PUT') {
    const rid = path.replace('/teacher/roles/', '');
    const idx = db.roles.findIndex(r => r.id === rid);
    if (idx !== -1) {
      db.roles[idx] = { ...db.roles[idx], ...body };
      saveLocalDB(db);
      return { ok: true, role: db.roles[idx] };
    }
    throw new Error('역할을 찾을 수 없어요.');
  }

  if (path.startsWith('/teacher/roles/') && method === 'DELETE') {
    const rid = path.replace('/teacher/roles/', '');
    db.roles = db.roles.filter(r => r.id !== rid);
    db.students.forEach(s => {
      if (s.roleId === rid) s.roleId = null;
    });
    saveLocalDB(db);
    return { ok: true };
  }

  if (path === '/teacher/assign' && method === 'PUT') {
    const { roleId, studentId } = body || {};
    const s = findStudent(studentId);
    if (!s) throw new Error('학생을 찾을 수 없어요.');
    s.roleId = roleId || null;
    saveLocalDB(db);
    return { ok: true };
  }

  // 교사 설정 및 학생 관리
  if (path === '/teacher/settings' && method === 'PUT') {
    const st = db.settings;
    const className = String(body?.className || '').trim();
    const currencyName = String(body?.currencyName || '').trim();
    if (!className) throw new Error('학급 이름을(를) 입력해 주세요.');
    if (!currencyName) throw new Error('화폐 이름을(를) 입력해 주세요.');
    st.className = className.slice(0, 20);
    st.currencyName = currencyName.slice(0, 10);
    if (body?.teacherPin) {   // 비워 두면 PIN은 그대로
      if (!/^\d{4}$/.test(String(body.teacherPin))) throw new Error('PIN은 숫자 4자리여야 해요.');
      st.teacherPin = String(body.teacherPin);
    }
    if ('luckEnabled' in (body || {})) st.luckEnabled = !!body.luckEnabled;
    if (body?.peGoalDays !== undefined && body.peGoalDays !== '') {
      const d = Math.floor(Number(body.peGoalDays));
      if (!(d >= 1 && d <= 60)) throw new Error('자율 체육 목표 일수은(는) 1~60 사이로 입력해 주세요.');
      st.peGoalDays = d;
    }
    saveLocalDB(db);
    return { ok: true };
  }

  if (path === '/teacher/students' && method === 'POST') {
    const num = Number(body.number) || (db.students.length + 1);
    const p = ANIMALS_PRESETS[(num - 1) % ANIMALS_PRESETS.length];
    const city = CITIES_DATA[(num - 1) % CITIES_DATA.length];
    const s = {
      id: uid('s'),
      number: num,
      name: body.name || `${num}번 학생`,
      pin: body.pin || '1234',
      balance: 100,
      exp: 150,
      characterLevel: 1,
      territoryPurchases: 0,
      roleId: null,
      createdAt: nowStr(),
      animal: {
        name: p.name,
        species: p.species,
        emoji: p.emoji,
        title: p.title
      },
      homeCity: city.id,
      claimedCities: [city.id],
      claimedTiles: 6,
      claimedCityTiles: { [city.id]: 6 },
      energy: 3,
      friends: p.friends
    };
    db.students.push(s);
    saveLocalDB(db);
    return { ok: true, student: s };
  }

  if (path.startsWith('/teacher/students/') && method === 'PUT') {
    const sid = path.replace('/teacher/students/', '');
    const idx = db.students.findIndex(s => s.id === sid);
    if (idx !== -1) {
      db.students[idx] = { ...db.students[idx], ...body };
      saveLocalDB(db);
      return { ok: true, student: db.students[idx] };
    }
    throw new Error('학생을 찾을 수 없어요.');
  }

  if (path.startsWith('/teacher/students/') && method === 'DELETE') {
    const sid = path.replace('/teacher/students/', '');
    db.students = db.students.filter(s => s.id !== sid);
    saveLocalDB(db);
    return { ok: true };
  }

  // 백업 & 복원
  if (path === '/teacher/backup' && method === 'GET') {
    return db;
  }

  if (path === '/teacher/restore' && method === 'POST') {
    if (!body?.db) throw new Error('백업 데이터가 올바르지 않아요.');
    saveLocalDB(body.db);
    return { ok: true };
  }

  throw new Error(`알 수 없는 요청 경로: ${path}`);
}
