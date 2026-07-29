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

    // Log initialization
    console.log(`🔧 GRGenerator initialized with type: ${this.config.type}`);
    if (this.config.type === 'gemini') {
      console.log(`   Gemini Model: ${this.config.model || 'gemini-1.5-flash'}`);
      console.log(`   API Key: ${this.config.key ? '✅ Present' : '❌ Missing'}`);
    }
  }

  _generate21DigitGRId(dateStr) {
    const now = new Date();
    const datePart = (dateStr || now.toISOString().split('T')[0]).replace(/-/g, '');
    const timePart = now.toTimeString().split(' ')[0].replace(/:/g, '');
    const randomPart = Math.floor(100000 + Math.random() * 900000).toString();
    const rawId = `${datePart}${timePart}${randomPart}`;
    return rawId.padEnd(21, '0').slice(0, 21);
  }

  _generateSecurityToken(grId) {
    const hash = crypto.createHash('sha256').update(grId + '_MAHA_SECURE_KEY').digest('hex').substring(0, 8).toUpperCase();
    return `SEC-MH-${hash}-${grId.slice(-4)}`;
  }

  _auditConflicts(inputData) {
    if (!this.knowledgeBase) {
      this.knowledgeBase = new PolicyKnowledgeBase(this.indexer);
    }
    return this.knowledgeBase.auditPolicyConflicts(inputData);
  }

  _generateFallbackGR(inputData, auditResult, grId, secToken) {
    const dept = inputData.department_name || inputData.department || 'School Education and Sports Department';
    const trigger = inputData.trigger_event || inputData.subject || 'Developmental requirements and administrative necessity';
    const refDoc = inputData.reference_document || 'Cabinet Decision / Administrative Reference Letter';
    const action = inputData.targeted_action || inputData.subject || 'Execute planned administrative sanction';
    const signee = inputData.signee_designation || 'Under Secretary to Government of Maharashtra';
    const grType = inputData.gr_type || inputData.intentType || '1_FINANCIAL_SANCTION';

    const readRefs = inputData.read_references || [
      `${refDoc}`,
      `Government Resolution, Finance Department No. FIN-2024/CR-12, Dated 15th January 2024.`,
      `Concurrence Note of Planning Department, Ref PLN-2025/CR-88.`
    ];

    const readSectionText = `Read:\n` + readRefs.map((r, idx) => `${idx + 1}. ${r}`).join('\n');
    const preambleEnglish = `In view of ${trigger}, and pursuant to the directions issued under ${refDoc}, the Government of Maharashtra in the ${dept} has carefully considered the proposal for ${action}. Following comprehensive administrative and financial evaluation, the Government is pleased to issue the following Resolution.`;
    const preambleMarathi = preambleEnglish;

    const clausesMarathi = [];
    const clausesEnglish = [];

    clausesEnglish.push(`1. The Government hereby accords formal administrative and executive sanction for ${action}.`);
    clausesMarathi.push(`1. The Government hereby accords formal administrative and executive sanction for ${action}.`);

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

    const flexFields = inputData.additional_custom_parameters || [];
    flexFields.forEach(ff => {
      if (ff.parameter_name && ff.parameter_value) {
        clausesMarathi.push(`${cIdx}. विशेष अट (${ff.parameter_name}): ${ff.parameter_value}`);
        clausesEnglish.push(`${cIdx}. Special Condition (${ff.parameter_name}): ${ff.parameter_value}`);
        cIdx++;
      }
    });

    clausesMarathi.push(`${cIdx}. सदर शासन निर्णय महाराष्ट्र शासनाच्या www.maharashtra.gov.in या संकेतस्थळावर उपलब्ध असून त्याचा संगणक संकेतांक (21-Digit GR ID): ${grId} असा आहे.`);
    clausesEnglish.push(`${cIdx}. This Government Resolution is available on the official Portal of Government of Maharashtra (www.maharashtra.gov.in) under Unique 21-Digit Computer Code: ${grId}.`);

    const distList = inputData.footer_distribution_list || [
      'The Accountant General (A&E), Maharashtra, Mumbai / Nagpur.',
      'The Pay and Accounts Officer, Mumbai.',
      'The Finance Department (Budget Wing), Mantralaya, Mumbai.',
      `Concerned Divisional Commissioner & District Collectors.`,
      `Guard File (${dept}).`
    ];

    const distText = `Copy forwarded for information and action:\n` + distList.map((d, i) => `${i + 1}) ${d}`).join('\n');

    const queries = [
      `${trigger.split(' ').slice(0, 4).join(' ')} fund release`,
      `${dept} policy sanction ${new Date().getFullYear()}`,
      `Budget head ${inputData.budget_head_15_digit || '2202'} allocation rules`,
      `${action.split(' ').slice(0, 3).join(' ')} historical GR`
    ];

    return {
      conflict_audit: auditResult,
      read_section_text: readSectionText || '',
      preamble_marathi: preambleMarathi || preambleEnglish,
      resolution_clauses_marathi: clausesMarathi,
      preamble_english: preambleEnglish,
      resolution_clauses_english: clausesEnglish,
      footer_distribution_text: distText,
      footer_distribution_list: distList,
      suggested_database_search_queries: queries,
      signee_designation: signee
    };
  }

async generateGR(inputData) {
    const today = inputData.gr_date || new Date().toISOString().split('T')[0];
    const grId = inputData.calculated_21_digit_gr_id || this._generate21DigitGRId(today);
    const secToken = this._generateSecurityToken(grId);

    // ============================================
    // STEP 1: Run audit on ORIGINAL input and SAVE IT
    // ============================================
    const originalAuditResult = this._auditConflicts(inputData);
    console.log('\n🔍 === ORIGINAL AUDIT RESULT ===');
    console.log('Has Conflict:', originalAuditResult.has_conflict);
    console.log('Severity:', originalAuditResult.severity);
    console.log('Conflicts Count:', originalAuditResult.conflicted_grs?.length || 0);
    console.log('Conflict Details:', originalAuditResult.conflict_details);
    console.log('================================\n');

    // ============================================
    // STEP 2: Validate metadata
    // ============================================
    const dept = inputData.department_name || inputData.department || '';
    const validated = {
      budget_head: null,
      ddo: null,
      scheme: null,
      account_head_valid: false,
      ddo_valid: false
    };

    if (inputData.budget_head_15_digit) {
      if (this.knowledgeBase.validateBudgetHeadForDepartment(inputData.budget_head_15_digit, dept)) {
        validated.budget_head = inputData.budget_head_15_digit;
        validated.account_head_valid = true;
      }
    }

    if (inputData.drawing_disbursing_officer) {
      if (this.knowledgeBase.validateDDOForDepartment(inputData.drawing_disbursing_officer, dept)) {
        validated.ddo = inputData.drawing_disbursing_officer;
        validated.ddo_valid = true;
      }
    }

    if (inputData.scheme_name) {
      const owners = this.knowledgeBase.getSchemeOwners(inputData.scheme_name.toLowerCase());
      if (owners.length > 0 && (!owners[0].department || owners[0].department === dept)) {
        validated.scheme = inputData.scheme_name;
      }
    }

    // ============================================
    // STEP 3: Find similar GRs for style context
    // ============================================
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

    // ============================================
    // STEP 4: Generate the GR content
    // ============================================
    let structuredOutput;

    if (this.config.type === 'fallback' || !this.config.key) {
      structuredOutput = this._generateFallbackGR(inputData, originalAuditResult, grId, secToken);
    } else {
      try {
        const safeInput = { ...inputData };
        safeInput.budget_head_15_digit = validated.account_head_valid ? validated.budget_head : '';
        safeInput.drawing_disbursing_officer = validated.ddo_valid ? validated.ddo : '';
        safeInput.scheme_name = validated.scheme || '';

        const prompt = this._buildJsonPrompt(safeInput, styleContext, originalAuditResult, grId);

        let responseText = '';

        if (this.config.type === 'gemini') {
          const modelName = this.config.model || 'gemini-1.5-flash';
          console.log(`📡 Calling Gemini API with model: ${modelName}`);
          
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.config.key}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  maxOutputTokens: 4096,
                  temperature: 0.1,
                  responseMimeType: "application/json"
                }
              })
            }
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Gemini API Error:', response.status, errorText);
            throw new Error(`Gemini API error ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          console.log('✅ Gemini API response received');
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          
          if (!responseText) {
            throw new Error('Empty response from Gemini API');
          }
          
          console.log(`📝 Response length: ${responseText.length} characters`);
          
        } else if (this.config.type === 'openrouter') {
          const modelName = this.config.model || 'meta-llama/llama-3-8b-instruct:free';
          console.log(`📡 Calling OpenRouter API with model: ${modelName}`);
          
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
              max_tokens: 4096,
              temperature: 0.1,
              response_format: { type: "json_object" }
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ OpenRouter API Error:', response.status, errorText);
            throw new Error(`OpenRouter API error ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          console.log('✅ OpenRouter API response received');
          responseText = data.choices?.[0]?.message?.content || '';
          
          if (!responseText) {
            throw new Error('Empty response from OpenRouter API');
          }

        } else if (this.config.type === 'claude') {
          console.log(`📡 Calling Claude API with model: ${this.model}`);
          
          const message = await this.client.messages.create({
            model: this.model,
            max_tokens: 4096,
            messages: [{ role: 'user', content: prompt }]
          });
          
          console.log('✅ Claude API response received');
          responseText = message.content[0].text || '';
          
          if (!responseText) {
            throw new Error('Empty response from Claude API');
          }
        } else {
          throw new Error(`Unsupported API type: ${this.config.type}`);
        }

        // Parse JSON response
        try {
          structuredOutput = await this._parseJSONResponse(responseText);
          // CRITICAL: Keep the original audit result
          structuredOutput.conflict_audit = originalAuditResult;
        } catch (parseError) {
          console.warn('⚠️ JSON parse failed, using fallback with audit data');
          structuredOutput = this._generateFallbackGR(inputData, originalAuditResult, grId, secToken);
        }

      } catch (error) {
        console.error('❌ Generation error:', error.message);
        console.warn('⚠️ Falling back to local generator');
        structuredOutput = this._generateFallbackGR(inputData, originalAuditResult, grId, secToken);
      }
    }

    // ============================================
    // STEP 5: ALWAYS use the original audit result
    // ============================================
    structuredOutput.conflict_audit = originalAuditResult;

    // ============================================
    // STEP 6: Search for historical references
    // ============================================
    let topHistoricalGRs = [];
    const preloadedReferences = {};

    const customRefGrIds = [];
    const scanFields = [inputData.reference_document, inputData.original_gr_id].filter(Boolean);
    scanFields.forEach(text => {
      if (text) {
        const matches = [...text.matchAll(/\b(20[0-2]\d{11,18})\b/g)].map(m => m[1]);
        customRefGrIds.push(...matches);
      }
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
        const hits = this.indexer.search({ keyword: q, limit: 3 });
        allResults.push(...hits);
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

    // ============================================
    // STEP 7: Assemble final draft
    // ============================================
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
        // Store the original audit result in metadata for debugging
        _auditResult: {
          has_conflict: originalAuditResult.has_conflict,
          severity: originalAuditResult.severity,
          conflict_count: originalAuditResult.conflicted_grs?.length || 0
        }
      },
      // CRITICAL: Use the ORIGINAL audit result
      conflict_audit: originalAuditResult,
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
          accountHead: validated.account_head_valid ? validated.budget_head : '',
          ddo: validated.ddo_valid ? validated.ddo : ''
        }] : [],
        distribution: (structuredOutput.footer_distribution_list || []).map((recipient, idx) => ({ order: idx + 1, recipient })),
        footer_distribution_text: structuredOutput.footer_distribution_text || ''
      },
      historical_references: topHistoricalGRs,
      districts: inputData.district ? [inputData.district] : (inputData.districts || []),
      inputPayload: inputData
    };

    // ============================================
    // STEP 8: Debug log the final conflict_audit
    // ============================================
    console.log('\n📤 === FINAL DRAFT CONFLICT AUDIT ===');
    console.log('Has Conflict:', finalDraft.conflict_audit?.has_conflict);
    console.log('Severity:', finalDraft.conflict_audit?.severity);
    console.log('Conflicts Count:', finalDraft.conflict_audit?.conflicted_grs?.length || 0);
    console.log('=====================================\n');

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

  async _parseJSONResponse(responseText) {
    if (!responseText || typeof responseText !== 'string') {
      throw new Error('Invalid response text');
    }

    // 1. Sanitize unicode space characters (like non-breaking spaces \u00A0)
    let sanitized = responseText
      .replace(/[\u00A0\u1680\u180E\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/gi, '')
      .trim();

    // 2. Extract JSON payload bounded by outermost braces
    const firstBrace = sanitized.indexOf('{');
    const lastBrace = sanitized.lastIndexOf('}');
    
    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error('No valid JSON object bounds found');
    }

    let jsonString = sanitized.substring(firstBrace, lastBrace + 1);

    // 3. Sanitizer strategies to handle standard LLM formatting errors
    const repairStrategies = [
      // Direct parse
      (str) => JSON.parse(str),

      // Fix trailing commas in objects and arrays
      (str) => JSON.parse(str.replace(/,\s*([}\]])/g, '$1')),

      // Fix unescaped raw newlines inside JSON string properties
      (str) => {
        const cleaned = str.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');
        return JSON.parse(cleaned);
      },

      // Aggressive repair for control characters and unescaped quotes
      (str) => {
        const cleaned = str
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, (match) => {
            if (match === '\n') return '\\n';
            if (match === '\r') return '\\r';
            if (match === '\t') return '\\t';
            return '';
          })
          .replace(/,\s*([}\]])/g, '$1');
        return JSON.parse(cleaned);
      }
    ];

    let lastError = null;
    for (const strategy of repairStrategies) {
      try {
        const result = strategy(jsonString);
        if (result && typeof result === 'object') {
          console.log('✅ JSON parsed successfully');
          return result;
        }
      } catch (err) {
        lastError = err;
      }
    }

    console.error('❌ All JSON parsing attempts failed');
    console.error('Problematic Raw Output (first 300 chars):', jsonString.substring(0, 300) + '...');
    throw new Error(`Failed to parse JSON: ${lastError?.message || 'Unknown parsing error'}`);
  }

  _buildJsonPrompt(inputData, styleContext, auditResult, _grId) {
    const safeString = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .trim();
    };

    const dept = safeString(inputData.department_name || inputData.department || 'N/A');
    const grType = safeString(inputData.gr_type || inputData.intentType || 'N/A');
    const grDate = safeString(inputData.gr_date || new Date().toISOString().split('T')[0]);
    const signee = safeString(inputData.signee_designation || 'Under Secretary');
    const refDoc = safeString(inputData.reference_document || 'N/A');
    const trigger = safeString(inputData.trigger_event || 'N/A');
    const action = safeString(inputData.targeted_action || inputData.subject || 'N/A');
    const typeVars = JSON.stringify(inputData.type_specific_variables || inputData.deptDetails || {});
    const flexFields = JSON.stringify(inputData.additional_custom_parameters || []);

    return `You are the Premier Digital Desk Officer for the Government of Maharashtra.
Return ONLY valid raw JSON matching the exact schema below. Do not output markdown code blocks or explanatory text.

INPUT DETAILS:
- Department: ${dept}
- GR Type: ${grType}
- Date: ${grDate}
- Signee: ${signee}
- Reference: ${refDoc}
- Trigger: ${trigger}
- Action: ${action}
- Type-Specific: ${typeVars}
- Flex-Fields: ${flexFields}

${styleContext || ''}

JSON SCHEMA:
{
  "read_section_text": "Read:\\n1. Reference 1\\n2. Reference 2",
  "preamble_marathi": "मजकूर...",
  "resolution_clauses_marathi": ["1. नियम १", "2. नियम २"],
  "preamble_english": "English text...",
  "resolution_clauses_english": ["1. Clause 1", "2. Clause 2"],
  "footer_distribution_text": "Copy forwarded to:\\n1. Authority 1",
  "footer_distribution_list": ["Authority 1", "Authority 2"],
  "suggested_database_search_queries": ["Query 1", "Query 2"]
}`;
  }
}

export default GRGenerator;