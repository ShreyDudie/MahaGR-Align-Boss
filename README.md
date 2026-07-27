# MAHARASHTRA GR-Align 🏛️

### Ultimate Digital Desk Officer (कक्षा अधिकारी) & Policy Auditor Platform

**MAHARASHTRA GR-Align** is an authoritative, production-grade Government Resolution (GR) management, generation, and policy auditing platform built for the **Government of Maharashtra**. Compliant with the **Maharashtra Manual of Office Procedures**, the system processes dynamic micro-inputs (Mad-Libs UI), performs pre-generation cross-departmental policy conflict auditing, generates formal traditional Marathi Administrative Vernacular (शासकीय मराठी) and formal Administrative English text, and automates 21-digit system GR IDs with cryptographic verification tokens.

The compliance & search engine queries and validates drafts against an indexed database containing **98,980 actual Maharashtra Government Resolutions** across 33 departments.

---

## 🚀 Key Implemented Features

### 1. **Mad-Libs Form Setup (Atomic Micro-Inputs UI)**
- **Global Header Inputs**: 33 Maharashtra Departments, GR Date, Signee Designation (Under Secretary to Additional Chief Secretary), and Document Language Selection.
- **Mandatory Preamble Micro-Text Boxes**:
  1. *Trigger / Incident*: Precise reason driving the GR (e.g., "Outbreak of Lumpy Skin Disease across 4 rural districts").
  2. *Reference File/Letter*: Official tracking ID (e.g., "Cabinet Decision No. CAB-102, Dated 12/03/2026").
  3. *Targeted Action / Executive Order*: Direct Action Verb and Mandate (e.g., "Release emergency procurement funds of Rs 50 Lakhs").
- **5 Archetype Selectors & Polymorphic Payloads**:
  1. `1_FINANCIAL_SANCTION`: Precise Amount (INR ₹), 15-Digit Budget Head, Drawing & Disbursing Officer (DDO), Utilization Certificate (UC) Deadline, Moratorium.
  2. `2_POLICY_SCHEME`: Scheme Name, Eligibility Criteria, Committee Chairman (null values cleanly dropped without breaking numbering).
  3. `3_ESTABLISHMENT_HR`: Employee Names & Cadres, Current Posting, New Posting, Effective Date.
  4. `4_STATUTORY_NOTIFICATION`: Parent Act Invoked, Geographic Scope, Exempted Entities.
  5. `5_CORRIGENDUM`: Original 21-Digit GR ID, Incorrect Text Reference, Corrected Text Placement.
- **Dynamic Flex-Fields (`additional_custom_parameters`)**: `[+ Add Custom Rule]` key-value generator (`parameter_name` & `parameter_value`) for dynamic policy conditions.

### 2. **TASK A: Policy & Cross-Department Conflict Auditor**
- Runs **BEFORE** text generation to evaluate inputs against departmental rules and historical GR databases.
- **Finance Ceiling Limit Audit**: If a Financial Sanction requested amount exceeds ₹4,00,00,000 (4 Crores), triggers a `CRITICAL` system conflict warning detailing Finance Regulation `FIN-2024-CR12`.
- **Scheme Name Duplication & Cross-Department Overlap**: Scans existing schemes in other departments to alert officers to inter-departmental conflicts.
- **Missing Required Prerequisites**: Checks for mandatory 15-digit budget heads, parent acts, and original GR references.

### 3. **TASK B & C: Bilingual Compliance Text Generation (Marathi & English)**
- Generates formal traditional **Marathi Administrative Vernacular (शासकीय मराठी)** for preamble and resolution clauses.
- Generates formal **Administrative English** text ("Read with...", "Pursuant to...", "The Government is pleased to accord sanction...").
- **Continuous Numbered List**: Omits null/blank fields cleanly without creating gap lines or breaking line numbering sequences.

### 4. **Secure 21-Digit System GR ID & Rajmudra Emblem Letterhead**
- Generates standard 21-digit GR IDs (`YYYYMMDDHHMMSSXXXXXX`, e.g., `20260728114530120301`).
- Cryptographic security checksum token (e.g., `SEC-MH-9F81A2B7-2026`).
- Official Government letterhead layout featuring the **Maharashtra Rajmudra Emblem ("प्रतिपच्चंद्रलेखेव वर्धिष्णुर्विश्ववंदिता...")** and Tricolor Motif.

### 5. **Hyper-Fast DB Search & Clickable Precursor References**
- Instant keyword and department search across historical records.
- **Clickable Reference GR Links**: Precursor GR references cited by AI or users can be clicked to view their full text in a modal or new window.
- Appends the **Top 3 Historical Reference GRs** with live document links at the document footer.

### 6. **Real-Time Input Field Verification**
- As the user types in the Mad-Libs form (e.g., 15-digit Budget Head, DDO Title, Amount), real-time verification badges display:
  - `✅ Verified in DB`
  - `🚨 CRITICAL: Exceeds Cap`
  - `ℹ️ Custom DDO / Valid Format`

---

## 🎨 UI Design System

- **Full-Width Viewport**: Utilizes 100% of the screen width, eliminating narrow centered boxes with blank margins.
- **Government Tricolor Theme**: Saffron (`#FF671F`), Emerald Green (`#046A38`), Deep Navy (`#0A2540`), Gold (`#D4AF37`), and Pure White.
- **Department Visual Cards**: Key administrative departments displayed as visual cards showing GR counts and one-click search lookups.

---

## 🛠️ Step-by-Step Userflow & Verification Guide

Follow these testing steps with sample inputs to verify all features:

### Test Case 1: Financial Sanction Exceeding ₹4 Crore Cap (Task A Conflict Audit Verification)
1. Navigate to **Create GR (कक्षा अधिकारी)**.
2. **Global Header**:
   - Department: `Finance Department`
   - Signee: `Under Secretary to Government of Maharashtra`
3. **Preamble Micro-Inputs**:
   - *Trigger / Incident*: `Urgent infrastructure expansion for Metro Line linking`
   - *Reference File/Letter*: `Cabinet Meeting Resolution No. CAB-2026-M4, Item 7`
   - *Targeted Action*: `Sanction emergency budget tranche for land acquisition`
4. Click **Next: Select GR Archetype**.
5. Select Archetype **💰 1. Financial Sanction**.
6. Enter Inputs:
   - Precise Amount (INR ₹): `70000000` (₹7.00 Crores - *Exceeds ₹4 Crore Ceiling Cap!*)
   - 15-Digit Budget Head: `2202-01-101-01-03`
   - DDO: `Metropolitan Commissioner, MMRDA`
   - UC Deadline: `2027-03-31`
7. Click **🚀 Generate Government Resolution (GR)**.
8. **Expected Verification Outcome**:
   - The system displays a **🚨 TASK A: POLICY & CONFLICT AUDITING ALERT (CRITICAL)** warning banner explaining that ₹7.00 Crores exceeds the maximum loan/expenditure threshold of ₹4.00 Crores set by Finance Regulation `FIN-2024-CR12`.
   - The 21-Digit GR ID is generated (e.g. `20260728114530120301`).

### Test Case 2: Policy Scheme with Null/Blank Fields & Dynamic Flex-Rules
1. Navigate to **Create GR**.
2. **Preamble Micro-Inputs**:
   - *Trigger / Incident*: `High youth unemployment in rural sectors`
   - *Reference File/Letter*: `Government Letter No. PLN-2026/CR-45`
   - *Targeted Action*: `Promulgate Youth Skill Apprenticeship Scheme`
3. Select Archetype **📜 2. Policy / Scheme**.
4. Enter Inputs:
   - Scheme Name: `Mukhyamantri Yuva Karya Prashikshan Yojana`
   - Eligibility Criteria: `Age 18-30, Resident of Maharashtra, Minimum 12th Pass`
   - Committee Chairman: *(Leave Blank / Clear text)* -> *Verifies null variable dropping!*
5. Under **Dynamic Flex-Fields**, click **➕ Add Custom Rule**:
   - *Rule Category*: `Escrow Account Binding`
   - *Rule Condition*: `All disbursed funds must be held in a non-divertible project Escrow Account`
6. Click **Generate GR**.
7. **Expected Verification Outcome**:
   - Continuous numbered Marathi & English clauses without gaps.
   - The committee chairman clause is completely omitted without breaking sequence numbering (1, 2, 3...).
   - The flex-field appears as a standalone resolution clause under Special Conditions.

### Test Case 3: Official Document View & PDF Export
1. On the Draft Workspace screen, click **🖨️ Official Format & PDF Download**.
2. A separate tab opens rendering the exact official Maharashtra Government resolution letterhead with:
   - Maharashtra Rajmudra Emblem
   - 21-Digit GR ID & Security Checksum
   - Read Section, Preamble, Numbered Clauses
   - Copy Forwarded Distribution List
   - Top 3 Historical Reference GR Hyperlinks at the footer
3. Click **Download / Print Official GR PDF** to save as PDF.

### Test Case 4: Cross-Department Scheme Overlap Verification
1. Navigate to **Create GR**.
2. Choose **Higher and Technical Education Department**.
3. Under Preamble Micro-Inputs, enter:
   - *Trigger / Incident*: `Urgent need for skill internships`
   - *Reference File/Letter*: `Letter No. HTE-2026/102`
   - *Targeted Action / Executive Order*: `Provide youth training yojana`
4. Proceed to **Step 2 (Archetype Selectors)** and choose **📜 2. Policy / Scheme**.
5. Enter:
   - *Scheme Name*: `Mukhyamantri Yuva Karya`
6. Click **Generate Government Resolution (GR)**.
7. **Expected Verification Outcome**:
   - The Workspace displays a **⚠️ Policy Conflict** alert: "Inter-Departmental Scheme Overlap: Scheme/Policy mandate in 'Higher and Technical Education Department' overlaps with existing scheme in 'Skill Development and Entrepreneurship Department' (Ref: Mukhyamantri Yuva Karya Prashikshan Yojana)."
   - An interactive link is provided: `🔗 View Conflicting GR (202203171257316505)`.

### Test Case 5: Cross-Department Budget Head Mismatch Verification
1. Navigate to **Create GR**.
2. Select **Housing Department** in the Global Header.
3. Choose **💰 1. Financial Sanction** archetype.
4. Input:
   - *Precise Amount*: `500000` (₹5 Lakhs)
   - *15-Digit Budget Head*: `2202-01-101-01-03` (*Note: 2202 is the Major Head representing the Education sector!*)
5. Click **Generate Government Resolution (GR)**.
6. **Expected Verification Outcome**:
   - The Workspace displays a **⚠️ Policy Conflict** alert: "Cross-Department Budget Head Mismatch: Budget Major Head 2202 belongs to 'School Education and Sports Department' sector, not 'Housing Department'."
   - A clickable link lets you inspect the precursor GR that established this head: `🔗 View Conflicting GR (202102021510117305)`.

### Test Case 6: Cross-Department Statutory Act Jurisdiction Mismatch
1. Navigate to **Create GR**.
2. Choose **Finance Department** in the Global Header.
3. Proceed to **Step 2** and select **⚖️ 4. Statutory Notification**.
4. Input:
   - *Parent Act Invoked*: `Section 25 of the Negotiable Instruments Act, 1881`
5. Click **Generate Government Resolution (GR)**.
6. **Expected Verification Outcome**:
   - The Workspace flags a **⚠️ Policy Conflict** alert: "Statutory Jurisdiction Overlap: Cited Act 'Negotiable Instruments Act' was previously invoked by and belongs to jurisdiction of 'General Administration Department'."
   - A clickable link is provided to inspect the conflicting resolution: `🔗 View Conflicting GR (202101141237329905)`.

### Test Case 7: Clickable Conflicting GR Viewer (Modal Integration)
1. Trigger any of the warnings in **Test Case 4**, **5**, or **6**.
2. Look at the alert card in the right pane.
3. Click the blue link `🔗 View Conflicting GR (GR-Number)`.
4. **Expected Outcome**:
   - A modal immediately pops up showing the full official text of the conflicting historical GR (Read Section, Preamble, and Resolution clauses).
   - This allows instant comparison and cross-verification without losing your current drafting context.
   - Click `×` to dismiss the modal and return to editing.

---

## 💻 Technical Setup & Server Launch

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment (`.env`)
```env
PORT=5000
NODE_ENV=development

# Optional: AI Model Keys
GEMINI_API_KEY=your_gemini_key_here
GEMINI_MODEL=gemini-1.5-flash
```

### 3. Start Backend Server
```bash
npm run server
```

### 4. Start Frontend Client
```bash
npm run dev
```
- Access application at: `http://localhost:5173`
