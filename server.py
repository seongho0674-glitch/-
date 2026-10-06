# -*- coding: utf-8 -*-
"""
학급경제 게임 서버
- 교실 PC: Python 3 표준 라이브러리만 사용합니다 (추가 설치 필요 없음).
  데이터는 data/db.json 파일에 저장됩니다.
  실행: python server.py  (또는 '실행하기.bat' 더블클릭)
- 웹(Vercel): api/index.py가 이 파일의 규칙을 그대로 쓰고, 데이터는 Neon(Postgres)에 저장합니다.
  (CLASS_ECONOMY_STORAGE=postgres, DATABASE_URL 환경변수 필요)
"""
import base64
import binascii
import hashlib
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
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, unquote

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
DATA_DIR = os.environ.get("CLASS_ECONOMY_DATA_DIR") or os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "db.json")
ROSTER_PATH = os.path.join(BASE_DIR, "class-roster.json")
PORT = int(os.environ.get("PORT", "8000"))

LOCK = threading.RLock()          # 데이터 변경은 항상 이 잠금 안에서 처리
SESSIONS = {}                     # token -> {"role": "teacher"|"student", "studentId": str|None}
FAILED = {}                       # 로그인 실패 횟수 기록 (PIN 무작위 입력 방지)
MAX_FAIL = 5
LOCK_SECONDS = 30

# 저장 방식: "file"(교실 PC, data/db.json) 또는 "postgres"(Vercel + Neon)
STORAGE = (os.environ.get("CLASS_ECONOMY_STORAGE") or "file").strip().lower()
CLOUD = STORAGE == "postgres"
SESSION_DAYS = 30                 # 웹 버전 로그인 유지 기간
DEFAULT_TEACHER_PIN = "0000"
CLASS_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"   # 헷갈리는 0·O·1·I·L 제외

# 한국 시간(서머타임 없음). Vercel 서버는 UTC라서 그대로 두면 '오늘'이 아침 9시에 바뀐다.
KST = timezone(timedelta(hours=9))


def local_now():
    return datetime.now(KST).replace(tzinfo=None)


def find_database_url():
    """Vercel에 Neon을 연결하면 자동으로 생기는 환경변수 이름들을 차례로 찾는다."""
    for key in ("DATABASE_URL", "POSTGRES_URL", "NEON_DATABASE_URL"):
        value = (os.environ.get(key) or "").strip()
        if value.startswith(("postgres://", "postgresql://")):
            return value
    for key in sorted(os.environ):   # 접두사를 붙여 연결한 경우 (예: STORAGE_DATABASE_URL)
        value = (os.environ.get(key) or "").strip()
        if key.endswith(("_DATABASE_URL", "_POSTGRES_URL")) and value.startswith(("postgres://", "postgresql://")):
            return value
    return ""


DATABASE_URL = find_database_url() if CLOUD else ""

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
    return local_now().isoformat(timespec="seconds")


def new_id(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


def load_class_roster():
    if not os.path.isfile(ROSTER_PATH):
        return None
    with open(ROSTER_PATH, "r", encoding="utf-8-sig") as f:
        roster = json.load(f)
    if not isinstance(roster, dict) or not isinstance(roster.get("students"), list) or not isinstance(roster.get("roles"), list):
        raise ValueError("학급 명단 설정을 확인해 주세요.")
    return roster


def has_student_reference(value, student_id):
    if isinstance(value, dict):
        return student_id in value or any(has_student_reference(v, student_id) for v in value.values())
    if isinstance(value, list):
        return any(has_student_reference(v, student_id) for v in value)
    return value == student_id


def apply_class_roster(db):
    """처음 한 번 명단과 직책을 넣고, 교사가 이후에 편집한 명단은 그대로 보존합니다."""
    if db.setdefault("settings", {}).get("rosterVersion", 0) >= 1:
        return False
    roster = load_class_roster()
    if not roster:
        return False
    students = db.setdefault("students", [])
    used_roles = {s.get("roleId") for s in students if s.get("roleId")}
    old_role_names = {"칠판 지킴이", "전등 관리자", "창문 관리자", "학급 문고 사서", "분리수거 대장",
                      "식물 돌보미", "우체부", "급식 도우미", "일정 알리미", "청소 반장", "IT 도우미", "학급 은행원"}
    roles = db.setdefault("roles", [])
    roles[:] = [r for r in roles if r.get("name") not in old_role_names or r.get("id") in used_roles]
    for record in roster["roles"]:
        role = next((r for r in roles if r.get("id") == record["id"]), None)
        if role:
            role.update(record)
        else:
            roles.append({**record, "createdAt": now_str()})
    matched_ids = set()
    for record in roster["students"]:
        student = next((s for s in students if s.get("id") not in matched_ids and s.get("name") == record["name"]), None)
        if not student:
            student = next((s for s in students if s.get("id") not in matched_ids
                            and s.get("number") == record["number"] and re.fullmatch(r"\d+번 학생", s.get("name", ""))), None)
        if not student:
            student = {"id": new_id("s"), "pin": "1234", "balance": 0, "exp": 0, "createdAt": now_str()}
            students.append(student)
        student.update({"number": record["number"], "name": record["name"], "roleId": record.get("roleId")})
        matched_ids.add(student["id"])
    other_data = {k: v for k, v in db.items() if k != "students"}
    configured_numbers = {record["number"] for record in roster["students"]}
    students[:] = [s for s in students if not (
        s["id"] not in matched_ids and s.get("number") not in configured_numbers
        and re.fullmatch(r"\d+번 학생", s.get("name", ""))
        and not s.get("balance") and not s.get("exp")
        and not s.get("roleId") and s.get("pin", "1234") == "1234"
        and int(s.get("characterLevel", 1)) <= 1 and not s.get("territoryPurchases")
        and len(s.get("claimedCities", [])) <= 1 and int(s.get("claimedTiles", 6)) <= 6
        and not has_student_reference(other_data, s["id"]))]
    db["settings"]["rosterVersion"] = 1
    return True


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
        ("🪑", "자리 바꾸기 교환권", "coupon", 150, SEAT_DESC),
        ("🧑‍🏫", "일일 선생님 쿠폰", "coupon", 120, "아침 활동 시간을 내가 진행해요."),
        ("📝", "숙제 하루 면제 쿠폰", "coupon", 100, "숙제 한 번을 면제받아요. (선생님 확인 필요)"),
        ("🍽️", "급식 먼저 먹기 쿠폰", "coupon", 60, "하루 동안 급식 줄 맨 앞에 서요."),
        ("🎵", "음악 들으며 공부 쿠폰", "coupon", 40, "자습 시간에 이어폰으로 음악을 들어요."),
        ("📒", "알림장 면제", "coupon", 100, "알림장 한 번을 면제받아요. (선생님 확인 필요)"),
        ("✏️", "학용품", "goods", 200, "학급 상점에서 학용품을 골라요."),
        ("🍬", "간식 뽑기", "goods", 50, "간식 상자에서 한 개를 골라요."),
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
    db = {
        "version": 3,
        "settings": {"className": "6학년 4반", "classNameVersion": 1, "currencyName": "코인", "teacherPin": "0000",
                     "luckEnabled": True, "peGoalDays": 10},
        "students": students,
        "roles": roles,
        "items": items,
        "transactions": [],
        "missions": seed_missions(),
        "submissions": [],
        "assignments": [],
        "vote": None,
        "peEvents": [],
    }
    apply_class_roster(db)
    return db


# ─────────────────────────── 미션 · 학급 회의 · 행운의 게임 규칙 ───────────────────────────
# (id, 아이콘, 이름, 보상, 설명, 매일 하는 미션, 신청할 때 적을 내용(비우면 안 적음), 종류)
MISSIONS_SEED = [
    ("m_teacher", "📝", "선생님 과제", 10, "선생님이 올린 학습지나 과제를 풀고 인증해요", False, "답안을 적고 인증해요", "assignment"),
    ("m_role", "🧩", "1인 1역", 10, "내가 맡은 역할을 끝까지 해냈어요", True, "", "role"),
    ("m_pypx_archive", "🗂️", "PYPX 아카이빙", 30, "PYPX 탐구 과정을 사진·글로 기록하고 정리했어요", False, "무엇을 기록·정리했나요?", ""),
    ("m_pypx_solve", "💡", "PYPX 탐구 해결", 40, "탐구 질문을 해결하고 알게 된 점을 나눴어요", False, "어떤 탐구 질문을 해결했나요?", ""),
    ("m_reading", "📖", "독서노트", 10, "책을 읽고 독서노트를 썼어요", False, "읽은 책 제목", ""),
    ("m_notice", "📒", "알림장", 5, "오늘 알림장을 빠짐없이 적었어요", True, "", ""),
    ("m_supplies", "🎒", "준비물 챙겨오기", 5, "오늘 필요한 준비물을 챙겨 왔어요", True, "", ""),
    ("m_pyp_reading", "🔎", "PYP 관련 독서 인증", 15, "탐구 주제와 관련된 책을 읽고 인증했어요", False, "책 제목과 관련된 탐구 주제", ""),
]

SEAT_DESC = "원하는 친구와 하루 동안 자리를 바꿔요. 가장 귀한 교환권!"
# 처음 기본 상품의 (예전 가격, 새 가격): 선생님이 가격을 바꾸지 않은 상품만 한 번 정리
ITEM_PRICE_UPDATE = {
    "자리 바꾸기 쿠폰": (50, 150),
    "일일 선생님 쿠폰": (120, 120),
    "숙제 하루 면제 쿠폰": (80, 100),
    "급식 먼저 먹기 쿠폰": (40, 60),
    "음악 들으며 공부 쿠폰": (30, 40),
    "미니 노트": (25, 30),
    "캐릭터 연필": (20, 25),
    "간식 뽑기": (15, 20),
}

LUCK_BET = 10        # 행운의 게임에 거는 화폐 = 기본 미션(1인 1역) 1개 보상
LUCK_FEE = 1         # 수수료 10% (게임마다 사라짐 → 오래 할수록 줄어들고, 물가 오름도 막음)
LUCK_DAILY = 5       # 하루에 할 수 있는 횟수
PE_PASS_RATE = 70    # 자율 체육 학급 회의 통과 기준 (전체 학생 중 찬성 %)


def seed_missions():
    return [
        {"id": i, "emoji": e, "name": n, "reward": r, "desc": d, "daily": daily, "prompt": p,
         "kind": k, "active": True, "createdAt": now_str()}
        for i, e, n, r, d, daily, p, k in MISSIONS_SEED
    ]


def migrate_db(db):
    """예전 데이터에 새 기능 칸을 채우고(지우는 것 없음), 기본 상품 가격을 한 번 정리합니다."""
    changed = False
    st = db.setdefault("settings", {})
    if int(st.get("classNameVersion", 0)) < 1:
        st["className"] = "6학년 4반"
        st["classNameVersion"] = 1
        changed = True
    for key, value in (("luckEnabled", True), ("peGoalDays", 10)):
        if key not in st:
            st[key] = value
            changed = True
    if not isinstance(db.get("missions"), list):
        db["missions"] = seed_missions()
        changed = True
    for key in ("submissions", "peEvents", "assignments"):
        if not isinstance(db.get(key), list):
            db[key] = []
            changed = True
    if "vote" not in db:
        db["vote"] = None
        changed = True
    if int(db.get("version", 1)) < 2:
        for it in db.get("items", []):
            upd = ITEM_PRICE_UPDATE.get(it.get("name"))
            if upd and it.get("price") == upd[0]:
                it["price"] = upd[1]
                if it["name"] == "자리 바꾸기 쿠폰":
                    it["name"] = "자리 바꾸기 교환권"
                    it["description"] = SEAT_DESC
        db["version"] = 2
        changed = True
    if int(db.get("version", 1)) < 3:
        updates = {
            "캐릭터 연필": {"name": "학용품", "type": "goods", "price": 200,
                        "description": "학급 상점에서 학용품을 골라요."},
            "미니 노트": {"name": "알림장 면제", "type": "coupon", "price": 100,
                       "description": "알림장 한 번을 면제받아요. (선생님 확인 필요)"},
            "미니노트": {"name": "알림장 면제", "type": "coupon", "price": 100,
                      "description": "알림장 한 번을 면제받아요. (선생님 확인 필요)"},
            "간식 뽑기": {"price": 50},
        }
        for item in db.get("items", []):
            update = updates.get(item.get("name"))
            if update:
                item.update(update)
        if not any(m.get("id") == "m_teacher" for m in db["missions"]):
            db["missions"].append(next(m for m in seed_missions() if m["id"] == "m_teacher"))
        db["version"] = 3
        changed = True
    if apply_class_roster(db):
        changed = True
    return changed



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
        if not isinstance(s.get("claimedCityTiles"), dict):
            other_cities = [city for city in s["claimedCities"] if city != s["homeCity"]]
            s["claimedCityTiles"] = {city: 3 for city in other_cities}
            s["claimedCityTiles"][s["homeCity"]] = max(1, int(s["claimedTiles"]) - 3 * len(other_cities))
            changed = True
        if "characterLevel" not in s:
            s["characterLevel"] = 1
            changed = True
        if "territoryPurchases" not in s:
            s["territoryPurchases"] = 0
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
    if migrate_db(db):
        save_db(db)
    ensure_student_fields(db)
    return db


def save_db(db):
    """임시 파일에 먼저 쓰고 교체해서, 저장 중 꺼져도 파일이 깨지지 않게 합니다.
    웹 버전에서는 '바뀜' 표시만 하고, 요청이 끝날 때 Neon에 한 번에 저장합니다."""
    if CLOUD:
        _REQ.dirty = True
        return
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


_REQ = threading.local()          # 웹 버전: 요청 하나 동안의 DB 연결과 '바뀜' 표시
DB = {} if CLOUD else load_db()   # 웹 버전은 요청마다 Neon에서 읽어 온다


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
            "animal", "homeCity", "claimedCities", "claimedTiles", "energy", "friends",
            "characterLevel", "territoryPurchases")
    out = {k: s.get(k) for k in keys if k in s}
    out.update(level_info(s["exp"]))
    character_level = int(s.get("characterLevel", 1))
    purchases = int(s.get("territoryPurchases", 0))
    out.update({"characterLevel": character_level, "nextUpgradeCost": character_level * 10 if character_level < 101 else None,
                "territoryPurchases": purchases, "nextTerritoryCost": (purchases + 1) * 200})
    if include_pin:
        out["pin"] = s["pin"]
    return out


def sorted_students():
    return sorted(DB["students"], key=lambda s: (s["number"], s["name"]))


def public_settings():
    st = DB["settings"]
    return {"className": st["className"], "currencyName": st["currencyName"]}


class ApiError(Exception):
    def __init__(self, status, message, code=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


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
    if CLOUD:
        row = _REQ.conn.execute("SELECT locked_until FROM app_login_failures WHERE key = %s", (key,)).fetchone()
        until = float(row[0]) if row else 0
    else:
        info = FAILED.get(key)
        until = info["until"] if info else 0
    if until > time.time():
        left = int(until - time.time()) + 1
        raise ApiError(429, f"PIN을 여러 번 틀렸어요. {left}초 뒤에 다시 시도해 주세요.")


def record_fail(key):
    if CLOUD:   # 여러 서버가 함께 일해도 실패 횟수가 이어지도록 DB에 기록
        count = _REQ.conn.execute(
            "INSERT INTO app_login_failures (key, fail_count) VALUES (%s, 1) "
            "ON CONFLICT (key) DO UPDATE SET fail_count = app_login_failures.fail_count + 1 "
            "RETURNING fail_count", (key,)).fetchone()[0]
        if count >= MAX_FAIL:
            _REQ.conn.execute("UPDATE app_login_failures SET fail_count = 0, locked_until = %s WHERE key = %s",
                              (time.time() + LOCK_SECONDS, key))
        return
    info = FAILED.setdefault(key, {"count": 0, "until": 0})
    info["count"] += 1
    if info["count"] >= MAX_FAIL:
        info["count"] = 0
        info["until"] = time.time() + LOCK_SECONDS


def clear_fail(key):
    if CLOUD:
        _REQ.conn.execute("DELETE FROM app_login_failures WHERE key = %s", (key,))
    else:
        FAILED.pop(key, None)


# ---- 로그인 세션 (교실 PC: 메모리 / 웹: Neon에 토큰의 해시만 저장) ----
def token_hash(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def session_create(role, student_id=None):
    token = secrets.token_urlsafe(24)
    if CLOUD:
        conn = _REQ.conn
        conn.execute("DELETE FROM app_sessions WHERE created_at < now() - make_interval(days => %s)", (SESSION_DAYS,))
        conn.execute("INSERT INTO app_sessions (token_hash, role, student_id) VALUES (%s, %s, %s)",
                     (token_hash(token), role, student_id))
    else:
        SESSIONS[token] = {"role": role, "studentId": student_id}
    return token


def session_get(token):
    if not token:
        return None
    if CLOUD:
        row = _REQ.conn.execute(
            "SELECT role, student_id FROM app_sessions WHERE token_hash = %s "
            "AND created_at > now() - make_interval(days => %s)", (token_hash(token), SESSION_DAYS)).fetchone()
        return {"role": row[0], "studentId": row[1]} if row else None
    return SESSIONS.get(token)


def session_drop(token):
    if not token:
        return
    if CLOUD:
        _REQ.conn.execute("DELETE FROM app_sessions WHERE token_hash = %s", (token_hash(token),))
    else:
        SESSIONS.pop(token, None)


def sessions_drop_students(student_id=None):
    """학생 한 명(student_id) 또는 모든 학생의 로그인을 끝낸다."""
    if CLOUD:
        if student_id:
            _REQ.conn.execute("DELETE FROM app_sessions WHERE student_id = %s", (student_id,))
        else:
            _REQ.conn.execute("DELETE FROM app_sessions WHERE role = 'student'")
        return
    for tok in [t for t, v in SESSIONS.items()
                if v.get("role") == "student" and (not student_id or v.get("studentId") == student_id)]:
        SESSIONS.pop(tok, None)


# ---- 학급 코드 (웹 버전: 코드를 아는 사람에게만 학생 이름을 보여 준다) ----
def new_class_code():
    return "".join(secrets.choice(CLASS_CODE_CHARS) for _ in range(6))


def normalize_code(value):
    return re.sub(r"[^0-9A-Z]", "", str(value or "").upper())


def class_code_ok(ctx):
    if not CLOUD:
        return True
    code = DB["settings"].get("classCode")
    return not code or secrets.compare_digest(normalize_code(ctx.get("classCode")), code)


# ─────────────────────────── API 처리 함수 ───────────────────────────
def api_public_info(ctx):
    if not class_code_ok(ctx):
        # 웹 버전: 학급 코드를 모르면 학생 이름을 보여 주지 않는다
        return {**public_settings(), "students": [], "needCode": True,
                "codeWrong": bool(normalize_code(ctx.get("classCode")))}
    return {
        **public_settings(),
        "students": [{"id": s["id"], "number": s["number"], "name": s["name"]} for s in sorted_students()],
        "needCode": False,
    }


def api_login_student(ctx):
    body = ctx["body"]
    if not class_code_ok(ctx):
        raise ApiError(403, "학급 코드를 먼저 입력해 주세요.")
    s = find(DB["students"], str(body.get("studentId", "")))
    if not s:
        raise ApiError(404, "학생을 찾을 수 없어요.")
    key = "s:" + s["id"]
    check_lockout(key)
    if str(body.get("pin", "")) != s["pin"]:
        record_fail(key)
        raise ApiError(403, "PIN이 맞지 않아요.")
    clear_fail(key)
    token = session_create("student", s["id"])
    return {"token": token, "role": "student", "studentId": s["id"], "name": s["name"]}


def api_login_teacher(ctx):
    key = "teacher"
    check_lockout(key)
    if str(ctx["body"].get("pin", "")) != DB["settings"]["teacherPin"]:
        record_fail(key)
        raise ApiError(403, "PIN이 맞지 않아요.")
    clear_fail(key)
    token = session_create("teacher")
    return {"token": token, "role": "teacher", "name": "선생님"}


def api_logout(ctx):
    session_drop(ctx["token"])
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
        "missions": [m for m in DB["missions"] if m.get("active", True)],
        "mySubmissions": today_submissions(s["id"]),
        "assignments": [assignment_view(a) for a in DB["assignments"] if assignment_visible(a, s)],
        "myAssignmentSubmissions": [x for x in DB["submissions"] if x["studentId"] == s["id"] and x.get("assignmentId")],
        "taxInfo": tax_info(s),
        "classGoal": class_goal(viewer=s["id"]),
        "luck": luck_info(s),
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
def must_change_teacher_pin():
    """웹 버전은 누구나 주소로 들어올 수 있어서, 처음 PIN(0000)을 바꾸기 전에는 다른 기능을 막는다."""
    return CLOUD and DB["settings"].get("teacherPin") == DEFAULT_TEACHER_PIN


def student_addresses(ctx):
    if CLOUD:
        host = ctx.get("host") or ""
        return [f"https://{host}"] if host else []
    return [f"http://{ip}:{PORT}" for ip in local_ips()]


def api_teacher_state(ctx):
    today = today_str()
    given = sum(t["amount"] for t in DB["transactions"] if t["type"] == "give" and t["createdAt"].startswith(today))
    taken = sum(t["amount"] for t in DB["transactions"] if t["type"] == "take" and t["createdAt"].startswith(today))
    bought = sum(1 for t in DB["transactions"] if t["type"] == "buy" and t["createdAt"].startswith(today))
    luck_today = [t for t in DB["transactions"] if t["type"] == "luck" and t["createdAt"].startswith(today)]
    return {
        "settings": {**public_settings(), "defaultPin": DB["settings"]["teacherPin"] == DEFAULT_TEACHER_PIN,
                     "mustChangePin": must_change_teacher_pin(), "cloud": CLOUD,
                     "classCode": DB["settings"].get("classCode", "") if CLOUD else "",
                     "luckEnabled": bool(DB["settings"].get("luckEnabled", True)),
                     "peGoalDays": int(DB["settings"].get("peGoalDays", 10))},
        "students": [student_view(s, include_pin=True) for s in sorted_students()],
        "roles": DB["roles"],
        "items": DB["items"],
        "today": {"given": given, "taken": taken, "purchases": bought},
        "missions": DB["missions"],
        "pendingCount": sum(1 for x in DB["submissions"] if x["status"] == "pending"),
        "classGoal": class_goal(teacher=True),
        "luck": {"todayPlays": len(luck_today), "todayFees": sum(t.get("fee", 0) for t in luck_today),
                 **class_luck_totals()},
        "addresses": student_addresses(ctx),   # 학생 기기에서 접속할 주소
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
    # 미션 버튼으로 지급하면 그 학생은 오늘 그 미션을 받은 것으로 기록 (같은 날 두 번 받지 않게)
    mission = find(DB["missions"], str(body.get("missionId") or "")) if kind == "give" else None
    if kind == "give" and (body.get("missionId") == "m_teacher" or (mission and mission.get("kind") == "assignment")):
        raise ApiError(400, "선생님 과제는 제출한 답안을 확인하고 승인해 주세요.")
    stamp = now_str()
    result, skipped = [], []
    for s in targets:
        if kind == "give":
            if mission and not mark_mission_paid(s, mission, amount, stamp):
                skipped.append(s["name"])
                continue
            result.append(pay_student(s, amount, reason, stamp))
        else:
            s["balance"] -= amount      # 교사 차감은 마이너스 허용, 경험치는 그대로
            DB["transactions"].append({
                "id": new_id("t"), "studentId": s["id"], "studentName": s["name"], "type": kind,
                "amount": amount, "reason": reason, "balanceAfter": s["balance"], "createdAt": stamp,
            })
            lv = level_info(s["exp"])["level"]
            result.append({"id": s["id"], "name": s["name"], "levelUp": False, "level": lv})
    save_db(DB)
    return {"ok": True, "results": result, "skipped": skipped}


def pay_student(s, amount, reason, stamp):
    """지급: 받은 만큼 경험치도 함께 쌓인다"""
    before = level_info(s["exp"])["level"]
    s["balance"] += amount
    s["exp"] += amount
    DB["transactions"].append({
        "id": new_id("t"), "studentId": s["id"], "studentName": s["name"], "type": "give",
        "amount": amount, "reason": reason[:60], "balanceAfter": s["balance"], "createdAt": stamp,
    })
    after = level_info(s["exp"])["level"]
    return {"id": s["id"], "name": s["name"], "levelUp": after > before, "level": after}


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
    ensure_student_fields(DB)   # 새 학생에게도 수호동물·시작 도시를 바로 정해 줌
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
    sessions_drop_students(s["id"])
    save_db(DB)
    return {"ok": True}


def api_settings(ctx):
    body = ctx["body"]
    st = DB["settings"]
    st["className"] = req_str(body, "className", "학급 이름", 20)
    st["currencyName"] = req_str(body, "currencyName", "화폐 이름", 10)
    if body.get("teacherPin"):
        pin = req_pin(body, "teacherPin")
        if CLOUD and pin == DEFAULT_TEACHER_PIN:
            raise ApiError(400, "0000은 누구나 아는 PIN이라 쓸 수 없어요. 다른 숫자 4자리를 정해 주세요.")
        st["teacherPin"] = pin
    elif must_change_teacher_pin():
        raise ApiError(400, "새 선생님 PIN을 입력해 주세요. 처음 PIN(0000)을 바꿔야 다른 기능을 쓸 수 있어요.")
    if CLOUD and "classCode" in body:
        code = normalize_code(body.get("classCode"))
        if not 4 <= len(code) <= 8:
            raise ApiError(400, "학급 코드는 영어 대문자와 숫자 4~8자리로 정해 주세요.")
        st["classCode"] = code
    if "luckEnabled" in body:
        st["luckEnabled"] = bool(body.get("luckEnabled"))
    if body.get("peGoalDays") not in (None, ""):
        st["peGoalDays"] = req_int(body, "peGoalDays", "자율 체육 목표 일수", 1, 60)
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
    if CLOUD:
        # 웹 버전: 지금 PIN·학급 코드는 그대로 둔다 (예전 백업의 0000으로 되돌아가 잠기지 않게)
        keep = {k: DB["settings"].get(k) for k in ("teacherPin", "classCode") if DB["settings"].get(k)}
        data.setdefault("settings", {}).update(keep)
    DB = data
    migrate_db(DB)              # 예전 백업에도 미션·학급 회의 칸을 채움
    ensure_student_fields(DB)   # 예전 백업에도 수호동물·도시 정보를 채움
    save_db(DB)
    # 학생 세션은 모두 초기화 (학생 목록이 바뀌었을 수 있음)
    sessions_drop_students()
    return {"ok": True}



def api_world_cities(ctx):
    """21개 도시 정보와 각 도시에 소속/개척된 학생들을 종합해서 반환합니다."""
    students = DB.get("students", [])
    if CLOUD and not ctx.get("session") and not class_code_ok(ctx):
        students = []   # 웹 버전: 로그인 전 첫 화면 지구본에는 학생 이름을 싣지 않는다
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
                    "characterLevel": int(s.get("characterLevel", 1)),
                    "animal": animal,
                    "isHome": is_home,
                    "tiles": s.get("claimedCityTiles", {}).get(c_id, tiles if is_home else 3)
                })
                city_map[c_id]["totalTiles"] += s.get("claimedCityTiles", {}).get(c_id, tiles if is_home else 3)

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

    purchases = int(s.get("territoryPurchases", 0))
    tx = spend_student(s, (purchases + 1) * 200, "territory", f"{city['name']} 영토 1칸 개척", cityId=city_id)
    claimed.append(city_id)
    s["claimedTiles"] = s.get("claimedTiles", 6) + 1
    s.setdefault("claimedCityTiles", {})[city_id] = 1
    s["territoryPurchases"] = purchases + 1
    s["energy"] = max(0, s.get("energy", 2) - 1)
    save_db(DB)

    return {
        "ok": True,
        "message": f"축하해요! {city['name']}에 내 깃발을 꽂았어요! 🚩",
        "city": city,
        "transaction": tx,
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


# ─────────────────────────── 코인으로 성장 · 세금 ───────────────────────────
def spend_student(s, amount, kind, reason, **extra):
    if s["balance"] < amount:
        raise ApiError(400, f"{DB['settings']['currencyName']}이(가) {amount - s['balance']}만큼 부족해요.")
    s["balance"] -= amount
    tx = {
        "id": new_id("t"), "studentId": s["id"], "studentName": s["name"], "type": kind,
        "amount": amount, "reason": reason, "balanceAfter": s["balance"], "createdAt": now_str(),
        **extra,
    }
    DB["transactions"].append(tx)
    return tx


def tax_info(s):
    today = today_str()
    paid = {t.get("taxType") for t in DB["transactions"]
            if t.get("studentId") == s["id"] and t.get("type") == "tax"
            and (t.get("date") or t.get("createdAt", "")[:10]) == today}
    return {"date": today, "incomePaid": "income" in paid, "propertyPaid": "property" in paid,
            "propertyDue": s["balance"] > 100 and "property" not in paid}


def api_student_tax(ctx):
    s = current_student(ctx)
    kind = ctx["body"].get("type")
    if kind not in ("income", "property"):
        raise ApiError(400, "소득세 또는 재산세를 골라 주세요.")
    info = tax_info(s)
    if info["incomePaid" if kind == "income" else "propertyPaid"]:
        raise ApiError(400, "오늘은 이미 납부한 세금이에요.")
    if kind == "property" and s["balance"] <= 100:
        raise ApiError(400, "재산세는 잔액이 100코인을 넘을 때 납부해요.")
    tx = spend_student(s, 10, "tax", "소득세 납부" if kind == "income" else "재산세 납부",
                       taxType=kind, date=info["date"])
    save_db(DB)
    return {"ok": True, "transaction": tx, "student": student_view(s), "taxInfo": tax_info(s)}


def api_student_upgrade_character(ctx):
    s = current_student(ctx)
    level = int(s.get("characterLevel", 1))
    if level >= 101:
        raise ApiError(400, "캐릭터가 최고 레벨에 도달했어요!")
    tx = spend_student(s, level * 10, "upgrade", f"캐릭터 업그레이드: Lv.{level} → Lv.{level + 1}")
    s["characterLevel"] = level + 1
    save_db(DB)
    return {"ok": True, "transaction": tx, "student": student_view(s)}


def api_student_expand_territory(ctx):
    s = current_student(ctx)
    purchases = int(s.get("territoryPurchases", 0))
    tx = spend_student(s, (purchases + 1) * 200, "territory", "내 영토 1칸 확장")
    s["claimedTiles"] = int(s.get("claimedTiles", 6)) + 1
    tiles = s.setdefault("claimedCityTiles", {})
    home = s.get("homeCity", "seoul")
    tiles[home] = int(tiles.get(home, s["claimedTiles"] - 1)) + 1
    s["territoryPurchases"] = purchases + 1
    save_db(DB)
    return {"ok": True, "transaction": tx, "student": student_view(s)}


# ─────────────────────────── 선생님 과제 · PDF 학습지 ───────────────────────────
# Vercel 함수는 요청·응답을 4.5MB까지만 주고받는다. PDF는 글자로 바꾸면 4/3배가 되므로 3MB로 제한한다.
PDF_MAX_BYTES = 3 * 1024 * 1024
PDF_PREFIX = "data:application/pdf;base64,"
PDF_REF_PREFIX = "neon:"          # 웹 버전: PDF 본문은 app_pdfs 표에 두고 학급 데이터에는 표시만 남긴다


def assignment_view(assignment):
    out = {k: v for k, v in assignment.items() if k != "pdfData"}
    out["hasPdf"] = bool(assignment.get("pdfData"))
    return out


def assignment_visible(assignment, student):
    ids = assignment.get("studentIds") or []
    return bool(assignment.get("active", True)) and (not ids or student["id"] in ids)


def assignment_pdf(assignment):
    if not assignment:
        raise ApiError(404, "과제를 찾을 수 없어요.")
    data = assignment.get("pdfData") or ""
    if not data:
        raise ApiError(404, "이 과제에는 PDF 학습지가 없어요.")
    if data.startswith(PDF_REF_PREFIX):
        row = _REQ.conn.execute("SELECT pdf_data FROM app_pdfs WHERE assignment_id = %s",
                                (assignment["id"],)).fetchone() if CLOUD else None
        if not row:
            raise ApiError(404, "PDF 학습지를 찾을 수 없어요. 선생님께 다시 올려 달라고 말씀드려 주세요.")
        data = row[0]
    return {"pdfName": assignment["pdfName"], "pdfData": data}


def api_teacher_assignments(ctx):
    return {"assignments": [assignment_view(a) for a in reversed(DB["assignments"])]}


def api_teacher_assignment_create(ctx):
    body = ctx["body"]
    title = req_str(body, "title", "과제 제목", 100)
    instructions = req_str(body, "instructions", "안내", 3000, required=False)
    reward = req_int(body, "reward", "보상", 1, 1000)
    ids = body.get("studentIds", [])
    if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids):
        raise ApiError(400, "과제를 받을 학생을 확인해 주세요.")
    ids = list(dict.fromkeys(ids))
    if any(not find(DB["students"], i) for i in ids):
        raise ApiError(404, "찾을 수 없는 학생이 있어요.")
    pdf_data = body.get("pdfData") or ""
    pdf_name = req_str(body, "pdfName", "PDF 파일 이름", 150, required=False)
    if pdf_data:
        if not isinstance(pdf_data, str) or not pdf_data.startswith(PDF_PREFIX):
            raise ApiError(400, "PDF 파일을 선택해 주세요.")
        encoded = pdf_data[len(PDF_PREFIX):]
        if len(encoded) > ((PDF_MAX_BYTES + 2) // 3) * 4:
            raise ApiError(413, "PDF 파일은 3MB 이하로 올려 주세요.")
        try:
            decoded = base64.b64decode(encoded, validate=True)
        except (ValueError, binascii.Error):
            raise ApiError(400, "PDF 파일을 읽을 수 없어요. 다시 선택해 주세요.")
        if len(decoded) > PDF_MAX_BYTES:
            raise ApiError(413, "PDF 파일은 3MB 이하로 올려 주세요.")
        if not decoded.startswith(b"%PDF-"):
            raise ApiError(400, "올바른 PDF 파일이 아니에요.")
        if not pdf_name:
            raise ApiError(400, "PDF 파일 이름을 입력해 주세요.")
    else:
        pdf_name = ""
    assignment = {
        "id": new_id("a"), "title": title, "instructions": instructions, "reward": reward,
        "studentIds": ids, "pdfName": pdf_name, "pdfData": pdf_data,
        "active": True, "createdAt": now_str(),
    }
    DB["assignments"].append(assignment)
    save_db(DB)
    return {"ok": True, "assignment": assignment_view(assignment)}


def api_teacher_assignment_delete(ctx):
    assignment = find(DB["assignments"], ctx["params"][0])
    if not assignment:
        raise ApiError(404, "과제를 찾을 수 없어요.")
    assignment["active"] = False
    save_db(DB)
    return {"ok": True}


def api_teacher_assignment_pdf(ctx):
    return assignment_pdf(find(DB["assignments"], ctx["params"][0]))


def api_student_assignment_pdf(ctx):
    s = current_student(ctx)
    assignment = find(DB["assignments"], ctx["params"][0])
    if not assignment or not assignment_visible(assignment, s):
        raise ApiError(404, "지금은 볼 수 없는 과제예요.")
    return assignment_pdf(assignment)


def api_student_assignment_submit(ctx):
    s = current_student(ctx)
    assignment = find(DB["assignments"], ctx["params"][0])
    if not assignment or not assignment_visible(assignment, s):
        raise ApiError(404, "지금은 할 수 없는 과제예요.")
    answer = req_str(ctx["body"], "answer", "답안 또는 풀이 인증", 10000)
    previous = [x for x in DB["submissions"] if x["studentId"] == s["id"]
                and x.get("assignmentId") == assignment["id"]]
    if any(x["status"] == "approved" for x in previous):
        raise ApiError(400, "이미 승인받은 과제예요.")
    if any(x["status"] == "pending" for x in previous):
        raise ApiError(400, "이미 인증했어요. 선생님 확인을 기다려 주세요.")
    submission = {
        "id": new_id("q"), "studentId": s["id"], "studentName": s["name"],
        "assignmentId": assignment["id"], "missionId": "m_teacher", "missionName": assignment["title"],
        "assignmentPdfName": assignment.get("pdfName", ""),
        "missionEmoji": "📝", "note": answer, "reward": assignment["reward"], "status": "pending",
        "createdAt": now_str(), "reviewedAt": None,
    }
    DB["submissions"].append(submission)
    save_db(DB)
    return {"ok": True, "submission": submission}


def api_teacher_world(ctx):
    """교사용: 전체 학생들의 3D 월드 개척 및 수호동물 현황 집계"""
    return api_world_cities(ctx)


# ─────────────────────────── 미션 ───────────────────────────
def today_str():
    return local_now().strftime("%Y-%m-%d")


def today_submissions(student_id):
    today = today_str()
    return [x for x in DB["submissions"] if x["studentId"] == student_id and x["createdAt"].startswith(today)
            and not x.get("assignmentId")]


def api_student_mission_submit(ctx):
    """학생이 미션을 했다고 신청 → 선생님이 확인하면 보상"""
    s = current_student(ctx)
    body = ctx["body"]
    m = find(DB["missions"], str(body.get("missionId", "")))
    if not m or not m.get("active", True):
        raise ApiError(404, "지금은 할 수 없는 미션이에요.")
    if m.get("kind") == "assignment":
        raise ApiError(400, "선생님이 내준 과제를 열고 답안을 인증해 주세요.")
    prompt = m.get("prompt") or ""
    note = req_str(body, "note", prompt or "기록", 80, required=bool(prompt))
    if m.get("kind") == "role":
        role = find(DB["roles"], s["roleId"]) if s.get("roleId") else None
        if not role:
            raise ApiError(400, "아직 맡은 역할이 없어요. 선생님께 역할을 받아 주세요.")
        note = note or f"{role['emoji']} {role['name']}"
    for x in today_submissions(s["id"]):
        if x["missionId"] == m["id"] and x["status"] in ("pending", "approved"):
            raise ApiError(400, "오늘은 이미 받은 미션이에요." if x["status"] == "approved"
                           else "이미 신청했어요. 선생님 확인을 기다려 주세요.")
    sub = {
        "id": new_id("q"), "studentId": s["id"], "studentName": s["name"],
        "missionId": m["id"], "missionName": m["name"], "missionEmoji": m.get("emoji", "🎯"),
        "reward": int(m["reward"]), "note": note, "status": "pending",
        "createdAt": now_str(), "reviewedAt": None,
    }
    DB["submissions"].append(sub)
    save_db(DB)
    return {"ok": True, "submission": sub}


def mark_mission_paid(s, mission, amount, stamp):
    """선생님이 미션 버튼으로 바로 지급할 때: 오늘 이미 받았으면 False"""
    done = [x for x in today_submissions(s["id"]) if x["missionId"] == mission["id"]]
    if any(x["status"] == "approved" for x in done):
        return False
    pending = next((x for x in done if x["status"] == "pending"), None)
    if pending:
        pending.update({"status": "approved", "reviewedAt": stamp, "reward": amount})
    else:
        DB["submissions"].append({
            "id": new_id("q"), "studentId": s["id"], "studentName": s["name"],
            "missionId": mission["id"], "missionName": mission["name"], "missionEmoji": mission.get("emoji", "🎯"),
            "reward": amount, "note": "선생님 확인", "status": "approved", "createdAt": stamp, "reviewedAt": stamp,
        })
    return True


def api_teacher_missions(ctx):
    today = today_str()
    subs = DB["submissions"]
    approved_today = [x for x in subs if x["status"] == "approved" and (x.get("reviewedAt") or "").startswith(today)]
    reviewed = sorted((x for x in subs if x["status"] != "pending"),
                      key=lambda x: x.get("reviewedAt") or x["createdAt"], reverse=True)
    return {
        "missions": DB["missions"],
        "pending": sorted((x for x in subs if x["status"] == "pending"), key=lambda x: x["createdAt"]),
        "recent": reviewed[:30],
        "today": {"approved": len(approved_today), "coins": sum(x["reward"] for x in approved_today)},
    }


def api_missions_review(ctx):
    body = ctx["body"]
    action = body.get("action")
    if action not in ("approve", "reject"):
        raise ApiError(400, "승인 또는 반려를 골라 주세요.")
    ids = {str(i) for i in (body.get("ids") or [])}
    targets = [x for x in DB["submissions"] if x["id"] in ids and x["status"] == "pending"]
    if not targets:
        raise ApiError(400, "처리할 미션이 없어요. 이미 처리됐을 수 있어요.")
    stamp = now_str()
    results = []
    for sub in targets:
        sub["reviewedAt"] = stamp
        s = find(DB["students"], sub["studentId"])
        if action == "reject" or not s:
            sub["status"] = "rejected"
            continue
        if sub.get("assignmentId") and any(
                x["studentId"] == sub["studentId"] and x.get("assignmentId") == sub["assignmentId"]
                and x["status"] == "approved" for x in DB["submissions"]):
            sub["status"] = "rejected"
            continue
        sub["status"] = "approved"
        reason = f"미션: {sub['missionName']}" + (f" · {sub['note']}" if sub.get("note") else "")
        results.append(pay_student(s, sub["reward"], reason, stamp))
    save_db(DB)
    return {"ok": True, "count": len(targets), "results": results}


def parse_mission(body):
    return {
        "emoji": req_str(body, "emoji", "아이콘", 8, required=False) or "🎯",
        "name": req_str(body, "name", "미션 이름", 20),
        "reward": req_int(body, "reward", "보상", 1, 1000),
        "desc": req_str(body, "desc", "설명", 60, required=False),
        "prompt": req_str(body, "prompt", "신청할 때 적을 내용", 40, required=False),
        "daily": bool(body.get("daily", False)),
        "active": bool(body.get("active", True)),
    }


def api_mission_create(ctx):
    m = {"id": new_id("m"), **parse_mission(ctx["body"]), "kind": "", "createdAt": now_str()}
    DB["missions"].append(m)
    save_db(DB)
    return {"ok": True, "mission": m}


def api_mission_update(ctx):
    m = find(DB["missions"], ctx["params"][0])
    if not m:
        raise ApiError(404, "미션을 찾을 수 없어요.")
    m.update(parse_mission(ctx["body"]))
    save_db(DB)
    return {"ok": True, "mission": m}


def api_mission_delete(ctx):
    m = find(DB["missions"], ctx["params"][0])
    if not m:
        raise ApiError(404, "미션을 찾을 수 없어요.")
    DB["missions"].remove(m)
    save_db(DB)
    return {"ok": True}


# ─────────────────────────── 자율 체육 저금통 · 학급 회의 ───────────────────────────
def class_goal(viewer=None, teacher=False):
    """학급 화폐 합계와 목표(학생 수 × 매일 미션 보상 합계 × 목표 일수), 학급 회의 상황"""
    students = DB["students"]
    per_day = sum(int(m["reward"]) for m in DB["missions"] if m.get("daily") and m.get("active", True))
    days = int(DB["settings"].get("peGoalDays", 10))
    goal = max(1, len(students) * per_day * days)
    total = sum(max(0, s["balance"]) for s in students)
    out = {
        "total": total, "goal": goal, "perDay": per_day, "days": days, "studentCount": len(students),
        "passRate": PE_PASS_RATE, "ready": total >= goal, "vote": None,
        "lastEvent": DB["peEvents"][-1] if DB["peEvents"] else None,
    }
    v = DB.get("vote")
    if v:
        ids = {s["id"] for s in students}
        votes = {k: c for k, c in v.get("votes", {}).items() if k in ids}
        vote = {
            "id": v["id"], "status": v["status"], "openedAt": v["openedAt"], "closedAt": v.get("closedAt"),
            "yes": sum(1 for c in votes.values() if c == "yes"), "no": sum(1 for c in votes.values() if c == "no"),
            "total": len(students), "result": v.get("result"),
        }
        if viewer:
            vote["myVote"] = votes.get(viewer)
        if teacher:  # 누가 무엇을 골랐는지는 보여 주지 않고(비밀 투표), 안 한 학생만 알려 줌
            vote["notVoted"] = [s["name"] for s in sorted_students() if s["id"] not in votes]
        out["vote"] = vote
    return out


def api_vote_open(ctx):
    v = DB.get("vote")
    if v and v["status"] == "open":
        raise ApiError(400, "이미 학급 회의가 열려 있어요.")
    g = class_goal()
    if not g["ready"]:
        raise ApiError(400, f"학급 화폐가 {g['goal'] - g['total']}만큼 더 모여야 학급 회의를 열 수 있어요.")
    DB["vote"] = {"id": new_id("v"), "topic": "pe", "status": "open", "openedAt": now_str(),
                  "closedAt": None, "votes": {}, "result": None}
    save_db(DB)
    return {"ok": True}


def api_student_vote(ctx):
    s = current_student(ctx)
    choice = ctx["body"].get("choice")
    if choice not in ("yes", "no"):
        raise ApiError(400, "찬성 또는 반대를 골라 주세요.")
    v = DB.get("vote")
    if not v or v["status"] != "open":
        raise ApiError(400, "지금은 열린 학급 회의가 없어요.")
    v["votes"][s["id"]] = choice    # 회의가 끝나기 전까지는 마음을 바꿀 수 있음
    save_db(DB)
    return {"ok": True, "classGoal": class_goal(viewer=s["id"])}


def spend_class_goal(goal, reason, stamp):
    """목표 금액을 학생들 잔액에서 같은 비율로 사용 (잔액이 0 이하인 학생은 내지 않음)"""
    payers = [s for s in DB["students"] if s["balance"] > 0]
    total = sum(s["balance"] for s in payers)
    shares = []
    for s in payers:
        exact = s["balance"] * goal / total
        shares.append([s, int(exact), exact - int(exact)])
    left = goal - sum(x[1] for x in shares)
    for x in sorted(shares, key=lambda x: -x[2]):
        if left <= 0:
            break
        if x[1] < x[0]["balance"]:
            x[1] += 1
            left -= 1
    spent = 0
    for s, pay, _ in shares:
        if pay <= 0:
            continue
        s["balance"] -= pay
        spent += pay
        DB["transactions"].append({
            "id": new_id("t"), "studentId": s["id"], "studentName": s["name"], "type": "class",
            "amount": pay, "reason": reason, "balanceAfter": s["balance"], "createdAt": stamp,
        })
    return spent


def api_vote_close(ctx):
    v = DB.get("vote")
    if not v or v["status"] != "open":
        raise ApiError(400, "열린 학급 회의가 없어요.")
    ids = {s["id"] for s in DB["students"]}
    votes = {k: c for k, c in v["votes"].items() if k in ids}
    n = len(ids)
    yes = sum(1 for c in votes.values() if c == "yes")
    no = sum(1 for c in votes.values() if c == "no")
    rate = round(yes * 100 / n) if n else 0
    passed = n > 0 and yes * 100 >= PE_PASS_RATE * n
    result = {"yes": yes, "no": no, "total": n, "rate": rate, "passed": passed, "spent": 0}
    stamp = now_str()
    if passed:
        g = class_goal()
        if not g["ready"]:
            raise ApiError(400, "그 사이 학급 화폐가 목표보다 줄었어요. 회의를 취소하고 조금 더 모은 뒤 다시 열어 주세요.")
        result["spent"] = spend_class_goal(g["goal"], f"🏃 자율 체육 (학급 회의 찬성 {rate}%)", stamp)
        DB["peEvents"].append({"id": new_id("e"), "date": stamp, "spent": result["spent"],
                               "yes": yes, "no": no, "total": n, "rate": rate})
    v.update({"status": "passed" if passed else "failed", "closedAt": stamp, "result": result})
    save_db(DB)
    return {"ok": True, "result": result}


def api_vote_cancel(ctx):
    v = DB.get("vote")
    if not v or v["status"] != "open":
        raise ApiError(400, "열린 학급 회의가 없어요.")
    v.update({"status": "canceled", "closedAt": now_str()})
    save_db(DB)
    return {"ok": True}


# ─────────────────────────── 행운의 게임 (홀짝) ───────────────────────────
def luck_net(t):
    return t["amount"] if t.get("win") else -t["amount"]


def class_luck_totals():
    """우리 반 전체가 행운의 게임으로 얻고 잃은 합계 (교육용 통계)"""
    all_luck = [t for t in DB["transactions"] if t["type"] == "luck"]
    return {"classPlays": len(all_luck), "classNet": sum(luck_net(t) for t in all_luck),
            "classFees": sum(t.get("fee", 0) for t in all_luck)}


def luck_info(s):
    today = today_str()
    mine = [t for t in DB["transactions"] if t["studentId"] == s["id"] and t["type"] == "luck"]
    plays_today = sum(1 for t in mine if t["createdAt"].startswith(today))
    wins = sum(1 for t in mine if t.get("win"))
    return {
        "enabled": bool(DB["settings"].get("luckEnabled", True)),
        "bet": LUCK_BET, "fee": LUCK_FEE, "daily": LUCK_DAILY,
        "playsToday": plays_today, "remaining": max(0, LUCK_DAILY - plays_today),
        "plays": len(mine), "wins": wins, "losses": len(mine) - wins,
        "fees": sum(t.get("fee", 0) for t in mine), "net": sum(luck_net(t) for t in mine),
        **class_luck_totals(),
    }


def api_student_luck(ctx):
    """홀짝: 맞히면 건 화폐의 2배를 받고 틀리면 0배. 게임마다 수수료 10%는 사라진다."""
    s = current_student(ctx)
    if not DB["settings"].get("luckEnabled", True):
        raise ApiError(400, "선생님이 지금은 행운의 게임을 쉬게 했어요.")
    pick = ctx["body"].get("pick")
    if pick not in ("odd", "even"):
        raise ApiError(400, "홀 또는 짝을 골라 주세요.")
    if luck_info(s)["remaining"] <= 0:
        raise ApiError(400, f"행운의 게임은 하루 {LUCK_DAILY}번까지만 할 수 있어요. 내일 다시 만나요!")
    cost = LUCK_BET + LUCK_FEE
    cur = DB["settings"]["currencyName"]
    if s["balance"] < cost:
        raise ApiError(400, f"{cur}이(가) 부족해요. 한 번 하려면 {cost} {cur}(걸기 {LUCK_BET} + 수수료 {LUCK_FEE})이 필요해요.")
    marbles = secrets.randbelow(10) + 1          # 구슬 1~10개: 홀·짝이 반반
    win = (marbles % 2 == 1) == (pick == "odd")
    net = (LUCK_BET if win else -LUCK_BET) - LUCK_FEE
    s["balance"] += net
    DB["transactions"].append({
        "id": new_id("t"), "studentId": s["id"], "studentName": s["name"], "type": "luck",
        "amount": abs(net), "win": win, "bet": LUCK_BET, "fee": LUCK_FEE, "pick": pick, "marbles": marbles,
        "reason": f"🍀 행운의 게임 · {'홀' if pick == 'odd' else '짝'} → 구슬 {marbles}개 ({'맞힘' if win else '틀림'})",
        "balanceAfter": s["balance"], "createdAt": now_str(),
    })
    save_db(DB)
    return {"ok": True, "result": {"marbles": marbles, "pick": pick, "win": win, "bet": LUCK_BET,
                                   "fee": LUCK_FEE, "net": net},
            "student": student_view(s), "luck": luck_info(s)}


# ─────────────────────────── 웹 버전 저장소 (Vercel + Neon Postgres) ───────────────────────────
# 학급 데이터 전체를 app_state 표의 한 줄(JSON)로 두고, 요청마다 잠금을 걸어 읽고 고친 뒤 저장한다.
# 교실 PC 버전(data/db.json)과 규칙·데이터 모양이 같아서 백업 파일을 서로 옮길 수 있다.
SCHEMA_SQL = (
    """CREATE TABLE IF NOT EXISTS app_state (
        id smallint PRIMARY KEY,
        version bigint NOT NULL,
        data jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now())""",
    """CREATE TABLE IF NOT EXISTS app_sessions (
        token_hash text PRIMARY KEY,
        role text NOT NULL,
        student_id text,
        created_at timestamptz NOT NULL DEFAULT now())""",
    "CREATE INDEX IF NOT EXISTS app_sessions_student_idx ON app_sessions (student_id)",
    """CREATE TABLE IF NOT EXISTS app_login_failures (
        key text PRIMARY KEY,
        fail_count integer NOT NULL DEFAULT 0,
        locked_until double precision NOT NULL DEFAULT 0)""",
    """CREATE TABLE IF NOT EXISTS app_pdfs (
        assignment_id text PRIMARY KEY,
        pdf_name text NOT NULL,
        pdf_data text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now())""",
)
SCHEMA_LOCK_ID = 7351001          # 여러 서버가 동시에 처음 실행돼도 표 만들기·첫 데이터 넣기는 한 곳만
STATE_ID = 1
_PG = {"conn": None}
_CACHE = {"key": None, "data": None}   # 바뀌지 않았으면 같은 서버에서는 다시 읽지 않는다 (전송량 절약)
DB_DOWN_MESSAGE = "데이터베이스에 잠시 연결할 수 없어요. 잠시 뒤 다시 시도해 주세요."


class DbNotConfigured(Exception):
    pass


def pg_connection():
    import psycopg   # 웹 버전에서만 필요 (교실 PC에는 설치하지 않아도 됨)
    conn = _PG["conn"]
    if conn is not None and not conn.closed and not conn.broken:
        return conn
    pg_reset()
    if not DATABASE_URL:
        raise DbNotConfigured()
    conn = psycopg.connect(DATABASE_URL, autocommit=True, prepare_threshold=None, connect_timeout=10)
    try:
        with conn.transaction():
            conn.execute("SELECT pg_advisory_xact_lock(%s)", (SCHEMA_LOCK_ID,))
            for sql in SCHEMA_SQL:
                conn.execute(sql)
    except Exception:
        conn.close()
        raise
    _PG["conn"] = conn
    return conn


def drop_cache():
    _CACHE["key"] = None
    _CACHE["data"] = None


def pg_reset():
    conn, _PG["conn"] = _PG["conn"], None
    drop_cache()
    if conn is not None:
        try:
            conn.close()
        except Exception:
            pass


def seed_cloud_db():
    """웹 버전 첫 실행: 명부로 학급을 만들고 학생 PIN은 무작위 4자리, 학급 코드는 새로 정한다."""
    db = seed_db()
    ensure_student_fields(db)
    for s in db["students"]:
        s["pin"] = f"{secrets.randbelow(10000):04d}"
    db["settings"]["classCode"] = new_class_code()
    return db


def cloud_load(conn, lock):
    global DB
    from psycopg.types.json import Jsonb
    sql = "SELECT version, updated_at FROM app_state WHERE id = %s" + (" FOR UPDATE" if lock else "")
    row = conn.execute(sql, (STATE_ID,)).fetchone()
    if row is None:
        conn.execute("SELECT pg_advisory_xact_lock(%s)", (SCHEMA_LOCK_ID + 1,))
        if conn.execute("SELECT 1 FROM app_state WHERE id = %s", (STATE_ID,)).fetchone() is None:
            conn.execute("INSERT INTO app_state (id, version, data) VALUES (%s, 1, %s)",
                         (STATE_ID, Jsonb(seed_cloud_db())))
        drop_cache()
        row = conn.execute(sql, (STATE_ID,)).fetchone()
    key = (int(row[0]), row[1])
    if _CACHE["key"] != key or _CACHE["data"] is None:
        _CACHE["data"] = conn.execute("SELECT data FROM app_state WHERE id = %s", (STATE_ID,)).fetchone()[0]
        _CACHE["key"] = key
    DB = _CACHE["data"]
    _REQ.version = key[0]
    _REQ.dirty = False
    changed = migrate_db(DB)
    ensure_student_fields(DB)          # 채운 칸이 있으면 save_db가 '바뀜' 표시
    if not DB["settings"].get("classCode"):
        DB["settings"]["classCode"] = new_class_code()
        changed = True
    if changed:
        _REQ.dirty = True


def cloud_save(conn, locked):
    from psycopg.types.json import Jsonb
    for a in DB.get("assignments", []):   # PDF 본문은 따로 저장 (매 요청마다 큰 파일을 주고받지 않게)
        data = a.get("pdfData") or ""
        if data.startswith(PDF_PREFIX):
            conn.execute(
                "INSERT INTO app_pdfs (assignment_id, pdf_name, pdf_data) VALUES (%s, %s, %s) "
                "ON CONFLICT (assignment_id) DO UPDATE SET pdf_name = EXCLUDED.pdf_name, pdf_data = EXCLUDED.pdf_data",
                (a["id"], a.get("pdfName") or "학습지.pdf", data))
            a["pdfData"] = PDF_REF_PREFIX + a["id"]
    sql = "UPDATE app_state SET data = %s, version = version + 1, updated_at = now() WHERE id = %s"
    params = [Jsonb(DB), STATE_ID]
    if not locked:   # 읽기 요청에서 생긴 자동 정리는, 그 사이 다른 저장이 없을 때만 쓴다
        sql += " AND version = %s"
        params.append(_REQ.version)
    row = conn.execute(sql + " RETURNING version, updated_at", params).fetchone()
    if row:
        _CACHE["key"], _CACHE["data"] = (int(row[0]), row[1]), DB
    else:
        drop_cache()


def authorize_and_run(fn, need, ctx):
    ctx["session"] = session_get(ctx["token"])
    if need and (not ctx["session"] or ctx["session"]["role"] != need):
        raise ApiError(401, "다시 들어와 주세요.")
    if need == "teacher" and fn not in PIN_CHANGE_ROUTES and must_change_teacher_pin():
        raise ApiError(403, "먼저 설정에서 선생님 PIN을 바꿔 주세요. (처음 PIN 0000은 웹에서 쓸 수 없어요)",
                       code="CHANGE_TEACHER_PIN")
    return fn(ctx)


def run_cloud(fn, need, ctx, method):
    import psycopg
    write = method != "GET"
    with LOCK:   # 같은 서버 안에서는 한 번에 한 요청씩 (학급 데이터 공유)
        for attempt in (1, 2):
            started = False
            failure = None
            try:
                conn = pg_connection()
                _REQ.conn = conn
                with conn.transaction():
                    cloud_load(conn, lock=write)
                    started = True
                    try:
                        result = authorize_and_run(fn, need, ctx)
                    except ApiError as e:
                        failure = e   # 로그인 실패 횟수 같은 기록은 남기고, 학급 데이터는 저장하지 않는다
                    else:
                        if _REQ.dirty:
                            cloud_save(conn, locked=write)
            except DbNotConfigured:
                raise ApiError(503, "데이터베이스(Neon)가 아직 연결되지 않았어요. Vercel 프로젝트의 Storage에서 Neon을 연결해 주세요.",
                               code="DB_NOT_CONFIGURED")
            except psycopg.Error as e:
                pg_reset()
                print("[DB 오류]", type(e).__name__, str(e).splitlines()[0][:200] if str(e) else "", file=sys.stderr)
                if attempt == 1 and not (write and started):   # 처리하기 전에 끊긴 경우만 한 번 더
                    continue
                raise ApiError(503, DB_DOWN_MESSAGE, code="DB_UNAVAILABLE")
            except Exception:
                drop_cache()
                raise
            finally:
                _REQ.conn = None
            if failure is not None:
                drop_cache()
                raise failure
            return result


def db_region():
    """Neon 주소에서 지역 이름만 꺼낸다 (예: ap-southeast-1). 비밀번호·주소는 내보내지 않는다."""
    try:
        parts = (urlparse(DATABASE_URL).hostname or "").split(".")
        return f"{parts[1]} ({parts[2]})" if len(parts) >= 5 and parts[-2:] == ["neon", "tech"] else ""
    except Exception:
        return ""


def health_report():
    info = {"ok": True, "storage": STORAGE, "fnRegion": os.environ.get("VERCEL_REGION", ""), "dbRegion": db_region()}
    if not CLOUD:
        return 200, {**info, "db": "file"}
    if not DATABASE_URL:
        return 503, {**info, "ok": False, "db": "missing"}
    try:
        with LOCK:
            conn = pg_connection()
            started = time.perf_counter()
            conn.execute("SELECT 1")
            ping = round((time.perf_counter() - started) * 1000, 1)
            ready = conn.execute("SELECT 1 FROM app_state WHERE id = %s", (STATE_ID,)).fetchone() is not None
        return 200, {**info, "db": "ok", "dbPingMs": ping, "initialized": ready}
    except Exception as e:
        pg_reset()
        return 503, {**info, "ok": False, "db": "error", "detail": type(e).__name__}


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
    ("POST", r"/api/student/taxes", api_student_tax, "student"),
    ("POST", r"/api/student/upgrade-character", api_student_upgrade_character, "student"),
    ("POST", r"/api/student/expand-territory", api_student_expand_territory, "student"),
    ("GET", r"/api/student/assignments/([\w-]+)/pdf", api_student_assignment_pdf, "student"),
    ("POST", r"/api/student/assignments/([\w-]+)/submit", api_student_assignment_submit, "student"),
    ("PUT", r"/api/student/animal", api_student_update_animal, "student"),
    ("POST", r"/api/student/missions", api_student_mission_submit, "student"),
    ("POST", r"/api/student/vote", api_student_vote, "student"),
    ("POST", r"/api/student/luck", api_student_luck, "student"),
    ("GET", r"/api/teacher/missions", api_teacher_missions, "teacher"),
    ("GET", r"/api/teacher/assignments", api_teacher_assignments, "teacher"),
    ("POST", r"/api/teacher/assignments", api_teacher_assignment_create, "teacher"),
    ("DELETE", r"/api/teacher/assignments/([\w-]+)", api_teacher_assignment_delete, "teacher"),
    ("GET", r"/api/teacher/assignments/([\w-]+)/pdf", api_teacher_assignment_pdf, "teacher"),
    ("POST", r"/api/teacher/missions", api_mission_create, "teacher"),
    ("POST", r"/api/teacher/missions/review", api_missions_review, "teacher"),
    ("PUT", r"/api/teacher/missions/([\w-]+)", api_mission_update, "teacher"),
    ("DELETE", r"/api/teacher/missions/([\w-]+)", api_mission_delete, "teacher"),
    ("POST", r"/api/teacher/vote/open", api_vote_open, "teacher"),
    ("POST", r"/api/teacher/vote/close", api_vote_close, "teacher"),
    ("POST", r"/api/teacher/vote/cancel", api_vote_cancel, "teacher"),
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
PIN_CHANGE_ROUTES = (api_teacher_state, api_settings)   # 처음 PIN을 바꾸기 전에도 쓸 수 있는 교사 기능


def run_local(fn, need, ctx):
    with LOCK:
        return authorize_and_run(fn, need, ctx)


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
        if path == "/api/health" and method == "GET":   # 연결 상태 확인용 (비밀 정보는 내보내지 않음)
            status, info = health_report()
            self.send_json(status, info)
            return
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
                    if not isinstance(body, dict):
                        raise ApiError(400, "잘못된 요청이에요.")
                auth = self.headers.get("Authorization", "")
                token = auth[7:] if auth.startswith("Bearer ") else ""
                host = re.sub(r"[^A-Za-z0-9.:\-]", "", self.headers.get("X-Forwarded-Host") or self.headers.get("Host") or "")
                ctx = {"body": body, "params": match.groups(), "token": token, "session": None,
                       "host": host[:200], "classCode": self.headers.get("X-Class-Code", "")[:40]}
                result = run_cloud(fn, need, ctx, method) if CLOUD else run_local(fn, need, ctx)
                self.send_json(200, result)
            except ApiError as e:
                self.send_json(e.status, {"error": e.message, **({"code": e.code} if e.code else {})})
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
    print("  🪙 서초롱 민주시민 경제교육 서버가 켜졌어요!")
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
