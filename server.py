# -*- coding: utf-8 -*-
"""
학급경제 게임 - 교실 PC용 서버
- Python 3 표준 라이브러리만 사용합니다 (추가 설치 필요 없음).
- 데이터는 data/db.json 파일에 저장됩니다.
- 실행: python server.py  (또는 '실행하기.bat' 더블클릭)
"""
import json
import mimetypes
import os
import re
import secrets
import socket
import sys
import threading
import time
import uuid
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "db.json")
PORT = int(os.environ.get("PORT", "8000"))

LOCK = threading.RLock()          # 데이터 변경은 항상 이 잠금 안에서 처리
SESSIONS = {}                     # token -> {"role": "teacher"|"student", "studentId": str|None}
FAILED = {}                       # 로그인 실패 횟수 기록 (PIN 무작위 입력 방지)
MAX_FAIL = 5
LOCK_SECONDS = 30

# Windows에서 .js 파일 형식을 잘못 알려주는 경우가 있어 직접 지정
MIME = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
}


# ─────────────────────────── 데이터 ───────────────────────────
def now_str():
    return datetime.now().isoformat(timespec="seconds")


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def seed_db():
    roles_seed = [
        ("🧽", "칠판 지킴이", ["쉬는 시간마다 칠판 지우기", "분필·보드마커 정리하기"]),
        ("💡", "전등 관리자", ["이동 수업 때 전등 끄기", "아침에 전등 켜기"]),
        ("🪟", "창문 관리자", ["아침에 창문 열어 환기하기", "하교 전 창문 닫기"]),
        ("📚", "학급 문고 사서", ["학급 문고 책 정리하기", "빌린 책 기록 확인하기"]),
        ("🗑️", "분리수거 대장", ["분리수거함 정리하기", "금요일에 분리수거 버리기"]),
        ("🪴", "식물 돌보미", ["화분에 물 주기 (월·수·금)", "시든 잎 정리하기"]),
        ("📮", "우체부", ["가정통신문 나눠 주기", "제출물 걷어서 선생님께 드리기"]),
        ("🍚", "급식 도우미", ["급식 전 손 씻기 안내하기", "급식 후 배식대 정리하기"]),
        ("📅", "일정 알리미", ["칠판에 오늘 날짜·시간표 쓰기", "내일 준비물 알려 주기"]),
        ("🧹", "청소 반장", ["청소 시간 역할 확인하기", "청소 도구 정리 확인하기"]),
        ("💻", "IT 도우미", ["수업 전 TV·컴퓨터 켜기", "하교 전 컴퓨터 끄기"]),
        ("🏦", "학급 은행원", ["선생님 화폐 지급 기록 돕기", "친구들 잔액 질문 안내하기"]),
    ]
    roles = [
        {"id": new_id("r"), "emoji": e, "name": n, "tasks": t, "createdAt": now_str()}
        for e, n, t in roles_seed
    ]
    items_seed = [
        ("🪑", "자리 바꾸기 쿠폰", "coupon", 50, "원하는 친구와 하루 동안 자리를 바꿔요."),
        ("🎵", "음악 들으며 공부 쿠폰", "coupon", 30, "자습 시간에 이어폰으로 음악을 들어요."),
        ("📝", "숙제 하루 면제 쿠폰", "coupon", 80, "숙제 한 번을 면제받아요. (선생님 확인 필요)"),
        ("🍽️", "급식 먼저 먹기 쿠폰", "coupon", 40, "하루 동안 급식 줄 맨 앞에 서요."),
        ("🧑‍🏫", "일일 선생님 쿠폰", "coupon", 120, "아침 활동 시간을 내가 진행해요."),
        ("✏️", "캐릭터 연필", "goods", 20, "귀여운 캐릭터 연필 한 자루"),
        ("🍬", "간식 뽑기", "goods", 15, "간식 상자에서 한 개를 골라요."),
        ("📒", "미니 노트", "goods", 25, "손바닥만 한 귀여운 노트"),
    ]
    items = [
        {"id": new_id("i"), "emoji": e, "name": n, "type": t, "price": p,
         "description": d, "active": True, "createdAt": now_str()}
        for e, n, t, p, d in items_seed
    ]
    students = [
        {"id": new_id("s"), "number": i, "name": f"{i}번 학생", "pin": "1234",
         "balance": 0, "exp": 0, "roleId": None, "createdAt": now_str()}
        for i in range(1, 26)
    ]
    return {
        "version": 1,
        "settings": {"className": "6학년 1반", "currencyName": "코인", "teacherPin": "0000"},
        "students": students,
        "roles": roles,
        "items": items,
        "transactions": [],
    }



CITIES_DATA = [
    {
        "id": "seoul",
        "name": "서울",
        "country": "대한민국",
        "continent": "asia",
        "lat": 37.5665,
        "lon": 126.9780,
        "tagline": "궁궐과 일상이 만나는 도시",
        "landmark": "경복궁",
        "landmarkDesc": "조선 왕조의 법궁으로, 북악산 아래 웅장한 근정전과 아름다운 경회루가 자리 잡고 있어요.",
        "tags": ["한양의 역사", "경회루 연못", "수문장 교대의식"],
        "wikiUrl": "https://ko.wikipedia.org/wiki/%EA%B2%BD%EB%B3%B5%EA%B5%81",
        "color": "#10b981",
        "emoji": "🏯"
    },
    {
        "id": "vancouver",
        "name": "밴쿠버",
        "country": "캐나다",
        "continent": "americas",
        "lat": 49.2827,
        "lon": -123.1207,
        "tagline": "바다와 산을 품은 항구 도시",
        "landmark": "캐나다 플레이스",
        "landmarkDesc": "흰 돛단배 모양의 지붕이 바다를 향해 펼쳐진 밴쿠버의 대표적인 해변 복합 문화 시설이에요.",
        "tags": ["흰 돛 지붕", "버라드 만", "태평양 관문"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Canada_Place",
        "color": "#06b6d4",
        "emoji": "⛵"
    },
    {
        "id": "new-york",
        "name": "뉴욕",
        "country": "미국",
        "continent": "americas",
        "lat": 40.7128,
        "lon": -74.0060,
        "tagline": "높은 빌딩과 다양한 문화의 도시",
        "landmark": "자유의 여신상",
        "landmarkDesc": "리버티 섬에서 횃불을 높이 들고 자유와 희망을 상징하는 세계적인 기념비예요.",
        "tags": ["자유의 횃불", "맨해튼 스카이라인", "리버티 섬"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Statue_of_Liberty",
        "color": "#3b82f6",
        "emoji": "🗽"
    },
    {
        "id": "los-angeles",
        "name": "로스앤젤레스",
        "country": "미국",
        "continent": "americas",
        "lat": 34.0522,
        "lon": -118.2437,
        "tagline": "영화와 별을 만나는 도시",
        "landmark": "그리피스 천문대",
        "landmarkDesc": "로스앤젤레스 시내와 할리우드 사인이 한눈에 내려다보이는 유서 깊은 천문대예요.",
        "tags": ["천체 망원경", "할리우드 야경", "플라네타륨"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Griffith_Observatory",
        "color": "#f59e0b",
        "emoji": "🔭"
    },
    {
        "id": "mexico-city",
        "name": "멕시코시티",
        "country": "멕시코",
        "continent": "americas",
        "lat": 19.4326,
        "lon": -99.1332,
        "tagline": "역사와 예술이 살아 있는 수도",
        "landmark": "벨라스 아르테스 궁전",
        "landmarkDesc": "순백의 대리석 외관과 화려한 돔, 아르누보 양식이 어우러진 멕시코 예술의 전당이에요.",
        "tags": ["황금빛 돔", "디에고 벽화", "국립 예술 극장"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Palacio_de_Bellas_Artes",
        "color": "#ec4899",
        "emoji": "🏛️"
    },
    {
        "id": "lima",
        "name": "리마",
        "country": "페루",
        "continent": "americas",
        "lat": -12.0464,
        "lon": -77.0428,
        "tagline": "태평양 곁 오래된 광장의 도시",
        "landmark": "리마 마요르 광장",
        "landmarkDesc": "유네스코 세계유산으로 등록된 유서 깊은 광장으로 대성당과 대통령궁이 둘러싸고 있어요.",
        "tags": ["아르마스 광장", "스페인 식민 건축", "청동 분수대"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Plaza_Mayor%2C_Lima",
        "color": "#eab308",
        "emoji": "⛲"
    },
    {
        "id": "rio-de-janeiro",
        "name": "리우데자네이루",
        "country": "브라질",
        "continent": "americas",
        "lat": -22.9068,
        "lon": -43.1729,
        "tagline": "해변과 산이 만나는 도시",
        "landmark": "예수상 (구세주 그리스도상)",
        "landmarkDesc": "코르코바두 산꼭대기에서 두 팔을 벌리고 도시 전체를 굽어살피는 거대한 조각상이에요.",
        "tags": ["코르코바두 산", "코파카바나 해변", "세계 7대 불가사의"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Christ_the_Redeemer_(statue)",
        "color": "#10b981",
        "emoji": "⛰️"
    },
    {
        "id": "buenos-aires",
        "name": "부에노스아이레스",
        "country": "아르헨티나",
        "continent": "americas",
        "lat": -34.6037,
        "lon": -58.3816,
        "tagline": "탱고의 리듬이 흐르는 도시",
        "landmark": "부에노스아이레스 오벨리스크",
        "landmarkDesc": "도시 건립 400주년을 기념해 세워진 높이 67.5미터의 상징적인 기념탑이에요.",
        "tags": ["7월 9일 대로", "탱고의 고향", "축구 열기"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Obelisco_de_Buenos_Aires",
        "color": "#38bdf8",
        "emoji": "🗼"
    },
    {
        "id": "london",
        "name": "런던",
        "country": "영국",
        "continent": "europe",
        "lat": 51.5074,
        "lon": -0.1278,
        "tagline": "템스강을 따라 걷는 도시",
        "landmark": "타워 브리지",
        "landmarkDesc": "도개교 형식으로 템스강 위를 가로지르는 고딕 양식의 쌍둥이 탑 다리예요.",
        "tags": ["도개교", "템스 강변", "빅토리아 시대"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Tower_Bridge",
        "color": "#6366f1",
        "emoji": "🌉"
    },
    {
        "id": "madrid",
        "name": "마드리드",
        "country": "스페인",
        "continent": "europe",
        "lat": 40.4168,
        "lon": -3.7038,
        "tagline": "왕궁과 예술이 어우러진 수도",
        "landmark": "마드리드 왕궁",
        "landmarkDesc": "서유럽 최대 규모의 웅장한 궁전으로, 화려한 왕실 보물과 그림들이 가득해요.",
        "tags": ["오리엔테 광장", "화려한 옥좌실", "왕실 근위대"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Royal_Palace_of_Madrid",
        "color": "#f97316",
        "emoji": "👑"
    },
    {
        "id": "reykjavik",
        "name": "레이캬비크",
        "country": "아이슬란드",
        "continent": "europe",
        "lat": 64.1466,
        "lon": -21.9426,
        "tagline": "북쪽 바다 곁의 아담한 수도",
        "landmark": "할그림스키르캬",
        "landmarkDesc": "주상절리 화산암 모양을 본떠 만든 독특하고 신비로운 아이슬란드의 랜드마크예요.",
        "tags": ["오로라의 도시", "주상절리 디자인", "지열 온천"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Hallgr%C3%ADmskirkja",
        "color": "#a855f7",
        "emoji": "⛪"
    },
    {
        "id": "cairo",
        "name": "카이로",
        "country": "이집트",
        "continent": "africa",
        "lat": 30.0444,
        "lon": 31.2357,
        "tagline": "나일강을 품은 큰 도시",
        "landmark": "카이로 타워",
        "landmarkDesc": "연꽃 모양을 형상화한 격자 타워로, 나일강과 기자 피라미드 풍경까지 내려다볼 수 있어요.",
        "tags": ["연꽃 문양", "나일강 뷰", "피라미드 조망"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Cairo_Tower",
        "color": "#d97706",
        "emoji": "🪷"
    },
    {
        "id": "cape-town",
        "name": "케이프타운",
        "country": "남아프리카공화국",
        "continent": "africa",
        "lat": -33.9249,
        "lon": 18.4241,
        "tagline": "평평한 산과 푸른 바다의 도시",
        "landmark": "테이블 마운틴",
        "landmarkDesc": "마치 식탁처럼 평평한 정상부가 바다와 도시를 병풍처럼 감싸고 있는 경이로운 자연 명소예요.",
        "tags": ["테이블보 구름", "희망봉 인근", "케이블카"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Table_Mountain",
        "color": "#14b8a6",
        "emoji": "🌄"
    },
    {
        "id": "nairobi",
        "name": "나이로비",
        "country": "케냐",
        "continent": "africa",
        "lat": -1.2921,
        "lon": 36.8219,
        "tagline": "동아프리카의 활기찬 수도",
        "landmark": "케냐타 국제컨벤션센터",
        "landmarkDesc": "도심 한복판에서 사파리 국립공원까지 내다볼 수 있는 원통형 랜드마크 빌딩이에요.",
        "tags": ["도심 사파리", "사바나 야생동물", "회전 전망대"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Kenyatta_International_Convention_Centre",
        "color": "#84cc16",
        "emoji": "🦒"
    },
    {
        "id": "istanbul",
        "name": "이스탄불",
        "country": "튀르키예",
        "continent": "europe",
        "lat": 41.0082,
        "lon": 28.9784,
        "tagline": "유럽과 아시아를 잇는 도시",
        "landmark": "아야 소피아",
        "landmarkDesc": "거대한 돔과 찬란한 모자이크가 동서양 문명의 만남을 상징하는 건축의 걸작이에요.",
        "tags": ["보스포루스 해협", "비잔틴 모자이크", "동서양의 교차로"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Hagia_Sophia",
        "color": "#ef4444",
        "emoji": "🕌"
    },
    {
        "id": "mumbai",
        "name": "뭄바이",
        "country": "인도",
        "continent": "asia",
        "lat": 19.0760,
        "lon": 72.8777,
        "tagline": "영화와 항구가 만나는 도시",
        "landmark": "인디아 게이트웨이",
        "landmarkDesc": "아라비아해를 바라보며 인도-사라센 양식으로 우뚝 솟은 웅장한 아치형 석조 문이에요.",
        "tags": ["아라비아해 항구", "발리우드 중심지", "현무암 개선문"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Gateway_of_India",
        "color": "#f59e0b",
        "emoji": "🚪"
    },
    {
        "id": "bangkok",
        "name": "방콕",
        "country": "태국",
        "continent": "asia",
        "lat": 13.7563,
        "lon": 100.5018,
        "tagline": "강과 사원이 어우러진 수도",
        "landmark": "왓 아룬 (새벽 사원)",
        "landmarkDesc": "짜오프라야 강변에 도자기 조각들로 장식된 탑들이 새벽 햇살에 눈부시게 빛나요.",
        "tags": ["새벽 사원", "짜오프라야 강", "도자기 불탑"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Wat_Arun",
        "color": "#e11d48",
        "emoji": "🛕"
    },
    {
        "id": "singapore",
        "name": "싱가포르",
        "country": "싱가포르",
        "continent": "asia",
        "lat": 1.3521,
        "lon": 103.8198,
        "tagline": "도시 전체가 하나의 나라",
        "landmark": "머라이언 상",
        "landmarkDesc": "사자의 머리와 물고기의 몸을 지닌 채 마리나 베이 바다로 시원한 물줄기를 뿜어내요.",
        "tags": ["마리나 베이", "가든스 바이 더 베이", "친환경 가든시티"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Merlion",
        "color": "#06b6d4",
        "emoji": "🦁"
    },
    {
        "id": "beijing",
        "name": "베이징",
        "country": "중국",
        "continent": "asia",
        "lat": 39.9042,
        "lon": 116.4074,
        "tagline": "오랜 궁궐과 유적을 품은 수도",
        "landmark": "천단 (기년전)",
        "landmarkDesc": "황제가 풍년을 기원하며 하늘에 제사를 올리던 삼중 처마의 신비로운 원형 전각이에요.",
        "tags": ["기년전 삼중 처마", "만리장성 관문", "하늘의 제단"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Temple_of_Heaven",
        "color": "#dc2626",
        "emoji": "🏮"
    },
    {
        "id": "sydney",
        "name": "시드니",
        "country": "오스트레일리아",
        "continent": "oceania",
        "lat": -33.8688,
        "lon": 151.2093,
        "tagline": "아름다운 항구와 공연의 도시",
        "landmark": "시드니 오페라 하우스",
        "landmarkDesc": "조개껍데기와 하얀 돛 모양을 형상화한 지붕으로 세계인들의 찬사를 받는 오페라 전당이에요.",
        "tags": ["하버 브리지", "조개 모양 지붕", "달링 하버"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Sydney_Opera_House",
        "color": "#2563eb",
        "emoji": "🎭"
    },
    {
        "id": "honolulu",
        "name": "호놀룰루",
        "country": "미국 · 하와이",
        "continent": "oceania",
        "lat": 21.3069,
        "lon": -157.8583,
        "tagline": "태평양 한가운데의 섬 도시",
        "landmark": "다이아몬드 헤드",
        "landmarkDesc": "와이키키 해변 너머로 우뚝 솟은 거대한 화산 분화구로, 정상에서 에메랄드빛 바다가 펼쳐져요.",
        "tags": ["와이키키 해변", "화산 분화구", "알로하 정신"],
        "wikiUrl": "https://en.wikipedia.org/wiki/Diamond_Head%2C_Hawaii",
        "color": "#10b981",
        "emoji": "🌺"
    }
]

ANIMALS_PRESETS = [
    {"name": "모리", "species": "여우", "emoji": "🦊", "title": "숲의 수호자", "friends": ["토끼 토리", "곰 밤이"]},
    {"name": "토리", "species": "토끼", "emoji": "🐰", "title": "깡총 탐험가", "friends": ["여우 모리", "다람쥐 람이"]},
    {"name": "밤이", "species": "아기곰", "emoji": "🐻", "title": "꿀잠 대장", "friends": ["여우 모리", "수달 달이"]},
    {"name": "레오", "species": "아기사자", "emoji": "🦁", "title": "용기 가득 대장", "friends": ["치타 치치", "기린 로로"]},
    {"name": "달이", "species": "수달", "emoji": "🦦", "title": "조약돌 요리사", "friends": ["곰 밤이", "펭귄 핑구"]},
    {"name": "팡이", "species": "판다", "emoji": "🐼", "title": "대나무 철학자", "friends": ["호랑이 호야", "여우 모리"]},
    {"name": "핑구", "species": "펭귄", "emoji": "🐧", "title": "빙하 슬라이더", "friends": ["수달 달이", "물개 뭉이"]},
    {"name": "슬로", "species": "나무늘보", "emoji": "🦥", "title": "낮잠 평화주의자", "friends": ["앵무새 루루", "토끼 토리"]},
    {"name": "돌이", "species": "돌고래", "emoji": "🐬", "title": "에메랄드 파도왕", "friends": ["수달 달이", "바다거북 북이"]},
    {"name": "코코", "species": "코알라", "emoji": "🐨", "title": "유칼립투스 시인", "friends": ["쿼카 쿠키", "토끼 토리"]},
    {"name": "람이", "species": "다람쥐", "emoji": "🐿️", "title": "도토리 탐정", "friends": ["토끼 토리", "여우 모리"]},
    {"name": "루루", "species": "앵무새", "emoji": "🦜", "title": "무지개 전령", "friends": ["나무늘보 슬로", "라마 포포"]},
    {"name": "페넥", "species": "사막여우", "emoji": "🦊", "title": "모래바람 마법사", "friends": ["치타 치치", "낙타 카멜"]},
    {"name": "호야", "species": "호랑이", "emoji": "🐯", "title": "백두산 용사", "friends": ["판다 팡이", "늑대 울프"]},
    {"name": "울프", "species": "늑대", "emoji": "🐺", "title": "달빛 순찰대", "friends": ["호랑이 호야", "독수리 아길"]},
    {"name": "레피", "species": "아기표범", "emoji": "🐆", "title": "바람의 질주자", "friends": ["아기사자 레오", "치타 치치"]},
    {"name": "나비", "species": "탱고냥이", "emoji": "🐱", "title": "골목길 낭만가", "friends": ["강아지 몽이", "토끼 토리"]},
    {"name": "몽이", "species": "충직견", "emoji": "🐶", "title": "학급 지킴이", "friends": ["탱고냥이 나비", "곰 밤이"]},
    {"name": "포포", "species": "라마", "emoji": "🦙", "title": "안데스 요정", "friends": ["알파카 카파", "앵무새 루루"]},
    {"name": "부엉", "species": "올빼미", "emoji": "🦉", "title": "밤하늘 박사", "friends": ["다람쥐 람이", "여우 모리"]},
    {"name": "하티", "species": "아기코끼리", "emoji": "🐘", "title": "기쁨의 분수", "friends": ["원숭이 몽키", "사자 레오"]},
    {"name": "쿠키", "species": "쿼카", "emoji": "🦘", "title": "행복 바이러스", "friends": ["코알라 코코", "토끼 토리"]},
    {"name": "치치", "species": "치타", "emoji": "🐆", "title": "초원 스피드스타", "friends": ["아기사자 레오", "사막여우 페넥"]},
    {"name": "초롱", "species": "반딧불이", "emoji": "✨", "title": "별빛 길잡이", "friends": ["수달 달이", "올빼미 부엉"]},
    {"name": "도치", "species": "고슴도치", "emoji": "🦔", "title": "가시방패 탐험가", "friends": ["다람쥐 람이", "토끼 토리"]},
]


def ensure_student_fields(db):
    """기존 DB 데이터에도 3D Classimal World의 동물, 홈 도시, 영토 필드를 안전하게 채워넣습니다."""
    cities_count = len(CITIES_DATA)
    changed = False
    for idx, s in enumerate(db.get("students", [])):
        p = ANIMALS_PRESETS[idx % len(ANIMALS_PRESETS)]
        city_id = CITIES_DATA[idx % cities_count]["id"]
        if "animal" not in s or not isinstance(s.get("animal"), dict):
            s["animal"] = {
                "name": p["name"],
                "species": p["species"],
                "emoji": p["emoji"],
                "title": p["title"],
            }
            changed = True
        if "homeCity" not in s or not s["homeCity"]:
            s["homeCity"] = city_id
            changed = True
        if "claimedCities" not in s or not isinstance(s.get("claimedCities"), list):
            s["claimedCities"] = [s["homeCity"]]
            changed = True
        if "claimedTiles" not in s:
            s["claimedTiles"] = 6
            changed = True
        if "energy" not in s:
            s["energy"] = 2
            changed = True
        if "friends" not in s or not isinstance(s.get("friends"), list):
            s["friends"] = p["friends"]
            changed = True
    if changed:
        save_db(db)


def load_db():
    if not os.path.exists(DB_PATH):
        os.makedirs(DATA_DIR, exist_ok=True)
        db = seed_db()
        ensure_student_fields(db)
        save_db(db)
        return db
    with open(DB_PATH, "r", encoding="utf-8") as f:
        db = json.load(f)
    ensure_student_fields(db)
    return db


def save_db(db):
    """임시 파일에 먼저 쓰고 교체해서, 저장 중 꺼져도 파일이 깨지지 않게 합니다."""
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = DB_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=1)
    for attempt in range(10):
        try:
            os.replace(tmp, DB_PATH)
            return
        except PermissionError:
            time.sleep(0.1 * (attempt + 1))
    raise RuntimeError("데이터 파일을 저장하지 못했어요.")


DB = load_db()


# ─────────────────────────── 계산 도우미 ───────────────────────────
def level_info(exp):
    """다음 레벨까지 필요한 경험치 = 현재 레벨 × 100"""
    level, remain = 1, int(exp)
    while remain >= level * 100:
        remain -= level * 100
        level += 1
    return {"level": level, "expInLevel": remain, "expToNext": level * 100}


def find(lst, _id):
    return next((x for x in lst if x["id"] == _id), None)


def student_view(s, include_pin=False):
    keys = ("id", "number", "name", "balance", "exp", "roleId",
            "animal", "homeCity", "claimedCities", "claimedTiles", "energy", "friends")
    out = {k: s.get(k) for k in keys if k in s}
    out.update(level_info(s["exp"]))
    if include_pin:
        out["pin"] = s["pin"]
    return out


def sorted_students():
    return sorted(DB["students"], key=lambda s: (s["number"], s["name"]))


def public_settings():
    st = DB["settings"]
    return {"className": st["className"], "currencyName": st["currencyName"]}


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def req_str(body, key, label, max_len=40, required=True):
    v = str(body.get(key, "") or "").strip()
    if required and not v:
        raise ApiError(400, f"{label}을(를) 입력해 주세요.")
    if len(v) > max_len:
        raise ApiError(400, f"{label}은(는) {max_len}자 이하로 입력해 주세요.")
    return v


def req_int(body, key, label, lo, hi):
    try:
        v = int(body.get(key))
    except (TypeError, ValueError):
        raise ApiError(400, f"{label}은(는) 숫자로 입력해 주세요.")
    if v < lo or v > hi:
        raise ApiError(400, f"{label}은(는) {lo}~{hi} 사이로 입력해 주세요.")
    return v


def req_pin(body, key="pin"):
    v = str(body.get(key, "") or "").strip()
    if not re.fullmatch(r"\d{4}", v):
        raise ApiError(400, "PIN은 숫자 4자리여야 해요.")
    return v


def check_lockout(key):
    info = FAILED.get(key)
    if info and info["until"] > time.time():
        left = int(info["until"] - time.time()) + 1
        raise ApiError(429, f"PIN을 여러 번 틀렸어요. {left}초 뒤에 다시 시도해 주세요.")


def record_fail(key):
    info = FAILED.setdefault(key, {"count": 0, "until": 0})
    info["count"] += 1
    if info["count"] >= MAX_FAIL:
        info["count"] = 0
        info["until"] = time.time() + LOCK_SECONDS


# ─────────────────────────── API 처리 함수 ───────────────────────────
def api_public_info(ctx):
    return {
        **public_settings(),
        "students": [{"id": s["id"], "number": s["number"], "name": s["name"]} for s in sorted_students()],
    }


def api_login_student(ctx):
    body = ctx["body"]
    s = find(DB["students"], str(body.get("studentId", "")))
    if not s:
        raise ApiError(404, "학생을 찾을 수 없어요.")
    key = "s:" + s["id"]
    check_lockout(key)
    if str(body.get("pin", "")) != s["pin"]:
        record_fail(key)
        raise ApiError(403, "PIN이 맞지 않아요.")
    FAILED.pop(key, None)
    token = secrets.token_urlsafe(24)
    SESSIONS[token] = {"role": "student", "studentId": s["id"]}
    return {"token": token, "role": "student", "studentId": s["id"], "name": s["name"]}


def api_login_teacher(ctx):
    key = "teacher"
    check_lockout(key)
    if str(ctx["body"].get("pin", "")) != DB["settings"]["teacherPin"]:
        record_fail(key)
        raise ApiError(403, "PIN이 맞지 않아요.")
    FAILED.pop(key, None)
    token = secrets.token_urlsafe(24)
    SESSIONS[token] = {"role": "teacher", "studentId": None}
    return {"token": token, "role": "teacher", "name": "선생님"}


def api_logout(ctx):
    SESSIONS.pop(ctx["token"], None)
    return {"ok": True}


# ---- 학생 ----
def current_student(ctx):
    s = find(DB["students"], ctx["session"]["studentId"])
    if not s:
        raise ApiError(401, "학생 정보가 없어요. 다시 들어와 주세요.")
    return s


def api_student_me(ctx):
    s = current_student(ctx)
    role = find(DB["roles"], s["roleId"]) if s["roleId"] else None
    mine = [t for t in DB["transactions"] if t["studentId"] == s["id"]]
    mine.sort(key=lambda t: t["createdAt"], reverse=True)
    return {
        "settings": public_settings(),
        "student": student_view(s),
        "role": role,
        "transactions": mine[:100],
        "purchases": [t for t in mine if t["type"] == "buy"],
    }


def api_student_shop(ctx):
    return {"items": [i for i in DB["items"] if i["active"]]}


def api_student_buy(ctx):
    s = current_student(ctx)
    item = find(DB["items"], str(ctx["body"].get("itemId", "")))
    if not item or not item["active"]:
        raise ApiError(404, "지금은 살 수 없는 상품이에요.")
    if s["balance"] < item["price"]:
        raise ApiError(400, f"{DB['settings']['currencyName']}이(가) {item['price'] - s['balance']}만큼 부족해요.")
    s["balance"] -= item["price"]
    tx = {
        "id": new_id("t"), "studentId": s["id"], "studentName": s["name"], "type": "buy",
        "amount": item["price"], "reason": f"상점 구매: {item['name']}",
        "itemId": item["id"], "itemName": item["name"], "itemEmoji": item.get("emoji", "🎁"),
        "itemType": item["type"], "balanceAfter": s["balance"], "createdAt": now_str(),
    }
    DB["transactions"].append(tx)
    save_db(DB)
    return {"ok": True, "transaction": tx, "student": student_view(s)}


# ---- 교사 ----
def api_teacher_state(ctx):
    today = datetime.now().strftime("%Y-%m-%d")
    given = sum(t["amount"] for t in DB["transactions"] if t["type"] == "give" and t["createdAt"].startswith(today))
    taken = sum(t["amount"] for t in DB["transactions"] if t["type"] == "take" and t["createdAt"].startswith(today))
    bought = sum(1 for t in DB["transactions"] if t["type"] == "buy" and t["createdAt"].startswith(today))
    return {
        "settings": {**public_settings(), "defaultPin": DB["settings"]["teacherPin"] == "0000"},
        "students": [student_view(s, include_pin=True) for s in sorted_students()],
        "roles": DB["roles"],
        "items": DB["items"],
        "today": {"given": given, "taken": taken, "purchases": bought},
    }


def api_teacher_transactions(ctx):
    txs = sorted(DB["transactions"], key=lambda t: t["createdAt"], reverse=True)
    return {"transactions": txs}


def api_teacher_pay(ctx):
    body = ctx["body"]
    kind = body.get("type")
    if kind not in ("give", "take"):
        raise ApiError(400, "지급 또는 차감을 선택해 주세요.")
    amount = req_int(body, "amount", "금액", 1, 100000)
    reason = req_str(body, "reason", "사유", 60)
    ids = body.get("studentIds") or []
    if not isinstance(ids, list) or not ids:
        raise ApiError(400, "학생을 한 명 이상 골라 주세요.")
    targets = [find(DB["students"], str(i)) for i in ids]
    if any(t is None for t in targets):
        raise ApiError(404, "찾을 수 없는 학생이 있어요.")
    stamp = now_str()
    result = []
    for s in targets:
        before = level_info(s["exp"])["level"]
        if kind == "give":
            s["balance"] += amount
            s["exp"] += amount          # 받은 만큼 경험치도 쌓임
        else:
            s["balance"] -= amount      # 교사 차감은 마이너스 허용, 경험치는 그대로
        DB["transactions"].append({
            "id": new_id("t"), "studentId": s["id"], "studentName": s["name"], "type": kind,
            "amount": amount, "reason": reason, "balanceAfter": s["balance"], "createdAt": stamp,
        })
        after = level_info(s["exp"])["level"]
        result.append({"id": s["id"], "name": s["name"], "levelUp": after > before, "level": after})
    save_db(DB)
    return {"ok": True, "results": result}


def parse_item(body):
    t = body.get("type")
    if t not in ("goods", "coupon"):
        raise ApiError(400, "종류(물건/쿠폰)를 골라 주세요.")
    return {
        "emoji": req_str(body, "emoji", "아이콘", 8, required=False) or "🎁",
        "name": req_str(body, "name", "상품 이름", 30),
        "type": t,
        "price": req_int(body, "price", "가격", 1, 100000),
        "description": req_str(body, "description", "설명", 100, required=False),
        "active": bool(body.get("active", True)),
    }


def api_item_create(ctx):
    item = {"id": new_id("i"), **parse_item(ctx["body"]), "createdAt": now_str()}
    DB["items"].append(item)
    save_db(DB)
    return {"ok": True, "item": item}


def api_item_update(ctx):
    item = find(DB["items"], ctx["params"][0])
    if not item:
        raise ApiError(404, "상품을 찾을 수 없어요.")
    item.update(parse_item(ctx["body"]))
    save_db(DB)
    return {"ok": True, "item": item}


def api_item_delete(ctx):
    item = find(DB["items"], ctx["params"][0])
    if not item:
        raise ApiError(404, "상품을 찾을 수 없어요.")
    DB["items"].remove(item)
    save_db(DB)
    return {"ok": True}


def parse_role(body):
    tasks = body.get("tasks") or []
    if isinstance(tasks, str):
        tasks = tasks.splitlines()
    tasks = [str(t).strip()[:60] for t in tasks if str(t).strip()][:10]
    if not tasks:
        raise ApiError(400, "할 일을 한 개 이상 적어 주세요.")
    return {
        "emoji": req_str(body, "emoji", "아이콘", 8, required=False) or "⭐",
        "name": req_str(body, "name", "역할 이름", 20),
        "tasks": tasks,
    }


def api_role_create(ctx):
    role = {"id": new_id("r"), **parse_role(ctx["body"]), "createdAt": now_str()}
    DB["roles"].append(role)
    save_db(DB)
    return {"ok": True, "role": role}


def api_role_update(ctx):
    role = find(DB["roles"], ctx["params"][0])
    if not role:
        raise ApiError(404, "역할을 찾을 수 없어요.")
    role.update(parse_role(ctx["body"]))
    save_db(DB)
    return {"ok": True, "role": role}


def api_role_delete(ctx):
    role = find(DB["roles"], ctx["params"][0])
    if not role:
        raise ApiError(404, "역할을 찾을 수 없어요.")
    for s in DB["students"]:
        if s["roleId"] == role["id"]:
            s["roleId"] = None
    DB["roles"].remove(role)
    save_db(DB)
    return {"ok": True}


def api_assign(ctx):
    """역할 1개에 학생 1명, 학생 1명에 역할 1개 (1인 1역)"""
    body = ctx["body"]
    role = find(DB["roles"], str(body.get("roleId", "")))
    if not role:
        raise ApiError(404, "역할을 찾을 수 없어요.")
    sid = body.get("studentId")
    for s in DB["students"]:
        if s["roleId"] == role["id"]:
            s["roleId"] = None
    if sid:
        s = find(DB["students"], str(sid))
        if not s:
            raise ApiError(404, "학생을 찾을 수 없어요.")
        s["roleId"] = role["id"]
    save_db(DB)
    return {"ok": True}


def api_student_create(ctx):
    body = ctx["body"]
    number = req_int(body, "number", "번호", 1, 99)
    if any(s["number"] == number for s in DB["students"]):
        raise ApiError(400, f"{number}번은 이미 있어요.")
    s = {"id": new_id("s"), "number": number, "name": req_str(body, "name", "이름", 12),
         "pin": req_pin(body), "balance": 0, "exp": 0, "roleId": None, "createdAt": now_str()}
    DB["students"].append(s)
    save_db(DB)
    return {"ok": True, "student": student_view(s, True)}


def api_student_update(ctx):
    s = find(DB["students"], ctx["params"][0])
    if not s:
        raise ApiError(404, "학생을 찾을 수 없어요.")
    body = ctx["body"]
    number = req_int(body, "number", "번호", 1, 99)
    if any(o["number"] == number and o["id"] != s["id"] for o in DB["students"]):
        raise ApiError(400, f"{number}번은 이미 있어요.")
    s["number"] = number
    s["name"] = req_str(body, "name", "이름", 12)
    s["pin"] = req_pin(body)
    save_db(DB)
    return {"ok": True, "student": student_view(s, True)}


def api_student_delete(ctx):
    s = find(DB["students"], ctx["params"][0])
    if not s:
        raise ApiError(404, "학생을 찾을 수 없어요.")
    DB["students"].remove(s)
    for tok in [t for t, v in SESSIONS.items() if v.get("studentId") == s["id"]]:
        SESSIONS.pop(tok, None)
    save_db(DB)
    return {"ok": True}


def api_settings(ctx):
    body = ctx["body"]
    st = DB["settings"]
    st["className"] = req_str(body, "className", "학급 이름", 20)
    st["currencyName"] = req_str(body, "currencyName", "화폐 이름", 10)
    if body.get("teacherPin"):
        st["teacherPin"] = req_pin(body, "teacherPin")
    save_db(DB)
    return {"ok": True}


def api_backup(ctx):
    return DB


def api_restore(ctx):
    global DB
    data = ctx["body"].get("db")
    keys = ("settings", "students", "roles", "items", "transactions")
    if not isinstance(data, dict) or any(k not in data for k in keys):
        raise ApiError(400, "올바른 백업 파일이 아니에요.")
    if not all(isinstance(data[k], list) for k in keys[1:]):
        raise ApiError(400, "올바른 백업 파일이 아니에요.")
    DB = data
    save_db(DB)
    # 학생 세션은 모두 초기화 (학생 목록이 바뀌었을 수 있음)
    for tok in [t for t, v in SESSIONS.items() if v["role"] == "student"]:
        SESSIONS.pop(tok, None)
    return {"ok": True}



def api_world_cities(ctx):
    """21개 도시 정보와 각 도시에 소속/개척된 학생들을 종합해서 반환합니다."""
    students = DB.get("students", [])
    city_map = {}
    for c in CITIES_DATA:
        city_map[c["id"]] = {
            **c,
            "residents": [],
            "totalTiles": 0
        }

    for s in students:
        s_home = s.get("homeCity", "seoul")
        claimed = s.get("claimedCities", [s_home])
        tiles = s.get("claimedTiles", 6)
        animal = s.get("animal", {"name": "모리", "species": "여우", "emoji": "🦊", "title": "숲의 수호자"})
        lvl = level_info(s["exp"])["level"]
        
        for c_id in claimed:
            if c_id in city_map:
                is_home = (c_id == s_home)
                city_map[c_id]["residents"].append({
                    "id": s["id"],
                    "number": s["number"],
                    "name": s["name"],
                    "level": lvl,
                    "animal": animal,
                    "isHome": is_home,
                    "tiles": tiles if is_home else 3
                })
                city_map[c_id]["totalTiles"] += (tiles if is_home else 3)

    return {
        "cities": list(city_map.values()),
        "currencyName": DB["settings"]["currencyName"]
    }


def api_student_claim_city(ctx):
    """학생이 코인을 사용하여 새로운 도시를 탐험하고 영토를 개척합니다."""
    s = current_student(ctx)
    body = ctx["body"]
    city_id = req_str(body, "cityId", "도시 ID", 30)
    city = next((c for c in CITIES_DATA if c["id"] == city_id), None)
    if not city:
        raise ApiError(404, "존재하지 않는 도시예요.")

    claimed = s.setdefault("claimedCities", [s.get("homeCity", "seoul")])
    if city_id in claimed:
        raise ApiError(400, "이미 개척한 도시예요!")

    # 개척 비용: 30 코인
    COST = 30
    cur_name = DB["settings"]["currencyName"]
    if s["balance"] < COST:
        raise ApiError(400, f"새 도시를 개척하려면 {cur_name}이(가) {COST - s['balance']}만큼 더 필요해요. (필요: {COST} {cur_name})")

    s["balance"] -= COST
    claimed.append(city_id)
    s["claimedTiles"] = s.get("claimedTiles", 6) + 4
    s["energy"] = max(0, s.get("energy", 2) - 1)

    tx = {
        "id": new_id("t"),
        "studentId": s["id"],
        "studentName": s["name"],
        "type": "buy",
        "amount": COST,
        "reason": f"3D 월드 탐험: {city['name']} 영토 개척",
        "balanceAfter": s["balance"],
        "createdAt": now_str()
    }
    DB["transactions"].append(tx)
    save_db(DB)

    return {
        "ok": True,
        "message": f"축하해요! {city['name']}에 내 깃발을 꽂았어요! 🚩",
        "city": city,
        "student": student_view(s)
    }


def api_student_update_animal(ctx):
    """학생의 수호동물 닉네임과 특징을 변경합니다."""
    s = current_student(ctx)
    body = ctx["body"]
    name = req_str(body, "name", "동물 이름", 20)
    species = req_str(body, "species", "동물 종류", 20, required=False) or s.get("animal", {}).get("species", "동물")
    emoji = req_str(body, "emoji", "동물 이모지", 8, required=False) or s.get("animal", {}).get("emoji", "🦊")
    title = req_str(body, "title", "칭호", 30, required=False) or s.get("animal", {}).get("title", "멋진 탐험가")

    s["animal"] = {
        "name": name,
        "species": species,
        "emoji": emoji,
        "title": title
    }
    save_db(DB)
    return {"ok": True, "animal": s["animal"], "student": student_view(s)}


def api_teacher_world(ctx):
    """교사용: 전체 학생들의 3D 월드 개척 및 수호동물 현황 집계"""
    return api_world_cities(ctx)


# (메서드, 경로 정규식, 함수, 필요한 권한)
ROUTES = [
    ("GET", r"/api/public/info", api_public_info, None),
    ("POST", r"/api/login/student", api_login_student, None),
    ("POST", r"/api/login/teacher", api_login_teacher, None),
    ("POST", r"/api/logout", api_logout, None),
    ("GET", r"/api/world/cities", api_world_cities, None),
    ("GET", r"/api/student/me", api_student_me, "student"),
    ("GET", r"/api/student/shop", api_student_shop, "student"),
    ("POST", r"/api/student/buy", api_student_buy, "student"),
    ("POST", r"/api/student/claim-city", api_student_claim_city, "student"),
    ("PUT", r"/api/student/animal", api_student_update_animal, "student"),
    ("GET", r"/api/teacher/state", api_teacher_state, "teacher"),
    ("GET", r"/api/teacher/transactions", api_teacher_transactions, "teacher"),
    ("GET", r"/api/teacher/world", api_teacher_world, "teacher"),
    ("POST", r"/api/teacher/pay", api_teacher_pay, "teacher"),
    ("POST", r"/api/teacher/items", api_item_create, "teacher"),
    ("PUT", r"/api/teacher/items/([\w-]+)", api_item_update, "teacher"),
    ("DELETE", r"/api/teacher/items/([\w-]+)", api_item_delete, "teacher"),
    ("POST", r"/api/teacher/roles", api_role_create, "teacher"),
    ("PUT", r"/api/teacher/roles/([\w-]+)", api_role_update, "teacher"),
    ("DELETE", r"/api/teacher/roles/([\w-]+)", api_role_delete, "teacher"),
    ("PUT", r"/api/teacher/assign", api_assign, "teacher"),
    ("POST", r"/api/teacher/students", api_student_create, "teacher"),
    ("PUT", r"/api/teacher/students/([\w-]+)", api_student_update, "teacher"),
    ("DELETE", r"/api/teacher/students/([\w-]+)", api_student_delete, "teacher"),
    ("PUT", r"/api/teacher/settings", api_settings, "teacher"),
    ("GET", r"/api/teacher/backup", api_backup, "teacher"),
    ("POST", r"/api/teacher/restore", api_restore, "teacher"),
]
ROUTES = [(m, re.compile("^" + p + "$"), f, r) for m, p, f, r in ROUTES]


# ─────────────────────────── HTTP 서버 ───────────────────────────
class Handler(BaseHTTPRequestHandler):
    server_version = "ClassEconomy/1.0"

    def log_message(self, fmt, *args):
        pass  # 콘솔을 깔끔하게 유지

    def send_json(self, status, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def handle_api(self, method, path):
        for m, rx, fn, need in ROUTES:
            if m != method:
                continue
            match = rx.match(path)
            if not match:
                continue
            try:
                body = {}
                length = int(self.headers.get("Content-Length") or 0)
                if length:
                    if length > 20 * 1024 * 1024:
                        raise ApiError(413, "데이터가 너무 커요.")
                    raw = self.rfile.read(length)
                    try:
                        body = json.loads(raw.decode("utf-8")) or {}
                    except ValueError:
                        raise ApiError(400, "잘못된 요청이에요.")
                auth = self.headers.get("Authorization", "")
                token = auth[7:] if auth.startswith("Bearer ") else ""
                session = SESSIONS.get(token)
                if need and (not session or session["role"] != need):
                    raise ApiError(401, "다시 들어와 주세요.")
                ctx = {"body": body, "params": match.groups(), "token": token, "session": session}
                with LOCK:
                    result = fn(ctx)
                self.send_json(200, result)
            except ApiError as e:
                self.send_json(e.status, {"error": e.message})
            except Exception as e:  # 예상하지 못한 오류
                print("[오류]", repr(e), file=sys.stderr)
                self.send_json(500, {"error": "서버에서 오류가 발생했어요."})
            return
        self.send_json(404, {"error": "없는 주소예요."})

    def serve_static(self, path):
        rel = unquote(path).lstrip("/") or "index.html"
        full = os.path.normpath(os.path.join(PUBLIC_DIR, rel))
        if not full.startswith(PUBLIC_DIR) or not os.path.isfile(full):
            full = os.path.join(PUBLIC_DIR, "index.html")
        ext = os.path.splitext(full)[1].lower()
        ctype = MIME.get(ext) or mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def dispatch(self, method):
        path = urlparse(self.path).path
        if path.startswith("/api/"):
            self.handle_api(method, path)
        elif method == "GET":
            self.serve_static(path)
        else:
            self.send_json(405, {"error": "허용되지 않은 요청이에요."})

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def do_DELETE(self):
        self.dispatch("DELETE")


def local_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # 실제로 전송하지 않음, 내 IP 확인용
        ips.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for ip in socket.gethostbyname_ex(socket.gethostname())[2]:
            if not ip.startswith("127."):
                ips.add(ip)
    except OSError:
        pass
    return sorted(ips)


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("=" * 56)
    print("  🪙 학급경제 게임 서버가 켜졌어요!")
    print("=" * 56)
    print(f"  선생님 PC에서:   http://localhost:{PORT}")
    for ip in local_ips():
        print(f"  학생 기기에서:   http://{ip}:{PORT}")
    print("-" * 56)
    print("  이 창을 닫으면 서버가 꺼져요. (종료: Ctrl + C)")
    print("=" * 56)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n서버를 종료합니다.")
        server.server_close()


if __name__ == "__main__":
    main()
