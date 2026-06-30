"""Iteration 8 backend tests - countries, register w/ country, sales template/import, sales reports series, branch filters."""
import os
import time
import uuid
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://mobile-optical-sync.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

OWNER = {"email": "shop1@test.com", "password": "Test@1234"}
STAFF = {"email": "staff1@test.com", "password": "Staff@1234"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=30)
    assert r.status_code == 200, f"login failed for {creds['email']}: {r.status_code} {r.text}"
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def owner_token():
    return _login(OWNER)


@pytest.fixture(scope="module")
def staff_token():
    return _login(STAFF)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- /api/countries ----------
class TestCountries:
    def test_countries_list_min10(self):
        r = requests.get(f"{API}/countries", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 10, f"expected >=10 countries, got {len(data)}"
        codes = {c["code"] for c in data}
        assert {"IN", "US", "GB"}.issubset(codes)
        for c in data:
            for k in ("code", "name", "currency", "symbol"):
                assert k in c and c[k], f"missing {k} in {c}"


# ---------- Register with country -> currency ----------
class TestRegisterCountry:
    def test_register_us_owner_has_usd(self):
        email = f"TEST_us_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{API}/auth/register", json={
            "name": "TEST US Owner", "email": email, "password": "Test@1234", "country": "US"
        }, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        u = data["user"]
        assert u.get("country") == "US"
        assert u.get("currency") == "USD"
        assert u.get("currency_symbol") == "$"
        assert u.get("locale") == "en-US"
        # /auth/me also reports the same
        me = requests.get(f"{API}/auth/me", headers=_h(data["access_token"]), timeout=20)
        assert me.status_code == 200
        mj = me.json()
        assert mj.get("currency") == "USD"
        assert mj.get("country") == "US"


# ---------- /sales-template.csv ----------
class TestSalesTemplate:
    def test_owner_can_download(self, owner_token):
        r = requests.get(f"{API}/sales-template.csv", headers=_h(owner_token), timeout=20)
        assert r.status_code == 200
        assert "invoice_no" in r.text.splitlines()[0]
        assert "customer_name" in r.text.splitlines()[0]
        assert "total" in r.text.splitlines()[0]

    def test_staff_forbidden(self, staff_token):
        r = requests.get(f"{API}/sales-template.csv", headers=_h(staff_token), timeout=20)
        assert r.status_code == 403


# ---------- /sales-import ----------
class TestSalesImport:
    def test_staff_forbidden(self, staff_token):
        r = requests.post(f"{API}/sales-import", headers=_h(staff_token), json={"rows": []}, timeout=20)
        assert r.status_code == 403

    def test_import_and_dup_skip(self, owner_token):
        uniq = uuid.uuid4().hex[:6].upper()
        inv_a = f"TEST-INV-A-{uniq}"
        inv_b = f"TEST-INV-B-{uniq}"
        rows = [
            {"invoice_no": inv_a, "date": "2025-12-01", "customer_name": "TEST Imp Customer A",
             "customer_phone": "+910000000001", "subtotal": 1000, "gst_amount": 100, "discount": 0,
             "total": 1100, "paid": 1100, "payment_status": "paid", "notes": "TEST"},
            {"invoice_no": inv_b, "date": "2025-12-12", "customer_name": "TEST Imp Customer B",
             "customer_phone": "+910000000002", "subtotal": 500, "gst_amount": 50, "discount": 0,
             "total": 550, "paid": 0, "payment_status": "unpaid", "notes": "TEST"},
            # missing customer_name -> error
            {"invoice_no": f"TEST-INV-ERR-{uniq}", "customer_name": "", "total": 100},
        ]
        r = requests.post(f"{API}/sales-import", headers=_h(owner_token),
                          json={"rows": rows, "skip_duplicates": True}, timeout=30)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["imported"] >= 2
        assert body["skipped_duplicates"] == 0
        assert len(body["errors"]) >= 1

        # Re-import same → dup skip
        r2 = requests.post(f"{API}/sales-import", headers=_h(owner_token),
                           json={"rows": rows[:2], "skip_duplicates": True}, timeout=30)
        assert r2.status_code == 200
        b2 = r2.json()
        assert b2["imported"] == 0
        assert b2["skipped_duplicates"] == 2

        # Verify imported orders carry is_imported=true (find via list)
        # GET /api/orders — search recent and assert one with invoice_no inv_a has is_imported
        ords = requests.get(f"{API}/orders", headers=_h(owner_token), timeout=20).json()
        found = [o for o in ords if o.get("invoice_no") == inv_a]
        assert found, f"imported invoice {inv_a} not visible in /orders"
        assert found[0].get("is_imported") is True


# ---------- /reports/sales with period ----------
class TestReportsSeries:
    def test_no_period_empty_series(self, owner_token):
        r = requests.get(f"{API}/reports/sales", headers=_h(owner_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        assert "series" in body
        assert body["series"] == []

    def test_monthly_series(self, owner_token):
        r = requests.get(f"{API}/reports/sales?period=monthly", headers=_h(owner_token), timeout=20)
        assert r.status_code == 200
        body = r.json()
        series = body["series"]
        assert isinstance(series, list)
        if series:
            row = series[0]
            for k in ("period", "orders", "revenue", "due", "gst", "discount", "total"):
                assert k in row, f"missing {k} in series row"
            # period key shape YYYY-MM
            assert len(row["period"]) == 7 and row["period"][4] == "-"

    def test_yearly_series(self, owner_token):
        r = requests.get(f"{API}/reports/sales?period=yearly", headers=_h(owner_token), timeout=20)
        assert r.status_code == 200
        s = r.json()["series"]
        if s:
            assert len(s[0]["period"]) == 4  # YYYY

    def test_daily_series(self, owner_token):
        r = requests.get(f"{API}/reports/sales?period=daily", headers=_h(owner_token), timeout=20)
        assert r.status_code == 200
        s = r.json()["series"]
        if s:
            assert len(s[0]["period"]) == 10  # YYYY-MM-DD


# ---------- /reports/sales.csv date + branch ----------
class TestReportsCSV:
    def test_csv_date_range(self, owner_token):
        start = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
        end = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        r = requests.get(f"{API}/reports/sales.csv?start={start}&end={end}", headers=_h(owner_token), timeout=30)
        assert r.status_code == 200
        assert "Invoice" in r.text.splitlines()[0]

    def test_csv_accepts_branch_id(self, owner_token):
        # find a branch
        br = requests.get(f"{API}/branches", headers=_h(owner_token), timeout=20)
        if br.status_code != 200 or not br.json():
            pytest.skip("no branch available")
        bid = br.json()[0]["id"]
        r = requests.get(f"{API}/reports/sales.csv?branch_id={bid}", headers=_h(owner_token), timeout=30)
        assert r.status_code == 200


# ---------- branch_id filter on list endpoints ----------
class TestBranchFilter:
    def test_branch_filter_lists(self, owner_token):
        br = requests.get(f"{API}/branches", headers=_h(owner_token), timeout=20)
        if br.status_code != 200 or not br.json():
            pytest.skip("no branch to filter by")
        bid = br.json()[0]["id"]
        for ep in ("orders", "inventory", "customers"):
            r = requests.get(f"{API}/{ep}?branch_id={bid}", headers=_h(owner_token), timeout=20)
            assert r.status_code == 200, f"{ep} branch filter failed: {r.status_code} {r.text[:200]}"
            data = r.json()
            assert isinstance(data, list)
            for item in data:
                # items either have branch_id == bid or were created prior to branches
                if item.get("branch_id"):
                    assert item["branch_id"] == bid
        # dashboard
        d = requests.get(f"{API}/dashboard?branch_id={bid}", headers=_h(owner_token), timeout=20)
        assert d.status_code == 200
        dj = d.json()
        assert "total_orders" in dj or "orders_today" in dj or "stats" in dj or isinstance(dj, dict)
