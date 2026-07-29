/**
 * Express Backend Server
 * API endpoints for MAHARASHTRA GR-Align
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import GRParser from './services/grParser.js';
import GRIndexer from './services/grIndexer.js';
import GRVerifier from './services/grVerifier.js';
// Fixed import - note the class name is now grGenerator (lowercase g)
import GRGenerator from './services/grGenerator.js';
import GRAssistant from './services/grAssistant.js';
import {
  initDB,
  saveGR,
  getGR,
  saveAlerts,
  getAlerts,
  updateGRStatus,
  getAllGRs,
} from './db.js';

// Get current directory (backend folder)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend folder FIRST
const envPath = path.join(__dirname, '.env');
console.log(`📁 Loading .env from: ${envPath}`);

if (fs.existsSync(envPath)) {
  console.log('✅ .env file found in backend folder!');
  dotenv.config({ path: envPath });
} else {
  console.error('❌ .env file NOT found in backend folder!');
  console.log('💡 Create /backend/.env with your API keys');
  dotenv.config();
}

// Debug: Show what was loaded
console.log('\n🔑 API Configuration:');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Not set');
console.log('OPENROUTER_API_KEY:', process.env.OPENROUTER_API_KEY ? '✅ Set' : '❌ Not set');
console.log('ANTHROPIC_API_KEY:', process.env.ANTHROPIC_API_KEY ? '✅ Set' : '❌ Not set');
console.log('PORT:', process.env.PORT || '5000 (default)');
console.log('');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Global instances
let indexer = null;
let verifier = null;
let generator = null;
let assistant = null;

// API Key Validation Helper
function validateApiKey(key, type) {
  if (!key || key.trim() === '') {
    return { valid: false, error: `${type} API key is missing or empty` };
  }
  
  if (type === 'gemini' && !key.startsWith('AIza')) {
    return { valid: false, error: 'Invalid Gemini API key format. Should start with "AIza"' };
  }
  
  if (type === 'openrouter' && key.length < 20) {
    return { valid: false, error: 'OpenRouter API key seems too short' };
  }
  
  if (type === 'anthropic' && !key.startsWith('sk-ant-')) {
    return { valid: false, error: 'Invalid Anthropic API key format. Should start with "sk-ant-"' };
  }
  
  return { valid: true };
}

/**
 * Initialize backend: Parse all GRs and build indices
 */
async function initializeBackend() {
  console.log('🚀 Initializing backend...');

  try {
    await initDB();
    console.log('✅ Database initialized');

    const parser = new GRParser();
    console.log('✅ Parser ready');

    const dataPath = path.join(__dirname, 'data', 'GRs');
    
    if (!fs.existsSync(dataPath)) {
      console.warn(`⚠️ Data directory not found: ${dataPath}`);
      console.log('📁 Creating sample data structure...');
      fs.mkdirSync(dataPath, { recursive: true });
    }
    
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

    indexer = new GRIndexer();
    indexer.indexGRs(allParsedGRs);
    console.log('✅ Indices built');

    verifier = new GRVerifier(indexer);
    console.log('✅ Verifier ready');

    if (verifier.knowledgeBase) {
      verifier.knowledgeBase.buildKnowledgeBase();
    }

    // Initialize generator with API key validation
    const geminiKey = process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    let apiConfigured = false;
    let apiErrors = [];

    // Try Gemini first
    if (geminiKey) {
      const validation = validateApiKey(geminiKey, 'gemini');
      if (validation.valid) {
        try {
          const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
          generator = new GRGenerator(indexer, { 
            type: 'gemini', 
            key: geminiKey, 
            model: geminiModel 
          });
          console.log(`✅ Generator ready (Gemini ${geminiModel} enabled)`);
          apiConfigured = true;
        } catch (error) {
          apiErrors.push(`Gemini initialization failed: ${error.message}`);
          console.error(`❌ Gemini initialization failed:`, error.message);
        }
      } else {
        apiErrors.push(`Gemini validation failed: ${validation.error}`);
        console.warn(`⚠️ ${validation.error}`);
      }
    }

    // Try OpenRouter if Gemini failed
    if (!apiConfigured && openrouterKey) {
      const validation = validateApiKey(openrouterKey, 'openrouter');
      if (validation.valid) {
        try {
          const openrouterModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free';
          generator = new GRGenerator(indexer, { 
            type: 'openrouter', 
            key: openrouterKey, 
            model: openrouterModel 
          });
          console.log(`✅ Generator ready (OpenRouter ${openrouterModel} enabled)`);
          apiConfigured = true;
        } catch (error) {
          apiErrors.push(`OpenRouter initialization failed: ${error.message}`);
          console.error(`❌ OpenRouter initialization failed:`, error.message);
        }
      } else {
        apiErrors.push(`OpenRouter validation failed: ${validation.error}`);
        console.warn(`⚠️ ${validation.error}`);
      }
    }

    // Try Anthropic
    if (!apiConfigured && anthropicKey) {
      const validation = validateApiKey(anthropicKey, 'anthropic');
      if (validation.valid) {
        try {
          generator = new GRGenerator(indexer, { 
            type: 'claude', 
            key: anthropicKey 
          });
          console.log('✅ Generator ready (Claude API enabled)');
          apiConfigured = true;
        } catch (error) {
          apiErrors.push(`Anthropic initialization failed: ${error.message}`);
          console.error(`❌ Anthropic initialization failed:`, error.message);
        }
      } else {
        apiErrors.push(`Anthropic validation failed: ${validation.error}`);
        console.warn(`⚠️ ${validation.error}`);
      }
    }

    // Fallback mode
    if (!apiConfigured) {
      generator = new GRGenerator(indexer, { type: 'fallback' });
      console.log('ℹ️  Generator initialized in Local Fallback mode');
      if (apiErrors.length > 0) {
        console.log('   API errors encountered:');
        apiErrors.forEach(err => console.log(`   - ${err}`));
      } else {
        console.log('   No API keys configured - using local fallback');
        console.log('   💡 To enable AI generation, add API keys to /backend/.env');
      }
    }

    assistant = new GRAssistant(indexer);
    console.log('✅ AI Policy Search Assistant ready');

    if (indexer && typeof indexer.getStatistics === 'function') {
      const stats = indexer.getStatistics();
      console.log(`\n📊 Database Statistics:`);
      console.log(`   Total GRs: ${stats.totalGRs || 0}`);
      console.log(`   Departments: ${stats.totalDepartments || 0}`);
      console.log(`   Districts: ${stats.districtCoverage || 0}`);
      console.log(`   Years covered: ${stats.yearBreakdown ? stats.yearBreakdown.length : 0}`);
    }

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
  const apiStatus = {
    configured: generator !== null,
    type: generator ? generator.config?.type || 'unknown' : 'none',
    ready: generator && generator.ready !== false
  };
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    indexerReady: indexer !== null,
    generatorReady: generator !== null,
    apiStatus: apiStatus,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get API status
app.get('/api/status', (req, res) => {
  const apiKeyStatus = {
    gemini: {
      configured: !!process.env.GEMINI_API_KEY,
      valid: process.env.GEMINI_API_KEY ? validateApiKey(process.env.GEMINI_API_KEY, 'gemini').valid : false,
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    },
    openrouter: {
      configured: !!process.env.OPENROUTER_API_KEY,
      valid: process.env.OPENROUTER_API_KEY ? validateApiKey(process.env.OPENROUTER_API_KEY, 'openrouter').valid : false,
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free'
    },
    anthropic: {
      configured: !!process.env.ANTHROPIC_API_KEY,
      valid: process.env.ANTHROPIC_API_KEY ? validateApiKey(process.env.ANTHROPIC_API_KEY, 'anthropic').valid : false
    },
    active: {
      type: generator ? generator.config?.type : 'none',
      ready: generator && generator.ready !== false
    }
  };
  
  res.json(apiKeyStatus);
});

// Dashboard statistics
app.get('/api/analytics/dashboard', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const analytics = indexer.getAnalytics();
  res.json(analytics);
});

// Search GRs - FIXED to handle various query formats
app.post('/api/search', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  try {
    const query = req.body || {};
    // Ensure query has proper format
    const searchParams = {
      keyword: query.keyword || query.query || '',
      department: query.department || '',
      district: query.district || '',
      yearFrom: query.yearFrom || '',
      yearTo: query.yearTo || ''
    };
    
    const results = indexer.search(searchParams);
    res.json({
      count: results.length,
      results: results.slice(0, 50),
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
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

// Real-time field verification
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
    return res.status(503).json({ 
      error: 'Generator not ready',
      details: 'No API key configured or initialization failed.',
      solution: 'Set GEMINI_API_KEY in /backend/.env file'
    });
  }

  try {
    const result = await generator.generateGR(req.body);

    if (result.success) {
      // Save to database
      await saveGR(result.draft, req.body.userId || 'system');

      let verification = null;
      let combinedConflictAudit = result.draft.conflict_audit || null;

      // Get the original conflicts from the draft
      const originalConflicts = result.draft.conflict_audit || { conflicted_grs: [], has_conflict: false };
      
      console.log('\n📊 === ORIGINAL CONFLICTS FROM DRAFT ===');
      console.log('Has Conflict:', originalConflicts.has_conflict);
      console.log('Conflicts Count:', originalConflicts.conflicted_grs?.length || 0);
      console.log('========================================\n');

      if (verifier) {
        try {
          verification = await verifier.verify(result.draft);
          
          // Get verification alerts
          const verifierAlerts = verification.alerts || [];
          const verifierConflicts = verifierAlerts.filter(a => a.category === 'conflict');
          
          // Get original conflicts
          const originalConflictGRs = originalConflicts.conflicted_grs || [];
          
          // COMBINE: Take conflicts from BOTH sources
          const combinedConflicts = [];
          
          // Add original conflicts
          originalConflictGRs.forEach(c => {
            combinedConflicts.push({
              grNumber: c.grNumber || c.sourceGrId,
              department: c.department || 'Unknown',
              reason: c.reason || c.conflict_details || 'Policy conflict detected',
              severity: c.severity || 'HIGH',
              sourceGrId: c.grNumber || c.sourceGrId,
              linkUrl: c.linkUrl || `/api/gr/${encodeURIComponent(c.grNumber || '')}`
            });
          });
          
          // Add verifier conflicts (avoid duplicates)
          const existingIds = new Set(combinedConflicts.map(c => c.grNumber).filter(Boolean));
          verifierConflicts.forEach(c => {
            if (!existingIds.has(c.sourceGrId)) {
              combinedConflicts.push({
                grNumber: c.sourceGrId || 'UNKNOWN',
                department: c.sourceDepartment || 'Unknown',
                reason: c.description || c.title || 'Verification conflict detected',
                severity: c.severity?.toUpperCase() || 'HIGH',
                sourceGrId: c.sourceGrId,
                linkUrl: c.linkUrl || `/api/gr/${encodeURIComponent(c.sourceGrId || '')}`
              });
            }
          });
          
          // Determine severity
          let maxSeverity = 'NONE';
          combinedConflicts.forEach(c => {
            const sev = c.severity?.toUpperCase() || 'NONE';
            const levels = { 'NONE': 0, 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
            if (levels[sev] > levels[maxSeverity]) maxSeverity = sev;
          });
          
          combinedConflictAudit = {
            has_conflict: combinedConflicts.length > 0 || originalConflicts.has_conflict,
            severity: maxSeverity,
            conflicted_grs: combinedConflicts,
            conflict_details: combinedConflicts.map(c => `${c.reason} (Ref: ${c.grNumber})`).join(' | ')
          };
          
          console.log('\n🔍 === COMBINED CONFLICT AUDIT ===');
          console.log('Has Conflict:', combinedConflictAudit.has_conflict);
          console.log('Severity:', combinedConflictAudit.severity);
          console.log('Conflicts Count:', combinedConflictAudit.conflicted_grs.length);
          combinedConflictAudit.conflicted_grs.forEach((c, i) => {
            console.log(`  ${i+1}. ${c.severity}: ${c.reason.substring(0, 80)}...`);
          });
          console.log('================================\n');
          
        } catch (verifyErr) {
          console.warn('Verification failed but continuing:', verifyErr.message);
          // Use original conflicts if verification fails
          combinedConflictAudit = originalConflicts;
        }
      }

      // Update the draft with combined conflicts
      result.draft.conflict_audit = combinedConflictAudit;

      // ALSO update the verification object to include the conflicts
      if (verification) {
        verification.conflict_audit = combinedConflictAudit;
        // Add conflicts to alerts if they're not already there
        if (combinedConflictAudit.conflicted_grs) {
          const existingAlertIds = new Set(verification.alerts.map(a => a.sourceGrId).filter(Boolean));
          combinedConflictAudit.conflicted_grs.forEach(c => {
            if (!existingAlertIds.has(c.sourceGrId)) {
              verification.alerts.push({
                severity: c.severity?.toLowerCase() || 'high',
                category: 'conflict',
                title: `🚨 ${c.severity || 'Policy'}: ${c.department || 'Unknown'}`,
                description: c.reason || 'Policy conflict detected',
                evidence: `Source: ${c.grNumber || 'Unknown'}`,
                remediationSuggestion: `Review references or mandates in ${c.grNumber} and coordinate across departments if necessary.`,
                sourceGrId: c.grNumber || c.sourceGrId,
                sourceDepartment: c.department,
                linkUrl: c.linkUrl || `/api/gr/${encodeURIComponent(c.grNumber || '')}`
              });
            }
          });
        }
      }

      res.json({
        success: true,
        grId: result.grId,
        draft: result.draft,
        verification: verification,
        tokensUsed: result.tokensUsed,
        apiUsed: generator.config?.type || 'fallback',
        // Explicitly include combined conflict_audit at top level
        conflict_audit: combinedConflictAudit
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Generation failed'
      });
    }
  } catch (error) {
    console.error('GR Generation error:', error);
    res.status(500).json({
      error: 'Failed to generate GR',
      details: error.message
    });
  }
});
// Save GR draft
app.post('/api/gr/save', async (req, res) => {
  try {
    const gr = req.body;
    const userId = req.body.userId || 'system';

    await saveGR(gr, userId);

    let verification = null;
    if (verifier) {
      verification = await verifier.verify(gr);
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
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

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
Fix the issues identified in the alert by adjusting/editing only the relevant sections.
Return your output in JSON format with the keys:
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
Return ONLY raw JSON.`;

  try {
    let responseText = '';
    let apiUsed = 'fallback';
    
    if (geminiKey) {
      const validation = validateApiKey(geminiKey, 'gemini');
      if (validation.valid) {
        try {
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
            apiUsed = 'gemini';
          } else {
            console.error("Gemini resolve failed:", response.status);
          }
        } catch (apiError) {
          console.error("Gemini API call error:", apiError.message);
        }
      }
    }

    let updatedSections = null;
    if (responseText) {
      try {
        const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        updatedSections = parsed.sections || parsed;
      } catch (e) {
        console.error("Failed to parse resolved sections:", e.message);
      }
    }

    if (!updatedSections) {
      console.log("Using local fallback for auto-resolve");
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

    await saveGR(updatedGr, gr.userId || 'system');

    let verification = null;
    if (verifier) {
      verification = await verifier.verify(updatedGr);
      await saveAlerts(updatedGr.id, verification.alerts);
    }

    res.json({
      success: true,
      gr: updatedGr,
      verification,
      apiUsed: apiUsed
    });
  } catch (error) {
    console.error("Auto resolve error:", error);
    res.status(500).json({ 
      error: error.message,
      details: 'Auto-resolve failed, but you can manually fix the issues'
    });
  }
});

// Helper to find GR by ID or GR Number
async function findGRByIdOrNumber(grId) {
  if (indexer) {
    let gr = indexer.getGRById(grId);
    if (gr) return gr;
    
    const indexedId = indexer.indices?.byGRNumber?.get(grId);
    if (indexedId) {
      gr = indexer.getGRById(indexedId);
      if (gr) return gr;
    }

    const normId = grId.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normId) {
      const normalizedMatchId = indexer.indices?.byGRNumberNormalized?.get(normId);
      if (normalizedMatchId) {
        gr = indexer.getGRById(normalizedMatchId);
        if (gr) return gr;
      }
    }
  }

  let gr = await getGR(grId);
  if (gr) return gr;
  
  if (!gr) {
    try {
      const db_instance = await initDB();
      let row = await db_instance.get('SELECT id FROM grs WHERE gr_number = ?', [grId]);
      if (!row) {
        row = await db_instance.get(
          'SELECT id FROM grs WHERE ? LIKE "%" || gr_number || "%" OR gr_number LIKE "%" || ? || "%"',
          [grId, grId]
        );
      }
      if (row) {
        gr = await getGR(row.id);
      }
    } catch (e) {
      console.error('Database query failed:', e);
    }
  }
  
  return gr;
}

// Get GR
app.get('/api/gr/:grId', async (req, res) => {
  try {
    const gr = await findGRByIdOrNumber(req.params.grId);

    if (!gr) {
      return res.status(404).json({ error: 'GR not found' });
    }

    if (gr.filename && fs.existsSync(gr.filename)) {
      try {
        gr.sections = gr.sections || {};
        gr.sections.fullText = fs.readFileSync(gr.filename, 'utf8');
      } catch (readErr) {
        console.error(`Failed to read file:`, readErr);
      }
    }

    const alerts = await getAlerts(req.params.grId) || [];

    let checksRun = [];
    if (verifier && gr.status === 'draft') {
      try {
        const verification = await verifier.verify(gr);
        checksRun = verification.checksRun;
      } catch (verifyErr) {
        console.warn(`Verifier skipped:`, verifyErr.message);
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

// Verify GR (dry-run)
app.post('/api/gr/verify-dryrun', async (req, res) => {
  if (!verifier) {
    return res.status(503).json({ error: 'Verifier not ready' });
  }
  try {
    const gr = req.body;
    const verification = await verifier.verify(gr);
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

    const verification = await verifier.verify(gr);
    await saveAlerts(gr.id, verification.alerts);

    res.json({
      verification,
      checksRun: verification.checksRun
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get alerts
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
    const userId = req.body.userId || 'system';
    const role = req.body.role || (userId.includes('minister') ? 'minister' : 'senior_officer');
    
    await updateGRStatus(req.params.grId, targetStatus, userId);

    const gr = await getGR(req.params.grId);
    if (gr) {
      gr.history = gr.history || [];
      gr.history.push({
        action: targetStatus === 'approved' ? 'Approved & Signed' : 'Approved & Forwarded to Minister',
        performedBy: role === 'minister' ? 'Hon. Minister Patil' : 'Officer Deshmukh (Joint Secy)',
        role: role,
        timestamp: new Date().toISOString(),
        comments: req.body.comments || 'Approved with formal digital sanction.'
      });
      await saveGR(gr, userId);
    }

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
    const reason = req.body.reason || 'Revision required.';
    const role = req.body.role || '';
    const actionType = req.body.actionType || 'request_changes';

    let rejectedBy = 'senior_officer';
    if (role.toLowerCase() === 'minister' || userId.toLowerCase().includes('minister')) {
      rejectedBy = 'minister';
    }

    const gr = await getGR(grId);
    if (gr) {
      gr.status = 'rejected';
      gr.rejectedBy = rejectedBy;
      gr.rejectedReason = reason;
      gr.history = gr.history || [];
      gr.history.push({
        action: actionType === 'reject' ? 'Permanently Rejected Document' : 'Requested Revision / Changes',
        performedBy: rejectedBy === 'minister' ? 'Hon. Minister Patil' : 'Officer Deshmukh',
        role: rejectedBy,
        timestamp: new Date().toISOString(),
        comments: reason
      });
      await saveGR(gr, userId);
    }

    await updateGRStatus(grId, 'rejected', userId, reason);

    res.json({
      success: true,
      status: 'rejected',
      actionType,
      gr
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AI Assistant Chat
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    if (!assistant) {
      if (indexer) {
        assistant = new GRAssistant(indexer);
      } else {
        return res.status(503).json({ error: 'GR Assistant Knowledge Base is initializing...' });
      }
    }

    const result = await assistant.chat(query.trim());
    res.json({
      success: true,
      answer: result.answer,
      matchingGRs: result.matchingGRs
    });
  } catch (error) {
    console.error('Error in AI Assistant:', error);
    res.status(500).json({ error: 'Failed to process AI assistant search: ' + error.message });
  }
});

// Policy evolution
app.get('/api/policy-evolution/:keyword', (req, res) => {
  if (!indexer) {
    return res.status(503).json({ error: 'Indexer not ready' });
  }

  const evolution = indexer.getPolicyEvolution(req.params.keyword);
  res.json({ evolution });
});

// Similar GRs
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

// Export HTML
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
      ${Array.isArray(clausesMarathi) ? clausesMarathi.map(c => `<li class="clause-item">${c}</li>`).join('') : ''}
    </ul>

    ${Array.isArray(clausesEnglish) && clausesEnglish.length > 0 ? `
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

    ${Array.isArray(historicalRefs) && historicalRefs.length > 0 ? `
      <div class="footer-links">
        <strong>📋 अस्सल संदर्भ ऐतिहासिक शासन निर्णय (Historical Reference GRs Cited by AI):</strong>
        <ul style="margin: 5px 0 0 0; padding-left: 20px;">
          ${historicalRefs.map(r => `<li><a class="ref-link" href="${r.linkUrl || '#'}" target="_blank">${r.grNumber || 'N/A'} - ${r.subject || ''} (${r.department || ''})</a></li>`).join('')}
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
      console.log(`🔑 API Status: http://localhost:${PORT}/api/status`);
      console.log(`📁 Health Check: http://localhost:${PORT}/health`);
    });
  } else {
    console.error('❌ Failed to initialize backend');
    process.exit(1);
  }
}

startServer();

export default app;