"""Isolated API and migration checks; never open the copied classroom database."""
import base64
import copy
from datetime import datetime
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as import_data:
    with patch.dict(os.environ, {"CLASS_ECONOMY_DATA_DIR": import_data}):
        spec = importlib.util.spec_from_file_location("isolated_class_economy", ROOT / "server.py")
        app = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(app)


class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = app.ThreadingHTTPServer(("127.0.0.1", 0), app.Handler)
        cls.worker = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.worker.start()
        cls.url = "http://127.0.0.1:" + str(cls.http.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.worker.join(timeout=5)

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        app.DATA_DIR = self.tmp.name
        app.DB_PATH = os.path.join(self.tmp.name, "db.json")
        app.DB = app.seed_db()
        app.ensure_student_fields(app.DB)
        app.SESSIONS.clear()
        app.FAILED.clear()
        self.student = app.DB["students"][0]
        self.other = app.DB["students"][1]
        self.session = {"role": "student", "studentId": self.student["id"]}

    def tearDown(self):
        self.tmp.cleanup()

    def ctx(self, body=None, params=(), student=None):
        session = {"role": "student", "studentId": (student or self.student)["id"]}
        return {"body": body or {}, "params": params, "session": session, "token": ""}

    def assert_api_error(self, status, function, ctx):
        with self.assertRaises(app.ApiError) as raised:
            function(ctx)
        self.assertEqual(raised.exception.status, status)

    def assignment(self, **overrides):
        body = {"title": "분수 학습지", "instructions": "문제를 풀고 답안을 인증해요.", "reward": 15,
                "studentIds": [], "pdfName": "학습지.pdf",
                "pdfData": app.PDF_PREFIX + base64.b64encode(b"%PDF-1.4\n% isolated test\n%%EOF").decode("ascii")}
        body.update(overrides)
        return app.api_teacher_assignment_create(self.ctx(body))["assignment"]

    def request(self, method, path, body=None, token=None):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        headers = {"Content-Type": "application/json"}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = Request(self.url + path, data=data, headers=headers, method=method)
        try:
            response = urlopen(request, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            return response.code, json.loads(response.read())

    def test_class_name_updates_once_and_preserves_all_classroom_records(self):
        self.assertEqual(app.seed_db()["settings"]["className"], "6학년 4반")
        legacy = copy.deepcopy(app.DB)
        legacy["settings"]["className"] = "6학년 1반"
        legacy["settings"].pop("classNameVersion", None)
        legacy["students"][0]["balance"] = 789
        legacy["students"][0]["pin"] = "9876"
        legacy["assignments"].append({"id": "saved_assignment", "title": "기존 학습지", "pdfData": "saved PDF"})
        legacy["submissions"].append({"id": "saved_submission", "studentId": self.student["id"], "answer": "기존 답안"})
        expected = copy.deepcopy(legacy)
        expected["settings"].update({"className": "6학년 4반", "classNameVersion": 1})
        self.assertTrue(app.migrate_db(legacy))
        self.assertEqual(legacy, expected)
        legacy["settings"]["className"] = "경제 교실"
        expected["settings"]["className"] = "경제 교실"
        self.assertFalse(app.migrate_db(legacy))
        self.assertEqual(legacy, expected)

    def test_student_first_pin_is_0000_and_old_default_moves_once(self):
        self.assertTrue(all(s["pin"] == "0000" for s in app.seed_db()["students"]))
        legacy = copy.deepcopy(app.DB)
        legacy["settings"].pop("pinDefaultVersion", None)
        legacy["students"][0]["pin"] = "1234"   # 예전 기본값
        legacy["students"][1]["pin"] = "5678"   # 선생님이 정해 준 PIN은 그대로
        self.assertTrue(app.migrate_db(legacy))
        self.assertEqual([legacy["students"][0]["pin"], legacy["students"][1]["pin"]], ["0000", "5678"])
        self.assertEqual(legacy["settings"]["teacherPin"], "0000")
        legacy["students"][0]["pin"] = "1234"   # 그 뒤에 일부러 1234로 정하면 다시 바꾸지 않는다
        self.assertFalse(app.migrate_db(legacy))
        self.assertEqual(legacy["students"][0]["pin"], "1234")

    def test_shop_migration_preserves_ids_and_history_and_runs_once(self):
        db = copy.deepcopy(app.DB)
        db["version"] = 2
        db["items"] = [
            {"id": "pencil", "name": "캐릭터 연필", "price": 25, "type": "goods", "active": False},
            {"id": "notebook", "name": "미니 노트", "price": 30, "type": "goods", "active": True},
            {"id": "snack", "name": "간식 뽑기", "price": 20, "type": "goods", "active": True},
            {"id": "custom", "name": "내 상품", "price": 73, "type": "goods", "active": True},
        ]
        db["missions"] = [m for m in db["missions"] if m["id"] != "m_teacher"]
        db["transactions"] = [{"id": "old", "studentId": self.student["id"], "itemId": "pencil", "itemName": "캐릭터 연필"}]
        before_students = copy.deepcopy(db["students"])
        self.assertTrue(app.migrate_db(db))
        self.assertEqual(db["version"], 4)
        for before, after in zip(before_students, db["students"]):   # v4는 소득세 시작점·산 영토 기록만 채운다
            skip = ("lastIncomeTaxDay", "landBought")
            self.assertEqual({k: v for k, v in after.items() if k not in skip}, {k: v for k, v in before.items() if k not in skip})
        self.assertEqual(db["transactions"][0]["itemName"], "캐릭터 연필")
        self.assertEqual(db["items"][0]["name"], "학용품")
        self.assertEqual(db["items"][0]["price"], 400)
        self.assertFalse(db["items"][0]["active"])
        self.assertEqual((db["items"][1]["name"], db["items"][1]["price"], db["items"][1]["type"]), ("알림장 면제", 100, "coupon"))
        self.assertEqual(db["items"][2]["price"], 200)
        self.assertEqual(db["items"][3]["price"], 73)
        self.assertEqual(app.find(db["missions"], "m_teacher")["kind"], "assignment")
        db["items"][0]["price"] = 210
        db["missions"] = [m for m in db["missions"] if m["id"] != "m_teacher"]
        self.assertFalse(app.migrate_db(db))
        self.assertEqual(db["items"][0]["price"], 210)
        self.assertIsNone(app.find(db["missions"], "m_teacher"))

    def test_v1_migration_reaches_v3(self):
        db = copy.deepcopy(app.DB)
        db["version"] = 1
        db["items"] = [{"id": "i", "name": "캐릭터 연필", "price": 20}]
        app.migrate_db(db)
        self.assertEqual((db["version"], db["items"][0]["name"], db["items"][0]["price"]), (4, "학용품", 400))

    def test_roster_matches_names_preserves_records_and_teacher_edits(self):
        roster_path = os.path.join(self.tmp.name, "roster.json")
        roster = {"students": [{"number": 1, "name": "가나다", "roleId": "min_a"}, {"number": 2, "name": "라마바", "roleId": "min_b"}],
                  "roles": [{"id": "min_a", "name": "경제부 장관", "emoji": "🏦", "tasks": ["세금 안내"]},
                            {"id": "min_b", "name": "환경부 장관", "emoji": "🌿", "tasks": ["환경 관리"]}]}
        with open(roster_path, "w", encoding="utf-8") as file:
            json.dump(roster, file)
        def pupil(_id, number, name, **extra):
            return {"id": _id, "number": number, "name": name, "pin": "0000", "balance": 0, "exp": 0, "roleId": None, **extra}
        db = {"settings": {}, "students": [
            pupil("named", 9, "가나다", balance=55, exp=75, pin="4567"), pupil("second", 2, "2번 학생"),
            pupil("empty", 3, "3번 학생"), pupil("history", 4, "4번 학생"), pupil("money", 5, "5번 학생", balance=1),
            pupil("real", 6, "다른 학생", roleId="used"), pupil("growth", 7, "7번 학생", characterLevel=2)],
            "roles": [{"id": "unused", "name": "칠판 지킴이"}, {"id": "used", "name": "청소 반장"}, {"id": "custom", "name": "나만의 직책"}],
            "transactions": [{"studentId": "history", "amount": 10}]}
        with patch.object(app, "ROSTER_PATH", roster_path):
            self.assertTrue(app.apply_class_roster(db))
            self.assertEqual(app.find(db["students"], "named")["number"], 1)
            self.assertEqual(app.find(db["students"], "named")["balance"], 55)
            self.assertEqual(app.find(db["students"], "named")["pin"], "4567")
            self.assertEqual(app.find(db["students"], "second")["name"], "라마바")
            self.assertIsNone(app.find(db["students"], "empty"))
            for retained in ("history", "money", "real", "growth"):
                self.assertIsNotNone(app.find(db["students"], retained))
            self.assertIsNone(app.find(db["roles"], "unused"))
            self.assertIsNotNone(app.find(db["roles"], "used"))
            self.assertIsNotNone(app.find(db["roles"], "custom"))
            db["students"][0]["name"] = "선생님 수정"
            self.assertFalse(app.apply_class_roster(db))
            self.assertEqual(db["students"][0]["name"], "선생님 수정")

    def test_character_costs_ten_through_one_thousand_without_xp(self):
        self.student.update(balance=100000, exp=350)
        spent = 0
        for expected in range(10, 1001, 10):
            self.assertEqual(app.student_view(self.student)["nextUpgradeCost"], expected)
            result = app.api_student_upgrade_character(self.ctx())
            self.assertEqual(result["transaction"]["amount"], expected)
            spent += expected
        self.assertEqual(self.student["characterLevel"], 101)
        self.assertEqual(self.student["exp"], 350)
        self.assertEqual(self.student["balance"], 100000 - spent)
        self.assertIsNone(app.student_view(self.student)["nextUpgradeCost"])
        self.assert_api_error(400, app.api_student_upgrade_character, self.ctx())
        self.assertEqual(len(app.DB["transactions"]), 100)

    def test_growth_insufficient_funds_keeps_all_fields(self):
        before = copy.deepcopy(self.student)
        self.assert_api_error(400, app.api_student_upgrade_character, self.ctx())
        self.assert_api_error(400, app.api_student_expand_territory, self.ctx())
        self.assertEqual(self.student, before)
        self.assertEqual(app.DB["transactions"], [])

    def test_territory_costs_two_hundred_steps_and_exactly_one_tile(self):
        self.student.update(balance=700, exp=40)
        tiles = self.student["claimedTiles"]
        first = app.api_student_expand_territory(self.ctx())
        second = app.api_student_expand_territory(self.ctx())
        self.assertEqual((first["transaction"]["amount"], second["transaction"]["amount"]), (200, 400))
        self.assertEqual(self.student["claimedTiles"], tiles + 2)
        self.assertEqual(self.student["balance"], 100)
        self.assertEqual(self.student["exp"], 40)
        self.assertEqual(second["student"]["nextTerritoryCost"], 600)
        self.assert_api_error(400, app.api_student_expand_territory, self.ctx())
        self.assertEqual(self.student["claimedTiles"], tiles + 2)

    def at(self, *when):
        return patch.object(app, "local_now", return_value=datetime(*when))

    def visit(self, student=None):
        """학생이 앱을 열었을 때처럼 접속 기록과 소득세 정리를 한다."""
        app.daily_settlement({"role": "student", "studentId": (student or self.student)["id"]})

    def income_taxes(self, student=None):
        sid = (student or self.student)["id"]
        return [t for t in app.DB["transactions"] if t["type"] == "tax" and t.get("taxType") == "income" and t["studentId"] == sid]

    def test_income_tax_is_automatic_at_nine_only_on_days_with_access(self):
        self.student["balance"] = 5
        with self.at(2026, 10, 6, 8, 30):
            self.visit()
            self.assertEqual(app.tax_info(self.student)["incomeStatus"], "scheduled")
            self.assertEqual(self.student["balance"], 5)
        self.assert_api_error(400, app.api_student_tax, self.ctx({"type": "income"}))
        with self.at(2026, 10, 6, 9, 0):
            app.daily_settlement(None)                       # 선생님 요청만 와도 9시가 되면 걷는다
            self.assertEqual(self.student["balance"], -5)     # 모자라면 마이너스(대출)
            self.assertEqual(app.tax_info(self.student)["incomeStatus"], "paid")
            self.visit()
        self.assertEqual([(t["createdAt"], t["date"]) for t in self.income_taxes()], [("2026-10-06T09:00:00", "2026-10-06")])
        with self.at(2026, 10, 7, 7, 59):                     # 아침 8시 전은 아직 6일
            self.visit()
            self.assertEqual(app.today_str(), "2026-10-06")
        with self.at(2026, 10, 9, 10, 15):                    # 7·8일은 접속하지 않음 → 걷지 않음
            app.daily_settlement(None)
            self.assertEqual(len(self.income_taxes()), 1)
            self.visit()
        self.assertEqual(self.income_taxes()[-1]["createdAt"], "2026-10-09T10:15:00")
        self.assertEqual(self.student["balance"], -15)
        self.assertEqual(self.income_taxes(self.other), [])

    def test_manual_income_tax_paid_before_update_is_not_charged_again(self):
        db = copy.deepcopy(app.DB)
        db["version"] = 3
        sid = db["students"][0]["id"]
        db["transactions"] = [{"id": "old_tax", "studentId": sid, "type": "tax", "taxType": "income", "amount": 10,
                               "date": "2026-10-06", "createdAt": "2026-10-06T10:00:00"}]
        for student in db["students"]:
            student.pop("lastIncomeTaxDay", None)
        app.migrate_db(db)
        self.assertEqual(db["students"][0]["lastIncomeTaxDay"], "2026-10-06")
        self.assertEqual(db["students"][1]["lastIncomeTaxDay"], "")

    def test_day_starts_at_eight_for_missions_and_luck(self):
        with self.at(2026, 10, 6, 21, 0):
            app.api_student_mission_submit(self.ctx({"missionId": "m_notice"}))
        with self.at(2026, 10, 7, 7, 59):
            self.assert_api_error(400, app.api_student_mission_submit, self.ctx({"missionId": "m_notice"}))
        with self.at(2026, 10, 7, 8, 0):
            self.assertTrue(app.api_student_mission_submit(self.ctx({"missionId": "m_notice"}))["ok"])

    def test_property_tax_notice_then_optional_payment(self):
        self.student["balance"] = 150
        self.assert_api_error(400, app.api_student_tax, self.ctx({"type": "property"}))
        sent = app.api_property_notify(self.ctx())
        self.assertEqual(sent["count"], 1)
        self.assertEqual(self.student["balance"], 150)          # 통보만으로는 걷지 않는다
        info = app.tax_info(self.student)["property"]
        self.assertEqual((info["amount"], info["paid"]), (10, False))
        self.assertIsNone(app.tax_info(self.other)["property"])
        paid = app.api_student_tax(self.ctx({"type": "property"}))
        self.assertEqual(paid["student"]["balance"], 140)
        self.assertTrue(paid["taxInfo"]["property"]["paid"])
        self.assert_api_error(400, app.api_student_tax, self.ctx({"type": "property"}))
        summary = app.property_summary()["latest"]
        self.assertEqual((summary["targets"], summary["paid"]), (1, 1))
        self.student["balance"] = 100                           # 100 이하면 대상이 아니다
        self.assert_api_error(400, app.api_property_notify, self.ctx())

    def test_fifth_luck_game_adds_prevention_fee_once(self):
        self.student["balance"] = 100
        for _ in range(4):
            self.assertIsNone(app.api_student_luck(self.ctx({"pick": "odd"}))["fine"])
        before = self.student["balance"]
        fifth = app.api_student_luck(self.ctx({"pick": "even"}))
        self.assertEqual(fifth["fine"]["amount"], 5)
        self.assertEqual(self.student["balance"], before + fifth["result"]["net"] - 5)
        self.assertTrue(fifth["luck"]["finedToday"])
        self.assert_api_error(400, app.api_student_luck, self.ctx({"pick": "odd"}))
        self.assertEqual(sum(1 for t in app.DB["transactions"] if t["type"] == "fine"), 1)

    def test_invasion_needs_more_than_double_and_keeps_starting_land(self):
        self.other["balance"] = 2000
        app.api_student_expand_territory(self.ctx(student=self.other))       # 200코인으로 1칸
        city = self.other["homeCity"]
        owner = next(r for c in app.api_world_cities(self.ctx())["cities"] if c["id"] == city
                     for r in c["residents"] if r["id"] == self.other["id"])
        self.assertEqual((owner["bought"], owner["paid"], owner["invadeCost"]), (1, 200, 401))
        self.student["balance"] = 400
        self.assert_api_error(400, app.api_student_invade, self.ctx({"cityId": city, "targetId": self.other["id"]}))
        self.student["balance"] = 1000
        self.assert_api_error(400, app.api_student_invade, self.ctx({"cityId": city, "targetId": self.student["id"]}))
        won = app.api_student_invade(self.ctx({"cityId": city, "targetId": self.other["id"]}))
        self.assertEqual((won["transaction"]["amount"], won["tiles"]), (401, 1))
        self.assertEqual(self.other["claimedCityTiles"][city], 6)              # 시작 6칸은 지킨다
        self.assertEqual(self.student["claimedCityTiles"][city], 1)
        self.assertEqual(self.student["landBought"][city], {"tiles": 1, "paid": 401})
        self.assertIn(city, self.student["claimedCities"])
        self.assertTrue(any(t["type"] == "invaded" and t["studentId"] == self.other["id"] for t in app.DB["transactions"]))
        self.assert_api_error(400, app.api_student_invade, self.ctx({"cityId": city, "targetId": self.other["id"]}))
        back = app.api_student_invade(self.ctx({"cityId": city, "targetId": self.student["id"]}, student=self.other))
        self.assertEqual(back["transaction"]["amount"], 803)
        self.assertNotIn(city, self.student["claimedCityTiles"])
        self.assertNotIn(city, self.student["claimedCities"])

    def test_teacher_board_shows_daily_missions_access_and_total_xp(self):
        self.student["balance"] = 1000
        with self.at(2026, 10, 6, 8, 40):
            self.visit()
            app.api_student_mission_submit(self.ctx({"missionId": "m_notice"}))
            app.api_student_expand_territory(self.ctx())                     # 영토 200
            app.api_student_upgrade_character(self.ctx())                    # 레벨업 10
            app.api_student_upgrade_character(self.ctx())                    # 레벨업 20
            board = app.daily_board()
        self.assertEqual([m["id"] for m in board["missions"]], ["m_role", "m_notice", "m_supplies"])
        row = next(r for r in board["rows"] if r["id"] == self.student["id"])
        self.assertEqual((row["missions"]["m_notice"], row["missions"]["m_supplies"], row["seen"], row["incomeTax"]),
                         ("pending", "none", True, "scheduled"))
        self.assertEqual((row["territoryCoins"], row["levelupCoins"], row["totalXp"]), (200, 30, 230))
        self.assertFalse(next(r for r in board["rows"] if r["id"] == self.other["id"])["seen"])

    def test_city_claim_shares_expansion_schedule_and_one_tile_allocation(self):
        self.student.update(balance=620, exp=70)
        initial_tiles = self.student["claimedTiles"]
        home = self.student["homeCity"]
        app.api_student_expand_territory(self.ctx())
        city = next(c for c in app.CITIES_DATA if c["id"] not in self.student["claimedCities"])
        result = app.api_student_claim_city(self.ctx({"cityId": city["id"]}))
        self.assertEqual(result["transaction"]["amount"], 400)
        self.assertEqual(result["transaction"]["type"], "territory")
        self.assertEqual(self.student["balance"], 20)
        self.assertEqual(self.student["claimedTiles"], initial_tiles + 2)
        self.assertEqual(self.student["claimedCityTiles"][home], initial_tiles + 1)
        self.assertEqual(self.student["claimedCityTiles"][city["id"]], 1)
        self.assertEqual(self.student["territoryPurchases"], 2)
        self.assertEqual(self.student["exp"], 70)
        self.assertEqual(result["student"]["nextTerritoryCost"], 600)
        self.assert_api_error(400, app.api_student_claim_city, self.ctx({"cityId": city["id"]}))
        next_city = next(c for c in app.CITIES_DATA if c["id"] not in self.student["claimedCities"])
        before = copy.deepcopy(self.student)
        self.assert_api_error(400, app.api_student_claim_city, self.ctx({"cityId": next_city["id"]}))
        self.assertEqual(self.student, before)
        world = app.api_world_cities(self.ctx())
        resident = next(r for c in world["cities"] if c["id"] == city["id"] for r in c["residents"] if r["id"] == self.student["id"])
        self.assertEqual(resident["tiles"], 1)

    def test_legacy_city_tile_migration_preserves_total_and_allocates(self):
        student = self.student
        student.pop("claimedCityTiles")
        student["claimedCities"] = [student["homeCity"], "vancouver", "new-york"]
        student["claimedTiles"] = 14
        app.ensure_student_fields(app.DB)
        self.assertEqual(sum(student["claimedCityTiles"].values()), 14)
        self.assertEqual(student["claimedCityTiles"][student["homeCity"]], 8)
        self.assertEqual(student["claimedCityTiles"]["vancouver"], 3)

    def test_tax_requires_funds_and_valid_kind(self):
        self.student["balance"] = 101
        app.api_property_notify(self.ctx())
        self.student["balance"] = 9                              # 재산세는 골라서 내는 것이라 잔액이 있어야 한다
        self.assert_api_error(400, app.api_student_tax, self.ctx({"type": "property"}))
        self.assert_api_error(400, app.api_student_tax, self.ctx({"type": "income"}))
        self.assert_api_error(400, app.api_student_tax, self.ctx({"type": "other"}))
        self.assertEqual(self.student["balance"], 9)
        self.assertEqual(app.DB["transactions"], [])

    def test_pdf_metadata_visibility_and_archiving(self):
        assignment = self.assignment(studentIds=[self.student["id"]])
        self.assertNotIn("pdfData", assignment)
        mine = app.api_student_me(self.ctx())
        self.assertEqual(mine["assignments"][0]["id"], assignment["id"])
        self.assertNotIn("pdfData", mine["assignments"][0])
        self.assertEqual(app.api_student_me(self.ctx(student=self.other))["assignments"], [])
        pdf = app.api_student_assignment_pdf(self.ctx(params=(assignment["id"],)))
        self.assertTrue(pdf["pdfData"].startswith(app.PDF_PREFIX))
        self.assert_api_error(404, app.api_student_assignment_pdf, self.ctx(params=(assignment["id"],), student=self.other))
        app.api_teacher_assignment_delete(self.ctx(params=(assignment["id"],)))
        self.assertEqual(app.api_student_me(self.ctx())["assignments"], [])
        self.assert_api_error(404, app.api_student_assignment_submit, self.ctx({"answer": "답"}, params=(assignment["id"],)))
        self.assertEqual(app.api_teacher_assignment_pdf(self.ctx(params=(assignment["id"],)))["pdfName"], "학습지.pdf")

    def test_pdf_signature_base64_size_and_reward_validation(self):
        for data in ("data:text/html;base64,abcd", app.PDF_PREFIX + "%%%%", app.PDF_PREFIX + base64.b64encode(b"not a pdf").decode("ascii")):
            self.assert_api_error(400, app.api_teacher_assignment_create, self.ctx({"title": "과제", "reward": 10, "pdfName": "x.pdf", "pdfData": data}))
        too_large = b"%PDF-" + b"x" * app.PDF_MAX_BYTES
        self.assert_api_error(413, app.api_teacher_assignment_create, self.ctx({"title": "과제", "reward": 10, "pdfName": "x.pdf", "pdfData": app.PDF_PREFIX + base64.b64encode(too_large).decode("ascii")}))
        for reward in (0, 1001, "abc"):
            self.assert_api_error(400, app.api_teacher_assignment_create, self.ctx({"title": "과제", "reward": reward}))
        self.assert_api_error(404, app.api_teacher_assignment_create, self.ctx({"title": "과제", "reward": 10, "studentIds": ["missing"]}))
        self.assertEqual(app.DB["assignments"], [])

    def test_assignment_submission_review_snapshot_and_forever_dedup(self):
        assignment = self.assignment()
        sub = app.api_student_assignment_submit(self.ctx({"answer": "정답: 3/4"}, params=(assignment["id"],)))["submission"]
        self.assertEqual(app.api_student_me(self.ctx())["mySubmissions"], [])
        self.assertEqual(app.api_student_me(self.ctx())["myAssignmentSubmissions"][0]["id"], sub["id"])
        self.assert_api_error(400, app.api_student_assignment_submit, self.ctx({"answer": "또 제출"}, params=(assignment["id"],)))
        app.find(app.DB["assignments"], assignment["id"])["reward"] = 100
        app.api_missions_review(self.ctx({"action": "approve", "ids": [sub["id"]]}))
        self.assertEqual(self.student["balance"], 15)
        self.assertEqual(self.student["exp"], 15)
        self.assert_api_error(400, app.api_missions_review, self.ctx({"action": "approve", "ids": [sub["id"]]}))
        with patch.object(app, "today_str", return_value="2099-01-01"):
            self.assert_api_error(400, app.api_student_assignment_submit, self.ctx({"answer": "다음 날"}, params=(assignment["id"],)))
        self.assertEqual(self.student["balance"], 15)

    def test_rejected_assignment_can_resubmit_and_stale_pending_cannot_pay_twice(self):
        assignment = self.assignment()
        first = app.api_student_assignment_submit(self.ctx({"answer": "첫 답"}, params=(assignment["id"],)))["submission"]
        app.api_missions_review(self.ctx({"action": "reject", "ids": [first["id"]]}))
        second = app.api_student_assignment_submit(self.ctx({"answer": "수정 답"}, params=(assignment["id"],)))["submission"]
        stale = {**second, "id": "stale"}
        app.DB["submissions"].append(stale)
        app.api_missions_review(self.ctx({"action": "approve", "ids": [second["id"], stale["id"]]}))
        self.assertEqual(self.student["balance"], 15)
        self.assertEqual(stale["status"], "rejected")

    def test_assignment_requires_nonempty_bounded_answer_and_generic_flow_rejected(self):
        assignment = self.assignment()
        for answer in ("", " " * 3, "답" * 10001):
            self.assert_api_error(400, app.api_student_assignment_submit, self.ctx({"answer": answer}, params=(assignment["id"],)))
        self.assert_api_error(400, app.api_student_mission_submit, self.ctx({"missionId": "m_teacher", "note": "직접 제출"}))
        self.assert_api_error(400, app.api_teacher_pay, self.ctx({"type": "give", "amount": 10, "reason": "과제", "studentIds": [self.student["id"]], "missionId": "m_teacher"}))
        self.assertEqual(self.student["balance"], 0)
        self.assertEqual(app.DB["submissions"], [])

    def test_http_role_guards_upload_large_pdf_and_submit(self):
        with self.at(2026, 10, 6, 8, 30):
            self.http_flow()

    def http_flow(self):
        code, login = self.request("POST", "/api/login/teacher", {"pin": "0000"})
        self.assertEqual(code, 200)
        teacher = login["token"]
        code, login = self.request("POST", "/api/login/student", {"studentId": self.student["id"], "pin": "0000"})
        self.assertEqual(code, 200)
        student = login["token"]
        self.assertEqual(self.request("GET", "/api/teacher/assignments", token=student)[0], 401)
        self.assertEqual(self.request("POST", "/api/student/taxes", {"type": "income"}, teacher)[0], 401)
        self.assertEqual(self.request("POST", "/api/student/taxes", {"type": "income"}, student)[0], 400)   # 소득세는 자동
        pdf = b"%PDF-1.4\n" + b"x" * (1100 * 1024)
        code, result = self.request("POST", "/api/teacher/assignments", {"title": "바로 풀기", "reward": 10,
            "studentIds": [], "pdfName": "big.pdf", "pdfData": app.PDF_PREFIX + base64.b64encode(pdf).decode("ascii")}, teacher)
        self.assertEqual(code, 200)
        assignment = result["assignment"]
        self.assertNotIn("pdfData", assignment)
        self.assertEqual(self.request("GET", "/api/student/assignments/" + assignment["id"] + "/pdf", token=teacher)[0], 401)
        code, result = self.request("GET", "/api/student/assignments/" + assignment["id"] + "/pdf", token=student)
        self.assertEqual(code, 200)
        self.assertEqual(result["pdfName"], "big.pdf")
        code, result = self.request("POST", "/api/student/assignments/" + assignment["id"] + "/submit", {"answer": "풀이와 답"}, student)
        self.assertEqual(code, 200)
        code, _ = self.request("POST", "/api/teacher/missions/review", {"action": "approve", "ids": [result["submission"]["id"]]}, teacher)
        self.assertEqual(code, 200)
        self.assertEqual(self.student["balance"], 10)


if __name__ == "__main__":
    unittest.main()
