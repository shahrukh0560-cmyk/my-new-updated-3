"""
Tests for OptiCRM new features: staff management + customer CSV export/import.
Targets all features listed in the iteration 6 review request.
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-optical-sync.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

SUPER_EMAIL = "admin@opticrm.com"
SUPER_PASS = "Admin@1234"
OWNER_EMAIL = "shop1@test.com"
OWNER_PASS = "Test@1234"
STAFF_EMAIL = "staff1@test.com"
STAFF_PASS = "Staff@1234"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    return r


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth / Login ----------
@pytest.fixture(scope="module")
def super_token():
    r = _login(SUPER_EMAIL, SUPER_PASS)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def owner_token():
    r = _login(OWNER_EMAIL, OWNER_PASS)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def staff_token():
    r = _login(STAFF_EMAIL, STAFF_PASS)
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_login_super_admin():
    r = _login(SUPER_EMAIL, SUPER_PASS)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "super_admin"


def test_login_owner():
    r = _login(OWNER_EMAIL, OWNER_PASS)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "owner"


def test_login_staff():
    r = _login(STAFF_EMAIL, STAFF_PASS)
    assert r.status_code == 200
    assert r.json()["user"]["role"] == "staff"


def test_login_wrong_password():
    r = _login(OWNER_EMAIL, "wrongpass")
    assert r.status_code in (400, 401)


# ---------- Staff list / RBAC ----------
def test_staff_list_owner(owner_token):
    r = requests.get(f"{API}/staff", headers=_auth(owner_token), timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    emails = [u.get("email") for u in data]
    # owner & seeded staff should both be visible to owner
    assert OWNER_EMAIL in emails
    assert STAFF_EMAIL in emails
    # ensure password_hash never returned
    for u in data:
        assert "password_hash" not in u
        assert "_id" not in u


def test_staff_list_forbidden_for_staff(staff_token):
    r = requests.get(f"{API}/staff", headers=_auth(staff_token), timeout=20)
    assert r.status_code == 403


# ---------- Staff CRUD (owner only) ----------
@pytest.fixture(scope="module")
def created_staff(owner_token):
    email = f"TEST_staff_{uuid.uuid4().hex[:8]}@example.com".lower()
    payload = {"email": email, "name": "TEST Staff", "password": "Pass@1234", "role": "staff"}
    r = requests.post(f"{API}/staff", headers=_auth(owner_token), json=payload, timeout=20)
    assert r.status_code in (200, 201), r.text
    body = r.json()
    assert body["email"] == email
    assert body["role"] == "staff"
    assert "id" in body
    yield {"id": body["id"], "email": email, "password": "Pass@1234"}
    # cleanup
    requests.delete(f"{API}/staff/{body['id']}", headers=_auth(owner_token), timeout=10)


def test_create_staff_persists_in_list(owner_token, created_staff):
    r = requests.get(f"{API}/staff", headers=_auth(owner_token), timeout=20)
    assert r.status_code == 200
    emails = [u["email"] for u in r.json()]
    assert created_staff["email"] in emails


def test_created_staff_can_login(created_staff):
    r = _login(created_staff["email"], created_staff["password"])
    assert r.status_code == 200
    assert r.json()["user"]["email"] == created_staff["email"]


def test_create_staff_duplicate_email(owner_token, created_staff):
    payload = {"email": created_staff["email"], "name": "Dup", "password": "Pass@1234", "role": "staff"}
    r = requests.post(f"{API}/staff", headers=_auth(owner_token), json=payload, timeout=20)
    assert r.status_code == 400


def test_staff_create_forbidden_for_staff(staff_token):
    payload = {"email": f"TEST_x_{uuid.uuid4().hex[:6]}@x.com", "name": "X", "password": "Pass@1234", "role": "staff"}
    r = requests.post(f"{API}/staff", headers=_auth(staff_token), json=payload, timeout=20)
    assert r.status_code == 403


def test_update_staff(owner_token, created_staff):
    r = requests.put(
        f"{API}/staff/{created_staff['id']}",
        headers=_auth(owner_token),
        json={"name": "TEST Updated", "status": "suspended"},
        timeout=20,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "TEST Updated"
    assert body["status"] == "suspended"
    # reactivate so subsequent login test (if reordered) still works
    requests.put(f"{API}/staff/{created_staff['id']}", headers=_auth(owner_token), json={"status": "active"}, timeout=10)


def test_update_staff_forbidden_for_staff(staff_token, created_staff):
    r = requests.put(
        f"{API}/staff/{created_staff['id']}",
        headers=_auth(staff_token),
        json={"name": "Hack"},
        timeout=20,
    )
    assert r.status_code == 403


def test_cannot_delete_self(owner_token):
    me = requests.get(f"{API}/auth/me", headers=_auth(owner_token), timeout=10).json()
    r = requests.delete(f"{API}/staff/{me['id']}", headers=_auth(owner_token), timeout=10)
    assert r.status_code == 400


def test_cannot_delete_owner_role(owner_token):
    """Find an owner in the list and ensure deletion is blocked"""
    lst = requests.get(f"{API}/staff", headers=_auth(owner_token), timeout=10).json()
    owners = [u for u in lst if u.get("role") == "owner"]
    assert owners, "Expected at least one owner in tenant"
    # If only owner is self, server returns 400 (self). Otherwise 403.
    me = requests.get(f"{API}/auth/me", headers=_auth(owner_token), timeout=10).json()
    other_owner = next((u for u in owners if u["id"] != me["id"]), None)
    if other_owner:
        r = requests.delete(f"{API}/staff/{other_owner['id']}", headers=_auth(owner_token), timeout=10)
        assert r.status_code == 403


def test_delete_staff(owner_token):
    # create a throwaway user for delete
    email = f"TEST_del_{uuid.uuid4().hex[:6]}@x.com"
    r = requests.post(
        f"{API}/staff",
        headers=_auth(owner_token),
        json={"email": email, "name": "Del", "password": "Pass@1234", "role": "staff"},
        timeout=10,
    )
    assert r.status_code in (200, 201)
    sid = r.json()["id"]
    rd = requests.delete(f"{API}/staff/{sid}", headers=_auth(owner_token), timeout=10)
    assert rd.status_code == 200
    # verify removal
    lst = requests.get(f"{API}/staff", headers=_auth(owner_token), timeout=10).json()
    assert email not in [u["email"] for u in lst]


# ---------- Customer CSV export & template ----------
def test_customers_csv_export_owner(owner_token):
    r = requests.get(f"{API}/customers.csv", headers=_auth(owner_token), timeout=30)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    first_line = r.text.splitlines()[0]
    assert first_line.lower().startswith("name,phone,email")


def test_customers_csv_export_forbidden_for_staff(staff_token):
    r = requests.get(f"{API}/customers.csv", headers=_auth(staff_token), timeout=20)
    assert r.status_code == 403


def test_customers_template_csv(owner_token):
    r = requests.get(f"{API}/customers-template.csv", headers=_auth(owner_token), timeout=20)
    assert r.status_code == 200
    assert "name,phone,email" in r.text.splitlines()[0].lower()


def test_customers_template_forbidden_for_staff(staff_token):
    r = requests.get(f"{API}/customers-template.csv", headers=_auth(staff_token), timeout=20)
    assert r.status_code == 403


# ---------- Customer Import ----------
def test_customers_import_skip_duplicates_and_errors(owner_token):
    unique = uuid.uuid4().hex[:8]
    phone_a = f"+91900000{unique[:4]}"
    phone_b = f"+91901111{unique[:4]}"
    payload = {
        "rows": [
            {"name": f"TEST Import A {unique}", "phone": phone_a, "email": "a@x.com"},
            {"name": f"TEST Import B {unique}", "phone": phone_b},
            {"name": f"TEST Import Dup {unique}", "phone": phone_a},  # duplicate phone
            {"name": "", "phone": "+919999999"},  # missing name
            {"name": "No phone", "phone": ""},   # missing phone
        ],
        "skip_duplicates": True,
    }
    r = requests.post(f"{API}/customers-import", headers=_auth(owner_token), json=payload, timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["imported"] == 2
    assert body["skipped_duplicates"] == 1
    assert len(body["errors"]) == 2


def test_customers_import_forbidden_for_staff(staff_token):
    payload = {"rows": [{"name": "x", "phone": "1"}], "skip_duplicates": True}
    r = requests.post(f"{API}/customers-import", headers=_auth(staff_token), json=payload, timeout=20)
    assert r.status_code == 403


# ---------- Tenant isolation ----------
def test_tenant_isolation_staff(owner_token):
    """Create a separate tenant via super_admin path is not exposed; we just confirm
    that owner_token's /staff list only returns users with same owner_id."""
    me = requests.get(f"{API}/auth/me", headers=_auth(owner_token), timeout=10).json()
    lst = requests.get(f"{API}/staff", headers=_auth(owner_token), timeout=10).json()
    for u in lst:
        # owner_id either equals me["id"] (since shop1 owner_id == own id) or me["owner_id"]
        oid = u.get("owner_id")
        assert oid in (me["id"], me.get("owner_id"))
