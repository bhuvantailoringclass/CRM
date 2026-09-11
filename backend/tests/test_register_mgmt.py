"""BIFD ERP: Register Management (custom registers) tests"""
import os
import time
import pytest
import requests

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL")
            or "https://bifd-registers.preview.emergentagent.com").rstrip("/")
ADMIN_H = {"Authorization": "Bearer testsess_admin", "Content-Type": "application/json"}
TEACHER_H = {"Authorization": "Bearer testsess_teacher", "Content-Type": "application/json"}

# Unique label per run to avoid collisions
STAMP = str(int(time.time()))
LABEL = f"TEST Library Fine Register {STAMP}"
KEY = f"test_library_fine_register_{STAMP}"


@pytest.fixture(scope="module")
def created_key():
    """Create a custom register, yield its key, then cleanup."""
    r = requests.post(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H,
                      json={"label": LABEL})
    assert r.status_code == 200, r.text
    key = r.json()["key"]
    yield key
    # Cleanup: delete all rows and definition
    try:
        rows = requests.get(f"{BASE_URL}/api/registers/{key}", headers=ADMIN_H).json()
        for row in rows:
            requests.delete(f"{BASE_URL}/api/registers/{key}/{row['id']}", headers=ADMIN_H)
    except Exception:
        pass
    # Reset schema
    requests.delete(f"{BASE_URL}/api/registers/{key}/schema", headers=ADMIN_H)
    # Delete def directly via mongo (no API to delete def; use pymongo)
    try:
        from pymongo import MongoClient
        cli = MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        dbn = os.environ.get("DB_NAME", "test_database")
        cli[dbn].register_defs.delete_one({"key": key})
        cli[dbn].drop_collection(f"reg_{key}")
        cli[dbn].register_schemas.delete_one({"name": key})
    except Exception as e:
        print(f"cleanup error: {e}")


# ---------- AuthZ on /register-mgmt ----------
class TestRegisterMgmtAuth:
    def test_get_no_token(self):
        r = requests.get(f"{BASE_URL}/api/register-mgmt")
        assert r.status_code == 401

    def test_get_teacher_forbidden(self):
        r = requests.get(f"{BASE_URL}/api/register-mgmt", headers=TEACHER_H)
        assert r.status_code == 403

    def test_post_teacher_forbidden(self):
        r = requests.post(f"{BASE_URL}/api/register-mgmt", headers=TEACHER_H,
                          json={"label": "X"})
        assert r.status_code == 403

    def test_put_teacher_forbidden(self):
        r = requests.put(f"{BASE_URL}/api/register-mgmt/admission",
                         headers=TEACHER_H, json={"active": False})
        assert r.status_code == 403


# ---------- List returns builtins + customs ----------
class TestList:
    def test_get_list(self):
        r = requests.get(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H)
        assert r.status_code == 200
        d = r.json()
        assert "builtins" in d and "customs" in d
        assert isinstance(d["builtins"], list) and len(d["builtins"]) == 27, \
            f"expected 27 builtins, got {len(d['builtins'])}"
        assert isinstance(d["customs"], list)
        # verify shape
        b0 = d["builtins"][0]
        assert "key" in b0 and "active" in b0


# ---------- Create / duplicate / rename / toggle ----------
class TestCreateDuplicateRename:
    def test_create_custom(self, created_key):
        assert created_key.startswith("test_library_fine_register_")
        # verify it appears in list
        d = requests.get(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H).json()
        keys = [c["key"] for c in d["customs"]]
        assert created_key in keys

    def test_starter_schema_seeded(self, created_key):
        r = requests.get(f"{BASE_URL}/api/registers/{created_key}/schema", headers=ADMIN_H)
        assert r.status_code == 200
        d = r.json()
        assert d["custom"] is True
        names = [f["name"] for f in d["fields"]]
        for n in ("date", "title", "amount", "remarks"):
            assert n in names, f"starter field {n} missing"

    def test_duplicate_label_400(self, created_key):
        r = requests.post(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H,
                          json={"label": LABEL})
        assert r.status_code == 400

    def test_duplicate_label_case_insensitive_400(self, created_key):
        r = requests.post(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H,
                          json={"label": LABEL.upper()})
        assert r.status_code == 400

    def test_duplicate_key_400(self, created_key):
        # try to create with same explicit key
        r = requests.post(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H,
                          json={"label": f"Something Else {STAMP}", "key": created_key})
        assert r.status_code == 400

    def test_duplicate_builtin_key_400(self):
        r = requests.post(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H,
                          json={"label": f"Admission Copy {STAMP}", "key": "admission"})
        assert r.status_code == 400

    def test_empty_label_400(self):
        r = requests.post(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H,
                          json={"label": ""})
        assert r.status_code == 400

    def test_rename_label(self, created_key):
        new_label = f"TEST Library Fines Renamed {STAMP}"
        r = requests.put(f"{BASE_URL}/api/register-mgmt/{created_key}",
                         headers=ADMIN_H, json={"label": new_label})
        assert r.status_code == 200
        d = requests.get(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H).json()
        row = next(c for c in d["customs"] if c["key"] == created_key)
        assert row["label"] == new_label

    def test_toggle_active_false_then_true(self, created_key):
        r = requests.put(f"{BASE_URL}/api/register-mgmt/{created_key}",
                         headers=ADMIN_H, json={"active": False})
        assert r.status_code == 200
        d = requests.get(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H).json()
        row = next(c for c in d["customs"] if c["key"] == created_key)
        assert row["active"] is False
        # re-activate
        r2 = requests.put(f"{BASE_URL}/api/register-mgmt/{created_key}",
                          headers=ADMIN_H, json={"active": True})
        assert r2.status_code == 200
        d2 = requests.get(f"{BASE_URL}/api/register-mgmt", headers=ADMIN_H).json()
        row2 = next(c for c in d2["customs"] if c["key"] == created_key)
        assert row2["active"] is True


# ---------- Custom register end-to-end: generic endpoints work ----------
class TestCustomEndToEnd:
    row_id = None

    def test_create_row(self, created_key):
        payload = {"date": "2026-01-15", "title": "TEST_LateReturn",
                   "amount": 50, "remarks": "TEST auto"}
        r = requests.post(f"{BASE_URL}/api/registers/{created_key}",
                          headers=ADMIN_H, json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["title"] == "TEST_LateReturn"
        assert "id" in d
        TestCustomEndToEnd.row_id = d["id"]

    def test_list_row(self, created_key):
        r = requests.get(f"{BASE_URL}/api/registers/{created_key}", headers=ADMIN_H)
        assert r.status_code == 200
        ids = [x["id"] for x in r.json()]
        assert TestCustomEndToEnd.row_id in ids

    def test_update_row(self, created_key):
        rid = TestCustomEndToEnd.row_id
        r = requests.put(f"{BASE_URL}/api/registers/{created_key}/{rid}",
                         headers=ADMIN_H, json={"title": "TEST_LateReturn2", "amount": 75})
        assert r.status_code == 200
        rows = requests.get(f"{BASE_URL}/api/registers/{created_key}", headers=ADMIN_H).json()
        row = next(x for x in rows if x["id"] == rid)
        assert row["title"] == "TEST_LateReturn2"
        assert row["amount"] == 75

    def test_export_csv(self, created_key):
        r = requests.get(f"{BASE_URL}/api/registers/{created_key}/export", headers=ADMIN_H)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        # body should include our title
        assert "TEST_LateReturn" in r.text

    def test_export_xlsx(self, created_key):
        r = requests.get(f"{BASE_URL}/api/registers/{created_key}/export.xlsx",
                         headers=ADMIN_H)
        assert r.status_code == 200
        assert "spreadsheetml" in r.headers.get("content-type", "")

    def test_audit_log(self, created_key):
        r = requests.get(f"{BASE_URL}/api/registers/{created_key}/audit",
                         headers=ADMIN_H)
        assert r.status_code == 200
        actions = [a.get("action") for a in r.json()]
        assert "create" in actions

    def test_delete_row(self, created_key):
        rid = TestCustomEndToEnd.row_id
        r = requests.delete(f"{BASE_URL}/api/registers/{created_key}/{rid}",
                            headers=ADMIN_H)
        assert r.status_code == 200


# ---------- REGRESSION: existing registers untouched ----------
class TestRegression:
    def test_admission_still_works(self):
        r = requests.get(f"{BASE_URL}/api/registers/admission", headers=ADMIN_H)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_dashboard(self):
        r = requests.get(f"{BASE_URL}/api/dashboard", headers=ADMIN_H)
        assert r.status_code == 200

    def test_unknown_register_still_404(self):
        r = requests.get(f"{BASE_URL}/api/registers/nonexistent_xyz", headers=ADMIN_H)
        assert r.status_code == 404

    def test_teacher_roster_still_works(self):
        r = requests.get(f"{BASE_URL}/api/teacher/roster", headers=TEACHER_H,
                         params={"course": "Fashion Design Diploma"})
        assert r.status_code == 200
