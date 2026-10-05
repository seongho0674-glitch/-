// ==========================================================
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

function nowStr() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '');
}

export function createDefaultDB() {
  const roles = [
    { id: uid("r"), emoji: "🧽", name: "칠판 지킴이", tasks: ["쉬는 시간마다 칠판 지우기", "분필·보드마커 정리하기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "💡", name: "전등 관리자", tasks: ["이동 수업 때 전등 끄기", "아침에 전등 켜기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "🪟", name: "창문 관리자", tasks: ["아침에 창문 열어 환기하기", "하교 전 창문 닫기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "📚", name: "학급 문고 사서", tasks: ["학급 문고 책 정리하기", "빌린 책 기록 확인하기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "🗑️", name: "분리수거 대장", tasks: ["분리수거함 정리하기", "금요일에 분리수거 버리기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "🪴", name: "식물 돌보미", tasks: ["화분에 물 주기 (월·수·금)", "시든 잎 정리하기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "📮", name: "우체부", tasks: ["가정통신문 나눠 주기", "제출물 걷어서 선생님께 드리기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "🍚", name: "급식 도우미", tasks: ["급식 전 손 씻기 안내하기", "급식 후 배식대 정리하기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "📅", name: "일정 알리미", tasks: ["칠판에 오늘 날짜·시간표 쓰기", "내일 준비물 알려 주기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "🧹", name: "청소 반장", tasks: ["청소 시간 역할 확인하기", "청소 도구 정리 확인하기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "💻", name: "IT 도우미", tasks: ["수업 전 TV·컴퓨터 켜기", "하교 전 컴퓨터 끄기"], createdAt: nowStr() },
    { id: uid("r"), emoji: "🏦", name: "학급 은행원", tasks: ["선생님 화폐 지급 기록 돕기", "친구들 잔액 질문 안내하기"], createdAt: nowStr() }
  ];

  const items = [
    { id: uid("i"), emoji: "🪑", name: "자리 바꾸기 쿠폰", type: "coupon", price: 50, description: "원하는 친구와 하루 동안 자리를 바꿔요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🎵", name: "음악 들으며 공부 쿠폰", type: "coupon", price: 30, description: "자습 시간에 이어폰으로 음악을 들어요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "📝", name: "숙제 하루 면제 쿠폰", type: "coupon", price: 80, description: "숙제 한 번을 면제받아요. (선생님 확인 필요)", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🍽️", name: "급식 먼저 먹기 쿠폰", type: "coupon", price: 40, description: "하루 동안 급식 줄 맨 앞에 서요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🧑‍🏫", name: "일일 선생님 쿠폰", type: "coupon", price: 120, description: "아침 활동 시간을 내가 진행해요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "✏️", name: "캐릭터 연필", type: "goods", price: 20, description: "귀여운 캐릭터 연필 한 자루", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "🍬", name: "간식 뽑기", type: "goods", price: 15, description: "간식 상자에서 한 개를 골라요.", active: true, createdAt: nowStr() },
    { id: uid("i"), emoji: "📒", name: "미니 노트", type: "goods", price: 25, description: "손바닥만 한 귀여운 노트", active: true, createdAt: nowStr() }
  ];

  const students = Array.from({ length: 25 }, (_, idx) => {
    const num = idx + 1;
    const p = ANIMALS_PRESETS[idx % ANIMALS_PRESETS.length];
    const city = CITIES_DATA[idx % CITIES_DATA.length];
    return {
      id: `s_${num}`,
      number: num,
      name: `${num}번 학생`,
      pin: "1234",
      balance: 100, // 웹 데모에서는 바로 체험할 수 있도록 기본 100 코인 제공
      exp: 150,     // 2레벨 체험 기본 제공
      roleId: roles[idx % roles.length].id,
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
      energy: 3,
      friends: p.friends
    };
  });

  return {
    version: 1,
    settings: {
      className: "6학년 1반",
      currencyName: "코인",
      teacherPin: "0000"
    },
    students,
    roles,
    items,
    transactions: [
      { id: uid("tx"), studentId: "s_1", studentName: "1번 학생", type: "pay", amount: 100, reason: "학급경제 첫 접속 축하 지원금", createdAt: nowStr() }
    ]
  };
}

export function getLocalDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) {
      const seeded = createDefaultDB();
      localStorage.setItem(DB_KEY, JSON.stringify(seeded));
      return seeded;
    }
    return JSON.parse(raw);
  } catch {
    const seeded = createDefaultDB();
    return seeded;
  }
}

export function saveLocalDB(db) {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (e) {
    console.error('LocalStorage 저장 실패:', e);
  }
}

export function resetLocalDB() {
  const seeded = createDefaultDB();
  saveLocalDB(seeded);
  return seeded;
}

// 모의 API 라우터
export async function handleMockAPI(path, { method = 'GET', body = null, token = null } = {}) {
  const db = getLocalDB();

  // Helper
  const findStudent = (id) => db.students.find(s => s.id === id);
  const getSessionStudentId = () => {
    if (!token) return null;
    if (token.startsWith('s_token_')) {
      return token.replace('s_token_', '');
    }
    return null;
  };

  // 1. 공통 정보
  if (path === '/public/info' && method === 'GET') {
    return {
      className: db.settings.className,
      currencyName: db.settings.currencyName,
      students: db.students.map(s => ({ id: s.id, number: s.number, name: s.name }))
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
    const s = findStudent(sid) || db.students[0];
    const level = Math.floor((s.exp || 0) / 100) + 1;
    const maxExp = level * 100;
    const role = db.roles.find(r => r.id === s.roleId) || null;
    const todayTasks = role ? role.tasks : [];
    const txs = db.transactions.filter(t => t.studentId === s.id).slice(-30).reverse();
    const myItems = db.transactions
      .filter(t => t.studentId === s.id && t.type === 'buy')
      .map(t => {
        const it = db.items.find(i => t.reason.includes(i.name)) || { emoji: '🎁', name: t.reason, type: 'coupon' };
        return {
          id: t.id,
          name: it.name,
          emoji: it.emoji,
          type: it.type,
          price: Math.abs(t.amount),
          boughtAt: t.createdAt
        };
      });

    return {
      ...s,
      level,
      maxExp,
      role,
      todayTasks,
      transactions: txs,
      myItems
    };
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
    const item = db.items.find(i => i.id === body?.itemId);
    if (!item || !item.active) throw new Error('판매 중인 상품이 아니에요.');
    if (s.balance < item.price) throw new Error(`${db.settings.currencyName}이 부족해요.`);

    s.balance -= item.price;
    const tx = {
      id: uid('tx'),
      studentId: s.id,
      studentName: s.name,
      type: 'buy',
      amount: -item.price,
      reason: `${item.name} 구매`,
      createdAt: nowStr()
    };
    db.transactions.push(tx);
    saveLocalDB(db);
    return { ok: true, balance: s.balance, transaction: tx };
  }

  if (path === '/world/cities' && method === 'GET') {
    const cities = CITIES_DATA.map(c => {
      const owner = db.students.find(s => (s.claimedCities || []).includes(c.id));
      return {
        ...c,
        ownerStudentId: owner ? owner.id : null,
        ownerStudentNumber: owner ? owner.number : null,
        ownerStudentName: owner ? owner.name : null,
        animalName: owner?.animal?.name || null,
        animalEmoji: owner?.animal?.emoji || null,
        animalTitle: owner?.animal?.title || null
      };
    });
    return { cities };
  }

  if (path === '/student/claim-city' && method === 'POST') {
    const sid = getSessionStudentId();
    const s = findStudent(sid);
    if (!s) throw new Error('학생 정보를 찾을 수 없어요.');
    const { cityId, animalName, animalEmoji } = body || {};
    if (!s.claimedCities) s.claimedCities = [];
    if (!s.claimedCities.includes(cityId)) {
      s.claimedCities.push(cityId);
    }
    if (animalName) s.animal.name = animalName;
    if (animalEmoji) s.animal.emoji = animalEmoji;
    saveLocalDB(db);
    return { ok: true, student: s };
  }

  // 4. 교사 영역
  if (path === '/teacher/state' && method === 'GET') {
    const totalBalance = db.students.reduce((acc, cur) => acc + (cur.balance || 0), 0);
    const totalExp = db.students.reduce((acc, cur) => acc + (cur.exp || 0), 0);
    const activeRoles = db.students.filter(s => !!s.roleId).length;

    return {
      settings: db.settings,
      students: db.students.map(s => {
        const level = Math.floor((s.exp || 0) / 100) + 1;
        const role = db.roles.find(r => r.id === s.roleId);
        return {
          ...s,
          level,
          roleName: role ? role.name : null,
          roleEmoji: role ? role.emoji : null
        };
      }),
      roles: db.roles,
      items: db.items,
      stats: {
        totalStudents: db.students.length,
        totalBalance,
        totalExp,
        activeRoles
      }
    };
  }

  if (path === '/teacher/transactions' && method === 'GET') {
    return {
      transactions: db.transactions.slice().reverse()
    };
  }

  if (path === '/teacher/world' && method === 'GET') {
    const cities = CITIES_DATA.map(c => {
      const owner = db.students.find(s => (s.claimedCities || []).includes(c.id));
      return {
        ...c,
        ownerStudentId: owner ? owner.id : null,
        ownerStudentNumber: owner ? owner.number : null,
        ownerStudentName: owner ? owner.name : null,
        animalName: owner?.animal?.name || null,
        animalEmoji: owner?.animal?.emoji || null,
        animalTitle: owner?.animal?.title || null
      };
    });
    return { cities, students: db.students };
  }

  if (path === '/teacher/pay' && method === 'POST') {
    const { studentIds, type, amount, reason } = body || {};
    const amt = Number(amount);
    if (!amt || amt <= 0) throw new Error('금액을 올바르게 입력해 주세요.');
    const now = nowStr();
    const createdTxs = [];

    for (const sid of (studentIds || [])) {
      const s = findStudent(sid);
      if (!s) continue;
      if (type === 'pay') {
        s.balance += amt;
        s.exp += amt;
      } else {
        s.balance -= amt;
      }
      const tx = {
        id: uid('tx'),
        studentId: s.id,
        studentName: s.name,
        type,
        amount: type === 'pay' ? amt : -amt,
        reason: reason || (type === 'pay' ? '선생님 지급' : '선생님 차감'),
        createdAt: now
      };
      db.transactions.push(tx);
      createdTxs.push(tx);
    }
    saveLocalDB(db);
    return { ok: true, count: createdTxs.length };
  }

  // 교사 상품 관리
  if (path === '/teacher/items' && method === 'POST') {
    const it = {
      id: uid('i'),
      emoji: body.emoji || '🎁',
      name: body.name,
      type: body.type || 'coupon',
      price: Number(body.price) || 10,
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
      db.items[idx] = { ...db.items[idx], ...body };
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
    db.settings = { ...db.settings, ...body };
    saveLocalDB(db);
    return { ok: true, settings: db.settings };
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
