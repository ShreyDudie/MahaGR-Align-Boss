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
