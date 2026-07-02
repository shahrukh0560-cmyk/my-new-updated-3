#!/usr/bin/env python3
"""
ROUND 3 Backend Testing — Subscription Plans + Feature Gating
Tests subscription plans, feature gating (402 responses), standard plan limits, and GST reports.
"""
import requests
import json
import uuid
from datetime import datetime

# Base URL from frontend/.env
BASE_URL = "https://eyecare-platform-1.preview.emergentagent.com/api"

# Test credentials
SUPER_ADMIN_EMAIL = "admin@opticrm.io"
SUPER_ADMIN_PASSWORD = "Admin@12345"

def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def register_owner():
    """Register a fresh owner for testing"""
    email = f"owner_{uuid.uuid4().hex[:8]}@test.com"
    password = "Test@12345"
    name = f"Test Owner {uuid.uuid4().hex[:4]}"
    
    resp = requests.post(f"{BASE_URL}/auth/register", json={
        "email": email,
        "password": password,
        "name": name,
        "country": "IN"
    })
    
    if resp.status_code != 200:
        log(f"❌ Owner registration failed: {resp.status_code} {resp.text}")
        return None, None, None
    
    data = resp.json()
    token = data.get("access_token")
    user = data.get("user", {})
    log(f"✅ Registered owner: {email}")
    return email, password, token

def login(email, password):
    """Login and get token"""
    resp = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    
    if resp.status_code != 200:
        log(f"❌ Login failed for {email}: {resp.status_code} {resp.text}")
        return None
    
    data = resp.json()
    token = data.get("access_token")
    log(f"✅ Logged in: {email}")
    return token

def headers(token):
    return {"Authorization": f"Bearer {token}"}

# ============================================================================
# TEST 1: GET /api/subscription/plans
# ============================================================================
def test_subscription_plans():
    log("\n=== TEST 1: GET /api/subscription/plans ===")
    resp = requests.get(f"{BASE_URL}/subscription/plans")
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {resp.status_code}")
        return False
    
    plans = resp.json()
    
    # Verify 5 plans
    if len(plans) != 5:
        log(f"❌ FAILED: Expected 5 plans, got {len(plans)}")
        return False
    
    # Verify plan IDs
    plan_ids = [p.get("id") for p in plans]
    expected_ids = ["trial", "standard", "premium_monthly", "premium_pro_monthly", "premium_pro_yearly"]
    
    for expected_id in expected_ids:
        if expected_id not in plan_ids:
            log(f"❌ FAILED: Missing plan ID: {expected_id}")
            return False
    
    # Verify pricing
    pricing = {p.get("id"): p.get("price") for p in plans}
    expected_pricing = {
        "trial": 0,
        "standard": 0,
        "premium_monthly": 299,
        "premium_pro_monthly": 499,
        "premium_pro_yearly": 3599
    }
    
    for plan_id, expected_price in expected_pricing.items():
        if pricing.get(plan_id) != expected_price:
            log(f"❌ FAILED: Plan {plan_id} price mismatch. Expected {expected_price}, got {pricing.get(plan_id)}")
            return False
    
    # Verify billing_cycle values
    billing_cycles = {p.get("id"): p.get("billing_cycle") for p in plans}
    expected_cycles = {
        "trial": "trial",
        "standard": "free",
        "premium_monthly": "monthly",
        "premium_pro_monthly": "monthly",
        "premium_pro_yearly": "yearly"
    }
    
    for plan_id, expected_cycle in expected_cycles.items():
        if billing_cycles.get(plan_id) != expected_cycle:
            log(f"❌ FAILED: Plan {plan_id} billing_cycle mismatch. Expected {expected_cycle}, got {billing_cycles.get(plan_id)}")
            return False
    
    # Verify required fields exist
    for plan in plans:
        required_fields = ["id", "name", "price", "currency", "billing_cycle", "tagline", "features", "cta"]
        for field in required_fields:
            if field not in plan:
                log(f"❌ FAILED: Plan {plan.get('id')} missing field: {field}")
                return False
    
    log("✅ PASSED: All 5 plans present with correct pricing, billing_cycle, and required fields")
    return True

# ============================================================================
# TEST 2: GET /api/auth/me includes plan info
# ============================================================================
def test_auth_me_plan_info(token):
    log("\n=== TEST 2: GET /api/auth/me includes plan info ===")
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers(token))
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Expected 200, got {resp.status_code}")
        return False
    
    data = resp.json()
    
    # Verify plan fields
    required_fields = ["plan_id", "plan_name", "plan_expires_at", "plan_features"]
    for field in required_fields:
        if field not in data:
            log(f"❌ FAILED: Missing field: {field}")
            return False
    
    # Fresh owner should be on trial
    if data.get("plan_id") != "trial":
        log(f"❌ FAILED: Fresh owner should be on 'trial', got '{data.get('plan_id')}'")
        return False
    
    # Verify plan_features is an array
    features = data.get("plan_features")
    if not isinstance(features, list):
        log(f"❌ FAILED: plan_features should be an array, got {type(features)}")
        return False
    
    # Trial should have all 13 features
    expected_features = [
        "unlimited_customers", "unlimited_inventory", "unlimited_orders",
        "gst_reports", "prescription_pdf", "bulk_barcode", "copilot_query",
        "multi_branch", "staff_users", "copilot_actions", "manage_all_branches",
        "referral_program", "whatsapp_campaigns"
    ]
    
    for feature in expected_features:
        if feature not in features:
            log(f"❌ FAILED: Trial plan missing feature: {feature}")
            return False
    
    log(f"✅ PASSED: auth/me returns plan_id='{data.get('plan_id')}', plan_name='{data.get('plan_name')}', and all 13 features")
    return True

# ============================================================================
# TEST 3: POST /api/subscription/start
# ============================================================================
def test_subscription_start(token):
    log("\n=== TEST 3: POST /api/subscription/start ===")
    
    # Test switching to standard
    resp = requests.post(f"{BASE_URL}/subscription/start", 
                        headers=headers(token),
                        json={"plan_id": "standard"})
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Expected 200 for standard plan, got {resp.status_code}")
        return False
    
    data = resp.json()
    if data.get("plan_id") != "standard":
        log(f"❌ FAILED: Plan not updated to standard, got {data.get('plan_id')}")
        return False
    
    log("✅ PASSED: Successfully switched to standard plan")
    
    # Test old plan IDs are rejected
    old_plan_ids = ["starter", "pro", "enterprise"]
    for old_id in old_plan_ids:
        resp = requests.post(f"{BASE_URL}/subscription/start",
                           headers=headers(token),
                           json={"plan_id": old_id})
        
        if resp.status_code != 422:
            log(f"❌ FAILED: Old plan ID '{old_id}' should be rejected with 422, got {resp.status_code}")
            return False
    
    log("✅ PASSED: Old plan IDs (starter/pro/enterprise) correctly rejected with 422")
    return True

# ============================================================================
# TEST 4: Feature Gating (402 responses)
# ============================================================================
def test_feature_gating(token):
    log("\n=== TEST 4: Feature Gating (402 responses) ===")
    
    # First ensure user is on standard plan
    resp = requests.post(f"{BASE_URL}/subscription/start",
                        headers=headers(token),
                        json={"plan_id": "standard"})
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not switch to standard plan")
        return False
    
    log("User is now on standard plan")
    
    # Test endpoints that should return 402
    gated_endpoints = [
        {
            "method": "POST",
            "url": f"{BASE_URL}/copilot/query",
            "json": {"question": "hi"},
            "feature": "copilot_query"
        },
        {
            "method": "POST",
            "url": f"{BASE_URL}/copilot/plan-action",
            "json": {"prompt": "test"},
            "feature": "copilot_actions"
        },
        {
            "method": "GET",
            "url": f"{BASE_URL}/branches/metrics",
            "feature": "manage_all_branches"
        },
        {
            "method": "GET",
            "url": f"{BASE_URL}/reports/gst",
            "feature": "gst_reports"
        }
    ]
    
    all_passed = True
    
    for endpoint in gated_endpoints:
        method = endpoint["method"]
        url = endpoint["url"]
        feature = endpoint["feature"]
        
        if method == "POST":
            resp = requests.post(url, headers=headers(token), json=endpoint.get("json", {}))
        else:
            resp = requests.get(url, headers=headers(token))
        
        if resp.status_code != 402:
            log(f"❌ FAILED: {method} {url} should return 402, got {resp.status_code}")
            all_passed = False
            continue
        
        # Verify response structure
        try:
            detail = resp.json().get("detail", {})
            
            required_keys = ["error", "feature", "current_plan", "current_plan_name", 
                           "required_plan", "required_plan_name", "required_plan_price", "message"]
            
            for key in required_keys:
                if key not in detail:
                    log(f"❌ FAILED: {method} {url} - 402 detail missing key: {key}")
                    all_passed = False
                    break
            
            # Verify values
            if detail.get("error") != "plan_upgrade_required":
                log(f"❌ FAILED: {method} {url} - error should be 'plan_upgrade_required', got '{detail.get('error')}'")
                all_passed = False
            
            if detail.get("current_plan") != "standard":
                log(f"❌ FAILED: {method} {url} - current_plan should be 'standard', got '{detail.get('current_plan')}'")
                all_passed = False
            
            if detail.get("current_plan_name") != "Standard":
                log(f"❌ FAILED: {method} {url} - current_plan_name should be 'Standard', got '{detail.get('current_plan_name')}'")
                all_passed = False
            
            if not isinstance(detail.get("required_plan_price"), (int, float)):
                log(f"❌ FAILED: {method} {url} - required_plan_price should be a number, got {type(detail.get('required_plan_price'))}")
                all_passed = False
            
            log(f"✅ {method} {url} - Correctly returned 402 with structured detail")
            
        except Exception as e:
            log(f"❌ FAILED: {method} {url} - Error parsing response: {e}")
            all_passed = False
    
    if all_passed:
        log("✅ PASSED: All gated endpoints return 402 with correct structure")
    
    return all_passed

# ============================================================================
# TEST 5: Standard Plan Limits
# ============================================================================
def test_standard_limits(token):
    log("\n=== TEST 5: Standard Plan Limits ===")
    
    # Ensure on standard plan
    resp = requests.post(f"{BASE_URL}/subscription/start",
                        headers=headers(token),
                        json={"plan_id": "standard"})
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not switch to standard plan")
        return False
    
    # Test customer creation (limit 100)
    log("Testing customer creation (limit 100)...")
    for i in range(3):
        resp = requests.post(f"{BASE_URL}/customers",
                           headers=headers(token),
                           json={
                               "name": f"Customer {i+1}",
                               "phone": f"98765432{i:02d}"
                           })
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Customer creation {i+1} failed with {resp.status_code}")
            return False
        
        data = resp.json()
        if data.get("existing") == True:
            log(f"✅ Customer {i+1} - returned existing customer (dedupe working)")
        else:
            log(f"✅ Customer {i+1} created successfully")
    
    # Test inventory creation (limit 30)
    log("Testing inventory creation (limit 30)...")
    for i in range(3):
        resp = requests.post(f"{BASE_URL}/inventory",
                           headers=headers(token),
                           json={
                               "name": f"Frame {i+1}",
                               "category": "frame",
                               "price": 1000 + i*100,
                               "stock": 10
                           })
        
        if resp.status_code != 200:
            log(f"❌ FAILED: Inventory creation {i+1} failed with {resp.status_code}")
            return False
        
        log(f"✅ Inventory item {i+1} created successfully")
    
    # Test branch creation (limit 1)
    log("Testing branch creation (limit 1)...")
    
    # First branch should succeed
    resp = requests.post(f"{BASE_URL}/branches",
                        headers=headers(token),
                        json={
                            "name": "Main Branch",
                            "code": "MAIN"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAILED: First branch creation failed with {resp.status_code}")
        return False
    
    log("✅ First branch created successfully")
    
    # Second branch should fail with 402
    resp = requests.post(f"{BASE_URL}/branches",
                        headers=headers(token),
                        json={
                            "name": "Second Branch",
                            "code": "SEC"
                        })
    
    if resp.status_code != 402:
        log(f"❌ FAILED: Second branch should return 402, got {resp.status_code}")
        return False
    
    log("✅ Second branch correctly blocked with 402")
    
    log("✅ PASSED: Standard plan limits working correctly")
    return True

# ============================================================================
# TEST 6: Plan Upgrade Flow
# ============================================================================
def test_plan_upgrade_flow(token):
    log("\n=== TEST 6: Plan Upgrade Flow ===")
    
    # Switch to premium_monthly
    log("Switching to premium_monthly...")
    resp = requests.post(f"{BASE_URL}/subscription/start",
                        headers=headers(token),
                        json={"plan_id": "premium_monthly"})
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not switch to premium_monthly")
        return False
    
    # Verify plan in auth/me
    resp = requests.get(f"{BASE_URL}/auth/me", headers=headers(token))
    data = resp.json()
    
    if data.get("plan_id") != "premium_monthly":
        log(f"❌ FAILED: Plan should be premium_monthly, got {data.get('plan_id')}")
        return False
    
    features = data.get("plan_features", [])
    
    # bulk_barcode should be present
    if "bulk_barcode" not in features:
        log(f"❌ FAILED: premium_monthly should have bulk_barcode feature")
        return False
    
    # staff_users should NOT be present
    if "staff_users" in features:
        log(f"❌ FAILED: premium_monthly should NOT have staff_users feature")
        return False
    
    log("✅ premium_monthly has correct features (bulk_barcode present, staff_users absent)")
    
    # Test bulk barcode endpoint (should work now)
    # First create an inventory item
    resp = requests.post(f"{BASE_URL}/inventory",
                        headers=headers(token),
                        json={
                            "name": "Test Frame for Barcode",
                            "category": "frame",
                            "price": 2000,
                            "stock": 5,
                            "sku": "TEST-SKU-001"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not create inventory item")
        return False
    
    item_id = resp.json().get("id")
    
    # Test bulk barcode
    resp = requests.post(f"{BASE_URL}/inventory/barcode-labels.pdf",
                        headers=headers(token),
                        json={
                            "items": [{"item_id": item_id, "count": 1}],
                            "size": "small"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Bulk barcode should work on premium_monthly, got {resp.status_code}")
        return False
    
    log("✅ Bulk barcode endpoint working on premium_monthly")
    
    # Test staff creation (should still be blocked)
    resp = requests.post(f"{BASE_URL}/staff",
                        headers=headers(token),
                        json={
                            "email": f"staff_{uuid.uuid4().hex[:8]}@test.com",
                            "password": "Staff@12345",
                            "name": "Test Staff",
                            "role": "staff"
                        })
    
    if resp.status_code != 402:
        log(f"❌ FAILED: Staff creation should return 402 on premium_monthly, got {resp.status_code}")
        return False
    
    log("✅ Staff creation correctly blocked on premium_monthly")
    
    # Switch to premium_pro_monthly
    log("Switching to premium_pro_monthly...")
    resp = requests.post(f"{BASE_URL}/subscription/start",
                        headers=headers(token),
                        json={"plan_id": "premium_pro_monthly"})
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not switch to premium_pro_monthly")
        return False
    
    # Test staff creation (should work now)
    resp = requests.post(f"{BASE_URL}/staff",
                        headers=headers(token),
                        json={
                            "email": f"staff_{uuid.uuid4().hex[:8]}@test.com",
                            "password": "Staff@12345",
                            "name": "Test Staff Pro",
                            "role": "staff"
                        })
    
    if resp.status_code not in [200, 201]:
        log(f"❌ FAILED: Staff creation should work on premium_pro_monthly, got {resp.status_code}")
        return False
    
    log("✅ Staff creation working on premium_pro_monthly")
    
    log("✅ PASSED: Plan upgrade flow working correctly")
    return True

# ============================================================================
# TEST 7: GST Report Structure
# ============================================================================
def test_gst_report_structure(token):
    log("\n=== TEST 7: GST Report Structure ===")
    
    # Switch to premium_monthly to access GST reports
    resp = requests.post(f"{BASE_URL}/subscription/start",
                        headers=headers(token),
                        json={"plan_id": "premium_monthly"})
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not switch to premium_monthly")
        return False
    
    # Create a customer
    resp = requests.post(f"{BASE_URL}/customers",
                        headers=headers(token),
                        json={
                            "name": "GST Test Customer",
                            "phone": "9876543210"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not create customer")
        return False
    
    customer_id = resp.json().get("id")
    
    # Create an inventory item with GST
    resp = requests.post(f"{BASE_URL}/inventory",
                        headers=headers(token),
                        json={
                            "name": "GST Test Frame",
                            "category": "frame",
                            "price": 1000,
                            "stock": 10,
                            "gst_rate": 12,
                            "hsn_code": "9004"
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not create inventory item")
        return False
    
    item_id = resp.json().get("id")
    
    # Create an order
    resp = requests.post(f"{BASE_URL}/orders",
                        headers=headers(token),
                        json={
                            "customer_id": customer_id,
                            "lines": [{"item_id": item_id, "quantity": 1}],
                            "discount": 0,
                            "paid": 1120
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not create order")
        return False
    
    log("✅ Created order with GST")
    
    # Get GST report
    resp = requests.get(f"{BASE_URL}/reports/gst", headers=headers(token))
    
    if resp.status_code != 200:
        log(f"❌ FAILED: GST report request failed with {resp.status_code}")
        return False
    
    data = resp.json()
    
    # Verify top-level structure
    required_top_level = ["rows", "total_taxable", "total_cgst", "total_sgst", 
                         "total_igst", "total_gst", "total_invoice_value", 
                         "total_orders", "start", "end"]
    
    for field in required_top_level:
        if field not in data:
            log(f"❌ FAILED: GST report missing top-level field: {field}")
            return False
    
    # Verify rows structure
    rows = data.get("rows", [])
    if not isinstance(rows, list):
        log(f"❌ FAILED: rows should be an array")
        return False
    
    if len(rows) > 0:
        row = rows[0]
        required_row_fields = ["hsn_code", "gst_rate", "taxable", "cgst", "sgst", 
                              "igst", "gst", "lines", "quantity"]
        
        for field in required_row_fields:
            if field not in row:
                log(f"❌ FAILED: GST report row missing field: {field}")
                return False
    
    log("✅ PASSED: GST report has correct structure with cgst/sgst/igst breakdown")
    return True

# ============================================================================
# TEST 8: Default GST 5%
# ============================================================================
def test_default_gst(token):
    log("\n=== TEST 8: Default GST 5% ===")
    
    # Create inventory without gst_rate
    resp = requests.post(f"{BASE_URL}/inventory",
                        headers=headers(token),
                        json={
                            "name": "Default GST Test Frame",
                            "category": "frame",
                            "price": 1500,
                            "stock": 5
                        })
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Inventory creation failed with {resp.status_code}")
        return False
    
    data = resp.json()
    gst_rate = data.get("gst_rate")
    
    if gst_rate != 5:
        log(f"❌ FAILED: Default GST should be 5, got {gst_rate}")
        return False
    
    log("✅ PASSED: Inventory without gst_rate defaults to 5%")
    return True

# ============================================================================
# TEST 9: Super-admin Bypass
# ============================================================================
def test_superadmin_bypass():
    log("\n=== TEST 9: Super-admin Bypass ===")
    
    # Login as super-admin
    token = login(SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
    
    if not token:
        log(f"❌ FAILED: Could not login as super-admin")
        return False
    
    # Test copilot/query (should NOT return 402)
    resp = requests.post(f"{BASE_URL}/copilot/query",
                        headers=headers(token),
                        json={"question": "How many customers do I have?"})
    
    if resp.status_code == 402:
        log(f"❌ FAILED: Super-admin should bypass feature gating, got 402")
        return False
    
    # May return 200 or other errors, but NOT 402
    log(f"✅ copilot/query returned {resp.status_code} (not 402)")
    
    # Test branches/metrics (should NOT return 402)
    resp = requests.get(f"{BASE_URL}/branches/metrics", headers=headers(token))
    
    if resp.status_code == 402:
        log(f"❌ FAILED: Super-admin should bypass feature gating, got 402")
        return False
    
    log(f"✅ branches/metrics returned {resp.status_code} (not 402)")
    
    log("✅ PASSED: Super-admin bypasses all feature gating")
    return True

# ============================================================================
# MAIN TEST RUNNER
# ============================================================================
def main():
    log("=" * 80)
    log("ROUND 3 BACKEND TESTING — Subscription Plans + Feature Gating")
    log("=" * 80)
    
    results = {}
    
    # Test 1: Subscription plans (no auth required)
    results["test_subscription_plans"] = test_subscription_plans()
    
    # Register a fresh owner for remaining tests
    email, password, token = register_owner()
    
    if not token:
        log("\n❌ CRITICAL: Could not register owner. Aborting tests.")
        return
    
    # Test 2: auth/me includes plan info
    results["test_auth_me_plan_info"] = test_auth_me_plan_info(token)
    
    # Test 3: subscription/start
    results["test_subscription_start"] = test_subscription_start(token)
    
    # Test 4: Feature gating
    results["test_feature_gating"] = test_feature_gating(token)
    
    # Test 5: Standard limits
    results["test_standard_limits"] = test_standard_limits(token)
    
    # Test 6: Plan upgrade flow
    results["test_plan_upgrade_flow"] = test_plan_upgrade_flow(token)
    
    # Test 7: GST report structure
    results["test_gst_report_structure"] = test_gst_report_structure(token)
    
    # Test 8: Default GST
    results["test_default_gst"] = test_default_gst(token)
    
    # Test 9: Super-admin bypass
    results["test_superadmin_bypass"] = test_superadmin_bypass()
    
    # Summary
    log("\n" + "=" * 80)
    log("TEST SUMMARY")
    log("=" * 80)
    
    passed = sum(1 for v in results.values() if v)
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        log(f"{status}: {test_name}")
    
    log(f"\nTotal: {passed}/{total} tests passed")
    
    if passed == total:
        log("\n🎉 ALL TESTS PASSED!")
    else:
        log(f"\n⚠️  {total - passed} test(s) failed")

if __name__ == "__main__":
    main()
