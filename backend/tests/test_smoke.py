"""OptiCRM smoke test - quick sanity for login bug-fix verification iteration 5."""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://sight-management-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@opticrm.com"
ADMIN_PASSWORD = "Admin@1234"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_root():
    r = requests.get(f"{API}/", timeout=15)
    assert r.status_code == 200


def test_login_admin():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert "access_token" in body
    assert body["user"]["email"] == ADMIN_EMAIL


def test_dashboard(headers):
    r = requests.get(f"{API}/dashboard", headers=headers, timeout=20)
    assert r.status_code == 200
    for k in ["revenue_today", "revenue_month", "customers_count", "inventory_count"]:
        assert k in r.json()


def test_customers(headers):
    r = requests.get(f"{API}/customers", headers=headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_inventory(headers):
    r = requests.get(f"{API}/inventory", headers=headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_orders(headers):
    r = requests.get(f"{API}/orders", headers=headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)
