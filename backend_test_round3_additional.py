#!/usr/bin/env python3
"""
ROUND 3 Additional Tests — Comprehensive Feature Gating Verification
Tests all gated endpoints mentioned in the review request with detailed 402 response validation.
"""
import requests
import json
import uuid
from datetime import datetime

BASE_URL = "https://eyecare-platform-1.preview.emergentagent.com/api"

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
    log(f"✅ Registered owner: {email}")
    return email, password, token

def headers(token):
    return {"Authorization": f"Bearer {token}"}

def test_comprehensive_feature_gating():
    """Test all gated endpoints with standard plan and verify 402 response structure"""
    log("\n=== COMPREHENSIVE FEATURE GATING TEST ===")
    
    email, password, token = register_owner()
    if not token:
        log("❌ FAILED: Could not register owner")
        return False
    
    # Switch to standard plan
    resp = requests.post(f"{BASE_URL}/subscription/start",
                        headers=headers(token),
                        json={"plan_id": "standard"})
    
    if resp.status_code != 200:
        log(f"❌ FAILED: Could not switch to standard plan")
        return False
    
    log("✅ Switched to standard plan")
    
    # Create test data for endpoints that need it
    # Create a customer
    resp = requests.post(f"{BASE_URL}/customers",
                        headers=headers(token),
                        json={"name": "Test Customer", "phone": "9876543210"})
    customer_id = resp.json().get("id") if resp.status_code == 200 else None
    
    # Create an inventory item
    resp = requests.post(f"{BASE_URL}/inventory",
                        headers=headers(token),
                        json={
                            "name": "Test Frame",
                            "category": "frame",
                            "price": 1000,
                            "stock": 5,
                            "sku": "TEST-001"
                        })
    item_id = resp.json().get("id") if resp.status_code == 200 else None
    
    # Create a prescription
    prescription_id = None
    if customer_id:
        resp = requests.post(f"{BASE_URL}/customers/{customer_id}/prescriptions",
                           headers=headers(token),
                           json={
                               "date": "2024-01-15",
                               "rx_type": "distance",
                               "od_sph": -2.5,
                               "notes": "Test prescription"
                           })
        if resp.status_code == 200:
            prescriptions = resp.json()
            if isinstance(prescriptions, list) and len(prescriptions) > 0:
                prescription_id = prescriptions[0].get("id")
    
    log(f"Test data created: customer_id={customer_id}, item_id={item_id}, prescription_id={prescription_id}")
    
    # Define all gated endpoints to test
    gated_tests = [
        {
            "name": "POST /api/copilot/query",
            "method": "POST",
            "url": f"{BASE_URL}/copilot/query",
            "json": {"question": "hi"},
            "feature": "copilot_query",
            "required_plan": "premium_monthly"
        },
        {
            "name": "POST /api/copilot/plan-action",
            "method": "POST",
            "url": f"{BASE_URL}/copilot/plan-action",
            "json": {"prompt": "test"},
            "feature": "copilot_actions",
            "required_plan": "premium_pro_monthly"
        },
        {
            "name": "POST /api/inventory/barcode-labels.pdf",
            "method": "POST",
            "url": f"{BASE_URL}/inventory/barcode-labels.pdf",
            "json": {"items": [{"item_id": item_id, "count": 1}], "size": "small"} if item_id else {"items": [], "size": "small"},
            "feature": "bulk_barcode",
            "required_plan": "premium_monthly"
        },
        {
            "name": "GET /api/branches/metrics",
            "method": "GET",
            "url": f"{BASE_URL}/branches/metrics",
            "feature": "manage_all_branches",
            "required_plan": "premium_pro_monthly"
        },
        {
            "name": "GET /api/reports/gst",
            "method": "GET",
            "url": f"{BASE_URL}/reports/gst",
            "feature": "gst_reports",
            "required_plan": "premium_monthly"
        },
        {
            "name": "POST /api/staff",
            "method": "POST",
            "url": f"{BASE_URL}/staff",
            "json": {
                "email": f"staff_{uuid.uuid4().hex[:8]}@test.com",
                "password": "Staff@12345",
                "name": "Test Staff",
                "role": "staff"
            },
            "feature": "staff_users",
            "required_plan": "premium_pro_monthly"
        }
    ]
    
    # Add prescription PDF test if we have a prescription
    if customer_id and prescription_id:
        gated_tests.append({
            "name": f"GET /api/customers/{customer_id}/prescriptions/{prescription_id}/pdf",
            "method": "GET",
            "url": f"{BASE_URL}/customers/{customer_id}/prescriptions/{prescription_id}/pdf",
            "feature": "prescription_pdf",
            "required_plan": "premium_monthly"
        })
    
    all_passed = True
    
    for test in gated_tests:
        log(f"\nTesting: {test['name']}")
        
        # Make request
        if test["method"] == "POST":
            resp = requests.post(test["url"], headers=headers(token), json=test.get("json", {}))
        else:
            resp = requests.get(test["url"], headers=headers(token))
        
        # Verify 402 status
        if resp.status_code != 402:
            log(f"  ❌ FAILED: Expected 402, got {resp.status_code}")
            log(f"     Response: {resp.text[:200]}")
            all_passed = False
            continue
        
        # Verify response is JSON
        try:
            response_data = resp.json()
        except:
            log(f"  ❌ FAILED: Response is not valid JSON")
            all_passed = False
            continue
        
        # Verify detail is an object (not a string)
        detail = response_data.get("detail")
        if not isinstance(detail, dict):
            log(f"  ❌ FAILED: detail should be an object, got {type(detail)}")
            log(f"     detail: {detail}")
            all_passed = False
            continue
        
        # Verify all required keys
        required_keys = [
            "error", "feature", "current_plan", "current_plan_name",
            "required_plan", "required_plan_name", "required_plan_price", "message"
        ]
        
        missing_keys = [key for key in required_keys if key not in detail]
        if missing_keys:
            log(f"  ❌ FAILED: Missing keys in detail: {missing_keys}")
            log(f"     detail: {json.dumps(detail, indent=2)}")
            all_passed = False
            continue
        
        # Verify specific values
        errors = []
        
        if detail.get("error") != "plan_upgrade_required":
            errors.append(f"error should be 'plan_upgrade_required', got '{detail.get('error')}'")
        
        if detail.get("feature") != test["feature"]:
            errors.append(f"feature should be '{test['feature']}', got '{detail.get('feature')}'")
        
        if detail.get("current_plan") != "standard":
            errors.append(f"current_plan should be 'standard', got '{detail.get('current_plan')}'")
        
        if detail.get("current_plan_name") != "Standard":
            errors.append(f"current_plan_name should be 'Standard', got '{detail.get('current_plan_name')}'")
        
        if not isinstance(detail.get("required_plan_price"), (int, float)):
            errors.append(f"required_plan_price should be a number, got {type(detail.get('required_plan_price'))}")
        
        if not isinstance(detail.get("message"), str) or len(detail.get("message", "")) == 0:
            errors.append(f"message should be a non-empty string")
        
        if errors:
            log(f"  ❌ FAILED: Validation errors:")
            for error in errors:
                log(f"     - {error}")
            log(f"     Full detail: {json.dumps(detail, indent=2)}")
            all_passed = False
        else:
            log(f"  ✅ PASSED: Correct 402 response with all required fields")
            log(f"     feature: {detail.get('feature')}")
            log(f"     required_plan: {detail.get('required_plan')} ({detail.get('required_plan_name')})")
            log(f"     required_plan_price: {detail.get('required_plan_price')}")
    
    return all_passed

def main():
    log("=" * 80)
    log("ROUND 3 ADDITIONAL TESTS — Comprehensive Feature Gating")
    log("=" * 80)
    
    result = test_comprehensive_feature_gating()
    
    log("\n" + "=" * 80)
    if result:
        log("🎉 ALL COMPREHENSIVE FEATURE GATING TESTS PASSED!")
    else:
        log("⚠️  SOME TESTS FAILED")
    log("=" * 80)

if __name__ == "__main__":
    main()
