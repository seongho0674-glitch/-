"""웹 버전(Vercel + Neon) 저장 방식 검사.

실제 Neon 대신 테스트용 Postgres에 연결해서 확인한다. 교실 데이터나 Neon에는 접속하지 않는다.
  CLASSROOM_TEST_DATABASE_URL=postgresql://... python -m unittest tests/test_cloud.py
환경변수가 없거나 psycopg가 설치돼 있지 않으면 건너뛴다.
"""
import base64
import importlib.util
import json
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
TEST_URL = os.environ.get("CLASSROOM_TEST_DATABASE_URL", "")
try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

SKIP = not TEST_URL or psycopg is None


def load_instance(name, database_url):
    """서버 한 대를 흉내 낸다. 같은 파일을 다른 이름으로 불러오면 서로 메모리를 나누지 않는 별개의 서버가 된다."""
    env = {"CLASS_ECONOMY_STORAGE": "postgres", "DATABASE_URL": database_url,
           "CLASS_ECONOMY_DATA_DIR": str(ROOT / "tests" / "__never_used__")}
    # 서버는 *_DATABASE_URL 이름도 찾아 쓰므로, 불러오는 동안 테스트용 주소는 잠시 숨긴다
    hidden = {k: os.environ.pop(k) for k in list(os.environ)
              if k != "DATABASE_URL" and k.endswith(("DATABASE_URL", "POSTGRES_URL"))}
    try:
        with patch.dict(os.environ, env):
            spec = importlib.util.spec_from_file_location(name, ROOT / "server.py")
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
    finally:
        os.environ.update(hidden)
    return module


def start(handler_cls):
    from http.server import ThreadingHTTPServer
    http = ThreadingHTTPServer(("127.0.0.1", 0), handler_cls)
    worker = threading.Thread(target=http.serve_forever, daemon=True)
    worker.start()
    return http, worker, "http://127.0.0.1:" + str(http.server_port)


def pdf_data_url(size=1200):
    raw = b"%PDF-1.4\n" + b"%" * max(0, size - 9)
    return "data:application/pdf;base64," + base64.b64encode(raw).decode("ascii"), raw


@unittest.skipIf(SKIP, "CLASSROOM_TEST_DATABASE_URL 또는 psycopg가 없어 웹 버전 검사를 건너뜀")
class CloudStorageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a = load_instance("cloud_server_a", TEST_URL)
        cls.b = load_instance("cloud_server_b", TEST_URL)
        cls.servers = []
        cls.url_a = cls._serve(cls.a.Handler)
        cls.url_b = cls._serve(cls.b.Handler)

    @classmethod
    def _serve(cls, handler_cls):
        http, worker, url = start(handler_cls)
        cls.servers.append((http, worker))
        return url

    @classmethod
    def tearDownClass(cls):
        for http, worker in cls.servers:
            http.shutdown()
            http.server_close()
            worker.join(timeout=5)
        for module in (cls.a, cls.b):
            module.pg_reset()

    def setUp(self):
        for module in (self.a, self.b):
            module.pg_reset()
        with psycopg.connect(TEST_URL, autocommit=True) as conn:
            conn.execute("DROP TABLE IF EXISTS app_state, app_sessions, app_login_failures, app_pdfs")

    # ---------- 도우미 ----------
    def request(self, base, method, path, body=None, token=None, code=None, host=None):
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = Request(base + path, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", "Bearer " + token)
        if code:
            req.add_header("X-Class-Code", code)
        if host:
            req.add_header("X-Forwarded-Host", host)
        try:
            with urlopen(req, timeout=20) as res:
                return res.status, json.loads(res.read().decode("utf-8"))
        except HTTPError as err:
            return err.code, json.loads(err.read().decode("utf-8"))

    def sql(self, query, params=()):
        with psycopg.connect(TEST_URL, autocommit=True) as conn:
            return conn.execute(query, params).fetchall()

    def state(self):
        return self.sql("SELECT data FROM app_state WHERE id = 1")[0][0]

    def class_code(self):
        self.request(self.url_a, "GET", "/api/public/info")   # 첫 요청이 학급을 만든다
        return self.state()["settings"]["classCode"]

    def teacher(self, base=None, pin="0000"):
        code, res = self.request(base or self.url_a, "POST", "/api/login/teacher", {"pin": pin})
        self.assertEqual(code, 200, res)
        return res["token"]

    def ready_teacher(self, base=None):
        """처음 PIN을 바꾼 교사 로그인"""
        token = self.teacher(base)
        code, res = self.request(base or self.url_a, "PUT", "/api/teacher/settings",
                                 {"className": "6학년 4반", "currencyName": "코인", "teacherPin": "4826"}, token)
        self.assertEqual(code, 200, res)
        return token

    def student_login(self, base, index=0):
        code_value = self.class_code()
        st = self.state()["students"][index]
        code, res = self.request(base, "POST", "/api/login/student",
                                 {"studentId": st["id"], "pin": st["pin"]}, code=code_value)
        self.assertEqual(code, 200, res)
        return res["token"], st

    # ---------- 검사 ----------
    def test_first_request_seeds_roster_with_random_pins_and_class_code(self):
        code, info = self.request(self.url_a, "GET", "/api/public/info")
        self.assertEqual(code, 200, info)
        self.assertEqual(info["students"], [])
        self.assertTrue(info["needCode"])
        db = self.state()
        self.assertEqual(len(db["students"]), 21)
        self.assertTrue(all(len(s["pin"]) == 4 and s["pin"].isdigit() for s in db["students"]))
        self.assertGreater(len({s["pin"] for s in db["students"]}), 1)
        self.assertRegex(db["settings"]["classCode"], r"^[A-Z0-9]{6}$")
        self.assertEqual(db["settings"]["teacherPin"], "0000")

    def test_class_code_unlocks_names_and_is_case_insensitive(self):
        code_value = self.class_code()
        status, wrong = self.request(self.url_a, "GET", "/api/public/info", code="WRONG1")
        self.assertEqual((wrong["students"], wrong["codeWrong"]), ([], True))
        status, info = self.request(self.url_b, "GET", "/api/public/info", code=code_value.lower())
        self.assertEqual(status, 200)
        self.assertEqual(len(info["students"]), 21)
        st = self.state()["students"][0]
        status, res = self.request(self.url_a, "POST", "/api/login/student", {"studentId": st["id"], "pin": st["pin"]})
        self.assertEqual(status, 403)

    def test_world_map_hides_names_before_login(self):
        code_value = self.class_code()
        _, public = self.request(self.url_a, "GET", "/api/world/cities")
        self.assertTrue(all(not c["residents"] for c in public["cities"]))
        _, unlocked = self.request(self.url_a, "GET", "/api/world/cities", code=code_value)
        self.assertEqual(sum(len(c["residents"]) for c in unlocked["cities"]), 21)

    def test_teacher_must_replace_default_pin_before_other_features(self):
        token = self.teacher()
        status, res = self.request(self.url_a, "GET", "/api/teacher/missions", token=token)
        self.assertEqual((status, res.get("code")), (403, "CHANGE_TEACHER_PIN"))
        status, st = self.request(self.url_a, "GET", "/api/teacher/state", token=token, host="classclass-gamma.vercel.app")
        self.assertEqual(status, 200)
        self.assertTrue(st["settings"]["mustChangePin"])
        self.assertTrue(st["settings"]["cloud"])
        self.assertEqual(st["addresses"], ["https://classclass-gamma.vercel.app"])
        self.assertRegex(st["settings"]["classCode"], r"^[A-Z0-9]{6}$")
        base = {"className": "6학년 4반", "currencyName": "코인"}
        self.assertEqual(self.request(self.url_a, "PUT", "/api/teacher/settings", base, token)[0], 400)
        self.assertEqual(self.request(self.url_a, "PUT", "/api/teacher/settings", {**base, "teacherPin": "0000"}, token)[0], 400)
        status, res = self.request(self.url_b, "PUT", "/api/teacher/settings", {**base, "teacherPin": "4826", "classCode": "ab-12cd"}, token)
        self.assertEqual(status, 200, res)
        self.assertEqual(self.state()["settings"]["classCode"], "AB12CD")
        self.assertEqual(self.request(self.url_a, "GET", "/api/teacher/missions", token=token)[0], 200)
        self.assertEqual(self.request(self.url_a, "POST", "/api/login/teacher", {"pin": "0000"})[0], 403)
        self.assertEqual(self.request(self.url_b, "POST", "/api/login/teacher", {"pin": "4826"})[0], 200)

    def test_sessions_and_lockout_are_shared_between_servers(self):
        token, st = self.student_login(self.url_a)
        stored = [row[0] for row in self.sql("SELECT token_hash FROM app_sessions")]
        self.assertNotIn(token, stored)   # 토큰 자체가 아니라 해시만 저장
        self.assertIn(self.a.token_hash(token), stored)
        status, me = self.request(self.url_b, "GET", "/api/student/me", token=token)
        self.assertEqual((status, me["student"]["id"]), (200, st["id"]))
        self.assertEqual(self.request(self.url_b, "POST", "/api/logout", token=token)[0], 200)
        self.assertEqual(self.request(self.url_a, "GET", "/api/student/me", token=token)[0], 401)
        code_value = self.state()["settings"]["classCode"]
        wrong = "0000" if st["pin"] != "0000" else "1111"
        for i in range(5):
            base = self.url_a if i % 2 else self.url_b
            status, _ = self.request(base, "POST", "/api/login/student", {"studentId": st["id"], "pin": wrong}, code=code_value)
            self.assertEqual(status, 403)
        status, res = self.request(self.url_a, "POST", "/api/login/student", {"studentId": st["id"], "pin": st["pin"]}, code=code_value)
        self.assertEqual(status, 429, res)

    def test_changes_are_visible_everywhere_without_lost_updates(self):
        teacher = self.ready_teacher()
        token, st = self.student_login(self.url_b)
        body = {"type": "give", "amount": 50, "reason": "발표", "studentIds": [st["id"]]}
        self.assertEqual(self.request(self.url_a, "POST", "/api/teacher/pay", body, teacher)[0], 200)
        status, me = self.request(self.url_b, "GET", "/api/student/me", token=token)
        self.assertEqual(me["student"]["balance"], 50)
        one = {"type": "give", "amount": 1, "reason": "동시 지급", "studentIds": [st["id"]]}
        errors = []

        def pay(base):
            status, res = self.request(base, "POST", "/api/teacher/pay", one, teacher)
            if status != 200:
                errors.append(res)

        threads = [threading.Thread(target=pay, args=(self.url_a if i % 2 else self.url_b,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        self.assertEqual(errors, [])
        self.assertEqual(self.request(self.url_a, "GET", "/api/student/me", token=token)[1]["student"]["balance"], 70)
        self.assertEqual(self.state()["students"][0]["balance"], 70)
        self.assertEqual(len([t for t in self.state()["transactions"] if t["studentId"] == st["id"]]), 21)

    def test_pdf_lives_outside_class_data_and_reaches_students(self):
        teacher = self.ready_teacher()
        token, st = self.student_login(self.url_a)
        data_url, raw = pdf_data_url(4096)
        status, res = self.request(self.url_a, "POST", "/api/teacher/assignments",
                                   {"title": "수학 학습지", "reward": 10, "pdfName": "math.pdf", "pdfData": data_url}, teacher)
        self.assertEqual(status, 200, res)
        stored = self.state()["assignments"][0]
        self.assertEqual(stored["pdfData"], "neon:" + stored["id"])
        self.assertEqual(self.sql("SELECT pdf_name FROM app_pdfs")[0][0], "math.pdf")
        status, pdf = self.request(self.url_b, "GET", f"/api/student/assignments/{stored['id']}/pdf", token=token)
        self.assertEqual(status, 200, pdf)
        self.assertEqual(base64.b64decode(pdf["pdfData"].split(",", 1)[1]), raw)
        status, mine = self.request(self.url_b, "GET", "/api/student/me", token=token)
        self.assertTrue(mine["assignments"][0]["hasPdf"])
        status, backup = self.request(self.url_a, "GET", "/api/teacher/backup", token=teacher)
        self.assertNotIn("base64", json.dumps(backup))
        too_big, _ = pdf_data_url(self.a.PDF_MAX_BYTES + 1)
        status, res = self.request(self.url_a, "POST", "/api/teacher/assignments",
                                   {"title": "큰 파일", "reward": 10, "pdfName": "big.pdf", "pdfData": too_big}, teacher)
        self.assertEqual(status, 413)
        self.assertIn("3MB", res["error"])

    def test_restore_keeps_web_pin_and_code_and_moves_inline_pdf(self):
        teacher = self.ready_teacher()
        code_before = self.state()["settings"]["classCode"]
        status, backup = self.request(self.url_a, "GET", "/api/teacher/backup", token=teacher)
        data_url, raw = pdf_data_url(2048)
        backup["settings"]["teacherPin"] = "0000"
        backup["settings"].pop("classCode", None)
        backup["students"][0]["balance"] = 321
        backup["assignments"] = [{"id": "a_restored", "title": "예전 학습지", "instructions": "", "reward": 5,
                                  "studentIds": [], "pdfName": "old.pdf", "pdfData": data_url, "active": True,
                                  "createdAt": "2026-10-01T09:00:00"}]
        status, res = self.request(self.url_b, "POST", "/api/teacher/restore", {"db": backup}, teacher)
        self.assertEqual(status, 200, res)
        db = self.state()
        self.assertEqual(db["settings"]["teacherPin"], "4826")
        self.assertEqual(db["settings"]["classCode"], code_before)
        self.assertEqual(db["students"][0]["balance"], 321)
        self.assertEqual(db["assignments"][0]["pdfData"], "neon:a_restored")
        self.assertEqual(self.sql("SELECT count(*) FROM app_pdfs WHERE assignment_id = 'a_restored'")[0][0], 1)

    def test_deleting_a_student_ends_that_students_login(self):
        teacher = self.ready_teacher()
        token, st = self.student_login(self.url_a)
        self.assertEqual(self.request(self.url_b, "DELETE", f"/api/teacher/students/{st['id']}", token=teacher)[0], 200)
        self.assertEqual(self.request(self.url_a, "GET", "/api/student/me", token=token)[0], 401)

    def test_dates_use_korean_time(self):
        kst = datetime.now(timezone(timedelta(hours=9))).replace(tzinfo=None)
        stamp = datetime.fromisoformat(self.a.now_str())
        self.assertLess(abs((stamp - kst).total_seconds()), 5)
        self.assertEqual(self.a.today_str(), kst.strftime("%Y-%m-%d"))

    def test_health_and_missing_database(self):
        status, info = self.request(self.url_a, "GET", "/api/health")
        self.assertEqual((status, info["db"], info["storage"]), (200, "ok", "postgres"))
        self.assertNotIn("postgres", json.dumps({k: v for k, v in info.items() if k != "storage"}))
        empty = load_instance("cloud_server_no_db", "")
        http, worker, url = start(empty.Handler)
        try:
            status, info = self.request(url, "GET", "/api/public/info")
            self.assertEqual((status, info.get("code")), (503, "DB_NOT_CONFIGURED"))
            status, info = self.request(url, "GET", "/api/health")
            self.assertEqual((status, info["db"]), (503, "missing"))
        finally:
            http.shutdown()
            http.server_close()
            worker.join(timeout=5)
            empty.pg_reset()

    def test_vercel_entry_reads_original_path_from_rewrite(self):
        env = {"DATABASE_URL": TEST_URL, "CLASS_ECONOMY_STORAGE": "postgres"}
        with patch.dict(os.environ, env):
            spec = importlib.util.spec_from_file_location("vercel_entry", ROOT / "api" / "index.py")
            entry = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(entry)
        http, worker, url = start(entry.handler)
        try:
            status, info = self.request(url, "GET", "/api/index?__p=public/info")
            self.assertEqual(status, 200, info)
            self.assertIn("needCode", info)
            status, info = self.request(url, "GET", "/api/public/info")
            self.assertEqual(status, 200, info)
            status, info = self.request(url, "GET", "/index.html")
            self.assertEqual(status, 404)
        finally:
            http.shutdown()
            http.server_close()
            worker.join(timeout=5)
            entry.server.pg_reset()


if __name__ == "__main__":
    unittest.main()
