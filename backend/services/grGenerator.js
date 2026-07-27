/**
 * GR Generator Service
 * Ultimate Digital Desk Officer & Policy Auditor for Govt of Maharashtra
 */

import Anthropic from '@anthropic-ai/sdk';
import crypto from 'crypto';
import PolicyKnowledgeBase from './policyKnowledgeBase.js';

export class GRGenerator {
  constructor(indexer, config) {
    this.indexer = indexer;
    this.knowledgeBase = new PolicyKnowledgeBase(indexer);
    this.config = typeof config === 'string' ? { type: 'claude', key: config } : config;

    if (!this.config || !this.config.key) {
      this.config = { type: 'fallback' };
    }

    if (this.config.type === 'claude' && this.config.key) {
      this.client = new Anthropic({ apiKey: this.config.key });
      this.model = 'claude-3-5-sonnet-20241022';
    }
  }

  /**
   * Generate 21-digit GR ID following Govt of Maharashtra Standard: YYYYMMDDHHMMSSXXXXXX
   */
  _generate21DigitGRId(dateStr) {
    const now = new Date();
    const datePart = (dateStr || now.toISOString().split('T')[0]).replace(/-/g, '');
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const randomPart = Math.floor(100000 + Math.random() * 900000).toString();
    const rawId = `${datePart}${timePart}${randomPart}`;
    return rawId.padEnd(21, '0').slice(0, 21);
  }

  /**
   * Generate digital security checksum for 21-digit GR ID
   */
  _generateSecurityToken(grId) {
    const hash = crypto.createHash('sha256').update(grId + '_MAHA_SECURE_KEY').digest('hex').substring(0, 8).toUpperCase();
    return `SEC-MH-${hash}-${grId.slice(-4)}`;
  }

  /**
   * TASK A: Policy & Cross-Department Conflict Auditing Engine
   * Runs BEFORE text generation to detect rule violations and ceiling limit breaches
   */
  _auditConflicts(inputData) {
    if (!this.knowledgeBase) {
      this.knowledgeBase = new PolicyKnowledgeBase(this.indexer);
    }
    return this.knowledgeBase.auditPolicyConflicts(inputData);
  }

  /**
   * TASK B & C: Generate Fallback Structured GR Object when no API key is available
   */
  _generateFallbackGR(inputData, auditResult, grId, secToken) {
    const dept = inputData.department_name || inputData.department || 'School Education and Sports Department';
    const trigger = inputData.trigger_event || inputData.subject || 'Developmental requirements and administrative necessity';
    const refDoc = inputData.reference_document || 'Cabinet Decision / Administrative Reference Letter';
    const action = inputData.targeted_action || inputData.subject || 'Execute planned administrative sanction';
    const signee = inputData.signee_designation || 'Under Secretary to Government of Maharashtra';
    const grType = inputData.gr_type || inputData.intentType || '1_FINANCIAL_SANCTION';

    // Format References Block
    const readRefs = inputData.read_references || [
      `${refDoc}`,
      `Government Resolution, Finance Department No. FIN-2024/CR-12, Dated 15th January 2024.`,
      `Concurrence Note of Planning Department, Ref PLN-2025/CR-88.`
    ];

    const readSectionText = `Read:\n` + readRefs.map((r, idx) => `${idx + 1}. ${r}`).join('\n');

    // Build English Preamble
    const preambleEnglish = `In view of ${trigger}, and pursuant to the directions issued under ${refDoc}, the Government of Maharashtra in the ${dept} has carefully considered the proposal for ${action}. Following comprehensive administrative and financial evaluation, the Government is pleased to issue the following Resolution.`;
    const preambleMarathi = preambleEnglish;

    // Build Resolution Clauses dynamically (Omit null fields, append flex-fields)
    const clausesMarathi = [];
    const clausesEnglish = [];

    // Core Executive Order (Clause 1)
    clausesEnglish.push(`1. The Government hereby accords formal administrative and executive sanction for ${action}.`);
    clausesMarathi.push(`1. The Government hereby accords formal administrative and executive sanction for ${action}.`);

    // Type-Specific Clauses (Omit null variables cleanly)
    let cIdx = 2;
    if (grType.includes('FINANCIAL') || inputData.precise_amount_inr || inputData.budget) {
      const amt = inputData.precise_amount_inr || inputData.budget || '0';
      const formattedAmt = Number(amt).toLocaleString('en-IN');
      const budgetHead = inputData.budget_head_15_digit || inputData.accountHead || '2202-01-101-01-03';
      const ddo = inputData.drawing_disbursing_officer || 'Concerned Drawing & Disbursing Officer';
      const ucDeadline = inputData.utilization_certificate_deadline || '2027-03-31';

      clausesMarathi.push(`${cIdx}. या योजनेअंतर्गत एकूण ₹${formattedAmt}/- इतका निधी लेखाशीर्ष ${budgetHead} खाली मंजूर करण्यात येत असून आहरण व संवितरण अधिकारी म्हणून ${ddo} यांना घोषित करण्यात येत आहे.`);
      clausesEnglish.push(`${cIdx}. A total budgetary sanction of ₹${formattedAmt}/- is hereby allocated under Budget Head ${budgetHead}, and ${ddo} is designated as the Drawing & Disbursing Officer (DDO).`);
      cIdx++;

      clausesMarathi.push(`${cIdx}. या निधीच्या वापराबाबतचे उपयोगिता प्रमाणपत्र (Utilization Certificate) दिनांक ${ucDeadline} पूर्वी महालेखापाल कार्यालयास सादर करणे बंधनकारक राहील.`);
      clausesEnglish.push(`${cIdx}. Submission of the mandatory Utilization Certificate (UC) to the Accountant General office before ${ucDeadline} shall be strictly binding.`);
      cIdx++;

      if (inputData.repayment_moratorium) {
        clausesMarathi.push(`${cIdx}. सदर रकमेचा परतावा मुदत (Moratorium): ${inputData.repayment_moratorium}.`);
        clausesEnglish.push(`${cIdx}. Repayment Moratorium Terms: ${inputData.repayment_moratorium}.`);
        cIdx++;
      }
    } else if (grType.includes('POLICY')) {
      if (inputData.scheme_name) {
        clausesMarathi.push(`${cIdx}. या धोरणांतर्गत '${inputData.scheme_name}' योजना संपूर्ण महाराष्ट्र राज्यात कार्यान्वित करण्यात येत आहे.`);
        clausesEnglish.push(`${cIdx}. The scheme titled '${inputData.scheme_name}' is hereby formally promulgated across the State of Maharashtra.`);
        cIdx++;
      }
      if (inputData.eligibility_criteria) {
        clausesMarathi.push(`${cIdx}. पात्रतेचे निकष: ${inputData.eligibility_criteria}.`);
        clausesEnglish.push(`${cIdx}. Eligibility Criteria: ${inputData.eligibility_criteria}.`);
        cIdx++;
      }
      if (inputData.committee_chairman) {
        clausesMarathi.push(`${cIdx}. सदर योजनेच्या अंमलबजावणीसाठी ${inputData.committee_chairman} यांच्या अध्यक्षतेखाली जिल्हास्तरीय समिती गठित करण्यात येत आहे.`);
        clausesEnglish.push(`${cIdx}. A District Monitoring Committee under the Chairmanship of ${inputData.committee_chairman} is hereby constituted for effective implementation.`);
        cIdx++;
      }
    } else if (grType.includes('ESTABLISHMENT')) {
      if (inputData.employee_names_and_cadres) {
        clausesMarathi.push(`${cIdx}. अधिकारी/कर्मचारी: ${inputData.employee_names_and_cadres}.`);
        clausesEnglish.push(`${cIdx}. Officer / Cadre details: ${inputData.employee_names_and_cadres}.`);
        cIdx++;
      }
      if (inputData.current_posting && inputData.new_posting) {
        clausesMarathi.push(`${cIdx}. सदर अधिकाऱ्यांची बदली वर्तमान पदस्थापना (${inputData.current_posting}) वरून नवीन पदस्थापना (${inputData.new_posting}) वर तात्काळ प्रभावाने करण्यात येत आहे.`);
        clausesEnglish.push(`${cIdx}. Transfer of posting from current posting (${inputData.current_posting}) to new posting (${inputData.new_posting}) is hereby ordered with immediate effect.`);
        cIdx++;
      }
    } else if (grType.includes('STATUTORY')) {
      if (inputData.parent_act_invoked) {
        clausesMarathi.push(`${cIdx}. हे राजपत्रित आदेश ${inputData.parent_act_invoked} अन्वये प्राप्त वैधानिक अधिकारांचा वापर करून जारी करण्यात येत आहेत.`);
        clausesEnglish.push(`${cIdx}. This statutory notification is issued in exercise of powers conferred under ${inputData.parent_act_invoked}.`);
        cIdx++;
      }
      if (inputData.geographic_scope) {
        clausesMarathi.push(`${cIdx}. सदर आदेशाची कार्यक्षेत्र मर्यादा: ${inputData.geographic_scope}.`);
        clausesEnglish.push(`${cIdx}. Geographical Jurisdiction Scope: ${inputData.geographic_scope}.`);
        cIdx++;
      }
      if (inputData.exempted_entities) {
        clausesMarathi.push(`${cIdx}. सूट देण्यात आलेल्या संस्था/सेवा: ${inputData.exempted_entities}.`);
        clausesEnglish.push(`${cIdx}. Exempted Establishments & Services: ${inputData.exempted_entities}.`);
        cIdx++;
      }
    } else if (grType.includes('CORRIGENDUM')) {
      if (inputData.original_gr_id) {
        clausesMarathi.push(`${cIdx}. मूळ शासन निर्णय क्र. ${inputData.original_gr_id} मधील चुकीचा मजकूर '${inputData.incorrect_text_reference || ''}' ऐवजी '${inputData.corrected_text_placement || ''}' असा वाचण्यात यावा.`);
        clausesEnglish.push(`${cIdx}. In original Government Resolution No. ${inputData.original_gr_id}, the phrase '${inputData.incorrect_text_reference || ''}' shall be substituted and read as '${inputData.corrected_text_placement || ''}'.`);
        cIdx++;
      }
    }

    // Process Dynamic Flex-Fields (`additional_custom_parameters`)
    const flexFields = inputData.additional_custom_parameters || [];
    flexFields.forEach(ff => {
      if (ff.parameter_name && ff.parameter_value) {
        clausesMarathi.push(`${cIdx}. विशेष अट (${ff.parameter_name}): ${ff.parameter_value}`);
        clausesEnglish.push(`${cIdx}. Special Condition (${ff.parameter_name}): ${ff.parameter_value}`);
        cIdx++;
      }
    });

    // Standard Compliance Obligation
    clausesMarathi.push(`${cIdx}. सदर शासन निर्णय महाराष्ट्र शासनाच्या www.maharashtra.gov.in या संकेतस्थळावर उपलब्ध असून त्याचा संगणक संकेतांक (21-Digit GR ID): ${grId} असा आहे.`);
    clausesEnglish.push(`${cIdx}. This Government Resolution is available on the official Portal of Government of Maharashtra (www.maharashtra.gov.in) under Unique 21-Digit Computer Code: ${grId}.`);

    // Build Footer Distribution
    const distList = inputData.footer_distribution_list || [
      'The Accountant General (A&E), Maharashtra, Mumbai / Nagpur.',
      'The Pay and Accounts Officer, Mumbai.',
      'The Finance Department (Budget Wing), Mantralaya, Mumbai.',
      `Concerned Divisional Commissioner & District Collectors.`,
      `Guard File (${dept}).`
    ];

    const distText = `Copy forwarded for information and action:\n` + distList.map((d, i) => `${i + 1}) ${d}`).join('\n');

    // Generate Suggested Database Search Queries
    const queries = [
      `${trigger.split(' ').slice(0, 4).join(' ')} fund release`,
      `${dept} policy sanction ${new Date().getFullYear()}`,
      `Budget head ${inputData.budget_head_15_digit || '2202'} allocation rules`,
      `${action.split(' ').slice(0, 3).join(' ')} historical GR`
    ];

    return {
      conflict_audit: auditResult,
      calculated_21_digit_gr_id: grId,
      security_checksum: secToken,
      read_section_text: readSectionText,
      preamble_marathi: preambleEnglish,
      resolution_clauses_marathi: clausesEnglish,
      preamble_english: preambleEnglish,
      resolution_clauses_english: clausesEnglish,
      footer_distribution_text: distText,
      footer_distribution_list: distList,
      suggested_database_search_queries: queries,
      signee_designation: signee
    };
  }

  /**
   * Main Method: Generate new Government Resolution draft
   */
  async generateGR(inputData) {
    const today = inputData.gr_date || new Date().toISOString().split('T')[0];
    const grId = inputData.calculated_21_digit_gr_id || this._generate21DigitGRId(today);
    const secToken = this._generateSecurityToken(grId);

    // Step A: Run Policy & Conflict Audit FIRST
    const auditResult = this._auditConflicts(inputData);

    // Find similar GRs from indexer for style context
    const draftQueryObj = {
      id: grId,
      department: inputData.department_name || inputData.department || '',
      metadata: {
        subject: inputData.subject || inputData.targeted_action || '',
      },
      sections: { references: [], resolutions: [], financials: [] }
    };

    let similar = [];
    if (this.indexer) {
      similar = this.indexer.findSimilar(draftQueryObj, 3);
    }
    const styleContext = this._buildStyleContext(similar);

    let structuredOutput;

    if (this.config.type === 'fallback' || !this.config.key) {
      structuredOutput = this._generateFallbackGR(inputData, auditResult, grId, secToken);
    } else {
      try {
        const prompt = this._buildJsonPrompt(inputData, styleContext, auditResult, grId);

        let responseText = '';
        if (this.config.type === 'gemini') {
          const modelName = this.config.model || 'gemini-1.5-flash';
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.config.key}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 2500, temperature: 0.2 }
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `Gemini API error ${response.status}`);
          }
          const data = await response.json();
          responseText = data.candidates[0].content.parts[0].text;
        } else if (this.config.type === 'openrouter') {
          const modelName = this.config.model || 'meta-llama/llama-3-8b-instruct:free';
          const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.config.key}`,
              'HTTP-Referer': 'http://localhost:5173',
              'X-Title': 'Maharashtra GR-Align'
            },
            body: JSON.stringify({
              model: modelName,
              messages: [{ role: 'user', content: prompt }],
              max_tokens: 2500,
              temperature: 0.2
            })
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `OpenRouter API error ${response.status}`);
          }
          const data = await response.json();
          responseText = data.choices[0].message.content;
        } else {
          // Claude API
          const message = await this.client.messages.create({
            model: this.model,
            max_tokens: 2500,
            messages: [{ role: 'user', content: prompt }]
          });
          responseText = message.content[0].text;
        }

        // Clean JSON from LLM output
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          structuredOutput = JSON.parse(jsonMatch[0]);
        } else {
          structuredOutput = JSON.parse(responseText);
        }
      } catch (apiError) {
        console.warn('⚠️ API Call failed or JSON parse error. Falling back to local structured generator:', apiError.message);
        structuredOutput = this._generateFallbackGR(inputData, auditResult, grId, secToken);
      }
    }

    // Step C: Execute Suggested Database Search Queries against 98k Indexer to get Top 3 historical GR reference links
    let topHistoricalGRs;
    const preloadedReferences = {};

    const customRefGrIds = [];
    const scanFields = [inputData.reference_document, inputData.original_gr_id].filter(Boolean);
    scanFields.forEach(text => {
      const matches = [...text.matchAll(/\b(20[0-2]\d{11,18})\b/g)].map(m => m[1]);
      customRefGrIds.push(...matches);
    });

    const customRefObjs = [];
    customRefGrIds.forEach(id => {
      if (this.indexer) {
        const refDoc = this.indexer.getGRById(id);
        if (refDoc) {
          customRefObjs.push({
            grNumber: id,
            department: refDoc.department || 'Administration',
            subject: refDoc.metadata?.subject || 'Referenced Policy Document',
            date: refDoc.metadata?.date || 'N/A',
            linkUrl: `/api/gr/${encodeURIComponent(id)}`
          });
          preloadedReferences[id] = refDoc;
        }
      }
    });

    const seen = new Set();
    customRefGrIds.forEach(id => seen.add(id));

    if (this.indexer) {
      const allResults = [];
      const queries = structuredOutput.suggested_database_search_queries || [];
      queries.forEach(q => {
        const hits = this.indexer.search({ query: q, limit: 3 });
        allResults.push(...hits);
      });

      const conflictStr = structuredOutput.conflict_audit?.conflict_details || auditResult?.conflict_details || '';
      conflictStr.split(/\s*\|\s*/).forEach(item => {
        const matches = [...item.matchAll(/\(Ref:\s*([^)]+)\)/g)].map(m => m[1]);
        if (matches.length > 0) {
          const id = matches.length >= 2 ? matches[1] : matches[0];
          if (id && !preloadedReferences[id]) {
            const refDoc = this.indexer.getGRById(id);
            if (refDoc) {
              preloadedReferences[id] = refDoc;
            }
          }
        }
      });

      const searchGRs = allResults.filter(item => {
        const id = item.id || item.metadata?.grNumber;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
      }).slice(0, 3).map(item => {
        const id = item.metadata?.grNumber || item.id;
        const fullDoc = this.indexer.getGRById(id);
        if (fullDoc) {
          preloadedReferences[id] = fullDoc;
        }
        return {
          grNumber: id,
          department: item.department,
          subject: item.metadata?.subject || item.title || 'Historical Resolution',
          date: item.metadata?.date || '2024-01-15',
          linkUrl: `/api/gr/${encodeURIComponent(id)}`
        };
      });

      topHistoricalGRs = [...customRefObjs, ...searchGRs];
    } else {
      topHistoricalGRs = [...customRefObjs];
    }

    // Assemble final draft object matching workspace requirements
    const finalDraft = {
      id: grId,
      calculated_21_digit_gr_id: grId,
      security_checksum: secToken,
      department: inputData.department_name || inputData.department || 'Finance Department',
      status: 'draft',
      metadata: {
        subject: inputData.targeted_action || inputData.subject || 'Government Resolution',
        departmentName: inputData.department_name || inputData.department || 'Finance Department',
        intentType: inputData.gr_type || inputData.intentType || '1_FINANCIAL_SANCTION',
        generatedAt: new Date().toISOString(),
        grDate: today,
        signeeDesignation: inputData.signee_designation || 'Under Secretary',
      },
      conflict_audit: structuredOutput.conflict_audit || auditResult,
      preloadedReferences: preloadedReferences,
      sections: {
        header: `GOVERNMENT OF MAHARASHTRA\n${inputData.department_name || inputData.department || 'DEPARTMENT'}\n21-Digit GR ID: ${grId}`,
        read_section_text: structuredOutput.read_section_text || '',
        introduction: structuredOutput.preamble_marathi || structuredOutput.preamble_english || '',
        preamble_marathi: structuredOutput.preamble_marathi || '',
        preamble_english: structuredOutput.preamble_english || '',
        resolution_clauses_marathi: structuredOutput.resolution_clauses_marathi || [],
        resolution_clauses_english: structuredOutput.resolution_clauses_english || [],
        resolution: (structuredOutput.resolution_clauses_marathi || []).join('\n'),
        resolutions: (structuredOutput.resolution_clauses_marathi || []).map((text, idx) => ({ text, index: idx + 1 })),
        financials: inputData.precise_amount_inr ? [{
          type: 'allocation',
          amount: inputData.precise_amount_inr,
          accountHead: inputData.budget_head_15_digit,
          ddo: inputData.drawing_disbursing_officer
        }] : [],
        distribution: (structuredOutput.footer_distribution_list || []).map((recipient, idx) => ({ order: idx + 1, recipient })),
        footer_distribution_text: structuredOutput.footer_distribution_text || ''
      },
      historical_references: topHistoricalGRs,
      districts: inputData.district ? [inputData.district] : (inputData.districts || []),
      inputPayload: inputData
    };

    return {
      success: true,
      grId: grId,
      draft: finalDraft,
      rawOutput: JSON.stringify(structuredOutput, null, 2)
    };
  }

  _buildStyleContext(similarGRs) {
    if (!similarGRs || similarGRs.length === 0) return '';
    let context = 'HISTORICAL RESOLUTION EXAMPLES FOR LEGAL STYLE:\n';
    similarGRs.forEach((gr, idx) => {
      context += `[EX ${idx + 1}] GR No: ${gr.metadata?.grNumber || gr.id} | Dept: ${gr.department} | Subject: ${gr.metadata?.subject}\n`;
    });
    return context;
  }

  _buildJsonPrompt(inputData, styleContext, auditResult, _grId) {
    return `You are the Premier Digital Desk Officer (कक्षा अधिकारी) and Policy Auditor for the Government of Maharashtra.
Generate an authoritative Government Resolution (GR) in JSON format matching the exact schema below.

INPUT VARIABLES:
- Department: ${inputData.department_name || inputData.department}
- GR Type: ${inputData.gr_type || inputData.intentType}
- Date: ${inputData.gr_date || new Date().toISOString().split('T')[0]}
- Signee Designation: ${inputData.signee_designation || 'Under Secretary'}
- Reference Document: ${inputData.reference_document || 'N/A'}
- Trigger Event: ${inputData.trigger_event || 'N/A'}
- Targeted Action: ${inputData.targeted_action || inputData.subject || 'N/A'}
- Type-Specific Variables: ${JSON.stringify(inputData.type_specific_variables || inputData.deptDetails || {})}
- Dynamic Flex-Fields: ${JSON.stringify(inputData.additional_custom_parameters || [])}

${styleContext}

STRICT CONSTRAINTS:
1. Preamble & Resolutions must be written in formal, authoritative Administrative English ONLY. Do do not output any Marathi translations or Devanagari text. All fields (including those labeled marathi) must be populated with English text only.
2. CONTINUOUS NUMBERING: If an input field is empty/null, OMIT that clause completely without leaving blank gap lines or breaking the continuous 1, 2, 3... numbering sequence.
3. FLEX-FIELDS: Convert items in 'additional_custom_parameters' array into standalone numbered resolution clauses.
4. JSON OUTPUT ONLY. Respond strictly with a valid JSON object matching this schema:

{
  "conflict_audit": {
    "has_conflict": ${auditResult.has_conflict},
    "severity": "${auditResult.severity}",
    "conflict_details": "${auditResult.conflict_details.replace(/"/g, "'")}"
  },
  "read_section_text": "Read:\\n1) ...\\n2) ...",
  "preamble_marathi": "Formal English text of Preamble...",
  "resolution_clauses_marathi": [
    "1. ...",
    "2. ..."
  ],
  "preamble_english": "Formal administrative English text of Preamble...",
  "resolution_clauses_english": [
    "1. ...",
    "2. ..."
  ],
  "footer_distribution_text": "Copy forwarded for information and action:\\n1) ...\\n2) ...",
  "footer_distribution_list": ["Authority 1", "Authority 2"],
  "suggested_database_search_queries": [
    "Query 1",
    "Query 2",
    "Query 3"
  ]
}`;
  }
}

export default GRGenerator;
