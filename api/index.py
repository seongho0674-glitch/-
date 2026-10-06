# -*- coding: utf-8 -*-
"""
Vercel 서버리스 함수: /api/* 요청을 server.py의 규칙 그대로 처리하고, 데이터는 Neon(Postgres)에 저장합니다.
- vercel.json이 /api/어떤/주소 요청을 이 파일로 보내면서 원래 주소를 ?__p= 로 붙여 줍니다.
- Neon 연결 정보(DATABASE_URL)는 Vercel 프로젝트의 Storage에서 Neon을 연결하면 자동으로 들어옵니다.
"""
import os
import sys
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
os.environ.setdefault("CLASS_ECONOMY_STORAGE", "postgres")

import server  # noqa: E402  (위에서 경로와 저장 방식을 정한 뒤 불러온다)


class handler(server.Handler):
    def dispatch(self, method):
        parsed = urlparse(self.path)
        original = parse_qs(parsed.query).get("__p")
        path = "/api/" + original[0].lstrip("/") if original else parsed.path
        if path.startswith("/api/"):
            self.handle_api(method, path)
        else:
            self.send_json(404, {"error": "없는 주소예요."})
