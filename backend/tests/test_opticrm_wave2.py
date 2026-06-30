"""OptiCRM Wave 2 backend integration tests (branches, subscription, reports, GST orders, fulfillment)."""
import os
import re
import pytest
import requests

BASE = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
API = f"{BASE}/api"

ADMIN_EMAIL = "admin@opticrm.com"
ADMIN_PASSWORD = "Admin@1234"


@pytest.fixture(scope="module")
def headers():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=30)
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ---------- Branches ----------
def test_branches_list_has_seeded(headers):
    r = requests.get(f"{API}/branches", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    branches = r.json()
    assert isinstance(branches, list)
    codes = {b.get("code") for b in branches}
    assert {"MAIN", "IND"}.issubset(codes), f"Expected MAIN+IND seeded branches, got {codes}"


def test_branches_create(headers):
    payload = {"name": "TEST_Branch_W2", "code": "TST2", "address": "Test St", "phone": "+91 1234"}
    r = requests.post(f"{API}/branches", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["code"] == "TST2"
    assert b.get("id")
    # verify in list
    r2 = requests.get(f"{API}/branches", headers=headers, timeout=15)
    assert any(x["code"] == "TST2" for x in r2.json())


# ---------- Subscription (MOCK Razorpay) ----------
def test_subscription_plans(headers):
    r = requests.get(f"{API}/subscription/plans", timeout=15)
    assert r.status_code == 200
    plans = r.json()
    ids = {p["id"] for p in plans}
    assert {"trial", "starter", "pro", "enterprise"}.issubset(ids)


def test_subscription_start_pro_and_me(headers):
    r = requests.post(f"{API}/subscription/start", headers=headers, json={"plan_id": "pro"}, timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "mock_payment" in body
    assert body["mock_payment"]["status"] == "captured_mock"
    assert body.get("plan_id") == "pro"

    r2 = requests.get(f"{API}/subscription/me", headers=headers, timeout=15)
    assert r2.status_code == 200
    sub = r2.json()
    assert sub["plan_id"] == "pro"
    assert sub["status"] == "active"
    assert sub.get("plan", {}).get("id") == "pro"


# ---------- Reports ----------
def test_reports_sales(headers):
    r = requests.get(f"{API}/reports/sales", headers=headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ["total_orders", "total_revenue", "total_due", "total_gst", "total_discount", "orders"]:
        assert k in d, f"missing {k}"
    assert isinstance(d["orders"], list)


def test_reports_gst(headers):
    r = requests.get(f"{API}/reports/gst", headers=headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ["rows", "total_taxable", "total_gst", "total_orders"]:
        assert k in d


def test_reports_inventory(headers):
    r = requests.get(f"{API}/reports/inventory", headers=headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    for k in ["total_items", "total_value", "low_stock_count", "out_of_stock_count", "by_category"]:
        assert k in d
    assert isinstance(d["by_category"], dict)


def test_reports_sales_csv(headers):
    r = requests.get(f"{API}/reports/sales.csv", headers=headers, timeout=20)
    assert r.status_code == 200
    ct = r.headers.get("content-type", "")
    assert "text/csv" in ct, f"Got content-type: {ct}"
    text = r.text
    assert "Invoice" in text and "GST" in text and "Fulfillment" in text


# ---------- Inventory extended fields & barcode ----------
def test_inventory_create_with_extended_fields(headers):
    payload = {
        "name": "TEST_Frame_W2",
        "category": "frame",
        "brand": "TestBrand",
        "price": 1200.0,
        "cost": 400,
        "stock": 7,
        "low_stock_threshold": 2,
        "sku": "TEST-W2-SKU-001",
        "barcode": "8901234567890",
        "rack_location": "A1-B2",
        "supplier": "TestSupp",
        "warranty_months": 12,
        "gst_rate": 12,
        "hsn_code": "9004",
        "lens_index": 1.60,
        "blue_cut": True,
        "coatings": "AR + Hydrophobic",
    }
    r = requests.post(f"{API}/inventory", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    item = r.json()
    for k in ["barcode", "rack_location", "supplier", "warranty_months", "gst_rate", "hsn_code", "lens_index", "blue_cut", "coatings"]:
        assert item.get(k) is not None or k == "blue_cut", f"missing {k}"
    assert item["barcode"] == "8901234567890"
    assert item["warranty_months"] == 12
    assert item["coatings"] == "AR + Hydrophobic"
    pytest.w2_item_id = item["id"]
    pytest.w2_barcode = "8901234567890"
    pytest.w2_sku = "TEST-W2-SKU-001"


def test_inventory_barcode_lookup(headers):
    # by barcode
    r = requests.get(f"{API}/inventory/barcode/{pytest.w2_barcode}", headers=headers, timeout=15)
    assert r.status_code == 200, r.text
    assert r.json()["id"] == pytest.w2_item_id

    # by SKU (same endpoint)
    r2 = requests.get(f"{API}/inventory/barcode/{pytest.w2_sku}", headers=headers, timeout=15)
    assert r2.status_code == 200, r2.text
    assert r2.json()["id"] == pytest.w2_item_id


# ---------- Orders: GST + invoice_no + fulfillment ----------
def _ensure_customer(headers):
    payload = {"name": "TEST_Customer_W2", "phone": "+91 99999 00002", "email": "w2cust@example.com",
               "gstin": "29ABCDE1234F2Z5", "address": "Test Addr"}
    r = requests.post(f"{API}/customers", headers=headers, json=payload, timeout=15)
    assert r.status_code == 200
    return r.json()["id"]


def test_create_order_with_gst_and_invoice_no(headers):
    cid = _ensure_customer(headers)
    pytest.w2_customer_id = cid
    order = {"customer_id": cid, "lines": [{"item_id": pytest.w2_item_id, "quantity": 2}], "discount": 0, "paid": 0}
    r = requests.post(f"{API}/orders", headers=headers, json=order, timeout=20)
    assert r.status_code == 200, r.text
    o = r.json()
    # invoice_no format
    assert "invoice_no" in o
    assert re.match(r"^INV-\d{6}-\d{5}$", o["invoice_no"]), f"Bad invoice format: {o['invoice_no']}"
    # gst totals
    assert o.get("gst_amount", 0) > 0, "Expected gst_amount > 0"
    # line-level gst fields
    assert o["lines"][0]["hsn_code"] == "9004"
    assert o["lines"][0]["gst_rate"] == 12
    assert o["lines"][0]["gst_amount"] > 0
    # total = 1200*2 + 12% gst = 2400 + 288 = 2688
    assert abs(o["total"] - 2688.0) < 0.01, f"Got total {o['total']}"
    assert o.get("fulfillment_status") == "received"
    assert o.get("payment_status") in ("unpaid", "partial", "paid")
    assert isinstance(o.get("timeline"), list) and len(o["timeline"]) >= 1
    assert o["timeline"][0]["status"] == "received"
    pytest.w2_order_id = o["id"]


def test_order_status_update_pipeline(headers):
    oid = pytest.w2_order_id
    r = requests.post(f"{API}/orders/{oid}/status", headers=headers, json={"status": "lens_ordered", "note": "TEST advance"}, timeout=15)
    assert r.status_code == 200, r.text
    o = r.json()
    assert o["fulfillment_status"] == "lens_ordered"
    statuses = [t["status"] for t in o["timeline"]]
    assert "lens_ordered" in statuses


# ---------- Dashboard: gst_collected_month + pipeline buckets ----------
def test_dashboard_wave2_fields(headers):
    r = requests.get(f"{API}/dashboard", headers=headers, timeout=20)
    assert r.status_code == 200
    d = r.json()
    assert "gst_collected_month" in d
    assert isinstance(d["gst_collected_month"], (int, float))
    assert "pipeline" in d
    assert isinstance(d["pipeline"], dict)
    for s in ["received", "frame_selected", "lens_ordered", "lab_processing", "edging", "fitting", "qc", "ready", "delivered", "cancelled"]:
        assert s in d["pipeline"], f"missing pipeline bucket: {s}"
    # since we just advanced one order to lens_ordered, count should be >= 1
    assert d["pipeline"]["lens_ordered"] >= 1
