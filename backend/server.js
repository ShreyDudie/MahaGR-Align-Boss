/**
 * Express Backend Server
 * API endpoints for MAHARASHTRA GR-Align
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import GRParser from './services/grParser.js';
import GRIndexer from './services/grIndexer.js';
import GRVerifier from './services/grVerifier.js';
import GRGenerator from './services/grGenerator.js';
import {
  initDB,
  saveGR,
  getGR,
  saveAlerts,
  getAlerts,
  updateGRStatus,
  getAllGRs,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables manually into process.env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const cleanLine = line.trim();
    if (cleanLine && !cleanLine.startsWith('#')) {
      const equalIndex = cleanLine.indexOf('=');
      if (equalIndex > 0) {
        const key = cleanLine.substring(0, equalIndex).trim();
        const value = cleanLine.substring(equalIndex + 1).trim();
        const cleanValue = value.replace(/^['"]|['"]$/g, '');
        process.env[key] = cleanValue;
      }
    }
  });
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Global instances
let indexer = null;
let verifier = null;
let generator = null;

/**
 * Initialize backend: Parse all GRs and build indices
 */
async function initializeBackend() {
  console.log('🚀 Initializing backend...');

  try {
    // Initialize database
    await initDB();
    console.log('✅ Database initialized');

    // Initialize parser
    const parser = new GRParser();
    console.log('✅ Parser ready');

    // Parse all GRs
    const dataPath = path.join(__dirname, 'data', 'GRs');
    const departments = fs.readdirSync(dataPath);

    const allParsedGRs = [];
    let grCount = 0;

    departments.forEach(deptFolder => {
      const deptPath = path.join(dataPath, deptFolder);
      if (fs.statSync(deptPath).isDirectory()) {
        const parsedGRs = parser.parseDirectory(deptPath, deptFolder);
        allParsedGRs.push(...parsedGRs);
        grCount += parsedGRs.length;
        console.log(`  📄 ${deptFolder}: ${parsedGRs.length} GRs`);
      }
    });

    console.log(`✅ Parsed ${grCount} total Government Resolutions`);

    // Build indices
    indexer = new GRIndexer();
    indexer.indexGRs(allParsedGRs);
    console.log('✅ Indices built');

    // Initialize verifier
    verifier = new GRVerifier(indexer);
    console.log('✅ Verifier ready');

    // Build Policy Knowledge Base
    verifier.knowledgeBase.buildKnowledgeBase();

    // Initialize generator (requires API key)
    const geminiKey = process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (geminiKey) {
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      generator = new GRGenerator(indexer, { type: 'gemini', key: geminiKey, model: geminiModel });
      console.log(`✅ Generator ready (Gemini ${geminiModel} enabled - Free Tier Compatible)`);
    } else if (openrouterKey) {
      const openrouterModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free';
      generator = new GRGenerator(indexer, { type: 'openrouter', key: openrouterKey, model: openrouterModel });
      console.log(`✅ Generator ready (OpenRouter ${openrouterModel} enabled - 100% Free Models)`);
    } else if (anthropicKey) {
      generator = new GRGenerator(indexer, { type: 'claude', key: anthropicKey });
      console.log('✅ Generator ready (Claude API enabled)');
    } else {
      generator = new GRGenerator(indexer, { type: 'fallback' });
      console.log('ℹ️  No API key configured - Generator initialized in Local Fallback mode');
    }

    // Log statistics
    const stats = indexer.getStatistics();
    console.log(`\n📊 Database Statistics:`);
    console.log(`   Total GRs: ${stats.totalGRs}`);
    console.log(`   Departments: ${stats.totalDepartments}`);
    console.log(`   Districts: ${stats.districtCoverage}`);
    console.log(`   Years covered: ${stats.yearBreakdown.length}`);

    return true;
  } catch (error) {
    console.error('❌ Initialization error:', error);
    return false;
  }
}

/**
 * API Routes
 */

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    indexerReady: indexer !== null,
    generatorReady: generator !== null,
  });
});

// Get dashboard statistics
app.get('/api/analytics/dashboard', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const analytics = indexer.getAnalytics();
  res.json(analytics);
});

// Search GRs
app.post('/api/search', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const results = indexer.search(req.body);
  res.json({
    count: results.length,
    results: results.slice(0, 50),
  });
});

// Get departments
app.get('/api/departments', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const departments = indexer.getDepartments();
  res.json({ departments });
});

// Get districts
app.get('/api/districts', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const districts = indexer.getDistricts();
  res.json({ districts });
});

// Real-time field verification route
app.post('/api/gr/verify-fields', (req, res) => {
  const { fieldName, fieldValue, department } = req.body;
  if (!verifier) {
    return res.json({ valid: true, status: 'verified', message: '' });
  }
  const result = verifier.verifyField(fieldName, fieldValue, department);
  res.json(result);
});

// Generate new GR
app.post('/api/gr/generate', async (req, res) => {
  if (!generator) {
    return res.status(503).json({ error: 'Generator not ready - API key not configured' });
  }

  try {
    const result = await generator.generateGR(req.body);

    if (result.success) {
      // Save to database
      await saveGR(result.draft, req.body.userId || 'system');

      // Run verification
      const verification = verifier.verify(result.draft);
      await saveAlerts(result.draft.id, verification.alerts);

      res.json({
        success: true,
        grId: result.grId,
        draft: result.draft,
        verification,
        tokensUsed: result.tokensUsed,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

// Save GR draft
app.post('/api/gr/save', async (req, res) => {
  try {
    const gr = req.body;
    const userId = req.body.userId || 'system';

    // Save to database
    await saveGR(gr, userId);

    // Re-verify the updated GR and save new alerts!
    let verification = null;
    if (verifier) {
      verification = verifier.verify(gr);
      await saveAlerts(gr.id, verification.alerts);
    }

    res.json({
      success: true,
      gr,
      verification,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Auto-resolve verification alerts
app.post('/api/gr/auto-resolve', async (req, res) => {
  const { gr, alert } = req.body;
  const geminiKey = process.env.GEMINI_API_KEY;
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

  if (!gr || !alert) {
    return res.status(400).json({ error: 'Missing gr or alert details' });
  }

  const prompt = `You are an expert Government Resolution (GR) formatting editor.
We have a draft Government Resolution that has failed verification checks.

DRAFT SUBJECT: ${gr.metadata?.subject || 'N/A'}
DRAFT DEPARTMENT: ${gr.department || 'N/A'}

THE VERIFICATION ALERT:
Category: ${alert.category}
Severity: ${alert.severity}
Title: ${alert.title}
Description: ${alert.description}
Conflicting Phrase/Text: "${alert.conflictingPhrase || ''}"
Remediation Suggestion: "${alert.remediationSuggestion || ''}"

FULL RESOLUTION SECTIONS:
1. Header:
${gr.sections?.header || ''}
2. Introduction:
${gr.sections?.introduction || ''}
3. References:
${JSON.stringify(gr.sections?.references || [])}
4. Resolution Text:
${gr.sections?.resolution || ''}
5. Financial Details:
${JSON.stringify(gr.sections?.financials || [])}
6. Distribution List:
${JSON.stringify(gr.sections?.distribution || [])}

YOUR TASK:
Fix the issues identified in the alert by adjusting/editing only the relevant sections (e.g., if there is a conflict in the resolution text, fix the resolution text. If it is a deprecated account head, update the financials account head. If it is a missing reference, insert a logical reference).
Keep all other sections completely unchanged.
You must return your output in JSON format with the keys:
{
  "sections": {
    "header": "updated header or unchanged",
    "introduction": "updated introduction or unchanged",
    "references": [updated references array or unchanged],
    "resolution": "updated resolution or unchanged",
    "financials": [updated financials array or unchanged],
    "distribution": [updated distribution array or unchanged]
  }
}
Do not include any extra dialogue or text outside of the JSON block. Return ONLY raw JSON.`;

  try {
    let responseText = '';
    if (geminiKey) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.1
          }
        })
      });
      if (response.ok) {
        const data = await response.json();
        responseText = data.candidates[0].content.parts[0].text;
      } else {
        console.error("Gemini resolve failed:", response.status, await response.text());
      }
    }

    let updatedSections = null;
    if (responseText) {
      try {
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        updatedSections = parsed.sections || parsed;
      } catch (e) {
        console.error("Failed to parse resolved sections:", e, responseText);
      }
    }

    if (!updatedSections) {
      // Mock local fallback resolve if no key or parsing fails
      updatedSections = { ...gr.sections };
      if (alert.category === 'deprecated' && alert.conflictingPhrase) {
        if (updatedSections.financials) {
          updatedSections.financials = updatedSections.financials.map(f => {
            if (f.accountHead === alert.conflictingPhrase) {
              return { ...f, accountHead: '2071-01-101' };
            }
            return f;
          });
        }
      }
    }

    const updatedGr = {
      ...gr,
      sections: {
        ...gr.sections,
        ...updatedSections
      }
    };

    // Re-save to database
    await saveGR(updatedGr, gr.userId || 'system');

    // Re-verify the updated GR and save alerts
    let verification = null;
    if (verifier) {
      verification = verifier.verify(updatedGr);
      await saveAlerts(updatedGr.id, verification.alerts);
    }

    res.json({
      success: true,
      gr: updatedGr,
      verification
    });
  } catch (error) {
    console.error("Auto resolve error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Helper to find GR by ID or GR Number
async function findGRByIdOrNumber(grId) {
  // 1. Check in-memory indexer FIRST (extremely fast, handles 99% of historical lookups)
  if (indexer) {
    let gr = indexer.getGRById(grId);
    if (gr) return gr;
    
    const indexedId = indexer.indices.byGRNumber?.get(grId);
    if (indexedId) {
      gr = indexer.getGRById(indexedId);
      if (gr) return gr;
    }

    // O(1) hash lookup via normalized GR Number / ID (resolves in <1 microsecond)
    const normId = grId.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normId) {
      const normalizedMatchId = indexer.indices.byGRNumberNormalized?.get(normId);
      if (normalizedMatchId) {
        gr = indexer.getGRById(normalizedMatchId);
        if (gr) return gr;
      }
    }
  }

  // 2. Check SQLite database by ID
  let gr = await getGR(grId);
  if (gr) return gr;
  
  // 3. Fallback: Check SQLite database by GR number
  if (!gr) {
    try {
      const db_instance = await initDB();
      // First exact search
      let row = await db_instance.get('SELECT id FROM grs WHERE gr_number = ?', [grId]);
      if (!row) {
        // Fuzzy two-way LIKE search (handles prefixes like 'No. ...')
        row = await db_instance.get(
          'SELECT id FROM grs WHERE ? LIKE "%" || gr_number || "%" OR gr_number LIKE "%" || ? || "%"',
          [grId, grId]
        );
      }
      if (row) {
        gr = await getGR(row.id);
      }
    } catch (e) {
      console.error('Database query in findGRByIdOrNumber failed:', e);
    }
  }
  
  return gr;
}

// Export GR as HTML
app.get('/api/gr/:grId/export/html', async (req, res) => {
  try {
    const gr = await findGRByIdOrNumber(req.params.grId);

    if (!gr) {
      return res.status(404).send('<h1>Government Resolution Not Found</h1>');
    }

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Government Resolution: ${gr.metadata?.grNumber || 'Draft'}</title>
  <style>
    body {
      font-family: 'Times New Roman', Times, serif;
      line-height: 1.6;
      color: #000;
      margin: 40px;
      background-color: #fff;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      border: 1px solid #ccc;
      padding: 50px;
      box-shadow: 0 0 10px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px double #000;
      padding-bottom: 20px;
    }
    .emblem {
      font-size: 50px;
      margin-bottom: 10px;
    }
    .header h1 {
      font-size: 22px;
      text-transform: uppercase;
      margin: 5px 0;
      letter-spacing: 1px;
    }
    .header h2 {
      font-size: 18px;
      margin: 5px 0;
      font-weight: normal;
    }
    .meta-table {
      width: 100%;
      margin-bottom: 30px;
      border-collapse: collapse;
    }
    .meta-table td {
      padding: 5px;
      vertical-align: top;
    }
    .meta-label {
      font-weight: bold;
      width: 150px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      text-transform: uppercase;
      margin-top: 25px;
      margin-bottom: 10px;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
    }
    .introduction {
      text-align: justify;
      margin-bottom: 20px;
      text-indent: 50px;
    }
    .references-list, .distribution-list {
      padding-left: 20px;
      margin-bottom: 20px;
    }
    .references-list li, .distribution-list li {
      margin-bottom: 8px;
    }
    .resolution-clause {
      text-align: justify;
      margin-bottom: 15px;
      text-indent: 30px;
    }
    .financial-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .financial-table th, .financial-table td {
      border: 1px solid #000;
      padding: 8px;
      text-align: left;
    }
    .financial-table th {
      background-color: #f2f2f2;
    }
    .financial-table td.amount {
      text-align: right;
    }
    .signature-block {
      margin-top: 50px;
      float: right;
      text-align: center;
      width: 250px;
    }
    .signature-line {
      border-top: 1px solid #000;
      margin-top: 50px;
      padding-top: 5px;
    }
    .seal {
      border: 2px solid #a00;
      color: #a00;
      padding: 10px;
      display: inline-block;
      border-radius: 50%;
      text-transform: uppercase;
      font-size: 10px;
      font-weight: bold;
      transform: rotate(-10deg);
      margin-top: 20px;
    }
    .print-btn-container {
      max-width: 800px;
      margin: 20px auto;
      text-align: right;
    }
    .print-btn {
      background-color: #1a3a52;
      color: white;
      border: none;
      padding: 10px 20px;
      font-size: 14px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: bold;
    }
    .print-btn:hover {
      background-color: #ff9933;
    }
    @media print {
      .print-btn-container {
        display: none;
      }
      body {
        margin: 0;
      }
      .container {
        border: none;
        box-shadow: none;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-btn-container">
    <button class="print-btn" onclick="window.print()">Print Resolution (PDF)</button>
  </div>

  <div class="container">
    <div class="header">
      <div class="emblem">🏛️</div>
      <h1>Government of Maharashtra</h1>
      <h2>${gr.department || 'Department of Administration'}</h2>
      <h2>Mantralaya, Mumbai - 400032</h2>
    </div>

    <table class="meta-table">
      <tr>
        <td class="meta-label">Resolution No:</td>
        <td><strong>${gr.metadata?.grNumber || 'Draft / Unassigned'}</strong></td>
      </tr>
      <tr>
        <td class="meta-label">Date:</td>
        <td>${gr.metadata?.date || new Date().toLocaleDateString('en-IN')}</td>
      </tr>
      <tr>
        <td class="meta-label">Subject:</td>
        <td><strong>${gr.metadata?.subject}</strong></td>
      </tr>
      ${gr.metadata?.intentType ? `
      <tr>
        <td class="meta-label">Intent Type:</td>
        <td>${gr.metadata.intentType}</td>
      </tr>` : ''}
      ${gr.districts && gr.districts.length > 0 ? `
      <tr>
        <td class="meta-label">Districts:</td>
        <td>${gr.districts.join(', ')}</td>
      </tr>` : ''}
    </table>

    ${gr.sections.introduction ? `
    <div class="section-title">Introduction</div>
    <div class="introduction">
      ${gr.sections.introduction}
    </div>` : ''}

    ${gr.sections.references && gr.sections.references.length > 0 ? `
    <div class="section-title">References</div>
    <ul class="references-list">
      ${gr.sections.references.map(ref => `
        <li>
          GR No. <strong>${ref.grNumber}</strong> ${ref.date ? `dated ${ref.date}` : ''}
        </li>
      `).join('')}
    </ul>` : ''}

    <div class="section-title">Government Resolution</div>
    <div class="resolution-body">
      ${gr.sections.resolutions && gr.sections.resolutions.length > 0 ? 
        gr.sections.resolutions.map(clause => `
          <div class="resolution-clause">
            ${clause.index}. ${clause.text}
          </div>
        `).join('') : `
          <div class="resolution-clause">
            ${gr.sections.resolution || 'The government hereby resolves to approve the proposals.'}
          </div>
        `
      }
    </div>

    ${gr.sections.financials && gr.sections.financials.length > 0 ? `
    <div class="section-title">Financial Allocations</div>
    <table class="financial-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Account Head</th>
          <th style="text-align: right;">Amount (₹)</th>
        </tr>
      </thead>
      <tbody>
        ${gr.sections.financials.map(fin => `
          <tr>
            <td>${fin.description || 'Budget allocation'}</td>
            <td><code>${fin.accountHead || 'N/A'}</code></td>
            <td class="amount"><strong>${fin.amount ? fin.amount.toLocaleString('en-IN') : 'N/A'}</strong></td>
          </tr>
        `).join('')}
      </tbody>
    </table>` : ''}

    ${gr.sections.distribution && gr.sections.distribution.length > 0 ? `
    <div class="section-title">Distribution</div>
    <ol class="distribution-list">
      ${gr.sections.distribution.map(dist => `
        <li>${dist.recipient}</li>
      `).join('')}
    </ol>` : ''}

    <div style="clear: both;"></div>

    <div class="signature-block">
      <div class="seal">Govt of Maharashtra</div>
      <div class="signature-line">
        <strong>Authorized Signatory</strong><br>
        Department of ${gr.department || 'Administration'}<br>
        Government of Maharashtra
      </div>
    </div>
    
    <div style="clear: both;"></div>
  </div>
</body>
</html>
    `;

    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Error generating export: ${error.message}</h1>`);
  }
});

// Get GR
app.get('/api/gr/:grId', async (req, res) => {
  try {
    const gr = await findGRByIdOrNumber(req.params.grId);

    if (!gr) {
      return res.status(404).json({ error: 'GR not found' });
    }

    // Dynamically read raw text file if it exists in the filesystem
    if (gr.filename && fs.existsSync(gr.filename)) {
      try {
        gr.sections = gr.sections || {};
        gr.sections.fullText = fs.readFileSync(gr.filename, 'utf8');
      } catch (readErr) {
        console.error(`Failed to read full text file ${gr.filename}:`, readErr);
      }
    }

    const alerts = await getAlerts(req.params.grId) || [];

    let checksRun = [];
    if (verifier && gr.status === 'draft') {
      try {
        const verification = verifier.verify(gr);
        checksRun = verification.checksRun;
      } catch (verifyErr) {
        console.warn(`Verifier skipped for historical GR ${gr.id}:`, verifyErr.message);
      }
    }

    res.json({
      gr,
      alerts,
      checksRun
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify GR (dry-run for instant reactive checks)
app.post('/api/gr/verify-dryrun', async (req, res) => {
  if (!verifier) {
    return res.status(503).json({ error: 'Verifier not ready' });
  }
  try {
    const gr = req.body;
    const verification = verifier.verify(gr);
    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify GR
app.post('/api/gr/:grId/verify', async (req, res) => {
  if (!verifier) {
    return res.status(503).json({ error: 'Verifier not ready' });
  }

  try {
    const gr = await getGR(req.params.grId);

    if (!gr) {
      return res.status(404).json({ error: 'GR not found' });
    }

    const verification = verifier.verify(gr);

    // Save alerts
    await saveAlerts(gr.id, verification.alerts);

    res.json(verification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts for GR
app.get('/api/gr/:grId/alerts', async (req, res) => {
  try {
    const alerts = await getAlerts(req.params.grId);
    res.json({ alerts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve GR
app.post('/api/gr/:grId/approve', async (req, res) => {
  try {
    const targetStatus = req.body.status || 'approved';
    await updateGRStatus(req.params.grId, targetStatus, req.body.userId || 'system');

    const gr = await getGR(req.params.grId);
    res.json({
      success: true,
      gr,
      status: targetStatus,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject GR
app.post('/api/gr/:grId/reject', async (req, res) => {
  try {
    const grId = req.params.grId;
    const userId = req.body.userId || 'system';
    const reason = req.body.reason;
    const role = req.body.role || '';

    let rejectedBy = 'senior_clerk';
    if (role.toLowerCase() === 'minister' || userId.toLowerCase().includes('minister')) {
      rejectedBy = 'minister';
    }

    const gr = await getGR(grId);
    if (gr) {
      gr.status = 'rejected';
      gr.rejectedBy = rejectedBy;
      gr.rejectedReason = reason;
      await saveGR(gr, userId);
    }

    await updateGRStatus(grId, 'rejected', userId, reason);

    res.json({
      success: true,
      status: 'rejected',
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get policy evolution
app.get('/api/policy-evolution/:keyword', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const evolution = indexer.getPolicyEvolution(req.params.keyword);
  res.json({ evolution });
});

// Get similar GRs
app.post('/api/similar-grs', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const gr = req.body;
  const similar = indexer.findSimilar(gr, req.body.limit || 10);

  res.json({
    count: similar.length,
    similar,
  });
});

// Official HTML / Printable Document Export
app.get('/api/gr/:grId/export/html', async (req, res) => {
  try {
    const grId = req.params.grId;
    let gr = await getGR(grId);
    if (!gr && indexer) {
      gr = indexer.getGRById(grId);
    }
    if (!gr) {
      return res.status(404).send('<h1>GR Document Not Found</h1>');
    }

    const dept = gr.department || gr.metadata?.departmentName || 'GOVERNMENT OF MAHARASHTRA';
    const date = gr.metadata?.grDate || gr.metadata?.date || new Date().toISOString().split('T')[0];
    const grNumber = gr.calculated_21_digit_gr_id || gr.id || '20260728114530120301';
    const secToken = gr.security_checksum || 'SEC-MH-8F21A-2026';
    const signee = gr.metadata?.signeeDesignation || 'Under Secretary to Government of Maharashtra';

    const preambleMarathi = gr.sections?.preamble_marathi || gr.sections?.introduction || '';
    const preambleEnglish = gr.sections?.preamble_english || '';
    const clausesMarathi = gr.sections?.resolution_clauses_marathi || (gr.sections?.resolution ? gr.sections.resolution.split('\n') : []);
    const clausesEnglish = gr.sections?.resolution_clauses_english || [];
    const readText = gr.sections?.read_section_text || '';
    const distText = gr.sections?.footer_distribution_text || '';
    const historicalRefs = gr.historical_references || [];

    const htmlContent = `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <title>Government Resolution - ${grNumber}</title>
  <style>
    body { font-family: 'Inter', 'Noto Sans Devanagari', Arial, sans-serif; background: #f4f6f8; margin: 0; padding: 20px; color: #111; }
    .gr-page { max-width: 850px; margin: 0 auto; background: #fff; border: 2px solid #0A2540; padding: 40px 50px; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border-radius: 4px; position: relative; }
    .tricolor-stripe { height: 8px; background: linear-gradient(90deg, #FF671F 0%, #FF671F 33%, #FFFFFF 33%, #FFFFFF 66%, #046A38 66%, #046A38 100%); margin-bottom: 25px; border-radius: 2px; }
    .gov-header { text-align: center; border-bottom: 2px solid #D4AF37; padding-bottom: 15px; margin-bottom: 25px; }
    .emblem-img { width: 75px; height: 75px; margin-bottom: 8px; }
    .gov-title { font-size: 22px; font-weight: 800; color: #0A2540; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; }
    .dept-title { font-size: 16px; font-weight: 700; color: #FF671F; margin: 5px 0 0 0; }
    .gr-meta-bar { display: flex; justify-content: space-between; font-size: 13px; font-weight: 600; background: #F8FAFC; padding: 10px 15px; border: 1px solid #E2E8F0; border-radius: 4px; margin-bottom: 20px; color: #334155; }
    .sec-badge { font-family: monospace; font-weight: bold; color: #046A38; }
    .section-title { font-size: 16px; font-weight: 700; color: #0A2540; border-bottom: 1.5px solid #0A2540; padding-bottom: 4px; margin-top: 25px; margin-bottom: 12px; }
    .preamble-box { font-size: 14px; line-height: 1.7; text-align: justify; text-indent: 30px; margin-bottom: 15px; }
    .clause-list { padding-left: 0; list-style: none; margin: 0; }
    .clause-item { font-size: 14px; line-height: 1.7; margin-bottom: 10px; padding-left: 24px; text-indent: -24px; text-align: justify; }
    .sign-off { margin-top: 40px; text-align: right; font-size: 14px; font-weight: 600; }
    .footer-links { margin-top: 35px; border-top: 2px dashed #CBD5E1; padding-top: 15px; font-size: 12px; color: #475569; }
    .ref-link { color: #0056b3; font-weight: 600; text-decoration: none; }
    .ref-link:hover { text-decoration: underline; }
    @media print {
      body { background: white; padding: 0; }
      .gr-page { border: none; box-shadow: none; padding: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="max-width: 850px; margin: 0 auto 15px auto; text-align: right;">
    <button onclick="window.print()" style="background: #046A38; color: white; border: none; padding: 10px 20px; font-weight: bold; border-radius: 4px; cursor: pointer;">🖨️ Download / Print Official GR PDF</button>
  </div>
  <div class="gr-page">
    <div class="tricolor-stripe"></div>
    <div class="gov-header">
      <img class="emblem-img" src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Emblem_of_Maharashtra.svg" alt="Rajmudra Emblem" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><circle cx=\'50\' cy=\'50\' r=\'45\' fill=\'%23D4AF37\'/><text x=\'50\' y=\'55\' font-size=\'14\' text-anchor=\'middle\' fill=\'%230A2540\' font-weight=\'bold\'>राजमुद्रा</text></svg>'"/>
      <h1 class="gov-title">महाराष्ट्र शासन (Government of Maharashtra)</h1>
      <h2 class="dept-title">${dept}</h2>
    </div>

    <div class="gr-meta-bar">
      <div><strong>२१-अंकी संगणक संकेतांक (21-Digit GR ID):</strong> ${grNumber}</div>
      <div><strong>दिनांक:</strong> ${date}</div>
      <div><strong>सुरक्षा टोकन:</strong> <span class="sec-badge">${secToken}</span></div>
    </div>

    ${readText ? `<div class="section-title">संदर्भ (References)</div><pre style="font-family: inherit; font-size: 13.5px; white-space: pre-wrap; background: #f9fafb; padding: 10px; border-left: 3px solid #0A2540; margin-bottom: 20px;">${readText}</pre>` : ''}

    <div class="section-title">प्रस्तावना (Preamble)</div>
    ${preambleMarathi ? `<div class="preamble-box">${preambleMarathi}</div>` : ''}
    ${preambleEnglish ? `<div class="preamble-box" style="font-style: italic; color: #334155;">${preambleEnglish}</div>` : ''}

    <div class="section-title">शासकीय निर्णय (Resolution Clauses)</div>
    <ul class="clause-list">
      ${clausesMarathi.map(c => `<li class="clause-item">${c}</li>`).join('')}
    </ul>

    ${clausesEnglish.length > 0 ? `
      <div style="margin-top: 15px; font-weight: 600; color: #475569; font-size: 13px;">English Translation of Clauses:</div>
      <ul class="clause-list" style="color: #334155; font-style: italic;">
        ${clausesEnglish.map(c => `<li class="clause-item">${c}</li>`).join('')}
      </ul>
    ` : ''}

    <div class="sign-off">
      <p>महाराष्ट्राचे राज्यपाल यांच्या आदेशानुसार व नावाने,</p>
      <br/><br/>
      <p style="text-decoration: underline; font-size: 15px;">(${gr.metadata?.signeeName || 'स्वाक्षरी'})</p>
      <p>${signee}<br/>महाराष्ट्र शासन</p>
    </div>

    ${distText ? `
      <div class="section-title">प्रत माहिती व कार्यवाहीसाठी (Distribution)</div>
      <pre style="font-family: inherit; font-size: 13px; white-space: pre-wrap; background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 4px;">${distText}</pre>
    ` : ''}

    ${historicalRefs.length > 0 ? `
      <div class="footer-links">
        <strong>📋 अस्सल संदर्भ ऐतिहासिक शासन निर्णय (Historical Reference GRs Cited by AI):</strong>
        <ul style="margin: 5px 0 0 0; padding-left: 20px;">
          ${historicalRefs.map(r => `<li><a class="ref-link" href="${r.linkUrl}" target="_blank">${r.grNumber} - ${r.subject} (${r.department})</a></li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>
</body>
</html>`;

    res.send(htmlContent);
  } catch (error) {
    res.status(500).send(`<h1>Error generating GR HTML: ${error.message}</h1>`);
  }
});

// List GRs
app.get('/api/grs', async (req, res) => {
  try {
    const filters = {
      department: req.query.department,
      status: req.query.status,
      createdBy: req.query.createdBy,
    };

    const grs = await getAllGRs(filters);
    res.json({
      count: grs.length,
      grs,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  const initialized = await initializeBackend();

  if (initialized) {
    app.listen(PORT, () => {
      console.log(`\n🎉 Server running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:5173`);
    });
  } else {
    console.error('❌ Failed to initialize backend');
    process.exit(1);
  }
}

startServer();

export default app;
