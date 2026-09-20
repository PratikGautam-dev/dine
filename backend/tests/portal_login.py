# tests/portal_login.py
"""Test helper: sign in to the portal the way the app does now.

The shared-hospital-password login was retired (it carried no role). Many older tests set a
"portal password" on a restaurant and then logged in with it; this keeps their setup lines as
they were but signs in as a real Owner/Manager staff login for that restaurant, through the
real /api/portal/staff/login route, and returns a response shaped like the old one
({"token": ...}) so the rest of each test is unchanged."""
import db.repository as db


class _Response:
    def __init__(self, status_code: int, body: dict):
        self.status_code, self._body = status_code, body
        self.text = str(body)

    def json(self):
        return self._body


def portal_login(client, password: str):
    hospital = db.find_hospital_by_portal_password(password)
    if hospital is None:
        return _Response(403, {"error": "Incorrect password."})
    email = f"portal-admin-{hospital.id}@example.test"
    if db.get_staff_user_by_email(email) is None:
        db.create_staff_user(hospital.id, "admin", email, db.hash_portal_password(password), "Portal Admin")
    resp = client.post("/api/portal/staff/login", json={"email": email, "password": password})
    if resp.status_code != 200:
        return _Response(resp.status_code, resp.json())
    body = resp.json()
    return _Response(200, {"token": body["access_token"], "hospital": body.get("hospital")})
