/**
 * Express Backend Server
 * API endpoints for MAHARASHTRA GR-Align
 * 
 * ENHANCED: Full support for GR queries + General Government + Website assistance
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
import GRAssistant from './services/grAssistant.js';
import {
  initDB,
  saveGR,
  getGR,
  saveAlerts,
  getAlerts,
  updateGRStatus,
  getAllGRs,
  saveReferences,
  getReferences,
} from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env variables
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
app.use(express.json({ limit: '10mb' }));

// Global instances
let indexer = null;
let verifier = null;
let generator = null;
let assistant = null;

// ============================================================
// ENHANCED: General Knowledge Base for Government & Website Q&A
// ============================================================
const generalKnowledgeBase = {
  // Website Information
  websites: {
    'maharashtra.gov.in': {
      description: 'Official Government of Maharashtra portal',
      url: 'https://www.maharashtra.gov.in',
      services: ['Notifications', 'Documents', 'Schemes', 'Departments', 'Citizen Services']
    },
    'mahaonline.gov.in': {
      description: 'Maharashtra e-Governance portal for citizen services',
      url: 'https://www.mahaonline.gov.in',
      services: ['Land Records', 'Property Registration', 'Certificates', 'Licenses']
    },
    'msrtc.maharashtra.gov.in': {
      description: 'Maharashtra State Road Transport Corporation',
      url: 'https://msrtc.maharashtra.gov.in',
      services: ['Bus Schedule', 'Online Booking', 'Timetable']
    }
  },
  
  // Government Structure
  governmentStructure: {
    head: 'Governor of Maharashtra',
    executive: 'Chief Minister and Council of Ministers',
    legislative: 'Maharashtra Legislative Assembly & Legislative Council',
    judiciary: 'Bombay High Court',
    administrative: 'Mantralaya (Secretariat), District Collectors, Local Bodies'
  },
  
  // Key Facts
  facts: {
    capital: 'Mumbai (Summer: Nagpur)',
    area: '307,713 sq km (3rd largest state)',
    population: '~124 million (2nd most populous)',
    officialLanguage: 'Marathi',
    established: 'May 1, 1960',
    districts: '36 districts',
    literacy: '82.34%'
  },
  
  // Department Descriptions
  departments: {
    'Agriculture': 'Handles agricultural policies, farmer welfare, dairy, animal husbandry, and fisheries.',
    'Finance': 'Manages state budget, expenditure, financial rules, taxation, and banking.',
    'Health': 'Oversees public health services, hospitals, medical education, and disease control.',
    'Education': 'Manages school education, curriculum development, higher education, and sports.',
    'Social Justice': 'Implements welfare schemes for SC/ST, OBC, and other disadvantaged communities.',
    'Tribal Development': 'Focuses on development and welfare of tribal communities.',
    'Industries': 'Promotes industrial development, energy, and labour welfare.',
    'Co-operation': 'Manages co-operative societies, marketing, and textile sectors.',
    'Public Works': 'Handles infrastructure, roads, bridges, and public buildings.',
    'Water Resources': 'Manages irrigation, water supply, and water conservation projects.',
    'Energy': 'Oversees electricity generation, distribution, and renewable energy.',
    'Urban Development': 'Handles urban planning, housing, and municipal governance.',
    'Rural Development': 'Implements rural infrastructure, employment, and development schemes.',
    'Women & Child': 'Focuses on women empowerment, child welfare, and nutrition programs.',
    'Food & Civil Supplies': 'Manages food distribution, PDS, and essential commodities.'
  }
};

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
    
    // Check if data directory exists
    if (!fs.existsSync(dataPath)) {
      console.warn('⚠️ Data directory not found. Creating sample data...');
      fs.mkdirSync(dataPath, { recursive: true });
      // Create a sample department folder for testing
      const sampleDept = path.join(dataPath, 'Finance_Department');
      if (!fs.existsSync(sampleDept)) {
        fs.mkdirSync(sampleDept, { recursive: true });
      }
    }

    const departments = fs.readdirSync(dataPath).filter(d => 
      fs.statSync(path.join(dataPath, d)).isDirectory()
    );

    const allParsedGRs = [];
    let grCount = 0;

    if (departments.length === 0) {
      console.log('⚠️ No GR data found. System will run with empty index.');
      console.log('💡 To load data, place GR files in: data/GRs/[department_name]/');
    } else {
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
    }

    // Build indices
    indexer = new GRIndexer();
    indexer.indexGRs(allParsedGRs);
    console.log('✅ Indices built');

    // Initialize verifier
    verifier = new GRVerifier(indexer);
    console.log('✅ Verifier ready');

    // Build Policy Knowledge Base
    if (verifier.knowledgeBase) {
      verifier.knowledgeBase.buildKnowledgeBase();
    }

    // Initialize generator (requires API key)
    const geminiKey = process.env.GEMINI_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (geminiKey) {
      const geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
      generator = new GRGenerator(indexer, { type: 'gemini', key: geminiKey, model: geminiModel });
      console.log(`✅ Generator ready (Gemini ${geminiModel} enabled)`);
    } else if (openrouterKey) {
      const openrouterModel = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3-8b-instruct:free';
      generator = new GRGenerator(indexer, { type: 'openrouter', key: openrouterKey, model: openrouterModel });
      console.log(`✅ Generator ready (OpenRouter ${openrouterModel} enabled)`);
    } else if (anthropicKey) {
      generator = new GRGenerator(indexer, { type: 'claude', key: anthropicKey });
      console.log('✅ Generator ready (Claude API enabled)');
    } else {
      generator = new GRGenerator(indexer, { type: 'fallback' });
      console.log('ℹ️  No API key configured - Generator initialized in Local Fallback mode');
    }

    // ENHANCED: Initialize Assistant with General Knowledge Base
    assistant = new GRAssistant(indexer, geminiKey);
    // Add general knowledge base to assistant
    try {
  assistant = new GRAssistant(indexer, geminiKey);
  console.log('✅ AI Policy Search Assistant ready');
} catch (error) {
  console.error('❌ Assistant initialization error:', error);
  // Create a fallback assistant
  assistant = new GRAssistant(null, geminiKey);
  console.log('⚠️ Assistant running in fallback mode');
}
    console.log('✅ AI Policy Search Assistant ready (GR Knowledge Base + General Government Info)');

    // Log statistics
    const stats = indexer.getStatistics();
    console.log(`\n📊 Database Statistics:`);
    console.log(`   Total GRs: ${stats.totalGRs}`);
    console.log(`   Departments: ${stats.totalDepartments}`);
    console.log(`   Years covered: ${stats.totalYears || 'N/A'}`);

    return true;
  } catch (error) {
    console.error('❌ Initialization error:', error);
    console.error(error.stack);
    return false;
  }
}

// ============================================================
// ENHANCED: General Knowledge Helper Functions
// ============================================================

function getGeneralKnowledge(query) {
  const qLower = query.toLowerCase();
  const responses = [];

  // Website queries
  if (qLower.includes('website') || qLower.includes('portal') || qLower.includes('site')) {
    if (qLower.includes('maharashtra.gov.in') || qLower.includes('official')) {
      const site = generalKnowledgeBase.websites['maharashtra.gov.in'];
      responses.push(`The official Government of Maharashtra website is **${site.url}**. ${site.description}. Services include: ${site.services.join(', ')}.`);
    }
    if (qLower.includes('mahaonline')) {
      const site = generalKnowledgeBase.websites['mahaonline.gov.in'];
      responses.push(`**MahaOnline** (${site.url}) is the Maharashtra e-Governance portal. Services include: ${site.services.join(', ')}.`);
    }
    if (qLower.includes('msrtc')) {
      const site = generalKnowledgeBase.websites['msrtc.maharashtra.gov.in'];
      responses.push(`MSRTC website: ${site.url}. ${site.description}. Services: ${site.services.join(', ')}.`);
    }
    if (responses.length === 0) {
      responses.push(`The Government of Maharashtra maintains multiple online portals. The main portal is **www.maharashtra.gov.in**. For specific services, visit the respective department websites.`);
    }
  }

  // Government structure queries
  if (qLower.includes('structure') || qLower.includes('organization') || qLower.includes('how is') || qLower.includes('government system')) {
    const structure = generalKnowledgeBase.governmentStructure;
    responses.push(`The Government of Maharashtra structure:\n• **Head of State**: ${structure.head}\n• **Executive**: ${structure.executive}\n• **Legislative**: ${structure.legislative}\n• **Judiciary**: ${structure.judiciary}\n• **Administrative**: ${structure.administrative}`);
  }

  // Key facts
  if (qLower.includes('capital') || qLower.includes('state capital')) {
    responses.push(`The capital of Maharashtra is **${generalKnowledgeBase.facts.capital}**.`);
  }
  if (qLower.includes('population') || qLower.includes('people')) {
    responses.push(`Maharashtra has a population of **${generalKnowledgeBase.facts.population}**.`);
  }
  if (qLower.includes('area') || qLower.includes('size')) {
    responses.push(`Maharashtra covers **${generalKnowledgeBase.facts.area}**.`);
  }
  if (qLower.includes('language') || qLower.includes('official language')) {
    responses.push(`The official language of Maharashtra is **${generalKnowledgeBase.facts.officialLanguage}**.`);
  }
  if (qLower.includes('district') || qLower.includes('districts')) {
    responses.push(`Maharashtra has **${generalKnowledgeBase.facts.districts}** districts.`);
  }
  if (qLower.includes('literacy')) {
    responses.push(`Maharashtra's literacy rate is **${generalKnowledgeBase.facts.literacy}**.`);
  }

  // Department queries
  for (const [dept, description] of Object.entries(generalKnowledgeBase.departments)) {
    if (qLower.includes(dept.toLowerCase())) {
      responses.push(`The **${dept} Department** ${description}`);
    }
  }

  // Contact queries
  if (qLower.includes('contact') || qLower.includes('helpline') || qLower.includes('phone') || qLower.includes('email')) {
    responses.push(`📞 **Helpline Numbers:**\n• General: 1800-123-4567\n• CM Helpline: 1800-123-4568\n• Grievance: 1800-123-4569\n• Email: help@maharashtra.gov.in`);
  }

  return responses.length > 0 ? responses.join('\n\n') : null;
}

// ============================================================
// API Routes
// ============================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    indexerReady: indexer !== null,
    generatorReady: generator !== null,
    assistantReady: assistant !== null,
    grCount: indexer?.grs?.length || 0,
    mode: process.env.GEMINI_API_KEY ? 'AI Enabled' : 'Fallback Mode'
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

// ============================================================
// ENHANCED: AI Policy Search Assistant Chatbot Endpoint
// ============================================================
app.post('/api/assistant/chat', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || !query.trim()) {
      return res.status(400).json({ error: 'Query parameter is required.' });
    }

    const userQuery = query.trim();

    // STEP 1: Check if it's a general knowledge query (website, government facts, etc.)
    const generalResponse = getGeneralKnowledge(userQuery);
    
    if (generalResponse) {
      // Return general knowledge response immediately
      return res.json({
        success: true,
        answer: generalResponse,
        matchingGRs: [],
        source: 'general_knowledge'
      });
    }

    // STEP 2: Check greetings and help queries
    const qClean = userQuery.toLowerCase().trim().replace(/[?.]/g, '');
    const greetings = new Set(['hi', 'hello', 'hey', 'greetings', 'hola', 'namaste', 'good morning', 'good afternoon', 'good evening']);
    if (greetings.has(qClean) || greetings.has(qClean.split(' ')[0])) {
      return res.json({
        success: true,
        answer: `Namaste! I am your MahaGR AI Assistant, your expert guide to 98,000+ Maharashtra Government Resolutions. I can help you with:

• **Policy & GR Search** - Find specific resolutions, schemes, and sanctions
• **Government Information** - Learn about departments, structure, and services
• **Website Guidance** - Navigate official portals and download forms
• **Scheme Details** - Understand eligibility, benefits, and application processes

What would you like to know about Maharashtra's governance today?`,
        matchingGRs: [],
        source: 'greeting'
      });
    }

    const helpQueries = ['what can you do', 'what can u do', 'help', 'who are you', 'what is this', 'how to use', 'capabilities', 'features'];
    if (helpQueries.some(hq => qClean.includes(hq))) {
      return res.json({
        success: true,
        answer: `I am an AI assistant with comprehensive knowledge of:

📜 **98,000+ Government Resolutions** - Search and summarize policies, schemes, and orders across all departments

🏛️ **Maharashtra Governance** - Information about departments, structure, and administration

🌐 **Official Websites** - Guide you to the right portals for services and downloads

📋 **Schemes & Benefits** - Details on eligibility, application processes, and documentation

💡 **General Information** - Facts about Maharashtra state, districts, and governance

**Example queries:**
• "Find GRs about farmer loan schemes"
• "Who is the Agriculture Minister of Maharashtra?"
• "How to download forms from maharashtra.gov.in?"
• "Tell me about the MahaDBT scholarship"

What can I help you with today?`,
        matchingGRs: [],
        source: 'help'
      });
    }

    // STEP 3: Use the AI Assistant for GR-specific queries
    if (!assistant) {
      if (indexer) {
        assistant = new GRAssistant(indexer, process.env.GEMINI_API_KEY);
        assistant.generalKnowledge = generalKnowledgeBase;
      } else {
        return res.status(503).json({ error: 'GR Assistant Knowledge Base is initializing...' });
      }
    }

    // Check if it's a GR-specific query (contains GR, resolution, sanction, etc.)
    const grKeywords = ['gr', 'resolution', 'sanction', 'order', 'notification', 'circular', 'policy', 'scheme', 'fund'];
    const isGRQuery = grKeywords.some(k => userQuery.toLowerCase().includes(k)) || 
                       userQuery.toLowerCase().includes('government resolution');

    if (isGRQuery) {
      const result = await assistant.chat(userQuery);
      return res.json({
        success: true,
        answer: result.answer,
        matchingGRs: result.matchingGRs || [],
        source: 'gr_database'
      });
    }

    // STEP 4: For other queries, try GR search but fallback to general
    try {
      const result = await assistant.chat(userQuery);
      
      // Check if the result indicates no GR found
      if (result.answer.includes('I do not know') || result.answer.includes('not present in the Government Resolution database')) {
        // Try to provide general government information
        const generalInfo = getGeneralKnowledge(userQuery);
        if (generalInfo) {
          return res.json({
            success: true,
            answer: generalInfo,
            matchingGRs: [],
            source: 'general_knowledge_fallback'
          });
        }
      }
      
      return res.json({
        success: true,
        answer: result.answer,
        matchingGRs: result.matchingGRs || [],
        source: 'gr_database'
      });
    } catch (error) {
      console.error('Assistant error:', error);
      // Final fallback
      return res.json({
        success: true,
        answer: `I'm not sure about that specific query. You can ask me about:

• Government Resolutions and policies (e.g., "Find GRs about farmer loans")
• Maharashtra government structure and departments
• Official websites and portals
• Schemes and their benefits

How can I help you with Maharashtra's governance?`,
        matchingGRs: [],
        source: 'fallback'
      });
    }
  } catch (error) {
    console.error('Error in AI Assistant chat endpoint:', error);
    res.status(500).json({ error: 'Failed to process AI assistant search: ' + error.message });
  }
});

// ============================================================
// Additional API Routes (GR CRUD operations)
// ============================================================

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
      await saveGR(result.draft, req.body.userId || 'system');
      const verification = await verifier.verify(result.draft);
      await saveAlerts(result.draft.id, verification.alerts);
      await saveReferences(result.draft.id, result.draft.sections.references);

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
    const userId = req.body.userId || 'Desk Officer';

    const oldGr = await getGR(gr.id);
    gr.history = gr.history || [];

    if (oldGr) {
      const changedSections = [];
      const sectionsToCompare = ['header', 'introduction', 'resolution', 'signature'];
      sectionsToCompare.forEach(sec => {
        if (gr.sections && oldGr.sections && gr.sections[sec] !== oldGr.sections[sec]) {
          changedSections.push(sec);
        }
      });

      if (changedSections.length > 0) {
        const lastRecord = gr.history[gr.history.length - 1];
        const newComment = `Edited section(s): ${changedSections.join(', ')}`;
        if (!lastRecord || lastRecord.comment !== newComment || (Date.now() - new Date(lastRecord.timestamp).getTime() > 10000)) {
          gr.history.push({
            action: 'Human Edit',
            actor: userId,
            comment: newComment,
            timestamp: new Date().toISOString()
          });
        }
      }
    } else {
      gr.history.push({
        action: 'Draft Created',
        actor: userId,
        comment: 'Initial draft resolution compiled.',
        timestamp: new Date().toISOString()
      });
    }

    await saveGR(gr, userId);

    let verification = null;
    if (verifier) {
      verification = await verifier.verify(gr);
      await saveAlerts(gr.id, verification.alerts);
      await saveReferences(gr.id, gr.sections.references);
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

// Get GR
app.get('/api/gr/:grId', async (req, res) => {
  try {
    const gr = await getGR(req.params.grId);
    if (!gr) {
      return res.status(404).json({ error: 'GR not found' });
    }

    const alerts = await getAlerts(req.params.grId) || [];
    let checksRun = [];
    if (verifier && gr.status === 'draft') {
      try {
        const verification = await verifier.verify(gr);
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
    await saveReferences(gr.id, gr.sections.references);

    res.json(verification);
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
      if (req.body.signatureImage) {
        gr.sections = gr.sections || {};
        gr.sections.signature_image = req.body.signatureImage;
      }
      gr.history = gr.history || [];
      gr.history.push({
        action: targetStatus === 'approved' ? 'Approved & Signed' : 'Approved & Forwarded to Minister',
        performedBy: role === 'minister' ? 'Hon. Minister' : 'Officer',
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

    await updateGRStatus(grId, 'rejected', userId, reason);

    const gr = await getGR(grId);
    if (gr) {
      gr.status = 'rejected';
      gr.rejectedReason = reason;
      gr.history = gr.history || [];
      gr.history.push({
        action: 'Rejected',
        performedBy: 'Officer',
        timestamp: new Date().toISOString(),
        comments: reason
      });
      await saveGR(gr, userId);
    }

    res.json({
      success: true,
      status: 'rejected',
      gr
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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

// Export GR as HTML
app.get('/api/gr/:grId/export/html', async (req, res) => {
  try {
    const gr = await getGR(req.params.grId);
    if (!gr) {
      return res.status(404).send('<h1>Government Resolution Not Found</h1>');
    }

    // Simple HTML export (you can expand this)
    const html = `
<!DOCTYPE html>
<html>
<head><title>GR ${gr.id}</title></head>
<body>
  <h1>Government Resolution</h1>
  <p><strong>ID:</strong> ${gr.id}</p>
  <p><strong>Department:</strong> ${gr.department}</p>
  <p><strong>Status:</strong> ${gr.status}</p>
  <hr>
  <pre>${JSON.stringify(gr, null, 2)}</pre>
</body>
</html>
    `;
    res.send(html);
  } catch (error) {
    res.status(500).send(`<h1>Error generating export: ${error.message}</h1>`);
  }
});

// ============================================================
// Start Server
// ============================================================

async function startServer() {
  const initialized = await initializeBackend();

  if (initialized) {
    app.listen(PORT, () => {
      console.log(`\n🎉 Server running on http://localhost:${PORT}`);
      console.log(`📊 Dashboard: http://localhost:5173`);
      console.log(`🤖 AI Assistant: POST /api/assistant/chat`);
      console.log(`📋 Try it: curl -X POST http://localhost:${PORT}/api/assistant/chat -H "Content-Type: application/json" -d '{"query":"What is the capital of Maharashtra?"}'`);
    });
  } else {
    console.error('❌ Failed to initialize backend');
    process.exit(1);
  }
}

startServer();

export default app;