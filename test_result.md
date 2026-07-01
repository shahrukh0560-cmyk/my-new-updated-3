#====================================================================================================
# START - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================

# THIS SECTION CONTAINS CRITICAL TESTING INSTRUCTIONS FOR BOTH AGENTS
# BOTH MAIN_AGENT AND TESTING_AGENT MUST PRESERVE THIS ENTIRE BLOCK

# Communication Protocol:
# If the `testing_agent` is available, main agent should delegate all testing tasks to it.
#
# You have access to a file called `test_result.md`. This file contains the complete testing state
# and history, and is the primary means of communication between main and the testing agent.
#
# Main and testing agents must follow this exact format to maintain testing data. 
# The testing data must be entered in yaml format Below is the data structure:
# 
## user_problem_statement: {problem_statement}
## backend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.py"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## frontend:
##   - task: "Task name"
##     implemented: true
##     working: true  # or false or "NA"
##     file: "file_path.js"
##     stuck_count: 0
##     priority: "high"  # or "medium" or "low"
##     needs_retesting: false
##     status_history:
##         -working: true  # or false or "NA"
##         -agent: "main"  # or "testing" or "user"
##         -comment: "Detailed comment about status"
##
## metadata:
##   created_by: "main_agent"
##   version: "1.0"
##   test_sequence: 0
##   run_ui: false
##
## test_plan:
##   current_focus:
##     - "Task name 1"
##     - "Task name 2"
##   stuck_tasks:
##     - "Task name with persistent issues"
##   test_all: false
##   test_priority: "high_first"  # or "sequential" or "stuck_first"
##
## agent_communication:
##     -agent: "main"  # or "testing" or "user"
##     -message: "Communication message between agents"

# Protocol Guidelines for Main agent
#
# 1. Update Test Result File Before Testing:
#    - Main agent must always update the `test_result.md` file before calling the testing agent
#    - Add implementation details to the status_history
#    - Set `needs_retesting` to true for tasks that need testing
#    - Update the `test_plan` section to guide testing priorities
#    - Add a message to `agent_communication` explaining what you've done
#
# 2. Incorporate User Feedback:
#    - When a user provides feedback that something is or isn't working, add this information to the relevant task's status_history
#    - Update the working status based on user feedback
#    - If a user reports an issue with a task that was marked as working, increment the stuck_count
#    - Whenever user reports issue in the app, if we have testing agent and task_result.md file so find the appropriate task for that and append in status_history of that task to contain the user concern and problem as well 
#
# 3. Track Stuck Tasks:
#    - Monitor which tasks have high stuck_count values or where you are fixing same issue again and again, analyze that when you read task_result.md
#    - For persistent issues, use websearch tool to find solutions
#    - Pay special attention to tasks in the stuck_tasks list
#    - When you fix an issue with a stuck task, don't reset the stuck_count until the testing agent confirms it's working
#
# 4. Provide Context to Testing Agent:
#    - When calling the testing agent, provide clear instructions about:
#      - Which tasks need testing (reference the test_plan)
#      - Any authentication details or configuration needed
#      - Specific test scenarios to focus on
#      - Any known issues or edge cases to verify
#
# 5. Call the testing agent with specific instructions referring to test_result.md
#
# IMPORTANT: Main agent must ALWAYS update test_result.md BEFORE calling the testing agent, as it relies on this file to understand what to test next.

#====================================================================================================
# END - Testing Protocol - DO NOT EDIT OR REMOVE THIS SECTION
#====================================================================================================



#====================================================================================================
# Testing Data - Main Agent and testing sub agent both should log testing data below this section
#====================================================================================================

user_problem_statement: |
  Import GitHub repo (edit-new-one) — an OptiCRM (Expo + FastAPI) app — and add these features:
  1. Remove demo login/password shown on login page
  2. Share order summary + prescription on WhatsApp (via wa.me deep link)
  3. AI Sales Copilot — natural-language queries over shop data (Emergent LLM key)
  4. Referral / Share App program (earn credits when others sign up)
  5. Manage All Branches — per-branch aggregated data (customers, orders, revenue, low stock)
  6. Barcode label printing — auto SKU labels for inventory items (Code128 PDF)

backend:
  - task: "Branch metrics endpoint (/api/branches/metrics)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added GET /api/branches/metrics returning per-branch customers/inventory/low_stock/orders_30d/revenue_30d/revenue_lifetime/unpaid_due, plus optional Unassigned row when data has no branch."
      - working: true
        agent: "testing"
        comment: "✅ PASSED all tests. Auth required (403 without token). Returns JSON array with all required fields (branch_id, name, code, customers, inventory, low_stock, orders_30d, revenue_30d, revenue_lifetime, unpaid_due). Fresh owner returns empty list. All data types correct."

  - task: "Barcode label PDF (/api/inventory/{id}/barcode-label.pdf)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added Code128 PDF label generator via ReportLab. Query params: count (1-100), size (small/medium/large). Uses barcode OR sku OR id as encoded value. Returns application/pdf. Manual curl smoke test passed (PDF header %PDF-1.3, 3KB payload)."
      - working: true
        agent: "testing"
        comment: "✅ PASSED. Generates valid PDF (starts with %PDF, correct Content-Type). Tested count=1,3,200 (clamped to 100) and size=small/medium/large. Returns 404 for non-existent item. Minor: Uses item ID as fallback when no SKU/barcode (returns 200 instead of 400), which is reasonable behavior though spec expected 400 error."

  - task: "Referral share endpoints (/api/referrals/my-code and /api/referrals/record-share)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "GET /api/referrals/my-code returns/lazy-creates unique code per user with share_url, share_message and pre-built whatsapp_url. POST /api/referrals/record-share increments channel counters. Manual curl smoke test passed."
      - working: true
        agent: "testing"
        comment: "✅ PASSED all tests. GET /api/referrals/my-code: Creates unique uppercase alphanumeric code, returns all required fields (code, share_url, share_message, whatsapp_url, shares, signups). Idempotent (same code on repeated calls). Different users get different codes. POST /api/referrals/record-share: Increments share counter correctly, validates channel (rejects invalid channels with 422)."

  - task: "AI Sales Copilot (/api/copilot/query)"
    implemented: true
    working: true
    file: "backend/server.py"
    stuck_count: 0
    priority: "high"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "POST /api/copilot/query builds a JSON snapshot of tenant data (top sellers 30d, dormant customers 180d+, revenue/orders totals, low stock) and sends it to Emergent Gemini 2.5 Flash with the question. Returns friendly answer. NOTE: On this environment the Emergent LLM key returns 'Budget has been exceeded! Max budget: 0.0' — endpoint wiring is correct and returns 502 with friendly message. User must top up their Emergent LLM balance to use."
      - working: true
        agent: "testing"
        comment: "✅ PASSED. Endpoint fully functional and wired correctly. Tested with 'How many customers do I have?' - returned 200 with proper answer ('You have 0 customers'). LLM integration working (Emergent LLM key has budget and returned valid response). Returns proper JSON with ok, answer, session_id, and snapshot_summary fields."

frontend:
  - task: "Remove demo credentials from login screen"
    implemented: true
    working: "NA"
    file: "frontend/app/login.tsx"
    stuck_count: 0
    priority: "medium"
    needs_retesting: false
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Cleared pre-filled email/password state and removed hint line 'Demo: superadmin@opticrm.com / SuperAdmin@2026'."

  - task: "WhatsApp share (order summary + prescription)"
    implemented: true
    working: "NA"
    file: "frontend/src/utils/whatsapp.ts, frontend/app/order/[id].tsx, frontend/app/customer/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added whatsapp.ts with openWhatsApp(), orderSummaryMessage(), prescriptionMessage(). Order detail has WhatsApp icon in header; each Rx card has a green 'Send on WhatsApp' pill. On web opens wa.me in new tab, on native uses Linking."

  - task: "Barcode label print (inventory detail)"
    implemented: true
    working: "NA"
    file: "frontend/app/inventory/[id].tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Added 'Print Barcode Labels' card with size (small/medium/large) + count. On web opens PDF in new tab and auto-triggers print; on native downloads."

  - task: "Manage All Branches data screen (/branches-data)"
    implemented: true
    working: "NA"
    file: "frontend/app/branches-data.tsx, frontend/app/(tabs)/more.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "New screen with combined-total hero card + per-branch mini cards (customers, inventory, low_stock, orders 30d, revenue 30d/lifetime, unpaid due). Added tile in More tab (admin-only)."

  - task: "AI Sales Copilot screen (/copilot)"
    implemented: true
    working: "NA"
    file: "frontend/app/copilot.tsx, frontend/app/(tabs)/more.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Chat-style UI with suggestion pills (progressive lenses, dormant customers, revenue). Sends to POST /api/copilot/query. Handles friendly errors when LLM budget is exhausted."

  - task: "Referral / Share App screen (/share-app)"
    implemented: true
    working: "NA"
    file: "frontend/app/share-app.tsx, frontend/app/(tabs)/more.tsx"
    stuck_count: 0
    priority: "high"
    needs_retesting: true
    status_history:
      - working: "NA"
        agent: "main"
        comment: "Displays user's referral code (from GET /api/referrals/my-code) with share_url + share_message. Buttons: WhatsApp share, System share (Web Share API / RN Share), Copy link, Copy message. Records analytics via POST /api/referrals/record-share."

metadata:
  created_by: "main_agent"
  version: "1.0"
  test_sequence: 1
  run_ui: false

test_plan:
  current_focus: []
  stuck_tasks: []
  test_all: false
  test_priority: "high_first"

agent_communication:
  - agent: "main"
    message: |
      Added 4 new backend endpoints (branch metrics, barcode label PDF, referral my-code & record-share, AI copilot query) and 3 new frontend screens (branches-data, copilot, share-app) plus WhatsApp share on orders and prescriptions and Print Barcode Labels on inventory detail. Please backend-test the 4 endpoints only. Credentials in /app/memory/test_credentials.md (admin@opticrm.io / Admin@12345). Note: the Copilot endpoint depends on Emergent LLM key balance — in this env the key returned 'Budget exceeded' so the endpoint returns 502; that's expected and correctly handled. Verify: (1) branches/metrics returns proper structure with owner login and per-branch aggregation; (2) barcode-label.pdf returns real PDF for a valid inventory item and 404 for a missing/no-SKU item; (3) referrals/my-code creates a code + share_url + share_message + whatsapp_url and returns same code on repeated calls; (4) record-share increments counters.
  - agent: "testing"
    message: |
      ✅ Backend testing COMPLETE. All 4 endpoints PASSED:
      1. GET /api/branches/metrics - Working perfectly (auth, structure, data types)
      2. GET /api/inventory/{id}/barcode-label.pdf - Working (generates valid PDFs, handles count/size params, 404 for missing items). Minor: uses item ID as fallback instead of returning 400 when no SKU/barcode.
      3. GET /api/referrals/my-code + POST /api/referrals/record-share - Working perfectly (unique codes, idempotency, counter increments, validation)
      4. POST /api/copilot/query - Working perfectly (LLM integration functional, returns proper answers)
      
      Note: Copilot endpoint is fully functional - the LLM key has budget and returned valid responses. Main agent's note about budget exceeded was outdated.
      
      Test credentials note: /app/memory/test_credentials.md had incorrect email (admin@opticrm.local) - correct is admin@opticrm.io from backend/.env.

