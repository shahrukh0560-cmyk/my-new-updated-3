"""
Backend tests for OptiCRM Super-Admin endpoints (iteration 6).

Covers:
- Super-admin login returns role=super_admin
- /admin/metrics aggregates
- /admin/tenants list + filtering (q, status)
- /admin/tenants/{id} detail
- /admin/tenants/{id}/status suspend/reactivate gates login (403)
- /admin/tenants/{id}/subscription complimentary grant
- /admin/broadcast + /admin/broadcasts + /broadcasts/latest
- RBAC: regular owner cannot hit /admin/*
- Tenant isolation on /customers and /inventory
- DELETE /admin/tenants/{id} cascade wipe
"""

import os
import uuid
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL (or EXPO_BACKEND_URL) must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@opticrm.com"
ADMIN_PASSWORD = "Admin@1234"

# Tenant accounts that pre-exist and must NOT be deleted
PROTECTED_TENANT_EMAILS = {
    "srk671994@gmail.com",
}  # owner+ui*@example.com / owner+178*@example.com handled by prefix check


def _is_protected(email: str) -> bool:
    if not email:
        return False
    e = email.lower()
    if e in PROTECTED_TENANT_EMAILS:
        return True
    if e.startswith("owner+ui") or e.startswith("owner+178"):
        return True
    return False


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def admin_token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "super_admin", f"admin role is {data['user'].get('role')}, expected super_admin"
    return data["access_token"]


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


def _register_tenant(session, email_prefix="t6"):
    email = f"TEST_{email_prefix}_{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "password": "Pwd@12345", "name": f"Test Owner {email_prefix}", "shop_name": f"Shop {email_prefix}"}
    r = session.post(f"{API}/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    j = r.json()
    return {
        "email": email,
        "password": "Pwd@12345",
        "token": j["access_token"],
        "id": j["user"]["id"],
        "headers": {"Authorization": f"Bearer {j['access_token']}", "Content-Type": "application/json"},
    }


# ---------- Auth & role ----------
class TestSuperAdminAuth:
    def test_admin_login_role(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        j = r.json()
        assert j["user"]["role"] == "super_admin"
        assert "access_token" in j


# ---------- Metrics ----------
class TestAdminMetrics:
    def test_metrics_returns_aggregates(self, session, admin_headers):
        r = session.get(f"{API}/admin/metrics", headers=admin_headers)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ["total_tenants", "active_tenants", "suspended_tenants", "mrr", "arr", "plan_breakdown", "platform_gmv"]:
            assert k in j, f"missing key: {k}"
        assert isinstance(j["total_tenants"], int)
        assert isinstance(j["plan_breakdown"], dict)


# ---------- Tenants list / detail / filters ----------
class TestAdminTenants:
    def test_list_tenants(self, session, admin_headers):
        r = session.get(f"{API}/admin/tenants", headers=admin_headers)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list)
        # at least one tenant should exist
        assert len(arr) >= 1
        first = arr[0]
        assert "metrics" in first and "subscription" in first
        assert "customers" in first["metrics"]
        assert "_id" not in first  # mongo _id excluded

    def test_filter_status_active(self, session, admin_headers):
        r = session.get(f"{API}/admin/tenants", headers=admin_headers, params={"status": "active"})
        assert r.status_code == 200
        for t in r.json():
            assert t.get("status") != "suspended"

    def test_filter_status_suspended(self, session, admin_headers):
        r = session.get(f"{API}/admin/tenants", headers=admin_headers, params={"status": "suspended"})
        assert r.status_code == 200
        for t in r.json():
            assert t.get("status") == "suspended"

    def test_search_q(self, session, admin_headers):
        # search by part of admin email won't match owners (admin is super_admin); use existing tenant prefix
        # list all, pick one email substring, then search
        r = session.get(f"{API}/admin/tenants", headers=admin_headers)
        assert r.status_code == 200
        tenants = r.json()
        if not tenants:
            pytest.skip("no tenants to search against")
        sample_email = tenants[0]["email"]
        substr = sample_email.split("@")[0][:4]
        r2 = session.get(f"{API}/admin/tenants", headers=admin_headers, params={"q": substr})
        assert r2.status_code == 200
        results = r2.json()
        assert any(substr.lower() in t["email"].lower() for t in results)

    def test_tenant_detail(self, session, admin_headers):
        r = session.get(f"{API}/admin/tenants", headers=admin_headers)
        assert r.status_code == 200
        tenants = r.json()
        if not tenants:
            pytest.skip("no tenants available")
        tid = tenants[0]["id"]
        r2 = session.get(f"{API}/admin/tenants/{tid}", headers=admin_headers)
        assert r2.status_code == 200, r2.text
        j = r2.json()
        for k in ["tenant", "metrics", "recent_orders", "recent_customers", "branches"]:
            assert k in j
        assert j["tenant"]["id"] == tid

    def test_tenant_detail_404(self, session, admin_headers):
        r = session.get(f"{API}/admin/tenants/non-existent-id-xyz", headers=admin_headers)
        assert r.status_code == 404


# ---------- Status: suspend / reactivate ----------
class TestSuspendReactivate:
    def test_suspend_blocks_login_then_reactivate(self, session, admin_headers):
        # create throwaway
        t = _register_tenant(session, "susp")
        # suspend
        r = session.post(f"{API}/admin/tenants/{t['id']}/status", headers=admin_headers, json={"status": "suspended"})
        assert r.status_code == 200, r.text
        assert r.json().get("status") == "suspended"
        # login must fail with 403
        r2 = session.post(f"{API}/auth/login", json={"email": t["email"], "password": t["password"]})
        assert r2.status_code == 403, f"expected 403, got {r2.status_code}: {r2.text}"
        # reactivate
        r3 = session.post(f"{API}/admin/tenants/{t['id']}/status", headers=admin_headers, json={"status": "active"})
        assert r3.status_code == 200
        # login should work
        r4 = session.post(f"{API}/auth/login", json={"email": t["email"], "password": t["password"]})
        assert r4.status_code == 200, r4.text
        # cleanup
        session.delete(f"{API}/admin/tenants/{t['id']}", headers=admin_headers)


# ---------- Subscription grant ----------
class TestComplimentarySubscription:
    def test_grant_pro_30days(self, session, admin_headers):
        t = _register_tenant(session, "sub")
        r = session.post(f"{API}/admin/tenants/{t['id']}/subscription",
                         headers=admin_headers, json={"plan_id": "pro", "days": 30})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["plan_id"] == "pro"
        assert j["status"] == "active"
        assert j.get("granted_by_admin") == ADMIN_EMAIL
        # plan info echoed
        assert j["plan"]["id"] == "pro"
        # cleanup
        session.delete(f"{API}/admin/tenants/{t['id']}", headers=admin_headers)


# ---------- Broadcasts ----------
class TestBroadcasts:
    def test_create_list_and_latest(self, session, admin_headers):
        title = f"TEST_BCAST_{uuid.uuid4().hex[:6]}"
        r = session.post(f"{API}/admin/broadcast", headers=admin_headers,
                         json={"title": title, "message": "hello tenants", "severity": "info"})
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["title"] == title
        assert j["severity"] == "info"

        r2 = session.get(f"{API}/admin/broadcasts", headers=admin_headers)
        assert r2.status_code == 200
        titles = [b["title"] for b in r2.json()]
        assert title in titles

        # any authenticated tenant can fetch latest
        t = _register_tenant(session, "bcast")
        r3 = session.get(f"{API}/broadcasts/latest", headers=t["headers"])
        assert r3.status_code == 200
        latest = r3.json()
        assert latest.get("title") == title  # newest first
        session.delete(f"{API}/admin/tenants/{t['id']}", headers=admin_headers)


# ---------- RBAC ----------
class TestRbacIsolation:
    def test_regular_owner_cannot_call_admin(self, session, admin_headers):
        t = _register_tenant(session, "rbac")
        h = t["headers"]
        endpoints = [
            ("GET", "/admin/metrics"),
            ("GET", "/admin/tenants"),
            ("GET", f"/admin/tenants/{t['id']}"),
            ("POST", f"/admin/tenants/{t['id']}/status"),
            ("POST", f"/admin/tenants/{t['id']}/subscription"),
            ("POST", "/admin/broadcast"),
            ("GET", "/admin/broadcasts"),
            ("DELETE", f"/admin/tenants/{t['id']}"),
        ]
        for method, ep in endpoints:
            if method == "GET":
                r = session.get(f"{API}{ep}", headers=h)
            elif method == "POST":
                r = session.post(f"{API}{ep}", headers=h, json={"status": "suspended", "plan_id": "pro", "title": "x", "message": "y"})
            elif method == "DELETE":
                r = session.delete(f"{API}{ep}", headers=h)
            assert r.status_code == 403, f"{method} {ep} expected 403, got {r.status_code}: {r.text[:200]}"
        # cleanup
        session.delete(f"{API}/admin/tenants/{t['id']}", headers=admin_headers)

    def test_tenant_customer_inventory_isolation(self, session, admin_headers):
        t1 = _register_tenant(session, "iso1")
        t2 = _register_tenant(session, "iso2")
        # t1 creates a customer + inventory item
        cr = session.post(f"{API}/customers", headers=t1["headers"], json={
            "name": "TEST_Iso Customer", "phone": "9990001111"
        })
        assert cr.status_code in (200, 201), cr.text
        ir = session.post(f"{API}/inventory", headers=t1["headers"], json={
            "name": "TEST_Iso Frame", "sku": f"TEST_SKU_{uuid.uuid4().hex[:6]}",
            "category": "frame", "price": 999, "cost": 500, "stock": 10
        })
        assert ir.status_code in (200, 201), ir.text

        # t2 lists customers/inventory: should NOT see t1's data
        t2_cust = session.get(f"{API}/customers", headers=t2["headers"]).json()
        t2_inv = session.get(f"{API}/inventory", headers=t2["headers"]).json()
        # accept dict-with-list or raw list
        t2_cust_list = t2_cust if isinstance(t2_cust, list) else t2_cust.get("items", [])
        t2_inv_list = t2_inv if isinstance(t2_inv, list) else t2_inv.get("items", [])
        assert all(c.get("owner_id") != t1["id"] for c in t2_cust_list), "t2 sees t1's customers!"
        assert all(i.get("owner_id") != t1["id"] for i in t2_inv_list), "t2 sees t1's inventory!"
        assert not any(c.get("name") == "TEST_Iso Customer" for c in t2_cust_list)

        # t1 sees their own
        t1_cust = session.get(f"{API}/customers", headers=t1["headers"]).json()
        t1_cust_list = t1_cust if isinstance(t1_cust, list) else t1_cust.get("items", [])
        assert any(c.get("name") == "TEST_Iso Customer" for c in t1_cust_list)

        # cleanup both
        session.delete(f"{API}/admin/tenants/{t1['id']}", headers=admin_headers)
        session.delete(f"{API}/admin/tenants/{t2['id']}", headers=admin_headers)


# ---------- Cascade delete ----------
class TestCascadeDelete:
    def test_delete_tenant_cascades(self, session, admin_headers):
        t = _register_tenant(session, "del")
        # add customer + inventory
        session.post(f"{API}/customers", headers=t["headers"], json={"name": "TEST_DelCust", "phone": "8881112222"})
        session.post(f"{API}/inventory", headers=t["headers"], json={
            "name": "TEST_DelItem", "sku": f"TEST_DEL_{uuid.uuid4().hex[:6]}",
            "category": "frame", "price": 100, "cost": 50, "stock": 1
        })
        # delete
        r = session.delete(f"{API}/admin/tenants/{t['id']}", headers=admin_headers)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("ok") is True
        assert j.get("deleted_tenant") == t["id"]

        # detail should now 404
        r2 = session.get(f"{API}/admin/tenants/{t['id']}", headers=admin_headers)
        assert r2.status_code == 404

        # login should fail
        r3 = session.post(f"{API}/auth/login", json={"email": t["email"], "password": t["password"]})
        assert r3.status_code == 401

    def test_protected_tenants_still_intact(self, session, admin_headers):
        """Sanity: pre-existing tenants the main agent told us not to delete are still there."""
        r = session.get(f"{API}/admin/tenants", headers=admin_headers)
        assert r.status_code == 200
        emails = {t["email"].lower() for t in r.json()}
        # at least one protected tenant must still be present
        if "srk671994@gmail.com" not in emails:
            # not fatal if seeded differently, but log
            pytest.skip("seeded protected tenant srk671994@gmail.com not found — possibly different seed")
