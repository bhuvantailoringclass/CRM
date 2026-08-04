"""Dynamic Field Management (Register Schema) tests"""
import io, os, csv, zipfile
import pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bifd-registers.preview.emergentagent.com").rstrip("/")
ADMIN_H = {"Authorization": "Bearer testsess_admin", "Content-Type": "application/json"}
TEACHER_H = {"Authorization": "Bearer testsess_teacher", "Content-Type": "application/json"}

REG = "visitor"


@pytest.fixture(autouse=True)
def cleanup():
    # ensure clean state before & after
    requests.delete(f"{BASE_URL}/api/registers/{REG}/schema", headers=ADMIN_H)
    yield
    requests.delete(f"{BASE_URL}/api/registers/{REG}/schema", headers=ADMIN_H)
    # clean TEST_ rows
    r = requests.get(f"{BASE_URL}/api/registers/{REG}", headers=ADMIN_H)
    if r.ok:
        for row in r.json():
            if any(str(v).startswith("TEST_") for v in row.values() if v):
                requests.delete(f"{BASE_URL}/api/registers/{REG}/{row['id']}", headers=ADMIN_H)


# ---- SCHEMA CRUD ----
class TestSchema:
    def test_get_default_null(self):
        r = requests.get(f"{BASE_URL}/api/registers/{REG}/schema", headers=ADMIN_H)
        assert r.status_code == 200
        assert r.json() == {"name": REG, "fields": None}

    def test_no_auth_401(self):
        r = requests.get(f"{BASE_URL}/api/registers/{REG}/schema")
        assert r.status_code == 401

    def test_teacher_forbidden(self):
        r = requests.get(f"{BASE_URL}/api/registers/{REG}/schema", headers=TEACHER_H)
        assert r.status_code == 403
        r2 = requests.put(f"{BASE_URL}/api/registers/{REG}/schema",
                          headers=TEACHER_H, json={"fields": [{"name": "x", "type": "text", "label": "X"}]})
        assert r2.status_code == 403

    def test_put_get_delete_cycle(self):
        fields = [
            {"name": "visitor_name", "type": "text", "label": "Guest Name", "required": True},
            {"name": "purpose", "type": "text", "label": "Purpose"},
            {"name": "blood_group", "type": "dropdown", "label": "Blood Group",
             "options": ["A+", "O+"]},
        ]
        r = requests.put(f"{BASE_URL}/api/registers/{REG}/schema",
                         headers=ADMIN_H, json={"fields": fields})
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

        r2 = requests.get(f"{BASE_URL}/api/registers/{REG}/schema", headers=ADMIN_H)
        assert r2.status_code == 200
        got = r2.json()["fields"]
        assert got[0]["label"] == "Guest Name"
        assert got[2]["name"] == "blood_group"
        assert [f["name"] for f in got] == ["visitor_name", "purpose", "blood_group"]

        r3 = requests.delete(f"{BASE_URL}/api/registers/{REG}/schema", headers=ADMIN_H)
        assert r3.status_code == 200
        r4 = requests.get(f"{BASE_URL}/api/registers/{REG}/schema", headers=ADMIN_H)
        assert r4.json()["fields"] is None

    def test_put_empty_400(self):
        r = requests.put(f"{BASE_URL}/api/registers/{REG}/schema",
                         headers=ADMIN_H, json={"fields": []})
        assert r.status_code == 400

    def test_put_duplicate_keys_400(self):
        r = requests.put(f"{BASE_URL}/api/registers/{REG}/schema",
                         headers=ADMIN_H,
                         json={"fields": [
                             {"name": "a", "type": "text", "label": "A"},
                             {"name": "a", "type": "text", "label": "A2"},
                         ]})
        assert r.status_code == 400


# ---- Export reflects schema ----
class TestExportReflectsSchema:
    def test_csv_and_xlsx_use_labels_and_exclude_hidden(self):
        fields = [
            {"name": "visitor_name", "type": "text", "label": "Guest Name"},
            {"name": "purpose", "type": "text", "label": "Purpose", "hidden": True},
            {"name": "blood_group", "type": "text", "label": "Blood Group"},
        ]
        assert requests.put(f"{BASE_URL}/api/registers/{REG}/schema",
                            headers=ADMIN_H, json={"fields": fields}).status_code == 200

        # create record with custom key
        c = requests.post(f"{BASE_URL}/api/registers/{REG}",
                          headers=ADMIN_H,
                          json={"visitor_name": "TEST_Jane", "purpose": "Meet",
                                "blood_group": "O+"})
        assert c.status_code == 200
        rid = c.json()["id"]
        # verify custom key stored
        g = requests.get(f"{BASE_URL}/api/registers/{REG}", headers=ADMIN_H)
        row = next(x for x in g.json() if x["id"] == rid)
        assert row.get("blood_group") == "O+"

        # CSV
        rc = requests.get(f"{BASE_URL}/api/registers/{REG}/export", headers=ADMIN_H)
        assert rc.status_code == 200
        reader = csv.reader(io.StringIO(rc.text))
        header = next(reader)
        assert header == ["Guest Name", "Blood Group"], header  # purpose hidden
        rows = list(reader)
        assert any(r == ["TEST_Jane", "O+"] for r in rows)

        # XLSX - validate it's a valid zip
        rx = requests.get(f"{BASE_URL}/api/registers/{REG}/export.xlsx", headers=ADMIN_H)
        assert rx.status_code == 200
        assert rx.headers.get("content-type", "").startswith(
            "application/vnd.openxmlformats-officedocument")
        z = zipfile.ZipFile(io.BytesIO(rx.content))
        assert "xl/workbook.xml" in z.namelist()

    def test_archived_excluded_from_export(self):
        fields = [
            {"name": "visitor_name", "type": "text", "label": "Name"},
            {"name": "purpose", "type": "text", "label": "Purpose", "archived": True},
        ]
        requests.put(f"{BASE_URL}/api/registers/{REG}/schema",
                     headers=ADMIN_H, json={"fields": fields})
        rc = requests.get(f"{BASE_URL}/api/registers/{REG}/export", headers=ADMIN_H)
        header = next(csv.reader(io.StringIO(rc.text)))
        assert header == ["Name"]
