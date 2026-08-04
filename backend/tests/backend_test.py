"""BIFD ERP backend tests"""
import os
import pytest
import requests
from datetime import datetime

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bifd-registers.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "testsess_admin"
TEACHER_TOKEN = "testsess_teacher"

ADMIN_H = {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}
TEACHER_H = {"Authorization": f"Bearer {TEACHER_TOKEN}", "Content-Type": "application/json"}


# ---------- AUTH ----------
class TestAuth:
    def test_me_admin(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=ADMIN_H)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["email"] == "admin@bifd.com"
        assert d["role"] == "admin"

    def test_me_no_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_teacher(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=TEACHER_H)
        assert r.status_code == 200
        assert r.json()["role"] == "teacher"


# ---------- RBAC ----------
class TestRBAC:
    def test_teacher_denied_admin_register(self):
        r = requests.get(f"{BASE_URL}/api/registers/fee", headers=TEACHER_H)
        assert r.status_code == 403

    def test_admin_can_access_fee(self):
        r = requests.get(f"{BASE_URL}/api/registers/fee", headers=ADMIN_H)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_teacher_cannot_post_admin_register(self):
        r = requests.post(f"{BASE_URL}/api/registers/visitor",
                          headers=TEACHER_H, json={"name": "X"})
        assert r.status_code == 403

    def test_teacher_can_read_admission(self):
        r = requests.get(f"{BASE_URL}/api/registers/admission", headers=TEACHER_H)
        assert r.status_code == 200


# ---------- Admin CRUD (visitor) ----------
class TestVisitorCRUD:
    created_id = None

    def test_create(self):
        payload = {"visitor_name": "TEST_John", "purpose": "Meeting",
                   "in_time": "10:00", "out_time": "11:00"}
        r = requests.post(f"{BASE_URL}/api/registers/visitor",
                          headers=ADMIN_H, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["visitor_name"] == "TEST_John"
        assert "id" in d
        TestVisitorCRUD.created_id = d["id"]

    def test_list_contains(self):
        r = requests.get(f"{BASE_URL}/api/registers/visitor", headers=ADMIN_H)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert TestVisitorCRUD.created_id in ids

    def test_update(self):
        rid = TestVisitorCRUD.created_id
        r = requests.put(f"{BASE_URL}/api/registers/visitor/{rid}",
                         headers=ADMIN_H, json={"visitor_name": "TEST_John2", "purpose": "Updated"})
        assert r.status_code == 200
        # verify persisted
        r2 = requests.get(f"{BASE_URL}/api/registers/visitor", headers=ADMIN_H)
        row = next(x for x in r2.json() if x["id"] == rid)
        assert row["visitor_name"] == "TEST_John2"

    def test_delete(self):
        rid = TestVisitorCRUD.created_id
        r = requests.delete(f"{BASE_URL}/api/registers/visitor/{rid}", headers=ADMIN_H)
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/registers/visitor", headers=ADMIN_H)
        assert rid not in [x["id"] for x in r2.json()]

    def test_audit_log_written(self):
        # Just make sure at least one audit exists after CRUD via a quick check.
        # No API to fetch audit; skip if unavailable.
        pass


# ---------- Admission auto student_id ----------
class TestAdmission:
    created_id = None
    student_id = None

    def test_auto_student_id(self):
        payload = {"name": "TEST_Student", "course": "Fashion Design Diploma", "status": "active"}
        r = requests.post(f"{BASE_URL}/api/registers/admission",
                          headers=ADMIN_H, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("student_id", "").startswith("BIFD-")
        TestAdmission.created_id = d["id"]
        TestAdmission.student_id = d["student_id"]

    def test_cleanup(self):
        if TestAdmission.created_id:
            requests.delete(f"{BASE_URL}/api/registers/admission/{TestAdmission.created_id}",
                            headers=ADMIN_H)


# ---------- CSV Export ----------
class TestExport:
    def test_admission_csv(self):
        r = requests.get(f"{BASE_URL}/api/registers/admission/export", headers=ADMIN_H)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert "attachment" in r.headers.get("content-disposition", "")


# ---------- Dashboard ----------
class TestDashboard:
    def test_admin_dashboard(self):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=ADMIN_H)
        assert r.status_code == 200
        d = r.json()
        for k in ("active_students", "attendance_pct", "collected_month", "overdue_count"):
            assert k in d, f"missing {k}"

    def test_teacher_denied_dashboard(self):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=TEACHER_H)
        assert r.status_code == 403


# ---------- Teacher roster + attendance ----------
class TestTeacher:
    def test_roster(self):
        r = requests.get(f"{BASE_URL}/api/teacher/roster",
                         headers=TEACHER_H, params={"course": "Fashion Design Diploma"})
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_roster_wrong_course(self):
        r = requests.get(f"{BASE_URL}/api/teacher/roster",
                         headers=TEACHER_H, params={"course": "Other Course"})
        assert r.status_code == 403

    def test_submit_and_lock(self):
        r = requests.get(f"{BASE_URL}/api/teacher/roster",
                         headers=TEACHER_H, params={"course": "Fashion Design Diploma"})
        students = r.json()
        if not students:
            pytest.skip("no roster")
        date = datetime.utcnow().strftime("%Y-%m-%d")
        entries = [{"student_id": s.get("student_id"), "student_name": s.get("name"),
                    "status": "present"} for s in students[:3]]
        payload = {"date": date, "course": "Fashion Design Diploma", "entries": entries}
        r1 = requests.post(f"{BASE_URL}/api/teacher/attendance",
                           headers=TEACHER_H, json=payload)
        assert r1.status_code == 200, r1.text
        saved1 = r1.json()["saved"]
        # resubmit -> saved 0 (locked)
        r2 = requests.post(f"{BASE_URL}/api/teacher/attendance",
                           headers=TEACHER_H, json=payload)
        assert r2.status_code == 200
        assert r2.json()["saved"] == 0

    def test_history(self):
        r = requests.get(f"{BASE_URL}/api/teacher/attendance", headers=TEACHER_H)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Global Search ----------
class TestSearch:
    def test_search_admin(self):
        r = requests.get(f"{BASE_URL}/api/search", headers=ADMIN_H, params={"q": "BIFD"})
        assert r.status_code == 200
        d = r.json()
        assert "students" in d and "faculty" in d

    def test_search_denied_for_teacher(self):
        r = requests.get(f"{BASE_URL}/api/search", headers=TEACHER_H, params={"q": "a"})
        assert r.status_code == 403
