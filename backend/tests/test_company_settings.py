"""Backend tests for Company Settings (white-label feature)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bifd-registers.preview.emergentagent.com").rstrip("/")
ADMIN_TOKEN = "testsess_admin"
TEACHER_TOKEN = "testsess_teacher"

DEFAULTS = {
    "name": "Bhuvan Institute of Fashion Design",
    "short_name": "BIFD",
    "logo": "",
    "address": "",
    "phone": "",
    "email": "",
    "website": "",
}


@pytest.fixture(scope="module")
def restore_defaults():
    yield
    # Always restore defaults after tests
    requests.put(
        f"{BASE_URL}/api/company-settings",
        json=DEFAULTS,
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        timeout=15,
    )


def test_get_company_settings_public_no_auth():
    r = requests.get(f"{BASE_URL}/api/company-settings", timeout=15)
    assert r.status_code == 200
    data = r.json()
    for k in DEFAULTS.keys():
        assert k in data


def test_put_no_token_returns_401():
    r = requests.put(f"{BASE_URL}/api/company-settings", json={"name": "X"}, timeout=15)
    assert r.status_code == 401


def test_put_teacher_returns_403():
    r = requests.put(
        f"{BASE_URL}/api/company-settings",
        json={"name": "X"},
        headers={"Authorization": f"Bearer {TEACHER_TOKEN}"},
        timeout=15,
    )
    assert r.status_code == 403


def test_put_admin_saves_and_persists(restore_defaults):
    payload = {
        "name": "Test Fashion Academy",
        "short_name": "TFA",
        "logo": "",
        "address": "1 Test Street",
        "phone": "+91 9999999999",
        "email": "test@tfa.edu",
        "website": "https://tfa.edu",
    }
    r = requests.put(
        f"{BASE_URL}/api/company-settings",
        json=payload,
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        timeout=15,
    )
    assert r.status_code == 200
    assert r.json().get("ok") is True

    g = requests.get(f"{BASE_URL}/api/company-settings", timeout=15)
    assert g.status_code == 200
    data = g.json()
    assert data["name"] == "Test Fashion Academy"
    assert data["short_name"] == "TFA"
    assert data["email"] == "test@tfa.edu"

    # restore defaults now (double-safety in addition to fixture teardown)
    requests.put(
        f"{BASE_URL}/api/company-settings",
        json=DEFAULTS,
        headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
        timeout=15,
    )
    g2 = requests.get(f"{BASE_URL}/api/company-settings", timeout=15)
    assert g2.json()["name"] == DEFAULTS["name"]
    assert g2.json()["short_name"] == DEFAULTS["short_name"]


def test_regression_admission_list_and_dashboard():
    h = {"Authorization": f"Bearer {ADMIN_TOKEN}"}
    r = requests.get(f"{BASE_URL}/api/registers/admission", headers=h, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    d = requests.get(f"{BASE_URL}/api/dashboard", headers=h, timeout=15)
    assert d.status_code == 200
    assert "active_students" in d.json()
