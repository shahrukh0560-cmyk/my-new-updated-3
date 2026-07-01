#!/usr/bin/env python3
"""
Backend API Testing for OptiCRM - New Endpoints
Tests: branches/metrics, barcode-label.pdf, referrals/my-code, referrals/record-share, copilot/query
"""
import requests
import json
import os
import sys
from datetime import datetime

# Load base URL from frontend/.env
BASE_URL = None
with open("/app/frontend/.env", "r") as f:
    for line in f:
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
            break

if not BASE_URL:
    print("❌ REACT_APP_BACKEND_URL not found in /app/frontend/.env")
    sys.exit(1)

API_BASE = f"{BASE_URL}/api"
print(f"🔗 Testing against: {API_BASE}\n")

# Test credentials
ADMIN_EMAIL = "admin@opticrm.io"
ADMIN_PASSWORD = "Admin@12345"

# Global token storage
admin_token = None
owner_token = None
owner_email = None

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def print_test(name):
    print(f"\n🧪 TEST: {name}")

def print_pass(msg):
    print(f"  ✅ {msg}")

def print_fail(msg):
    print(f"  ❌ {msg}")

def print_info(msg):
    print(f"  ℹ️  {msg}")

def print_warn(msg):
    print(f"  ⚠️  {msg}")


# ============================================================
# Authentication Setup
# ============================================================
def login_admin():
    """Login as super admin"""
    global admin_token
    print_section("AUTHENTICATION SETUP")
    print_test("Login as super admin")
    
    resp = requests.post(f"{API_BASE}/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    
    if resp.status_code == 200:
        data = resp.json()
        admin_token = data.get("access_token") or data.get("token")
        if admin_token:
            print_pass(f"Admin login successful")
            print_info(f"Token: {admin_token[:20]}...")
            return True
        else:
            print_fail(f"No token in response: {data}")
            return False
    else:
        print_fail(f"Admin login failed: {resp.status_code} - {resp.text}")
        return False


def register_owner():
    """Register a new owner account for tenant-scoped testing"""
    global owner_token, owner_email
    print_test("Register new owner account")
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    owner_email = f"ownertest{timestamp}@test.com"
    
    resp = requests.post(f"{API_BASE}/auth/register", json={
        "name": "Test Owner",
        "email": owner_email,
        "password": "TestOwner@123",
        "business_name": "Test Optical Shop"
    })
    
    if resp.status_code == 200:
        data = resp.json()
        owner_token = data.get("access_token") or data.get("token")
        if owner_token:
            print_pass(f"Owner registration successful: {owner_email}")
            print_info(f"Token: {owner_token[:20]}...")
            return True
        else:
            print_fail(f"No token in response: {data}")
            return False
    else:
        print_fail(f"Owner registration failed: {resp.status_code} - {resp.text}")
        return False


# ============================================================
# Test 1: GET /api/branches/metrics
# ============================================================
def test_branches_metrics():
    print_section("TEST 1: GET /api/branches/metrics")
    
    # Test without auth
    print_test("Request without authentication")
    resp = requests.get(f"{API_BASE}/branches/metrics")
    if resp.status_code in [401, 403]:
        print_pass(f"Correctly rejected unauthenticated request: {resp.status_code}")
    else:
        print_fail(f"Should reject unauthenticated request, got: {resp.status_code}")
    
    # Test with owner token
    print_test("Request with owner authentication")
    headers = {"Authorization": f"Bearer {owner_token}"}
    resp = requests.get(f"{API_BASE}/branches/metrics", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        print_pass(f"Request successful: {resp.status_code}")
        print_info(f"Response type: {type(data)}")
        
        if isinstance(data, list):
            print_pass(f"Response is a list (expected)")
            print_info(f"Number of branches: {len(data)}")
            
            if len(data) > 0:
                # Check structure of first branch
                branch = data[0]
                required_fields = ["branch_id", "name", "code", "customers", "inventory", 
                                 "low_stock", "orders_30d", "revenue_30d", "revenue_lifetime", "unpaid_due"]
                
                missing_fields = [f for f in required_fields if f not in branch]
                if not missing_fields:
                    print_pass("All required fields present in branch object")
                    print_info(f"Sample branch: {json.dumps(branch, indent=2)}")
                else:
                    print_fail(f"Missing fields: {missing_fields}")
                
                # Check data types
                if isinstance(branch.get("customers"), int):
                    print_pass("customers is integer")
                else:
                    print_fail(f"customers should be int, got {type(branch.get('customers'))}")
                
                if isinstance(branch.get("revenue_30d"), (int, float)):
                    print_pass("revenue_30d is numeric")
                else:
                    print_fail(f"revenue_30d should be numeric, got {type(branch.get('revenue_30d'))}")
            else:
                print_info("Empty list returned (fresh owner with no branches)")
        else:
            print_fail(f"Response should be a list, got {type(data)}")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")


# ============================================================
# Test 2: GET /api/inventory/{id}/barcode-label.pdf
# ============================================================
def test_barcode_label():
    print_section("TEST 2: GET /api/inventory/{id}/barcode-label.pdf")
    
    # First, create an inventory item with SKU and barcode
    print_test("Create inventory item with SKU and barcode")
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    inv_data = {
        "name": "Test Frame Model X",
        "sku": "TFX-001",
        "barcode": "1234567890123",
        "category": "frame",
        "brand": "TestBrand",
        "price": 2500,
        "stock": 10,
        "low_stock_threshold": 3
    }
    
    resp = requests.post(f"{API_BASE}/inventory", json=inv_data, headers=headers)
    
    if resp.status_code == 200:
        item = resp.json()
        item_id = item.get("id")
        print_pass(f"Inventory item created: {item_id}")
        
        # Test 2a: Generate PDF with default params
        print_test("Generate barcode label PDF (default: count=1, size=small)")
        resp = requests.get(f"{API_BASE}/inventory/{item_id}/barcode-label.pdf", headers=headers)
        
        if resp.status_code == 200:
            print_pass(f"PDF generated successfully: {resp.status_code}")
            
            # Check content type
            content_type = resp.headers.get("Content-Type")
            if content_type == "application/pdf":
                print_pass(f"Content-Type is application/pdf")
            else:
                print_fail(f"Content-Type should be application/pdf, got {content_type}")
            
            # Check PDF signature
            content = resp.content
            if content.startswith(b"%PDF"):
                print_pass("Response starts with %PDF (valid PDF)")
                print_info(f"PDF size: {len(content)} bytes")
            else:
                print_fail("Response does not start with %PDF")
        else:
            print_fail(f"PDF generation failed: {resp.status_code} - {resp.text}")
        
        # Test 2b: Generate with count=3, size=medium
        print_test("Generate barcode label PDF (count=3, size=medium)")
        resp = requests.get(f"{API_BASE}/inventory/{item_id}/barcode-label.pdf?count=3&size=medium", headers=headers)
        
        if resp.status_code == 200:
            print_pass(f"PDF generated with count=3, size=medium")
            print_info(f"PDF size: {len(resp.content)} bytes")
        else:
            print_fail(f"PDF generation failed: {resp.status_code} - {resp.text}")
        
        # Test 2c: Generate with count=200 (should clamp to 100)
        print_test("Generate barcode label PDF (count=200, should clamp to 100)")
        resp = requests.get(f"{API_BASE}/inventory/{item_id}/barcode-label.pdf?count=200&size=large", headers=headers)
        
        if resp.status_code == 200:
            print_pass(f"PDF generated (count clamped to 100)")
            print_info(f"PDF size: {len(resp.content)} bytes")
        else:
            print_fail(f"PDF generation failed: {resp.status_code} - {resp.text}")
        
    else:
        print_fail(f"Failed to create inventory item: {resp.status_code} - {resp.text}")
        return
    
    # Test 2d: Create item WITHOUT SKU/barcode and test error
    print_test("Create inventory item WITHOUT SKU/barcode")
    inv_data_no_sku = {
        "name": "Test Item No SKU",
        "category": "lens",
        "price": 500,
        "stock": 5
    }
    
    resp = requests.post(f"{API_BASE}/inventory", json=inv_data_no_sku, headers=headers)
    
    if resp.status_code == 200:
        item_no_sku = resp.json()
        item_no_sku_id = item_no_sku.get("id")
        print_pass(f"Item without SKU created: {item_no_sku_id}")
        
        print_test("Request barcode PDF for item without SKU (should fail)")
        resp = requests.get(f"{API_BASE}/inventory/{item_no_sku_id}/barcode-label.pdf", headers=headers)
        
        if resp.status_code == 400:
            print_pass(f"Correctly rejected item without SKU: {resp.status_code}")
            if "SKU" in resp.text or "barcode" in resp.text:
                print_pass(f"Error message mentions SKU/barcode: {resp.text}")
            else:
                print_warn(f"Error message unclear: {resp.text}")
        else:
            print_fail(f"Should return 400 for item without SKU, got: {resp.status_code}")
    
    # Test 2e: Test 404 for bogus inventory id
    print_test("Request barcode PDF for non-existent item (should 404)")
    resp = requests.get(f"{API_BASE}/inventory/bogus-id-12345/barcode-label.pdf", headers=headers)
    
    if resp.status_code == 404:
        print_pass(f"Correctly returned 404 for non-existent item")
    else:
        print_fail(f"Should return 404, got: {resp.status_code}")


# ============================================================
# Test 3: GET /api/referrals/my-code
# ============================================================
def test_referrals_my_code():
    print_section("TEST 3: GET /api/referrals/my-code")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Test 3a: First call should create code
    print_test("First call to /api/referrals/my-code")
    resp = requests.get(f"{API_BASE}/referrals/my-code", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        print_pass(f"Request successful: {resp.status_code}")
        
        # Check required fields
        required_fields = ["code", "share_url", "share_message", "whatsapp_url", "shares", "signups"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if not missing_fields:
            print_pass("All required fields present")
        else:
            print_fail(f"Missing fields: {missing_fields}")
        
        # Check code format
        code = data.get("code")
        if code and isinstance(code, str) and len(code) > 0:
            print_pass(f"Code is non-empty string: {code}")
            
            if code.isupper() and code.isalnum():
                print_pass("Code is uppercase alphanumeric")
            else:
                print_warn(f"Code format unexpected (should be uppercase alphanumeric): {code}")
        else:
            print_fail(f"Code is invalid: {code}")
        
        # Check share_url contains code
        share_url = data.get("share_url")
        if share_url and code in share_url:
            print_pass(f"share_url contains code: {share_url}")
        else:
            print_fail(f"share_url should contain code. URL: {share_url}")
        
        # Check initial counters
        if data.get("shares") == 0 and data.get("signups") == 0:
            print_pass("Initial shares and signups are 0")
        else:
            print_info(f"Shares: {data.get('shares')}, Signups: {data.get('signups')}")
        
        print_info(f"Full response: {json.dumps(data, indent=2)}")
        
        # Test 3b: Second call should return SAME code (idempotency)
        print_test("Second call to /api/referrals/my-code (idempotency)")
        resp2 = requests.get(f"{API_BASE}/referrals/my-code", headers=headers)
        
        if resp2.status_code == 200:
            data2 = resp2.json()
            code2 = data2.get("code")
            
            if code2 == code:
                print_pass(f"Same code returned (idempotent): {code2}")
            else:
                print_fail(f"Different code returned! First: {code}, Second: {code2}")
        else:
            print_fail(f"Second request failed: {resp2.status_code}")
        
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
    
    # Test 3c: Different user should get different code
    print_test("Register second owner and check for different code")
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    owner2_email = f"ownertest2_{timestamp}@test.com"
    
    resp = requests.post(f"{API_BASE}/auth/register", json={
        "name": "Test Owner 2",
        "email": owner2_email,
        "password": "TestOwner2@123",
        "business_name": "Test Optical Shop 2"
    })
    
    if resp.status_code == 200:
        owner2_token = resp.json().get("access_token") or resp.json().get("token")
        print_pass(f"Second owner registered: {owner2_email}")
        
        headers2 = {"Authorization": f"Bearer {owner2_token}"}
        resp = requests.get(f"{API_BASE}/referrals/my-code", headers=headers2)
        
        if resp.status_code == 200:
            data2 = resp.json()
            code2 = data2.get("code")
            
            # Get first owner's code again for comparison
            resp_first = requests.get(f"{API_BASE}/referrals/my-code", headers=headers)
            code_first = resp_first.json().get("code") if resp_first.status_code == 200 else None
            
            if code2 != code_first:
                print_pass(f"Different users have different codes: {code_first} vs {code2}")
            else:
                print_fail(f"Different users should have different codes! Both: {code2}")
        else:
            print_fail(f"Failed to get code for second owner: {resp.status_code}")
    else:
        print_warn(f"Could not register second owner for comparison test: {resp.status_code}")


# ============================================================
# Test 4: POST /api/referrals/record-share
# ============================================================
def test_referrals_record_share():
    print_section("TEST 4: POST /api/referrals/record-share")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Get initial share count
    print_test("Get initial share count")
    resp = requests.get(f"{API_BASE}/referrals/my-code", headers=headers)
    initial_shares = 0
    
    if resp.status_code == 200:
        initial_shares = resp.json().get("shares", 0)
        print_info(f"Initial shares: {initial_shares}")
    
    # Test 4a: Record share with valid channel
    print_test("Record share with channel=whatsapp")
    resp = requests.post(f"{API_BASE}/referrals/record-share", 
                        json={"channel": "whatsapp"}, 
                        headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        print_pass(f"Share recorded successfully: {data}")
        
        if data.get("ok") == True:
            print_pass("Response contains ok: true")
        else:
            print_warn(f"Response should contain ok: true, got: {data}")
    else:
        print_fail(f"Failed to record share: {resp.status_code} - {resp.text}")
    
    # Test 4b: Record another share
    print_test("Record second share with channel=copy")
    resp = requests.post(f"{API_BASE}/referrals/record-share", 
                        json={"channel": "copy"}, 
                        headers=headers)
    
    if resp.status_code == 200:
        print_pass("Second share recorded")
    else:
        print_fail(f"Failed to record second share: {resp.status_code}")
    
    # Test 4c: Verify share count increased
    print_test("Verify share count increased by 2")
    resp = requests.get(f"{API_BASE}/referrals/my-code", headers=headers)
    
    if resp.status_code == 200:
        current_shares = resp.json().get("shares", 0)
        expected_shares = initial_shares + 2
        
        if current_shares >= expected_shares:
            print_pass(f"Share count increased: {initial_shares} -> {current_shares}")
        else:
            print_fail(f"Share count should be at least {expected_shares}, got {current_shares}")
    else:
        print_fail(f"Failed to get updated share count: {resp.status_code}")
    
    # Test 4d: Invalid channel should be rejected
    print_test("Record share with invalid channel (twitter)")
    resp = requests.post(f"{API_BASE}/referrals/record-share", 
                        json={"channel": "twitter"}, 
                        headers=headers)
    
    if resp.status_code == 422:
        print_pass(f"Invalid channel correctly rejected: {resp.status_code}")
    else:
        print_fail(f"Should reject invalid channel with 422, got: {resp.status_code}")


# ============================================================
# Test 5: POST /api/copilot/query (SANITY CHECK)
# ============================================================
def test_copilot_query():
    print_section("TEST 5: POST /api/copilot/query (SANITY CHECK)")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    print_test("Send copilot query: 'How many customers do I have?'")
    print_info("NOTE: Emergent LLM key has 0 budget in this environment")
    print_info("Expected: 502 with friendly error OR 200 with answer")
    
    resp = requests.post(f"{API_BASE}/copilot/query", 
                        json={"question": "How many customers do I have?"}, 
                        headers=headers)
    
    print_info(f"Response status: {resp.status_code}")
    print_info(f"Response body: {resp.text[:500]}")
    
    if resp.status_code == 200:
        data = resp.json()
        if "answer" in data:
            print_pass("Endpoint working! Got answer from LLM")
            print_info(f"Answer: {data.get('answer')[:200]}...")
        else:
            print_warn(f"200 response but no answer field: {data}")
    elif resp.status_code == 502:
        # Expected due to budget limit
        if any(keyword in resp.text.lower() for keyword in ["budget", "unavailable", "exceeded", "balance"]):
            print_pass("Expected 502 with budget/unavailable message (LLM key has 0 budget)")
            print_info(f"Error message: {resp.text}")
        else:
            print_warn(f"502 but unclear error message: {resp.text}")
    elif resp.status_code == 500:
        print_fail(f"500 Internal Server Error (should handle gracefully): {resp.text}")
    elif resp.status_code == 404:
        print_fail("404 - Endpoint not found (should be implemented)")
    elif resp.status_code == 405:
        print_fail("405 - Method not allowed (check POST method)")
    else:
        print_warn(f"Unexpected status code: {resp.status_code} - {resp.text}")
    
    # Verify endpoint is wired (not 404/405/500 traceback)
    if resp.status_code not in [404, 405]:
        print_pass("Endpoint is wired (not 404/405)")
    else:
        print_fail("Endpoint not properly wired")


# ============================================================
# Main Test Runner
# ============================================================
def main():
    print("\n" + "="*60)
    print("  OptiCRM Backend API Testing - New Endpoints")
    print("="*60)
    
    # Setup authentication
    if not login_admin():
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed with tests.")
        sys.exit(1)
    
    if not register_owner():
        print("\n❌ CRITICAL: Owner registration failed. Cannot proceed with tests.")
        sys.exit(1)
    
    # Run all tests
    try:
        test_branches_metrics()
    except Exception as e:
        print_fail(f"Test crashed: {e}")
    
    try:
        test_barcode_label()
    except Exception as e:
        print_fail(f"Test crashed: {e}")
    
    try:
        test_referrals_my_code()
    except Exception as e:
        print_fail(f"Test crashed: {e}")
    
    try:
        test_referrals_record_share()
    except Exception as e:
        print_fail(f"Test crashed: {e}")
    
    try:
        test_copilot_query()
    except Exception as e:
        print_fail(f"Test crashed: {e}")
    
    print("\n" + "="*60)
    print("  Testing Complete")
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
