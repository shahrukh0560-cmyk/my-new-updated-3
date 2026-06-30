"""OptiCRM backend integration tests"""
import os
import pytest
import requests

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://sight-management-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@opticrm.com"
ADMIN_PASSWORD = "Admin@1234"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "access_token" in data and data.get("user", {}).get("email") == ADMIN_EMAIL
    return data["access_token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"}, timeout=15)
    assert r.status_code == 401


def test_auth_me(headers):
    r = requests.get(f"{API}/auth/me", headers=headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["email"] == ADMIN_EMAIL


# ---------- Dashboard ----------
def test_dashboard(headers):
    r = requests.get(f"{API}/dashboard", headers=headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ["revenue_today", "revenue_month", "pending_due", "orders_today",
              "customers_count", "inventory_count", "low_stock", "recent_customers", "recent_orders"]:
        assert k in d, f"missing {k}"
    assert isinstance(d["low_stock"], list)


# ---------- Customers ----------
def test_customers_list_and_create(headers):
    r = requests.get(f"{API}/customers", headers=headers, timeout=15)
    assert r.status_code == 200
    assert isinstance(r.json(), list)

    payload = {"name": "TEST_Customer", "phone": "+1 555 0100", "email": "test_cust@example.com"}
    r = requests.post(f"{API}/customers", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200
    c = r.json()
    assert c["name"] == "TEST_Customer"
    cid = c["id"]

    # verify GET
    r = requests.get(f"{API}/customers/{cid}", headers=headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["phone"] == "+1 555 0100"

    pytest.created_customer_id = cid


def test_add_prescription_and_ai_summary(headers):
    cid = pytest.created_customer_id
    rx = {"date": "2026-01-10", "od_sph": -1.0, "od_cyl": -0.5, "od_axis": 90,
          "os_sph": -1.25, "os_cyl": -0.25, "os_axis": 85, "pd": 62.0, "notes": "TEST rx"}
    r = requests.post(f"{API}/customers/{cid}/prescriptions", headers=headers, json=rx, timeout=15)
    assert r.status_code == 200
    rx_id = r.json()["id"]

    # AI summary (slow)
    r = requests.post(f"{API}/customers/{cid}/prescriptions/{rx_id}/ai-summary", headers=headers, timeout=60)
    assert r.status_code == 200
    body = r.json()
    assert "ai_summary" in body and len(body["ai_summary"]) > 0
    pytest.ai_summary_text = body["ai_summary"]


# ---------- Inventory ----------
def test_inventory_filter_and_create_update(headers):
    r = requests.get(f"{API}/inventory?category=frame", headers=headers, timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert all(i["category"] == "frame" for i in items)

    new_item = {"name": "TEST_Frame", "category": "frame", "brand": "T", "price": 99.0,
                "cost": 30, "stock": 5, "low_stock_threshold": 2, "sku": "TEST-F"}
    r = requests.post(f"{API}/inventory", headers=headers, json=new_item, timeout=15)
    assert r.status_code == 200
    iid = r.json()["id"]
    pytest.created_item_id = iid

    r = requests.put(f"{API}/inventory/{iid}", headers=headers, json={"stock": 10}, timeout=15)
    assert r.status_code == 200
    assert r.json()["stock"] == 10


# ---------- Orders ----------
def test_create_order_and_payment_and_stock(headers):
    iid = pytest.created_item_id
    cid = pytest.created_customer_id

    # get current stock
    r = requests.get(f"{API}/inventory?category=frame", headers=headers, timeout=15)
    before = next(i for i in r.json() if i["id"] == iid)["stock"]

    order = {"customer_id": cid, "lines": [{"item_id": iid, "quantity": 2}],
             "discount": 10, "paid": 50, "notes": "TEST order"}
    r = requests.post(f"{API}/orders", headers=headers, json=order, timeout=20)
    assert r.status_code == 200, r.text
    o = r.json()
    expected_total = 99.0 * 2 - 10
    assert abs(o["total"] - expected_total) < 0.01
    assert abs(o["due"] - (expected_total - 50)) < 0.01
    assert o["status"] == "partial"
    oid = o["id"]

    # stock decremented
    r = requests.get(f"{API}/inventory?category=frame", headers=headers, timeout=15)
    after = next(i for i in r.json() if i["id"] == iid)["stock"]
    assert after == before - 2

    # add payment to clear due
    remaining = o["due"]
    r = requests.post(f"{API}/orders/{oid}/payment?amount={remaining}", headers=headers, timeout=15)
    assert r.status_code == 200
    assert r.json()["status"] == "paid"
    assert r.json()["due"] == 0

    # list orders
    r = requests.get(f"{API}/orders", headers=headers, timeout=15)
    assert r.status_code == 200
    assert any(x["id"] == oid for x in r.json())


# ---------- Reminders (MOCK) ----------
def test_reminder_mock(headers):
    cid = pytest.created_customer_id
    for ch in ["sms", "whatsapp"]:
        r = requests.post(f"{API}/reminders", headers=headers,
                          json={"customer_id": cid, "channel": ch, "message": "TEST reminder"}, timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "sent_mock"
