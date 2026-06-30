"""Tests for new /api/auth/register sign-up feature."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://sight-management-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

TS = int(time.time())
FRESH_EMAIL = f"owner+{TS}@example.com"
FRESH_PASSWORD = "Owner@1234"
FRESH_NAME = "Test Owner · Test Shop"

DUPLICATE_EMAIL = "admin@opticrm.com"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Sign-up flow ---
class TestRegister:
    created_token = None

    def test_register_fresh_email_returns_token_and_owner(self, client):
        r = client.post(f"{API}/auth/register", json={
            "email": FRESH_EMAIL, "password": FRESH_PASSWORD, "name": FRESH_NAME
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str) and len(data["access_token"]) > 20
        assert data.get("token_type") == "bearer"
        user = data.get("user") or {}
        assert user.get("email") == FRESH_EMAIL.lower()
        assert user.get("name") == FRESH_NAME
        assert user.get("role") == "owner"
        assert "id" in user
        TestRegister.created_token = data["access_token"]

    def test_register_duplicate_email_returns_400(self, client):
        r = client.post(f"{API}/auth/register", json={
            "email": DUPLICATE_EMAIL, "password": "Admin@1234", "name": "Dup"
        })
        assert r.status_code == 400, r.text
        assert "already registered" in r.json().get("detail", "").lower()

    def test_register_same_email_twice_returns_400(self, client):
        r = client.post(f"{API}/auth/register", json={
            "email": FRESH_EMAIL, "password": FRESH_PASSWORD, "name": FRESH_NAME
        })
        assert r.status_code == 400
        assert "already registered" in r.json().get("detail", "").lower()

    def test_login_with_registered_credentials(self, client):
        r = client.post(f"{API}/auth/login", json={
            "email": FRESH_EMAIL, "password": FRESH_PASSWORD
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data
        assert data["user"]["email"] == FRESH_EMAIL.lower()
        assert data["user"]["role"] == "owner"

    def test_auth_me_with_register_token(self, client):
        assert TestRegister.created_token, "register test must run first"
        r = client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {TestRegister.created_token}"})
        assert r.status_code == 200, r.text
        me = r.json()
        assert me["email"] == FRESH_EMAIL.lower()
        assert me["role"] == "owner"
        assert "password_hash" not in me
        assert "_id" not in me

    def test_subscription_me_defaults_to_trial(self, client):
        assert TestRegister.created_token
        r = client.get(f"{API}/subscription/me", headers={"Authorization": f"Bearer {TestRegister.created_token}"})
        assert r.status_code == 200, r.text
        sub = r.json()
        assert sub.get("plan_id") == "trial"
        assert sub.get("status") == "active"
        assert sub.get("plan", {}).get("name") == "Free Trial"

    def test_register_invalid_email_returns_422(self, client):
        r = client.post(f"{API}/auth/register", json={
            "email": "not-an-email", "password": "abcdef", "name": "x"
        })
        assert r.status_code == 422
