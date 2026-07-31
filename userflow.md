# MAHARASHTRA GR-Align - Features & Testing Userflow Guide

This document maps out the end-to-end userflows for testing all drafting, verification, compliance auditing, and role-based features inside the **MAHARASHTRA GR-Align** platform.

---

## 🎭 Userflow 1: Role Swapping & Dynamic UI Themes

### Intent
Verify that switching roles updates the available actions, restricts navigation, redirects pages logically, and provides clear visual themes to prevent cognitive strain.

### Steps
1. Open the application in your browser (`http://localhost:5173`).
2. Locating the **User Dropdown** in the top right corner of the header:
   - Select **Clerk: John Doe (Desk Officer)**.
     - *Visual Theme*: Header transitions to a Cobalt Blue gradient with Saffron border/badges.
     - *Actions*: "Create GR" is visible in the sidebar.
3. Click on **Create GR** in the sidebar.
4. While on the `/create` page, open the dropdown and select **Senior Officer: Officer Deshmukh**.
   - *Visual Theme*: Header transitions to a dark Slate/Charcoal gradient with a light gray badge.
   - *Behavior*: You are automatically redirected to the **Executive Review** page (`/approve/pending`). The "Create GR" sidebar navigation disappears and is replaced by "Executive Review".
5. Change the role to **Minister: Hon. Minister Patil**.
   - *Visual Theme*: Header transitions to a deep Emerald Green gradient with an Amber/Gold badge.
   - *Behavior*: You remain on the **Executive Review** page with permission to execute final signatures.
6. Switch back to **Clerk**.
   - *Behavior*: You are automatically returned to the **Create GR** page (`/create`).

---

## 💾 Userflow 2: Zero-Loss Draft Progress (localStorage Cache)

### Intent
Confirm that the desk officer's typed draft is never lost when navigating away or switching roles.

### Steps
1. Under **Clerk** mode, navigate to **Create GR**.
2. Fill in the following fields:
   - Department: `Higher and Technical Education Department`
   - Trigger / Incident: `Urgent need for rural polytechnic teachers`
   - Targeted Action: `Establish new training institute in Wardha`
3. Click **Next: Select GR Archetype**.
4. In the role dropdown, switch to **Senior Officer**.
   - *Behavior*: You are automatically redirected to `/approve/pending`.
5. Switch back to **Clerk**.
   - *Behavior*: You are redirected back to `/create`.
6. **Expected Outcome**: Inspect the form fields. The department, trigger text, targeted action, and step position (Step 2) are fully restored from cache.

---

## ⏳ Userflow 3: Stepped Progress Loading Indicator (HCI Concept)

### Intent
Verify that both the document generation and submission processes display step-by-step progress status in a locked fullscreen overlay to manage user expectations.

### Steps
1. Navigate to **Create GR** as a Clerk.
2. Complete Step 1:
   - *Trigger / Incident*: `High vacancy rate in district veterinary clinics`
   - *Targeted Action*: `Appoint 20 medical assistants on temporary contracts`
3. Click **Next: Select GR Archetype**.
4. Select **💼 3. HR / Establishment**.
5. Click **🚀 Generate Government Resolution (GR)**.
6. **Expected Outcome**:
   - The screen is locked by a dark, blurred overlay.
   - A rotating saffron-green wheel containing a pulsing **Maharashtra Government Rajmudra Emblem** is centered.
   - Stepped checklists turn from circles `○` to active `⚡` to green checks `✅` as the system:
     1. Connects to the engine.
     2. Scans 98,980 historical precursor GRs.
     3. Audits budget heads and statutory jurisdictions.
     4. Compiles the official bilingual drafts.
7. Once loaded inside the **Draft Workspace**, edit any section and click **Submit for Review** in the header.
8. **Expected Outcome**:
   - A dark submission overlay locks the screen with the pulsing Rajmudra emblem.
   - The checklist walks through security sealing, checksum generation, departmental database updates, and E-Gazette queue dispatch.

---

## 🚨 Userflow 4: Multi-Domain Compliance Audits (Workspace Verification)

### Test Case A: Financial Sanction Ceiling Overrun
1. Under **Clerk** mode, go to **Create GR**.
2. Complete Step 1 (Trigger: `Land acquisition for Metro`, Action: `Sanction emergency tranche`).
3. Proceed to Step 2, select **💰 1. Financial Sanction**.
4. Enter:
   - Precise Amount (INR): `70000000` (₹7 Crores - exceeds the ₹4 Crore Finance Ceiling Cap!)
   - Budget Head: `2202-01-101-01-03`
5. Click **Generate GR**.
6. **Expected Outcome**:
   - A critical red banner is displayed: **🚨 TASK A: POLICY & CONFLICT AUDITING ALERT**.
   - Warning reads: "Proposed amount of 7.00 Crores exceeds maximum threshold of 4.00 Crores set by Finance regulation 'FIN-2024-CR12'."
   - A 21-digit GR ID is assigned (e.g. starting with `20260728...`).

### Test Case B: Cross-Department Scheme Overlap
1. Navigate to **Create GR**.
2. Choose **Higher and Technical Education Department**.
3. Under Trigger, enter: `Need for rural student skill upgrades`.
4. Proceed to Step 2, select **📜 2. Policy / Scheme**.
5. Input:
   - Scheme Name: `Mukhyamantri Yuva Karya`
6. Click **Generate GR**.
7. **Expected Outcome**:
   - The right-hand warnings column shows a **⚠️ Policy Conflict** alert.
   - Text reads: "Inter-Departmental Scheme Overlap: Scheme/Policy mandate in 'Higher and Technical Education Department' overlaps with existing scheme in 'Skill Development and Entrepreneurship Department' (Ref: Mukhyamantri Yuva Karya Prashikshan Yojana)."
   - Includes a clickable link: `🔗 View Conflicting GR (202203171257316505)`.

### Test Case C: Cross-Department Budget Head Mismatch
1. Navigate to **Create GR**.
2. Choose **Housing Department** in the Global Header.
3. Proceed to Step 2, select **💰 1. Financial Sanction**.
4. Input:
   - Amount: `500000`
   - Budget Head: `2202-01-101-01-03` (*Note: 2202 is General Education sector*)
5. Click **Generate GR**.
6. **Expected Outcome**:
   - The Workspace flags a **⚠️ Policy Conflict** warning.
   - Text reads: "Cross-Department Budget Head Mismatch: Budget Major Head 2202 belongs to 'School Education and Sports Department' sector, not 'Housing Department'."
   - Includes a clickable link: `🔗 View Conflicting GR (202102021510117305)`.

### Test Case D: Statutory Jurisdiction Overlap
1. Navigate to **Create GR**.
2. Choose **Finance Department** in the Global Header.
3. Proceed to Step 2, select **⚖️ 4. Statutory Notification**.
4. Input:
   - Parent Act Invoked: `Section 25 of the Negotiable Instruments Act, 1881`
5. Click **Generate GR**.
6. **Expected Outcome**:
   - Workspace flags a **⚠️ Policy Conflict** warning.
   - Text reads: "Statutory Jurisdiction Overlap: Cited Act 'Negotiable Instruments Act' was previously invoked by and belongs to jurisdiction of 'General Administration Department'."
   - Includes a clickable link: `🔗 View Conflicting GR (202101141237329905)`.

### Test Case E: Emergency Outbreak Doctor Appointment (HR & Custom Rules)
1. Navigate to **Create GR**.
2. **Global Header (Step 1A):**
   - Department: `Public Health Department`
   - Signee: `Under Secretary to Government of Maharashtra`
3. **Preamble Micro-Inputs (Step 1B):**
   - *Trigger / Incident*: `Severe dengue and malaria outbreak in Thane district`
   - *Reference File/Letter*: `Letter No. PHD-2026/OUTBREAK-99`
   - *Targeted Action*: `Appoint medical officers on contract to reinforce rural clinics`
4. Click **Next: Select GR Archetype**.
5. Select Archetype **💼 3. HR / Establishment**.
6. Enter inputs:
   - Employee Names and Cadres: `Dr. Amit Shah (M.B.B.S, Cadre-A), Dr. Sneha Patil (M.D, Cadre-A)`
   - Current Posting: `Resident Medical Officers, Thane Civil Hospital`
   - New Posting: `Temporary Emergency Medical Officers, Rural Sub-Centers (Mumbra & Kalwa)`
   - Effective Date: `Immediate (तात्काळ)`
7. Under **Dynamic Flex-Fields**, click **➕ Add Custom Rule**:
   - *Rule 1 Category*: `Emergency Duty Joining Window`
   - *Rule 1 Condition*: `All appointed medical officers must report to duty within 24 hours of notification due to active epidemic outbreak.`
8. Click **➕ Add Custom Rule again**:
   - *Rule 2 Category*: `MMC Registration Verification`
   - *Rule 2 Condition*: `Subject to verification of active Maharashtra Medical Council registration status.`
9. Click **🚀 Generate Government Resolution (GR)**.
10. **Expected Outcome**:
    - The generated GR draft preserves formatting (newlines) and renders full section text.
    - Under the **Resolution (शासन निर्णय)** card, the custom flex-field rules appear as formatted numbered clauses (*३. सर्व नियुक्त वैद्यकीय अधिकाऱ्यांनी तात्काळ २४ तासांच्या आत कर्तव्यावर रुजू व्हावे...* and *४. महाराष्ट्र वैद्यकीय परिषदेकडे नोंदणीची पडताळणी बंधनकारक राहील...*).

### Test Case F: Fully Compliant Draft (No Compliance Alerts)
1. Navigate to **Create GR**.
2. **Global Header (Step 1A):**
   - Department: `School Education and Sports Department`
   - Signee: `Under Secretary to Government of Maharashtra`
3. **Preamble Micro-Inputs (Step 1B):**
   - *Trigger / Incident*: `Routine maintenance and upgrades for rural playgrounds`
   - *Reference File/Letter*: `Letter No. EDU-2026/PLAY-05`
   - *Targeted Action*: `Approve administrative sanction for playground equipment purchase`
4. Click **Next: Select GR Archetype**.
5. Select Archetype **💰 1. Financial Sanction**.
6. Enter inputs:
   - Precise Amount (INR): `1500000` (₹15 Lakhs - *Well within the ₹4 Crore Finance Ceiling Cap!*)
   - Budget Head: `2202-01-101-01-03` (*Note: 2202 is the correct School Education designated major head*)
   - DDO Name: `District Sports Officer, Wardha`
   - UC Deadline: `2027-03-31`
7. Click **🚀 Generate Government Resolution (GR)**.
8. **Expected Outcome**:
   - The compliance auditing checklist finishes with green checks.
   - Inside the Workspace, the **Verification Alerts** pane displays: "All checks passed! (सर्व पडताळणी यशस्वी!)" with a green check symbol and **no warnings or critical blocks**.

---

## 🔍 Userflow 5: Clickable Precursor GR Viewer (Modal Integration & Highlighting)

### Intent
Ensure the Desk Officer can inspect precursor resolutions inline, view the exact conflicting parts highlighted in yellow, and resume writing without losing progress.

### Steps
1. Trigger any warning from **Userflow 4** (e.g. Test Case B, C, or D).
2. Find the alert card inside the top warning banner.
3. Click the blue link `🔗 View Conflicting GR (GR-Number)` under the warning bulletin description.
4. **Expected Outcome**:
   - An inline modal pops up immediately overlaying the workspace.
   - Renders the complete official historical GR (Preamble, numbered clauses, etc.).
   - **Keyword Highlighting**: Conflicting keywords that triggered the overlap audit (e.g. scheme words like `Krishi`, `Annapurna`, `Solar`, `Cooperative`, `Sukarmi`) are highlighted inside the text in bright yellow (`<mark>`) to draw immediate visual attention.
5. Click `×` or `Close` to dismiss the modal and resume workspace drafting.

---

## 🖨️ Userflow 6: Official Maharashtra Govt Format & PDF Export

### Intent
Verify that the official letterhead format adheres strictly to the Maharashtra Manual of Office Procedures (MMOP) and can be downloaded as a PDF.

### Steps
1. On any generated Draft Workspace screen, click **🖨️ Official Format & PDF Download** in the top action bar.
2. **Expected Outcome**:
   - A new browser tab opens.
   - Renders the official resolution letterhead featuring:
     - The **Maharashtra Rajmudra Emblem** centered at the top.
     - The **21-Digit Computer Code (संकेतांक)** on the top right.
     - Formal introduction (प्रस्तावना) and numbered clauses (शासन निर्णय) in clean, justified text.
     - Governor sign-off blocks.
     - The **Copy Forwarded Distribution List** at the bottom.
     - Clickable footnotes for the **Top 3 Precursor References**.
3. Click the green button **Download / Print Official GR PDF** to save or print the page as a structured PDF document.

---

## 🚫 Userflow 7: Independent Alert Dismissal & Submission Gate

### Intent
Verify that dismissing a single verification alert removes only that specific item, and that submitting a resolution is gated until all alerts are either resolved (Auto-Fix) or dismissed.

### Steps
1. Navigate to **Create GR** (`/create`) under **Clerk** mode.
2. Enter an amount over 4 Crores (`₹4,50,00,000`) or choose an outdated account head to trigger multiple verification alerts.
3. Click **Generate Government Resolution**.
4. Inside the **Draft Workspace**:
   - Inspect the top alert banner displaying the generated alerts.
   - Click **Dismiss** on the first alert card.
   - **Expected Outcome**: Only the targeted alert disappears; all remaining alerts stay visible.
   - Inspect the workspace footer: The **Submit for Review** button is disabled with a warning badge: `⚠️ Resolve (Auto-Fix) or Dismiss all alerts before submitting`.
5. Click **Dismiss** or **Auto-Fix** on the remaining alert cards.
6. **Expected Outcome**: Once all alerts are cleared, the **Submit for Review** button becomes active and enabled.

---

## 🇬🇧 Userflow 8: 100% Administrative English Document Generation (No References Section)

### Intent
Ensure the document text is generated strictly in formal government-style English without Marathi text mixing, and confirm the References section has been completely removed from the document preview and PDF output.

### Steps
1. Create and generate any Government Resolution as a Clerk.
2. Inside the **Draft Workspace**:
   - Inspect the section titles and resolution body text in the preview pane.
   - **Expected Outcome**: Preamble, Executive Order Clauses, Financial Allocations, and Distribution List are 100% in formal Administrative English ("In pursuance of...", "The Government is pleased to accord sanction...").
   - Confirm there is **no References section** in the document layout.
3. Click **🖨️ Official Format & PDF Download** in the top action bar.
4. **Expected Outcome**: The exported HTML/PDF letterhead displays clean, formal administrative English text without a References section.

---

## 🏛️ Userflow 9: Senior Minister Review (Approve, Request Changes & Permanent Reject with Audit Trail)

### Intent
Verify that the Senior Minister has options to approve, request revisions with feedback comments, or permanently reject a GR, and confirm that all actions leave an audit trail log.

### Steps
1. In the top navbar role dropdown, select **Minister: Hon. Minister Patil**.
2. Navigate to **Executive Review** (`/approve/pending`).
3. Select a pending resolution from the queue.
4. Observe the top header displaying the official emblems (**State Emblem of India** and **Maharashtra Rajmudra Seal**).
5. Test the 3 available action buttons:
   - **📝 Request Changes**: Click and enter revision comments (e.g. "Adjust allocated budget for Wardha district"). Status changes to `rejected` with `rejectedBy = 'minister'`, allowing the Desk Officer to revise and resubmit directly back to the Minister.
   - **❌ Reject Document**: Click and enter official rejection reason. The resolution is permanently marked as rejected.
   - **✅ Approve & Sign**: Click to approve and sign off the resolution.
6. Inspect the **📜 Audit Trail & Action Log** section on the review panel:
   - **Expected Outcome**: Displays an append-only timeline tracking every action, user role, timestamp, and comments for full transparency.

---

## 🤖 Userflow 10: AI Policy Search Assistant Chatbot (98,000+ GR Knowledge Base)

### Intent
Verify that the floating AI assistant widget allows users to search the 98,000+ GR database in conversational English, providing bullet point summaries and clickable links to full resolution documents.

### Steps
1. Locate the floating chatbot widget at the **bottom-right corner** of the screen (`🤖 AI Policy Assistant`).
2. Click the floating button to expand the chat panel.
3. Click one of the suggestion chips or type a search query:
   - *"Was a GR launched for Lumpy Skin Disease?"*
   - *"Solar pump subsidy scheme rules"*
4. **Expected Outcome**:
   - The assistant queries the 98,000+ Maharashtra GR database.
   - Responds strictly in **clear, conversational English**.
   - Outlines the key rules and mandates in clean **bullet point format** (`• ...`).
   - Displays clickable link badges: `🔗 GR [GR_ID] (Department)`.
5. Click any `🔗 GR [GR_ID]` link button in the chat response.
6. **Expected Outcome**:
   - An official document modal immediately pops up overlaying the screen, displaying the complete resolution document (Header with official emblems, Preamble, Government Resolution clauses, Financial details).
   - Click **🖨️ Open Full PDF View** or `×` to close.

---

## 🔍 Userflow 11: Reference Parser Verification (FR-1, FR-2, FR-3)

### Intent
Verify that the reference parser accurately extracts precursor GRs, Circulars, and Court Orders from the draft preamble, queries the 98k historical index to confirm their existence, and flags invalid/unverified references.

### Steps
1. Navigate to **Create GR** (`/create`) under **Clerk** mode.
2. Complete Step 1 with a preamble citing multiple document types:
   - *Trigger / Incident*: `Pursuant to Government Resolution, Finance Department, No. Asank-1004/ Q.No.12/ (Part-II)/ 2004/ Financial Reforms-1D dated 04/10/2004 and Circular No. SAMRIDH-2317/ PR No. 189/5 and pursuant to the High Court Order in Writ Petition No. 4613/2008.`
   - *Targeted Action*: `Approve funding allocation.`
3. Click **Generate Government Resolution**.
4. **Expected Outcome**:
   - The right-hand pane shows the verification results.
   - Circular `SAMRIDH-2317/ PR No. 189/5` and Court Order `4613/2008` exist in the index database and are successfully verified. No alerts are generated for them.
   - The historical GR `Asank-1004/ Q.No.12/...` from 2004 is extracted but flags a low-severity alert `Referenced GR may not exist` because it is outside the active indexed set.
5. In the preamble editor, type: `GR No. INVALID-GR-99999-DATED-2026`.
6. Wait 1 second for reactive dryrun verification to trigger.
7. **Expected Outcome**:
   - The verifier highlights the invalid reference: `Referenced GR may not exist: INVALID-GR-99999-DATED-2026`.

---

## 🧠 Userflow 12: Semantic Conflict Detector (FR-4, FR-5, FR-6)

### Intent
Verify that the semantic search splits resolutions into sentences and computes similarities against other departments' policies, alerting the user to overlapping mandates and providing auto-fix rewrites.

### Steps
1. Navigate to **Create GR** (`/create`) under **Clerk** mode.
2. Set the department in the header to **Finance Department**.
3. Proceed to Step 2, select **💰 1. Financial Sanction**.
4. Under the Resolution clauses editor, type the following overlapping clause:
   - *"In 2018-19, the Department of Finance, under the scheme of Promotion of Group Farming of Farmers for Promotion and Empowerment of Group Farming, has approved Rs. 10 crore for disbursement to the Office of the Agriculture Commissioner."*
5. Save or wait for dryrun verification to run.
6. **Expected Outcome**:
   - The system queries the database, extracts sentences from cross-department candidates, and calculates cosine similarity.
   - A high-severity alert is triggered: `Semantic Conflict (75% similarity)`.
   - The warning specifies: `Draft clause overlaps with existing policy in 'Agriculture_Dairy_Development_Animal_Husbandry_and_Fisheries_Department' (GR ID: 201804131513183101.pdf.en).`
   - It displays the conflicting sentence as evidence: `Promotion of group farming of farmers for promotion and empowerment of group farming`.
7. Test the resolution actions on the alert card:
   - **Option A (Preview Fix)**: Click **🔧 Preview Fix**. The system renders a side-by-side diff comparison in the middle column. Click **Accept ✓** to apply it.
   - **Option B (Direct Auto-Resolve)**: Click **⚡ Auto-Resolve**. The system updates the conflicting resolution text immediately and automatically clears the alert.

---

## 🚫 Userflow 13: Template Enforcement Engine (FR-10, FR-11, FR-12)

### Intent
Verify that structural checks enforce the Maharashtra Manual of Office Procedures, validate budget heads, audit signature details, and block final submission on critical violations.

### Steps
1. Navigate to **Create GR** (`/create`) under **Clerk** mode.
2. Generate a draft, then clear the **Introduction (Preamble)** and **Resolution** content in the workspace cards.
3. **Expected Outcome**:
   - The verifier raises multiple critical alerts: `Missing Preamble/Introduction` and `Missing Resolution Mandates`.
   - The **Submit for Review** button is disabled.
4. Select **💰 1. Financial Sanction** archetype. Edit the financials table:
   - Enter budget head: `abc-123` (invalid format).
5. **Expected Outcome**:
   - The verifier raises a critical alert: `Incorrect Budget Head Format`.
6. Edit the **Signature Block** card:
   - Clear the text or enter: `Signed by Desk Officer John`.
7. **Expected Outcome**:
   - The verifier raises a high-severity alert: `Incorrect Signature Header format`, stating the Governor of Maharashtra is not cited as the executive authority.
8. Modify the signature text to: `By order and in the name of the Governor of Maharashtra,\n\n(John Doe)`.
9. Modify the budget head to: `2202-01-101-01-03`.
10. **Expected Outcome**:
    - The critical alerts disappear, and the **Submit for Review** button is unlocked.

---

## 📜 Userflow 14: Outline Navigator & Change History Audit Trail (FR-13, FR-15)

### Intent
Verify that the left outline panel scrolls the page to selected sections and that manual edits and accepted AI suggestions are saved in the history timeline.

### Steps
1. Navigate to the **Draft Workspace** for any active draft.
2. Inspect the left-hand column:
   - Clicking **Resolutions** scrolls the resolution card smoothly into view.
   - Clicking **Signature** scrolls the signature card smoothly into view.
3. Click the edit pencil `✎` on the **Introduction** card, modify the text, and click save `✓` or wait for autosave.
4. **Expected Outcome**:
   - A timeline entry is immediately added to the **Audit Trail & Edit Log** panel in the right pane: `Human Edit | By: John Doe (Desk Officer) | comment: "Edited section(s): introduction"`.
5. Trigger a semantic conflict warning and click **🔧 Auto-Fix**.
6. In the AI Suggestion accept/reject box, click **Accept ✓**.
7. **Expected Outcome**:
   - The text is rewritten.
   - A new timeline entry is recorded in the Audit Trail log: `AI Suggestion Accepted | By: John Doe (Desk Officer) | comment: "Applied auto-fix for: "Semantic Conflict (75% similarity)""`.
8. Switch role to **Minister: Hon. Minister Patil** and open the **Executive Review** dashboard. The audit timeline displays the exact sequence of human edits and suggestion accept logs.

---

## 🏛️ Userflow 15: Marathi-English Term Mismatch (Glossary Validation)

### Intent
Verify that the system highlights Marathi-English terminology mismatches (e.g., draft belongs to Finance Department but the Marathi text cites 'गृह विभाग' / Home Department) against a small bilingual glossary.

### Steps
1. Navigate to **Create GR** (`/create`) under **Clerk** mode.
2. Complete Step 1:
   - Choose department: **Finance Department** (in Global Header).
   - Enter Trigger / Incident: `Urgent funding needed for development.`
   - Enter Targeted Action / Executive Order: `वित्त विभाग authorizes budget allocation.`
3. Click **Generate Government Resolution**.
4. In the generated **Draft Workspace**:
   - Locate the **Resolution (शासन निर्णय)** card and click the edit icon `✎`.
   - Insert the mismatched term inside the resolution body text: `या योजनेचे संनियंत्रण गृह विभाग द्वारे केले जाईल.` (This translates to: "This scheme will be monitored by the Home Department.").
   - Save or wait 1 second for reactive dryrun verification to run.
5. **Expected Outcome**:
   - The verifier highlights the mismatch by raising a medium-severity alert in the right pane: `Bilingual Term Mismatch: गृह विभाग`.
   - The description details: `Draft department is 'Finance Department', but the Marathi text cites 'गृह विभाग' (associated with 'Home Department').`
   - Remediations suggest: `Verify if 'गृह विभाग' is correct or align it with the 'Finance Department' ('वित्त विभाग').`
6. Edit the resolution text to change `गृह विभाग` to `वित्त विभाग` and save.
7. **Expected Outcome**: The terminology mismatch alert is cleared.

---

## ⚖️ Userflow 16: Controlled Glossary Term Validation (FR-7, FR-8, FR-9)

### Intent
Verify that the system flags unapproved Marathi translations when their standard administrative English counterparts are used (e.g. using "भरती" instead of "नियुक्ती" when "appoint" is in the document context) and suggests standard terms.

### Steps
1. Navigate to **Create GR** (`/create`) under **Clerk** mode.
2. Complete Step 1:
   - Choose department: **Finance Department** (in Global Header).
   - Enter Trigger / Incident: `Decision to appoint emergency project coordinators.` (Contains the term 'appoint').
   - Enter Targeted Action / Executive Order: `Approve staffing mandates.`
3. Click **Generate Government Resolution**.
4. In the generated **Draft Workspace**:
   - Locate the **Resolution (शासन निर्णय)** card and click the edit icon `✎`.
   - Insert an unapproved translation term in the resolution body text: `या पदांवर नवीन उमेदवारांची तात्काळ भरती करण्यात यावी.` (uses unapproved term 'भरती' instead of approved translation 'नियुक्ती').
   - Save or wait 1 second for reactive dryrun verification to run.
5. **Expected Outcome**:
   - The verifier highlights the unapproved terminology by raising a low-severity alert in the right pane: `Unapproved terminology: "भरती"`.
   - The description details: `The unapproved Marathi term "भरती" was found. For standard administrative English term "appoint", the approved translation is "नियुक्ती".`
   - Remediations suggest: `Replace "भरती" with the approved standard term "नियुक्ती".`
6. Edit the resolution text to change `भरती` to `नियुक्ती` and save.
7. **Expected Outcome**: The terminology alert is cleared.
