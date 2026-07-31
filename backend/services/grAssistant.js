/**
 * GR Assistant Service
 * Conversational AI Search & Policy Synthesis Engine across 98,000+ Maharashtra GRs
 */

export class GRAssistant {
  constructor(indexer, geminiKey = process.env.GEMINI_API_KEY, geminiModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash') {
    this.indexer = indexer;
    this.geminiKey = geminiKey;
    this.geminiModel = geminiModel;
  }

  /**
   * Search database for top matching GRs based on natural language prompt
   */
  _findRelevantGRs(userQuery) {
    if (!this.indexer || !this.indexer.grs) return [];

    const queryLower = userQuery.toLowerCase();
    
    // Stopwords list: exclude filler and search verbs
    const stopwords = new Set([
      'what', 'when', 'where', 'which', 'who', 'how', 'is', 'are', 'was', 'were',
      'the', 'about', 'regarding', 'launched', 'issued', 'show', 'tell', 'me', 'find',
      'search', 'gr', 'grs', 'policy', 'rules', 'rule', 'government', 'resolution',
      'there', 'any', 'for', 'scheme', 'schemes', 'benefit', 'benefits', 'details',
      'give', 'provide', 'information', 'department', 'state', 'maharashtra', 'with',
      'under', 'from', 'this', 'that', 'have', 'has', 'had', 'does', 'did'
    ]);

    const keywords = queryLower.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !stopwords.has(w));

    if (keywords.length === 0) {
      return [];
    }

    // Domain / Topic specific department boosting maps
    const domainBoostMap = {
      loan: ['Co-operation,_Textiles_and_Marketing_Department', 'Agriculture,_Dairy_Development,_Animal_Husbandry_and_Fisheries_Department', 'Finance_Department'],
      farmer: ['Agriculture,_Dairy_Development,_Animal_Husbandry_and_Fisheries_Department', 'Co-operation,_Textiles_and_Marketing_Department', 'Soil_and_Water_Conservation_Department'],
      farmers: ['Agriculture,_Dairy_Development,_Animal_Husbandry_and_Fisheries_Department', 'Co-operation,_Textiles_and_Marketing_Department'],
      sc: ['Social_Justice_and_Special_Assistance_Department', 'Other_Backward_Bahujan_Welfare_Department'],
      st: ['Tribal_Development_Department', 'Social_Justice_and_Special_Assistance_Department'],
      caste: ['Social_Justice_and_Special_Assistance_Department'],
      tribe: ['Tribal_Development_Department'],
      scholarship: ['Social_Justice_and_Special_Assistance_Department', 'Tribal_Development_Department', 'Higher_and_Technical_Education_Department', 'School_Education_and_Sports_Department', 'Minorities_Development_Department'],
      solar: ['Industries,_Energy_and_Labour_Department', 'Agriculture,_Dairy_Development,_Animal_Husbandry_and_Fisheries_Department'],
      pump: ['Industries,_Energy_and_Labour_Department', 'Agriculture,_Dairy_Development,_Animal_Husbandry_and_Fisheries_Department'],
      health: ['Public_Health_Department', 'Medical_Education_and_Drugs_Department'],
      lumpy: ['Agriculture,_Dairy_Development,_Animal_Husbandry_and_Fisheries_Department']
    };

    const targetDepts = new Set();
    keywords.forEach(kw => {
      if (domainBoostMap[kw]) {
        domainBoostMap[kw].forEach(d => targetDepts.add(d));
      }
    });

    // Score all GRs based on keyword matches & domain boost
    const scoredGRs = [];

    this.indexer.grs.forEach(gr => {
      let score = 0;
      const subject = (gr.metadata?.subject || '').toLowerCase();
      const dept = (gr.department || '').toLowerCase();
      const resolutions = (gr.sections?.resolutions?.map(r => r.text).join(' ') || '').toLowerCase();

      keywords.forEach(word => {
        if (subject.includes(word)) score += 25;
        if (dept.includes(word)) score += 10;
        if (resolutions.includes(word)) score += 3;
      });

      if (targetDepts.has(gr.department)) {
        score += 30;
      }

      if (score > 0) {
        scoredGRs.push({ gr, score });
      }
    });

    // Sort by score descending
    scoredGRs.sort((a, b) => b.score - a.score);

    return scoredGRs.map(item => item.gr).slice(0, 6);
  }

  /**
   * Helper to dynamically synthesize answer & parameters based on user query and top GR content
   */
  _extractShortBulletPoints(topGR, userQuery = '') {
    const dept = topGR.department?.replace(/_/g, ' ') || 'State Government';
    const subject = topGR.metadata?.subject || 'Government Resolution';
    const date = topGR.metadata?.date || 'N/A';
    
    // Direct answer paragraph summarizing the GR naturally like a human
    const directAnswer = `I found a Government Resolution regarding **${subject}**. It was issued by the **${dept}** on **${date}** under Resolution No. **${topGR.metadata?.grNumber || topGR.id}**.`;
    
    const bullets = [];
    
    // 1. Core Mandates / Resolution clauses
    const clauses = topGR.sections?.resolutions || [];
    if (clauses.length > 0) {
      // Pick the first 2 clauses as the key points
      clauses.slice(0, 2).forEach((c, idx) => {
        const cleanText = c.text.substring(0, 120).replace(/\n/g, ' ').trim();
        bullets.push(`• **Clause #${idx + 1}**: *"${cleanText}${c.text.length > 120 ? '...' : ''}"*`);
      });
    } else {
      bullets.push(`• **Status**: This contains official administrative rules and execution orders.`);
    }

    // 2. Financial allocations if present
    const mainFin = (topGR.sections?.financials || []).find(f => f.amountNumeric || f.amount);
    if (mainFin) {
      bullets.push(`• **Financial Sanction**: **₹${mainFin.amount || mainFin.amountNumeric}**`);
      if (mainFin.context) {
        // Extract a clean snippet of the context
        const cleanContext = mainFin.context.substring(0, 80).replace(/\n/g, ' ').trim();
        bullets.push(`• **Budget Details**: *"${cleanContext}..."*`);
      }
    }
    
    // 3. Account Heads
    const acctHead = (topGR.sections?.financials || []).find(f => f.type === 'accountHead');
    if (acctHead && acctHead.accountHead) {
      bullets.push(`• **Account Head**: Code **${acctHead.accountHead}**`);
    }

    // 4. Districts / Jurisdiction if present
    if (topGR.districts && topGR.districts.length > 0) {
      bullets.push(`• **Jurisdiction**: Applicable to **${topGR.districts.join(', ')}**`);
    }

    return `${directAnswer}\n\nHere are the key points from the document:\n${bullets.join('\n')}`;
  }

  /**
   * Synthesize conversational English response from query and retrieved GRs
   */
  async chat(userQuery) {
    const qClean = userQuery.toLowerCase().trim().replace(/[?.]/g, '');
    const greetings = new Set(['hi', 'hello', 'hey', 'greetings', 'hola']);
    const helpQueries = [
      'what can you do', 'what can u do', 'help', 'who are you', 'what is this', 
      'how to use', 'what can u tell me', 'what can you tell me', 'what do you do'
    ];

    if (greetings.has(qClean)) {
      return {
        answer: "Hello! I am your MahaGR AI Assistant. I can search through 98,980+ Maharashtra Government Resolutions and summarize their details for you. What policy or topic are you interested in today?",
        matchingGRs: []
      };
    }
    
    if (helpQueries.some(hq => qClean.includes(hq))) {
      return {
        answer: "I am an AI assistant trained on the database of 98,980+ Maharashtra Government Resolutions. You can ask me about agricultural schemes, educational scholarships, public health orders, department sanctions, or specific resolution subjects. I will find the relevant documents, summarize the core details, and provide links to view the official resolutions.",
        matchingGRs: []
      };
    }

    const matchingGRs = this._findRelevantGRs(userQuery);

    if (matchingGRs.length === 0) {
      return {
        answer: "I do not know the answer to this question as it is not present in the Government Resolution database.",
        matchingGRs: []
      };
    }

    const topGR = matchingGRs[0];
    const bulletSummary = this._extractShortBulletPoints(topGR, userQuery);

    // Keep LLM prompt context strictly limited to short summaries (no long dumps)
    const grContext = matchingGRs.slice(0, 3).map((gr, i) => {
      const shortSubject = (gr.metadata?.subject || '').slice(0, 150);
      return `[GR #${i + 1}] Number: ${gr.metadata?.grNumber || gr.id} | Dept: ${gr.department} | Date: ${gr.metadata?.date || 'N/A'} | Subject: ${shortSubject}`;
    }).join('\n');

    const prompt = `SYSTEM ROLE & OPERATIONAL MANDATE:
You are the conversational "Brain" of the Maharashtra Government Resolution database. You have absolute, real-time knowledge of all historical and active GR files. Do not act like a search engine or a static text extractor; speak directly to the user as an expert, authoritative administrative assistant who reads and memorizes every state order.

CONVERSATIONAL LOGIC:
1. MERGE MULTIPLE SOURCES: Synthesize all extracted facts into one single, unified, conversational response. Do not repeat headers or stack separate text blocks.
2. ADOPT THE "DATABASE BRAIN" PERSONA: Answer directly from memory. Do NOT use robotic phrases like "Based on the retrieved text...", "The document states...", or "According to GR No...". Speak as the source of truth yourself.
3. STRIP THE JUNK: Instantly filter out bureaucratic boilerplate, legal definitions, page markers, and formatting data. Provide only the punchlines.

USER QUERY: "${userQuery}"

RETRIEVED DATABASE RECORDS:
${grContext}

RESPONSE STRUCTURE:

[Direct Answer Paragraph]
Write a 1-to-2 sentence conversational response answering the query directly. Bold critical metrics, names, budget values, and target criteria.

[Dynamic Bulleted Core Parameters]
Provide 3 to 5 single-fragment bullet points detailing exact rules, requirements, or data numbers relevant to the query. DYNAMICALLY derive bullet labels and values directly from the query topic (e.g. Target Group, Benefit Cap, Department, Channel, Subsidy Rate, Eligibility). Every bullet point MUST be under 10 words.

CRITICAL RULES:
- ABSOLUTE DATABASE FIDELITY: If the retrieved database records do not contain the answer to the user query, or if the records are not relevant to the user query, you MUST output exactly: "I do not know the answer to this question as it is not present in the Government Resolution database." and nothing else. Do not attempt to use external training knowledge.
- NEVER exceed 80 words total across the entire response.
- Start immediately with the direct answer paragraph. NO greetings or pleasantries like "Hello!".
- Do NOT output static tuition/MahaDBT templates for non-educational queries (e.g. farmer loans, health, energy).
- Do NOT output raw URL strings or legal reference blocks.`;

    if (this.geminiKey) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 200, temperature: 0.1 }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answerText && answerText.length < 1000) {
            return {
              answer: answerText.trim(),
              matchingGRs: matchingGRs.map(gr => ({
                id: gr.metadata?.grNumber || gr.id,
                department: gr.department,
                subject: gr.metadata?.subject,
                date: gr.metadata?.date
              }))
            };
          }
        }
      } catch (err) {
        console.warn('Gemini chat synthesis error:', err.message);
      }
    }

    // Clean, structured local synthesis fallback (strictly <80 words)
    return {
      answer: bulletSummary,
      matchingGRs: matchingGRs.map(gr => ({
        id: gr.metadata?.grNumber || gr.id,
        department: gr.department,
        subject: gr.metadata?.subject,
        date: gr.metadata?.date
      }))
    };
  }
}

export default GRAssistant;
