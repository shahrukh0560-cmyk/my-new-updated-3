"""
Iteration 9 backend tests for OptiCRM new features:
- Customer birthday/anniversary
- Repair orders
- Coupons
- Referrals
- Subscription auto-renew + expiry-reminder
- AI prescription scanner (Gemini vision)
- PDF/Excel exports (customers/inventory/sales)
- Super-admin views for new modules
- Tenant scoping
"""
import os
import io
import base64
import time
import uuid
from datetime import datetime, timezone

import pytest
import requests
from PIL import Image, ImageDraw, ImageFont


# Read BASE_URL from frontend .env (no defaults — fail fast if missing)
def _read_base_url():
    env_path = "/app/frontend/.env"
    with open(env_path, "r") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not found in /app/frontend/.env")


BASE_URL = _read_base_url()
API = f"{BASE_URL}/api"
TIMEOUT = 30
AI_TIMEOUT = 90

SUPER_EMAIL = "superadmin@opticrm.com"
SUPER_PASSWORD = "SuperAdmin@2026"


# ---------------- helpers ----------------
def _post(path, token=None, json=None, params=None, timeout=TIMEOUT):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.post(f"{API}{path}", json=json, params=params, headers=h, timeout=timeout)


def _get(path, token=None, params=None, timeout=TIMEOUT):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.get(f"{API}{path}", params=params, headers=h, timeout=timeout)


def _put(path, token=None, json=None):
    h = {"Content-Type": "application/json"}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.put(f"{API}{path}", json=json, headers=h, timeout=TIMEOUT)


def _del(path, token=None):
    h = {}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return requests.delete(f"{API}{path}", headers=h, timeout=TIMEOUT)


def _register_owner(prefix="ownertest"):
    email = f"{prefix}_{int(time.time() * 1000)}_{uuid.uuid4().hex[:6]}@arn.com"
    body = {"email": email, "password": "TestPass@2026", "name": f"{prefix} Owner", "country": "IN"}
    r = _post("/auth/register", json=body)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return data["access_token"], data["user"], email


# ---------------- fixtures ----------------
@pytest.fixture(scope="module")
def super_token():
    r = _post("/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD})
    assert r.status_code == 200, f"super login failed: {r.status_code} {r.text}"
    j = r.json()
    assert j["user"]["role"] == "super_admin"
    return j["access_token"]


@pytest.fixture(scope="module")
def owner_a():
    token, user, email = _register_owner("ownerA")
    return {"token": token, "user": user, "email": email}


@pytest.fixture(scope="module")
def owner_b():
    token, user, email = _register_owner("ownerB")
    return {"token": token, "user": user, "email": email}


@pytest.fixture(scope="module")
def customer_today(owner_a):
    today = datetime.now(timezone.utc)
    bday = f"1990-{today.month:02d}-{today.day:02d}"
    anniv = f"2010-{today.month:02d}-{today.day:02d}"
    body = {
        "name": "TEST_CelebrationCustomer",
        "phone": f"9{int(time.time()) % 1000000000:09d}",
        "email": "test_celebration@example.com",
        "birthday": bday,
        "anniversary": anniv,
    }
    r = _post("/customers", token=owner_a["token"], json=body)
    assert r.status_code == 200, f"customer create failed: {r.status_code} {r.text}"
    return r.json()


# ============================================================
# AUTH
# ============================================================
class TestAuth:
    def test_super_admin_login(self):
        r = _post("/auth/login", json={"email": SUPER_EMAIL, "password": SUPER_PASSWORD})
        assert r.status_code == 200, r.text
        j = r.json()
        assert "access_token" in j
        assert j["user"]["role"] == "super_admin"

    def test_register_owner(self):
        token, user, email = _register_owner("ownerreg")
        assert user["role"] == "owner"
        # /auth/me should work
        r = _get("/auth/me", token=token)
        assert r.status_code == 200
        assert r.json()["email"] == email


# ============================================================
# CUSTOMER birthday/anniversary persistence
# ============================================================
class TestCustomerCelebrationFields:
    def test_birthday_anniversary_persisted(self, owner_a):
        body = {
            "name": "TEST_BDayPersist",
            "phone": f"8{int(time.time()) % 1000000000:09d}",
            "birthday": "1985-04-15",
            "anniversary": "2008-11-22",
        }
        r = _post("/customers", token=owner_a["token"], json=body)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]
        g = _get(f"/customers/{cid}", token=owner_a["token"])
        assert g.status_code == 200
        c = g.json()
        assert c["birthday"] == "1985-04-15"
        assert c["anniversary"] == "2008-11-22"


# ============================================================
# CELEBRATIONS & WISHES
# ============================================================
class TestCelebrationsAndWishes:
    def test_celebrations_today_returns_customer(self, owner_a, customer_today):
        r = _get("/customers/celebrations/today", token=owner_a["token"])
        assert r.status_code == 200, r.text
        j = r.json()
        assert isinstance(j.get("birthdays"), list)
        assert isinstance(j.get("anniversaries"), list)
        ids_b = [c["id"] for c in j["birthdays"]]
        ids_a = [c["id"] for c in j["anniversaries"]]
        assert customer_today["id"] in ids_b
        assert customer_today["id"] in ids_a

    def test_wishes_send_single(self, owner_a, customer_today):
        body = {"customer_id": customer_today["id"], "occasion": "birthday", "channel": "whatsapp"}
        r = _post("/customers/wishes/send", token=owner_a["token"], json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "sent_mock"
        assert j["kind"] == "wish"
        assert j["occasion"] == "birthday"

    def test_wishes_send_bulk(self, owner_a):
        r = _post(
            "/customers/wishes/send-bulk",
            token=owner_a["token"],
            params={"occasion": "birthday", "channel": "whatsapp"},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert "sent" in j
        assert j["occasion"] == "birthday"
        assert j["channel"] == "whatsapp"
        assert isinstance(j["sent"], int)


# ============================================================
# COUPONS
# ============================================================
class TestCoupons:
    coupon_code = f"WELCOME10_{int(time.time())}"
    created_id = None

    def test_create_coupon(self, owner_a):
        body = {
            "code": self.__class__.coupon_code,
            "discount_type": "percent",
            "value": 10,
            "min_order": 500,
            "active": True,
        }
        r = _post("/coupons", token=owner_a["token"], json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["code"] == self.__class__.coupon_code.upper()
        self.__class__.created_id = j["id"]

    def test_duplicate_coupon_400(self, owner_a):
        body = {
            "code": self.__class__.coupon_code,
            "discount_type": "percent",
            "value": 5,
            "min_order": 0,
        }
        r = _post("/coupons", token=owner_a["token"], json=body)
        assert r.status_code == 400, f"expected 400 duplicate got {r.status_code}: {r.text}"

    def test_list_coupons(self, owner_a):
        r = _get("/coupons", token=owner_a["token"])
        assert r.status_code == 200
        codes = [c["code"] for c in r.json()]
        assert self.__class__.coupon_code.upper() in codes

    def test_validate_coupon_ok(self, owner_a):
        r = _post(
            "/coupons/validate",
            token=owner_a["token"],
            params={"code": self.__class__.coupon_code, "subtotal": 1000},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["valid"] is True
        assert abs(j["discount"] - 100.0) < 0.01

    def test_validate_coupon_below_min(self, owner_a):
        r = _post(
            "/coupons/validate",
            token=owner_a["token"],
            params={"code": self.__class__.coupon_code, "subtotal": 100},
        )
        assert r.status_code == 400, r.text

    def test_validate_coupon_not_found(self, owner_a):
        r = _post(
            "/coupons/validate",
            token=owner_a["token"],
            params={"code": f"NONEXIST_{int(time.time())}", "subtotal": 1000},
        )
        assert r.status_code == 404, r.text

    def test_delete_coupon(self, owner_a):
        assert self.__class__.created_id, "Coupon id not stored — preceding test failed"
        r = _del(f"/coupons/{self.__class__.created_id}", token=owner_a["token"])
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # Verify gone
        lst = _get("/coupons", token=owner_a["token"]).json()
        codes = [c["code"] for c in lst]
        assert self.__class__.coupon_code.upper() not in codes


# ============================================================
# REFERRALS
# ============================================================
class TestReferrals:
    def test_create_and_convert_referral(self, owner_a):
        # Create a customer to refer
        cbody = {
            "name": "TEST_RefSource",
            "phone": f"7{int(time.time()) % 1000000000:09d}",
        }
        cresp = _post("/customers", token=owner_a["token"], json=cbody)
        assert cresp.status_code == 200, cresp.text
        cust = cresp.json()
        initial_points = cust.get("loyalty_points", 0)

        # Create referral
        rbody = {
            "referrer_customer_id": cust["id"],
            "referred_name": "TEST_Referred",
            "referred_phone": "9000000000",
        }
        r = _post("/referrals", token=owner_a["token"], json=rbody)
        assert r.status_code == 200, r.text
        ref = r.json()
        assert ref["status"] == "pending"
        assert ref["referrer_name"] == "TEST_RefSource"
        assert "id" in ref

        # Convert
        conv = _post(
            f"/referrals/{ref['id']}/convert",
            token=owner_a["token"],
            params={"reward_points": 100},
        )
        assert conv.status_code == 200, conv.text
        cj = conv.json()
        assert cj["status"] == "rewarded"
        assert cj["reward_points"] == 100

        # Verify customer loyalty_points incremented
        g = _get(f"/customers/{cust['id']}", token=owner_a["token"])
        assert g.status_code == 200
        new_points = g.json().get("loyalty_points", 0)
        assert new_points == initial_points + 100, f"expected {initial_points + 100}, got {new_points}"


# ============================================================
# REPAIR ORDERS
# ============================================================
class TestRepairOrders:
    repair_id = None

    def test_create_repair_order(self, owner_a):
        # Need a customer
        cresp = _post(
            "/customers",
            token=owner_a["token"],
            json={"name": "TEST_RepairCust", "phone": f"6{int(time.time()) % 1000000000:09d}"},
        )
        assert cresp.status_code == 200
        cid = cresp.json()["id"]
        body = {
            "customer_id": cid,
            "item_description": "Black Ray-Ban frame",
            "issue": "Loose hinge",
            "estimated_cost": 250,
            "advance_paid": 0,
        }
        r = _post("/repair-orders", token=owner_a["token"], json=body)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "received"
        import re
        assert re.match(r"^RPR-\d{6}-\d{5}$", j["repair_no"]), f"bad repair_no: {j['repair_no']}"
        assert isinstance(j.get("timeline"), list) and len(j["timeline"]) == 1
        self.__class__.repair_id = j["id"]

    def test_update_repair_status(self, owner_a):
        assert self.__class__.repair_id
        r = _post(
            f"/repair-orders/{self.__class__.repair_id}/status",
            token=owner_a["token"],
            json={"status": "ready", "note": "Fixed"},
        )
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "ready"
        assert len(j["timeline"]) >= 2

    def test_list_repair_orders_filter(self, owner_a):
        r = _get("/repair-orders", token=owner_a["token"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

        r2 = _get("/repair-orders", token=owner_a["token"], params={"status": "ready"})
        assert r2.status_code == 200
        for ro in r2.json():
            assert ro["status"] == "ready"


# ============================================================
# SUBSCRIPTION auto-renew + expiry-reminder
# ============================================================
class TestSubscription:
    def test_auto_renew_and_expiry_reminder(self, owner_a):
        r = _post(
            "/subscription/auto-renew",
            token=owner_a["token"],
            json={"auto_renew": True, "reminder_days": 5},
        )
        assert r.status_code == 200, r.text
        sub = r.json()
        assert sub.get("auto_renew") is True
        assert sub.get("reminder_days") == 5

        g = _get("/subscription/expiry-reminder", token=owner_a["token"])
        assert g.status_code == 200, g.text
        j = g.json()
        # When no subscription expires_at exists yet, server returns {expiring_soon: False}
        assert "expiring_soon" in j
        assert isinstance(j["expiring_soon"], bool)


# ============================================================
# AI Prescription scanner
# ============================================================
def _make_prescription_jpeg_b64() -> str:
    """Generate a content-bearing JPEG with prescription text drawn."""
    img = Image.new("RGB", (900, 600), color=(255, 255, 250))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
        font_s = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except Exception:
        font = ImageFont.load_default()
        font_s = font
    d.rectangle([10, 10, 890, 590], outline=(0, 0, 0), width=3)
    d.text((30, 30), "ARN OPTICAL — Eye Prescription", fill=(0, 0, 0), font=font)
    d.line([(30, 80), (870, 80)], fill=(0, 0, 0), width=2)
    d.text((30, 110), "Patient: John Doe   Date: 2025-04-15", fill=(0, 0, 0), font=font_s)
    d.text((30, 160), "OD (Right):  SPH -1.50   CYL -0.75   AXIS 90", fill=(0, 0, 0), font=font_s)
    d.text((30, 210), "OS (Left):   SPH -1.25   CYL -0.50   AXIS 85", fill=(0, 0, 0), font=font_s)
    d.text((30, 280), "PD: 62 mm", fill=(0, 0, 0), font=font_s)
    d.text((30, 340), "Type: Distance vision", fill=(0, 0, 0), font=font_s)
    d.text((30, 400), "Dr. Smith, M.D.", fill=(0, 0, 0), font=font_s)
    # Add some texture so it's not uniform
    for i in range(0, 900, 60):
        d.line([(i, 580), (i + 30, 590)], fill=(180, 180, 180), width=1)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


class TestAIPrescriptionScan:
    def test_ai_scan(self, owner_a):
        b64 = _make_prescription_jpeg_b64()
        body = {"image_base64": b64, "mime_type": "image/jpeg"}
        r = _post("/prescription/ai-scan", token=owner_a["token"], json=body, timeout=AI_TIMEOUT)
        assert r.status_code == 200, f"AI scan returned {r.status_code}: {r.text[:500]}"
        j = r.json()
        assert j.get("ok") is True
        ext = j.get("extracted", {})
        # Keys should exist (values can be null)
        for k in ["od_sph", "os_sph", "pd", "confidence"]:
            assert k in ext, f"missing key {k} in extracted: {ext}"


# ============================================================
# EXPORTS: PDF / XLSX
# ============================================================
class TestExports:
    def test_customers_pdf(self, owner_a):
        r = _get("/customers.pdf", token=owner_a["token"])
        assert r.status_code == 200, r.text[:300]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:4] == b"%PDF"

    def test_customers_xlsx(self, owner_a):
        r = _get("/customers.xlsx", token=owner_a["token"])
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("application/vnd.openxmlformats")
        assert r.content[:2] == b"PK"

    def test_inventory_pdf(self, owner_a):
        r = _get("/inventory.pdf", token=owner_a["token"])
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_inventory_xlsx(self, owner_a):
        r = _get("/inventory.xlsx", token=owner_a["token"])
        assert r.status_code == 200
        assert r.content[:2] == b"PK"

    def test_sales_pdf(self, owner_a):
        r = _get("/reports/sales.pdf", token=owner_a["token"])
        assert r.status_code == 200
        assert r.content[:4] == b"%PDF"

    def test_sales_xlsx(self, owner_a):
        r = _get("/reports/sales.xlsx", token=owner_a["token"])
        assert r.status_code == 200
        assert r.content[:2] == b"PK"


# ============================================================
# DASHBOARD
# ============================================================
class TestDashboard:
    def test_dashboard_new_fields(self, owner_a, customer_today):
        r = _get("/dashboard", token=owner_a["token"])
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ["repair_total", "repair_open", "repair_ready", "birthdays_today", "anniversaries_today"]:
            assert k in j, f"missing dashboard key {k}: keys={list(j.keys())}"
        assert isinstance(j["repair_total"], int)
        assert isinstance(j["repair_open"], int)
        assert isinstance(j["repair_ready"], int)
        assert isinstance(j["birthdays_today"], list)
        assert isinstance(j["anniversaries_today"], list)


# ============================================================
# SUPER ADMIN
# ============================================================
class TestSuperAdmin:
    def test_coupons_all_super(self, super_token):
        r = _get("/admin/coupons-all", token=super_token)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_referrals_all_super(self, super_token):
        r = _get("/admin/referrals-all", token=super_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_repair_orders_all_super(self, super_token):
        r = _get("/admin/repair-orders-all", token=super_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_wishes_all_super(self, super_token):
        r = _get("/admin/wishes-all", token=super_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_owner_forbidden_admin_endpoints(self, owner_a):
        for path in [
            "/admin/coupons-all",
            "/admin/referrals-all",
            "/admin/repair-orders-all",
            "/admin/wishes-all",
        ]:
            r = _get(path, token=owner_a["token"])
            assert r.status_code == 403, f"{path} returned {r.status_code}, expected 403: {r.text[:120]}"


# ============================================================
# TENANT SCOPING
# ============================================================
class TestTenantScoping:
    def test_coupons_scoped(self, owner_a, owner_b):
        code = f"OWNA_{int(time.time())}"
        r = _post(
            "/coupons",
            token=owner_a["token"],
            json={"code": code, "discount_type": "flat", "value": 50, "min_order": 0},
        )
        assert r.status_code == 200, r.text
        # Owner B should NOT see it
        lst_b = _get("/coupons", token=owner_b["token"]).json()
        codes_b = [c["code"] for c in lst_b]
        assert code.upper() not in codes_b
        # Owner A SHOULD see it
        lst_a = _get("/coupons", token=owner_a["token"]).json()
        codes_a = [c["code"] for c in lst_a]
        assert code.upper() in codes_a

    def test_referrals_scoped(self, owner_a, owner_b):
        # Create customer + referral as owner A
        cresp = _post(
            "/customers",
            token=owner_a["token"],
            json={"name": "TEST_RefScope", "phone": f"5{int(time.time()) % 1000000000:09d}"},
        )
        cid = cresp.json()["id"]
        r = _post(
            "/referrals",
            token=owner_a["token"],
            json={"referrer_customer_id": cid, "referred_name": "X", "referred_phone": "8888888888"},
        )
        assert r.status_code == 200, r.text
        ref_id = r.json()["id"]
        ids_b = [x["id"] for x in _get("/referrals", token=owner_b["token"]).json()]
        assert ref_id not in ids_b
        ids_a = [x["id"] for x in _get("/referrals", token=owner_a["token"]).json()]
        assert ref_id in ids_a

    def test_repair_orders_scoped(self, owner_a, owner_b):
        cresp = _post(
            "/customers",
            token=owner_a["token"],
            json={"name": "TEST_RepScope", "phone": f"4{int(time.time()) % 1000000000:09d}"},
        )
        cid = cresp.json()["id"]
        r = _post(
            "/repair-orders",
            token=owner_a["token"],
            json={"customer_id": cid, "item_description": "frame", "issue": "scratch"},
        )
        assert r.status_code == 200
        rid = r.json()["id"]
        ids_b = [x["id"] for x in _get("/repair-orders", token=owner_b["token"]).json()]
        assert rid not in ids_b
        ids_a = [x["id"] for x in _get("/repair-orders", token=owner_a["token"]).json()]
        assert rid in ids_a
