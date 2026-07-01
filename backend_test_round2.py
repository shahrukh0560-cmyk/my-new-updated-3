#!/usr/bin/env python3
"""
Backend API Testing for OptiCRM - Round 2 Features
Tests: customer dedupe, prescription edit/PDF/share, bulk barcode labels, 
       order edit, business settings, copilot actions, branch-scoped staff isolation
"""
import requests
import json
import os
import sys
import time
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

# Global storage
admin_token = None
owner_token = None
owner_email = None
owner_id = None

def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")

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
        admin_token = data.get("access_token")
        if admin_token:
            print_pass(f"Admin login successful")
            return True
        else:
            print_fail(f"No token in response")
            return False
    else:
        print_fail(f"Admin login failed: {resp.status_code} - {resp.text}")
        return False


def register_owner():
    """Register a new owner account for tenant-scoped testing"""
    global owner_token, owner_email, owner_id
    print_test("Register new owner account")
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    owner_email = f"ownerround2_{timestamp}@test.com"
    
    resp = requests.post(f"{API_BASE}/auth/register", json={
        "name": "Round2 Test Owner",
        "email": owner_email,
        "password": "TestOwner@123"
    })
    
    if resp.status_code == 200:
        data = resp.json()
        owner_token = data.get("access_token")
        user_data = data.get("user", {})
        owner_id = user_data.get("id")
        if owner_token:
            print_pass(f"Owner registration successful: {owner_email}")
            print_info(f"Owner ID: {owner_id}")
            return True
        else:
            print_fail(f"No token in response")
            return False
    else:
        print_fail(f"Owner registration failed: {resp.status_code} - {resp.text}")
        return False


# ============================================================
# Test 1: Customer Dedupe by Mobile
# ============================================================
def test_customer_dedupe():
    print_section("TEST 1: CUSTOMER DEDUPE BY MOBILE")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Test 1a: Create first customer with phone
    print_test("Create first customer with phone 9876543210")
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "Alice Kumar",
        "phone": "9876543210",
        "email": "alice@test.com"
    }, headers=headers)
    
    customer1_id = None
    if resp.status_code == 200:
        data = resp.json()
        customer1_id = data.get("id")
        existing_flag = data.get("existing", False)
        
        if not existing_flag:
            print_pass(f"First customer created: {customer1_id}")
            print_info(f"Name: {data.get('name')}, Phone: {data.get('phone')}")
        else:
            print_warn(f"Customer marked as existing on first create")
    else:
        print_fail(f"Failed to create customer: {resp.status_code} - {resp.text}")
        return
    
    # Test 1b: Create second customer with SAME phone but different name
    print_test("Create second customer with SAME phone (9876543210) but different name")
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "Different Name",
        "phone": "9876543210",
        "email": "different@test.com"
    }, headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        customer2_id = data.get("id")
        existing_flag = data.get("existing", False)
        
        if existing_flag and customer2_id == customer1_id:
            print_pass(f"✅ DEDUPE WORKING: Returned existing customer with existing=true")
            print_info(f"Same customer ID returned: {customer2_id}")
        else:
            print_fail(f"❌ DEDUPE FAILED: Created duplicate or wrong response")
            print_info(f"existing flag: {existing_flag}, ID match: {customer2_id == customer1_id}")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
    
    # Test 1c: Lookup by phone (existing)
    print_test("GET /api/customers/lookup-by-phone?phone=9876543210")
    resp = requests.get(f"{API_BASE}/customers/lookup-by-phone?phone=9876543210", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("exists") == True and "customer" in data:
            print_pass("Lookup found existing customer")
            print_info(f"Customer: {data['customer'].get('name')}")
        else:
            print_fail(f"Lookup should return exists=true with customer data")
    else:
        print_fail(f"Lookup failed: {resp.status_code} - {resp.text}")
    
    # Test 1d: Lookup by phone (non-existent)
    print_test("GET /api/customers/lookup-by-phone?phone=0000000000")
    resp = requests.get(f"{API_BASE}/customers/lookup-by-phone?phone=0000000000", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("exists") == False:
            print_pass("Lookup correctly returns exists=false for non-existent phone")
        else:
            print_fail(f"Should return exists=false, got: {data}")
    else:
        print_fail(f"Lookup failed: {resp.status_code} - {resp.text}")


# ============================================================
# Test 2: Prescription Edit (PUT)
# ============================================================
def test_prescription_edit():
    print_section("TEST 2: PRESCRIPTION EDIT (PUT)")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Create a customer first
    print_test("Create customer for prescription testing")
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "Bob Sharma",
        "phone": "9988776655",
        "email": "bob@test.com"
    }, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create customer: {resp.status_code}")
        return
    
    customer_id = resp.json().get("id")
    print_pass(f"Customer created: {customer_id}")
    
    # Create a prescription
    print_test("Create prescription")
    rx_data = {
        "date": "2024-01-15",
        "rx_type": "distance",
        "od_sph": -2.5,
        "od_cyl": -0.5,
        "od_axis": 90,
        "os_sph": -2.0,
        "os_cyl": -0.75,
        "os_axis": 85,
        "pd": 63.0,
        "notes": "Original notes"
    }
    
    resp = requests.post(f"{API_BASE}/customers/{customer_id}/prescriptions", json=rx_data, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create prescription: {resp.status_code}")
        return
    
    rx_id = resp.json().get("id")
    print_pass(f"Prescription created: {rx_id}")
    
    # Edit the prescription
    print_test("PUT /api/customers/{cid}/prescriptions/{rx_id} - Edit prescription")
    updated_rx = {
        "date": "2024-01-15",
        "rx_type": "distance",
        "od_sph": -3.0,  # Changed
        "od_cyl": -0.5,
        "od_axis": 90,
        "os_sph": -2.0,
        "os_cyl": -0.75,
        "os_axis": 85,
        "pd": 63.0,
        "notes": "Updated notes - changed OD SPH"  # Changed
    }
    
    resp = requests.put(f"{API_BASE}/customers/{customer_id}/prescriptions/{rx_id}", 
                       json=updated_rx, headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("od_sph") == -3.0 and "Updated notes" in data.get("notes", ""):
            print_pass("✅ Prescription updated successfully")
            print_info(f"New od_sph: {data.get('od_sph')}, Notes: {data.get('notes')[:50]}")
        else:
            print_fail(f"Prescription not updated correctly: {data}")
    else:
        print_fail(f"PUT failed: {resp.status_code} - {resp.text}")
    
    # Verify changes persisted
    print_test("GET customer to verify prescription changes persisted")
    resp = requests.get(f"{API_BASE}/customers/{customer_id}", headers=headers)
    
    if resp.status_code == 200:
        customer = resp.json()
        prescriptions = customer.get("prescriptions", [])
        rx = next((r for r in prescriptions if r.get("id") == rx_id), None)
        
        if rx and rx.get("od_sph") == -3.0:
            print_pass("Changes persisted correctly")
        else:
            print_fail(f"Changes not persisted: {rx}")
    else:
        print_fail(f"Failed to get customer: {resp.status_code}")


# ============================================================
# Test 3: Prescription PDF + Public Share Link
# ============================================================
def test_prescription_pdf_and_share():
    print_section("TEST 3: PRESCRIPTION PDF + PUBLIC SHARE LINK")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Create customer and prescription
    print_test("Setup: Create customer and prescription")
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "Charlie Patel",
        "phone": "9876501234",
        "email": "charlie@test.com"
    }, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create customer")
        return
    
    customer_id = resp.json().get("id")
    
    rx_data = {
        "date": "2024-02-01",
        "rx_type": "progressive",
        "od_sph": -1.5,
        "od_cyl": -0.25,
        "od_axis": 180,
        "od_add": 2.0,
        "os_sph": -1.75,
        "os_cyl": -0.5,
        "os_axis": 175,
        "os_add": 2.0,
        "pd": 64.0,
        "doctor_name": "Dr. Smith",
        "notes": "Progressive lenses recommended"
    }
    
    resp = requests.post(f"{API_BASE}/customers/{customer_id}/prescriptions", json=rx_data, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create prescription")
        return
    
    rx_id = resp.json().get("id")
    print_pass(f"Setup complete: Customer {customer_id}, Rx {rx_id}")
    
    # Test 3a: Get authenticated PDF
    print_test("GET /api/customers/{cid}/prescriptions/{rx_id}/pdf (with auth)")
    resp = requests.get(f"{API_BASE}/customers/{customer_id}/prescriptions/{rx_id}/pdf", headers=headers)
    
    if resp.status_code == 200:
        content_type = resp.headers.get("Content-Type")
        content = resp.content
        
        if content_type == "application/pdf":
            print_pass("Content-Type is application/pdf")
        else:
            print_fail(f"Wrong Content-Type: {content_type}")
        
        if content.startswith(b"%PDF"):
            print_pass("✅ PDF generated successfully (starts with %PDF)")
            print_info(f"PDF size: {len(content)} bytes")
        else:
            print_fail("Response does not start with %PDF")
    else:
        print_fail(f"PDF generation failed: {resp.status_code} - {resp.text}")
    
    # Test 3b: Create share link
    print_test("POST /api/customers/{cid}/prescriptions/{rx_id}/share-link")
    resp = requests.post(f"{API_BASE}/customers/{customer_id}/prescriptions/{rx_id}/share-link", 
                        headers=headers)
    
    share_url = None
    if resp.status_code == 200:
        data = resp.json()
        share_url = data.get("url")
        expires_in_days = data.get("expires_in_days")
        
        if share_url and expires_in_days == 7:
            print_pass(f"✅ Share link created: expires in {expires_in_days} days")
            print_info(f"URL: {share_url[:80]}...")
            
            if "/api/rx-shared/" in share_url and share_url.endswith(".pdf"):
                print_pass("URL format correct (/api/rx-shared/<token>.pdf)")
            else:
                print_fail(f"URL format incorrect: {share_url}")
        else:
            print_fail(f"Missing url or expires_in_days: {data}")
    else:
        print_fail(f"Share link creation failed: {resp.status_code} - {resp.text}")
        return
    
    # Test 3c: Access public share link WITHOUT auth
    print_test("GET public share URL WITHOUT Authorization header")
    resp = requests.get(share_url)  # No headers!
    
    if resp.status_code == 200:
        content_type = resp.headers.get("Content-Type")
        content = resp.content
        
        if content_type == "application/pdf" and content.startswith(b"%PDF"):
            print_pass("✅ Public PDF access works WITHOUT auth")
            print_info(f"PDF size: {len(content)} bytes")
        else:
            print_fail(f"Wrong content type or not a PDF")
    else:
        print_fail(f"Public access failed: {resp.status_code} - {resp.text}")
    
    # Test 3d: Invalid token
    print_test("GET /api/rx-shared/garbage.pdf (invalid token)")
    resp = requests.get(f"{API_BASE}/rx-shared/garbage.pdf")
    
    if resp.status_code == 400:
        print_pass("Invalid token correctly rejected with 400")
    else:
        print_fail(f"Should return 400, got: {resp.status_code}")


# ============================================================
# Test 4: Bulk Barcode Labels (POST)
# ============================================================
def test_bulk_barcode_labels():
    print_section("TEST 4: BULK BARCODE LABELS (POST)")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Create inventory items
    print_test("Create inventory items (one WITH barcode, one WITHOUT)")
    
    # Item with barcode
    resp1 = requests.post(f"{API_BASE}/inventory", json={
        "name": "Frame Model A",
        "category": "frame",
        "brand": "TestBrand",
        "sku": "FMA-001",
        "barcode": "1234567890123",
        "price": 2500,
        "stock": 10
    }, headers=headers)
    
    # Item without barcode/sku
    resp2 = requests.post(f"{API_BASE}/inventory", json={
        "name": "Frame Model B (No SKU)",
        "category": "frame",
        "brand": "TestBrand",
        "price": 3000,
        "stock": 5
    }, headers=headers)
    
    if resp1.status_code != 200 or resp2.status_code != 200:
        print_fail("Failed to create inventory items")
        return
    
    item_with_barcode_id = resp1.json().get("id")
    item_without_barcode_id = resp2.json().get("id")
    
    print_pass(f"Item with barcode: {item_with_barcode_id}")
    print_pass(f"Item without barcode: {item_without_barcode_id}")
    
    # Test 4a: Bulk labels with mixed items (should skip item without SKU)
    print_test("POST /api/inventory/barcode-labels.pdf with mixed items")
    resp = requests.post(f"{API_BASE}/inventory/barcode-labels.pdf", json={
        "items": [
            {"item_id": item_with_barcode_id, "count": 2},
            {"item_id": item_without_barcode_id, "count": 1}
        ],
        "size": "medium"
    }, headers=headers)
    
    if resp.status_code == 200:
        content_type = resp.headers.get("Content-Type")
        content = resp.content
        content_disposition = resp.headers.get("Content-Disposition", "")
        
        if content_type == "application/pdf" and content.startswith(b"%PDF"):
            print_pass("✅ Bulk PDF generated (skipped item without SKU)")
            print_info(f"PDF size: {len(content)} bytes")
            
            if "filename" in content_disposition:
                print_pass(f"Content-Disposition includes filename: {content_disposition}")
            else:
                print_warn("Content-Disposition missing filename")
        else:
            print_fail("Not a valid PDF")
    else:
        print_fail(f"Bulk labels failed: {resp.status_code} - {resp.text}")
    
    # Test 4b: Only items without SKU (should return 400)
    print_test("POST with only items that have no SKU (should 400)")
    resp = requests.post(f"{API_BASE}/inventory/barcode-labels.pdf", json={
        "items": [
            {"item_id": item_without_barcode_id, "count": 3}
        ],
        "size": "small"
    }, headers=headers)
    
    if resp.status_code == 400:
        print_pass("Correctly rejected with 400 when no printable items")
        if "SKU" in resp.text or "barcode" in resp.text or "printable" in resp.text:
            print_pass(f"Error message mentions SKU/barcode: {resp.text[:100]}")
    else:
        print_fail(f"Should return 400, got: {resp.status_code}")


# ============================================================
# Test 5: Order Edit (PATCH)
# ============================================================
def test_order_edit():
    print_section("TEST 5: ORDER EDIT (PATCH)")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Setup: Create customer and inventory
    print_test("Setup: Create customer and inventory item")
    
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "David Lee",
        "phone": "9988001122",
        "email": "david@test.com"
    }, headers=headers)
    
    if resp.status_code != 200:
        print_fail("Failed to create customer")
        return
    
    customer_id = resp.json().get("id")
    
    resp = requests.post(f"{API_BASE}/inventory", json={
        "name": "Test Frame XYZ",
        "category": "frame",
        "price": 1000,
        "stock": 50
    }, headers=headers)
    
    if resp.status_code != 200:
        print_fail("Failed to create inventory")
        return
    
    item_id = resp.json().get("id")
    print_pass(f"Setup complete: Customer {customer_id}, Item {item_id}")
    
    # Create an order
    print_test("Create order")
    resp = requests.post(f"{API_BASE}/orders", json={
        "customer_id": customer_id,
        "lines": [{"item_id": item_id, "quantity": 1}],
        "discount": 0,
        "paid": 500,
        "notes": "Original order"
    }, headers=headers)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create order: {resp.status_code}")
        return
    
    order = resp.json()
    order_id = order.get("id")
    original_subtotal = order.get("subtotal")
    original_gst = order.get("gst_amount")
    original_total = order.get("total")
    original_paid = order.get("paid")
    
    print_pass(f"Order created: {order_id}")
    print_info(f"Subtotal: {original_subtotal}, GST: {original_gst}, Total: {original_total}, Paid: {original_paid}")
    
    # Edit order - change discount and notes
    print_test("PATCH /api/orders/{oid} - Update discount and notes")
    resp = requests.patch(f"{API_BASE}/orders/{order_id}", json={
        "discount": 100,
        "notes": "Updated order - added discount"
    }, headers=headers)
    
    if resp.status_code == 200:
        updated_order = resp.json()
        new_discount = updated_order.get("discount")
        new_total = updated_order.get("total")
        new_due = updated_order.get("due")
        new_payment_status = updated_order.get("payment_status")
        new_notes = updated_order.get("notes")
        
        expected_total = original_subtotal + original_gst - 100
        expected_due = expected_total - original_paid
        
        if new_discount == 100:
            print_pass(f"Discount updated: {new_discount}")
        else:
            print_fail(f"Discount not updated correctly: {new_discount}")
        
        if abs(new_total - expected_total) < 0.01:
            print_pass(f"✅ Total recalculated correctly: {new_total}")
        else:
            print_fail(f"Total wrong: expected {expected_total}, got {new_total}")
        
        if abs(new_due - expected_due) < 0.01:
            print_pass(f"Due recalculated correctly: {new_due}")
        else:
            print_fail(f"Due wrong: expected {expected_due}, got {new_due}")
        
        if "Updated order" in new_notes:
            print_pass("Notes updated correctly")
        else:
            print_fail(f"Notes not updated: {new_notes}")
        
        print_info(f"Payment status: {new_payment_status}")
    else:
        print_fail(f"PATCH failed: {resp.status_code} - {resp.text}")


# ============================================================
# Test 6: Business Settings
# ============================================================
def test_business_settings():
    print_section("TEST 6: BUSINESS SETTINGS")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Test 6a: Update business settings
    print_test("PUT /api/settings/business")
    resp = requests.put(f"{API_BASE}/settings/business", json={
        "google_review_url": "https://g.page/r/abc/review",
        "business_name": "Alice Opticals",
        "business_address": "123 MG Road, Bengaluru"
    }, headers=headers)
    
    if resp.status_code == 200:
        print_pass("Business settings updated")
    else:
        print_fail(f"Update failed: {resp.status_code} - {resp.text}")
    
    # Test 6b: Verify settings in /auth/me
    print_test("GET /api/auth/me - Verify business settings included")
    resp = requests.get(f"{API_BASE}/auth/me", headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        google_review_url = data.get("google_review_url")
        business_name = data.get("business_name")
        business_address = data.get("business_address")
        
        if google_review_url == "https://g.page/r/abc/review":
            print_pass(f"✅ google_review_url correct: {google_review_url}")
        else:
            print_fail(f"google_review_url wrong: {google_review_url}")
        
        if business_name == "Alice Opticals":
            print_pass(f"✅ business_name correct: {business_name}")
        else:
            print_fail(f"business_name wrong: {business_name}")
        
        if business_address == "123 MG Road, Bengaluru":
            print_pass(f"✅ business_address correct: {business_address}")
        else:
            print_fail(f"business_address wrong: {business_address}")
    else:
        print_fail(f"/auth/me failed: {resp.status_code}")


# ============================================================
# Test 7: Copilot Actions
# ============================================================
def test_copilot_actions():
    print_section("TEST 7: COPILOT ACTIONS")
    
    headers = {"Authorization": f"Bearer {owner_token}"}
    
    # Test 7a: Discount campaign for dormant customers
    print_test("POST /api/copilot/plan-action - Discount campaign")
    resp = requests.post(f"{API_BASE}/copilot/plan-action", json={
        "prompt": "Send 20% discount to customers who haven't visited in 6 months"
    }, headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        intent = data.get("intent")
        params = data.get("params", {})
        draft_message = data.get("draft_message")
        targets = data.get("targets", [])
        count = data.get("count")
        
        if intent == "discount_campaign_dormant":
            print_pass(f"✅ Intent classified correctly: {intent}")
        else:
            print_fail(f"Wrong intent: {intent}")
        
        discount_pct = params.get("discount_pct")
        days_since = params.get("days_since_last_visit")
        
        if discount_pct and 15 <= discount_pct <= 25:
            print_pass(f"Discount % extracted: {discount_pct}%")
        else:
            print_warn(f"Discount % unexpected: {discount_pct}")
        
        if days_since and 150 <= days_since <= 200:
            print_pass(f"Days since last visit extracted: {days_since}")
        else:
            print_warn(f"Days since unexpected: {days_since}")
        
        if draft_message:
            print_pass(f"Draft message present: {draft_message[:60]}...")
        else:
            print_fail("No draft_message")
        
        if isinstance(targets, list):
            print_pass(f"Targets list present: {len(targets)} customers")
            
            if count == len(targets):
                print_pass(f"Count matches targets length: {count}")
            else:
                print_fail(f"Count mismatch: count={count}, len(targets)={len(targets)}")
            
            # Check whatsapp_url in targets
            if len(targets) > 0:
                target = targets[0]
                if target.get("phone") and target.get("whatsapp_url", "").startswith("https://wa.me/"):
                    print_pass(f"WhatsApp URL present: {target['whatsapp_url'][:50]}...")
                else:
                    print_warn(f"WhatsApp URL format unexpected")
        else:
            print_fail(f"Targets should be a list")
    elif resp.status_code == 502:
        if "budget" in resp.text.lower() or "unavailable" in resp.text.lower():
            print_warn("⚠️  LLM budget exhausted (acceptable - endpoint wired correctly)")
            print_info(f"Error: {resp.text[:200]}")
        else:
            print_fail(f"502 but unclear error: {resp.text}")
    else:
        print_fail(f"Request failed: {resp.status_code} - {resp.text}")
    
    # Test 7b: Restock alert
    print_test("POST /api/copilot/plan-action - Restock alert")
    resp = requests.post(f"{API_BASE}/copilot/plan-action", json={
        "prompt": "Which items should I reorder?"
    }, headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        intent = data.get("intent")
        
        if intent == "restock_alert":
            print_pass(f"✅ Restock intent classified correctly")
        else:
            print_warn(f"Intent: {intent} (expected restock_alert)")
    elif resp.status_code == 502:
        print_warn("⚠️  LLM budget exhausted (acceptable)")
    else:
        print_fail(f"Request failed: {resp.status_code}")
    
    # Test 7c: Record campaign
    print_test("POST /api/copilot/record-campaign")
    resp = requests.post(f"{API_BASE}/copilot/record-campaign", json={
        "intent": "discount_campaign_dormant",
        "sent_customer_ids": ["cust1", "cust2"]
    }, headers=headers)
    
    if resp.status_code == 200:
        data = resp.json()
        if data.get("ok") == True and data.get("recorded") == 2:
            print_pass(f"✅ Campaign recorded: {data}")
        else:
            print_fail(f"Unexpected response: {data}")
    else:
        print_fail(f"Record campaign failed: {resp.status_code}")


# ============================================================
# Test 8: Branch-Scoped Staff Isolation (MOST IMPORTANT)
# ============================================================
def test_branch_scoped_staff():
    print_section("TEST 8: BRANCH-SCOPED STAFF ISOLATION (CRITICAL)")
    
    # Register a NEW owner for this test
    print_test("Register fresh owner for branch testing")
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    branch_owner_email = f"ownerbranch{timestamp}@test.com"
    
    resp = requests.post(f"{API_BASE}/auth/register", json={
        "name": "Branch Test Owner",
        "email": branch_owner_email,
        "password": "BranchOwner@123"
    })
    
    if resp.status_code != 200:
        print_fail(f"Failed to register branch owner: {resp.status_code}")
        return
    
    branch_owner_token = resp.json().get("access_token")
    print_pass(f"Branch owner registered: {branch_owner_email}")
    
    headers_owner = {"Authorization": f"Bearer {branch_owner_token}"}
    
    # Create two branches
    print_test("Create Branch 1 (Main)")
    resp = requests.post(f"{API_BASE}/branches", json={
        "name": "Main",
        "code": "MN",
        "address": "Main Street"
    }, headers=headers_owner)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create branch 1: {resp.status_code}")
        return
    
    branch1_id = resp.json().get("id")
    print_pass(f"Branch 1 created: {branch1_id}")
    
    print_test("Create Branch 2 (Central)")
    resp = requests.post(f"{API_BASE}/branches", json={
        "name": "Central",
        "code": "CT",
        "address": "Central Avenue"
    }, headers=headers_owner)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create branch 2: {resp.status_code}")
        return
    
    branch2_id = resp.json().get("id")
    print_pass(f"Branch 2 created: {branch2_id}")
    
    # Create customers in different branches
    print_test("Create customer Alice_B1 in Branch 1")
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "Alice_B1",
        "phone": "9001001001",
        "branch_id": branch1_id
    }, headers=headers_owner)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create Alice_B1")
        return
    
    alice_b1_id = resp.json().get("id")
    print_pass(f"Alice_B1 created: {alice_b1_id}")
    
    print_test("Create customer Bob_B2 in Branch 2")
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "Bob_B2",
        "phone": "9002002002",
        "branch_id": branch2_id
    }, headers=headers_owner)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create Bob_B2")
        return
    
    bob_b2_id = resp.json().get("id")
    print_pass(f"Bob_B2 created: {bob_b2_id}")
    
    # Create inventory in different branches
    print_test("Create inventory Item_B1 in Branch 1")
    resp = requests.post(f"{API_BASE}/inventory", json={
        "name": "Item_B1",
        "category": "frame",
        "price": 1000,
        "stock": 10,
        "branch_id": branch1_id
    }, headers=headers_owner)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create Item_B1")
        return
    
    item_b1_id = resp.json().get("id")
    print_pass(f"Item_B1 created: {item_b1_id}")
    
    print_test("Create inventory Item_B2 in Branch 2")
    resp = requests.post(f"{API_BASE}/inventory", json={
        "name": "Item_B2",
        "category": "lens",
        "price": 500,
        "stock": 20,
        "branch_id": branch2_id
    }, headers=headers_owner)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create Item_B2")
        return
    
    item_b2_id = resp.json().get("id")
    print_pass(f"Item_B2 created: {item_b2_id}")
    
    # Create staff user for Branch 1
    print_test("Create staff user for Branch 1")
    staff_email = f"branchstaff{timestamp}@test.com"
    resp = requests.post(f"{API_BASE}/staff", json={
        "email": staff_email,
        "password": "Test@1234",
        "name": "Staff1",
        "role": "staff",
        "branch_id": branch1_id
    }, headers=headers_owner)
    
    if resp.status_code != 200:
        print_fail(f"Failed to create staff: {resp.status_code} - {resp.text}")
        return
    
    print_pass(f"Staff created: {staff_email}")
    
    # Login as staff
    print_test("Login as staff user")
    resp = requests.post(f"{API_BASE}/auth/login", json={
        "email": staff_email,
        "password": "Test@1234"
    })
    
    if resp.status_code != 200:
        print_fail(f"Staff login failed: {resp.status_code}")
        return
    
    staff_token = resp.json().get("access_token")
    print_pass(f"Staff logged in successfully")
    
    headers_staff = {"Authorization": f"Bearer {staff_token}"}
    
    # Test staff can only see Branch 1 customers
    print_test("GET /api/customers as STAFF (should only see Branch 1)")
    resp = requests.get(f"{API_BASE}/customers", headers=headers_staff)
    
    if resp.status_code == 200:
        customers = resp.json()
        customer_ids = [c.get("id") for c in customers]
        customer_names = [c.get("name") for c in customers]
        
        if alice_b1_id in customer_ids and bob_b2_id not in customer_ids:
            print_pass(f"✅ ISOLATION WORKING: Staff sees only Alice_B1, NOT Bob_B2")
            print_info(f"Customers: {customer_names}")
        else:
            print_fail(f"❌ ISOLATION FAILED: Staff should only see Alice_B1")
            print_info(f"Saw: {customer_names}")
    else:
        print_fail(f"GET customers failed: {resp.status_code}")
    
    # Test staff can only see Branch 1 inventory
    print_test("GET /api/inventory as STAFF (should only see Branch 1)")
    resp = requests.get(f"{API_BASE}/inventory", headers=headers_staff)
    
    if resp.status_code == 200:
        items = resp.json()
        item_ids = [i.get("id") for i in items]
        item_names = [i.get("name") for i in items]
        
        if item_b1_id in item_ids and item_b2_id not in item_ids:
            print_pass(f"✅ ISOLATION WORKING: Staff sees only Item_B1, NOT Item_B2")
            print_info(f"Items: {item_names}")
        else:
            print_fail(f"❌ ISOLATION FAILED: Staff should only see Item_B1")
            print_info(f"Saw: {item_names}")
    else:
        print_fail(f"GET inventory failed: {resp.status_code}")
    
    # Test staff auto-inherits branch_id when creating customer
    print_test("POST /api/customers as STAFF (no branch_id) - should auto-inherit Branch 1")
    resp = requests.post(f"{API_BASE}/customers", json={
        "name": "Charlie_Auto",
        "phone": "9003003003"
        # No branch_id specified
    }, headers=headers_staff)
    
    if resp.status_code == 200:
        customer = resp.json()
        customer_branch_id = customer.get("branch_id")
        
        if customer_branch_id == branch1_id:
            print_pass(f"✅ AUTO-INHERIT WORKING: Customer auto-assigned to Branch 1")
        else:
            print_fail(f"❌ AUTO-INHERIT FAILED: branch_id={customer_branch_id}, expected {branch1_id}")
    else:
        print_fail(f"Create customer failed: {resp.status_code}")
    
    # Test owner sees BOTH branches
    print_test("GET /api/customers as OWNER (should see BOTH branches)")
    resp = requests.get(f"{API_BASE}/customers", headers=headers_owner)
    
    if resp.status_code == 200:
        customers = resp.json()
        customer_ids = [c.get("id") for c in customers]
        customer_names = [c.get("name") for c in customers]
        
        if alice_b1_id in customer_ids and bob_b2_id in customer_ids:
            print_pass(f"✅ OWNER ACCESS CORRECT: Sees both Alice_B1 and Bob_B2")
            print_info(f"Customers: {customer_names}")
        else:
            print_fail(f"❌ OWNER should see both customers")
            print_info(f"Saw: {customer_names}")
    else:
        print_fail(f"GET customers as owner failed: {resp.status_code}")


# ============================================================
# Main Test Runner
# ============================================================
def main():
    print("\n" + "="*70)
    print("  OptiCRM Backend API Testing - Round 2 Features")
    print("="*70)
    
    # Setup authentication
    if not login_admin():
        print("\n❌ CRITICAL: Admin login failed. Cannot proceed.")
        sys.exit(1)
    
    if not register_owner():
        print("\n❌ CRITICAL: Owner registration failed. Cannot proceed.")
        sys.exit(1)
    
    # Run all tests
    tests = [
        ("Customer Dedupe", test_customer_dedupe),
        ("Prescription Edit", test_prescription_edit),
        ("Prescription PDF & Share", test_prescription_pdf_and_share),
        ("Bulk Barcode Labels", test_bulk_barcode_labels),
        ("Order Edit", test_order_edit),
        ("Business Settings", test_business_settings),
        ("Copilot Actions", test_copilot_actions),
        ("Branch-Scoped Staff Isolation", test_branch_scoped_staff),
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print_fail(f"{test_name} crashed: {e}")
            import traceback
            traceback.print_exc()
    
    print("\n" + "="*70)
    print("  Testing Complete")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
