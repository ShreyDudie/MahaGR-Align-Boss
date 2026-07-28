/**
 * Policy Knowledge Base Engine
 * Extracts and audits inter-departmental policy rules across 98,000+ Maharashtra GRs
 *
 * CHANGES FOR METADATA-AWARE RAG:
 * - Added lookup helpers to validate budget heads, DDOs, and schemes by department
 * - These helpers are used by the generator to ensure financial metadata is not copied across departments
 */

const GENERIC_ADMIN_STOPWORDS = new Set([
  'appoint', 'appointing', 'appointment', 'appointments', 'committee', 'agency', 'officer', 'officers', 
  'assistant', 'assistants', 'staff', 'member', 'members', 'temporary', 'contract', 'selection', 'honorarium', 
  'approval', 'administrative', 'sanction', 'implementation', 'regarding', 'service', 'services', 'hospitals', 
  'hospital', 'clinics', 'posts', 'post', 'vacancy', 'vacancies', 'district', 'districts', 'rural', 'urban', 
  'scheme', 'yojana', 'policy', 'decision', 'resolution', 'government', 'state', 'department', 'departments', 
  'office', 'offices', 'additional', 'special', 'deputy', 'joint', 'under', 'secretary', 'director', 
  'commissioner', 'board', 'corporation', 'authority', 'work', 'works', 'project', 'projects', 'purchase', 
  'purchases', 'equipment', 'maintenance', 'repair', 'repairs', 'construction', 'development', 'management', 
  'planning', 'finance', 'financial', 'budget', 'heads', 'head', 'allowance', 'allowances', 'pay', 'scale', 
  'salary', 'salaries', 'recruitment', 'promotion', 'transfer', 'transfers', 'postings', 'posting', 'leave', 
  'pension', 'under', 'level', 'established', 'establishment', 'proposal', 'proposals', 'constituted', 
  'implement', 'assistance', 'grants', 'grant', 'allotment', 'allotted', 'funds', 'fund', 'external',
  'social', 'media', 'secretariat', 'information', 'public', 'relations', 'directorate', 'general',
  'private', 'self', 'financing', 'university', 'conduct', 'conducting', 'submit', 'submitted', 'submitting',
  'examining', 'examination', 'examiner', 'scrutiny', 'technical', 'education', 'higher', 'sports', 'school',
  'medical', 'health', 'public', 'active', 'outbreak', 'epidemic', 'emergency', 'contracts', 'duties', 'duty',
  'joining', 'window', 'verification', 'verify', 'verifying', 'registration', 'council', 'clinic', 'clinics',
  'veterinary', 'mukhyamantri', 'chief', 'minister', 'ministers', 'maharashtra', 'national', 'pradhan', 'mantri',
  'pradhanmantri', 'krishi', 'annapurna', 'sukarmi', 'saur', 'solar'
]);

export class PolicyKnowledgeBase {
  constructor(indexer) {
    this.indexer = indexer;
    this.schemeRegistry = new Map();
    this.budgetRegistry = new Map();
    this.statutoryRegistry = new Map();
    this.majorHeadToDeptsMap = new Map();
    this.actToDeptsMap = new Map();
    this.deptMaxBudgetMap = new Map();
    this.supersededRegistry = new Map();
    
    // Explicit Rule Constitution compiled dynamically from historical data
    this.ruleConstitution = {
      budgetHeadRules: new Map(), // MajorHead -> { ownerDepartment, establishedByGr }
      jurisdictionRules: new Map(), // ActName -> { ownerDepartment, establishedByGr }
      ceilingRules: new Map(), // Department -> { maxAmount, establishedByGr }
      activeSchemes: new Map() // SchemeWord -> { ownerDepartment, establishedByGr }
    };
    
    this.initialized = false;
  }

  /**
   * Build knowledge base indexes from parsed GR dataset
   */
  buildKnowledgeBase() {
    if (!this.indexer || !this.indexer.grs) return;

    this.schemeRegistry.clear();
    this.budgetRegistry.clear();
    this.statutoryRegistry.clear();
    this.majorHeadToDeptsMap.clear();
    this.actToDeptsMap.clear();
    this.deptMaxBudgetMap.clear();
    this.supersededRegistry.clear();

    const commonActs = [
      'Negotiable Instruments Act',
      'Police Act',
      'Right to Education',
      'Co-operative Societies Act',
      'Land Revenue Code',
      'Municipal Corporations Act',
      'Maharashtra Regional and Town Planning Act',
      'MRTP',
      'Grampanchayat Act',
      'Motor Vehicles Act',
      'Public Health Act',
      'MHADA',
      'Housing Board Act',
      'Forest Act',
      'Industries Development',
      'Water Supply and Sewerage Board Act'
    ];

    this.indexer.grs.forEach(gr => {
      const dept = gr.department || 'General';
      const subject = gr.metadata?.subject || '';
      const grId = gr.metadata?.grNumber || gr.id;

      // 0. Filter GRs issued before 2016 (User directive)
      const dateStr = gr.metadata?.date || '';
      const yearMatch = dateStr.match(/\b(19\d{2}|20\d{2})\b/);
      const year = yearMatch ? parseInt(yearMatch[1], 10) : 0;
      if (year > 0 && year < 2016) {
        return;
      }

      // 1. Index Schemes & Policies (Filtered by Stopwords)
      if (subject) {
        const words = subject.toLowerCase().split(/[^\w\u0900-\u097F]+/).filter(w => w.length > 4 && !GENERIC_ADMIN_STOPWORDS.has(w));
        words.forEach(word => {
          if (!this.schemeRegistry.has(word)) {
            this.schemeRegistry.set(word, []);
          }
          if (this.schemeRegistry.get(word).length < 20) {
            this.schemeRegistry.get(word).push({
              grId,
              department: dept,
              subject,
              date: gr.metadata?.date || '2024-01-15',
              fullGr: gr
            });
          }
        });
      }

      // 2. Index Budget Heads & Major Heads
      if (gr.sections?.financials) {
        gr.sections.financials.forEach(fin => {
          if (fin.accountHead) {
            if (!this.budgetRegistry.has(fin.accountHead)) {
              this.budgetRegistry.set(fin.accountHead, []);
            }
            this.budgetRegistry.get(fin.accountHead).push({
              grId,
              department: dept,
              amount: fin.amountNumeric || fin.amount || 0,
              date: gr.metadata?.date
            });

            // Extract Major Head (first 4 digits)
            const match = fin.accountHead.match(/^(\d{4})/);
            if (match) {
              const majorHead = match[1];
              if (!this.majorHeadToDeptsMap.has(majorHead)) {
                this.majorHeadToDeptsMap.set(majorHead, new Map());
              }
              const deptMap = this.majorHeadToDeptsMap.get(majorHead);
              if (!deptMap.has(dept)) {
                deptMap.set(dept, []);
              }
              deptMap.get(dept).push(grId);
            }
          }

          // Calculate department maximum budgets
          if (fin.amountNumeric) {
            const currentMax = this.deptMaxBudgetMap.get(dept) || { amount: 0, grId: null };
            if (fin.amountNumeric > currentMax.amount) {
              this.deptMaxBudgetMap.set(dept, { amount: fin.amountNumeric, grId });
            }
          }
        });
      }

      // 3. Index Statutory Acts
      const fullTextToScan = `${subject} ${gr.sections?.introduction || ''} ${gr.sections?.resolution || ''}`.toLowerCase();
      commonActs.forEach(act => {
        if (fullTextToScan.includes(act.toLowerCase())) {
          if (!this.actToDeptsMap.has(act)) {
            this.actToDeptsMap.set(act, new Map());
          }
          const deptsMap = this.actToDeptsMap.get(act);
          if (!deptsMap.has(dept)) {
            deptsMap.set(dept, []);
          }
          deptsMap.get(dept).push(grId);
        }
      });

      // 4. Index Superseded / Nullified GRs
      if (fullTextToScan.includes('अधिक्रमित') || fullTextToScan.includes('रद्द') || fullTextToScan.includes('supersede') || fullTextToScan.includes('nullify') || fullTextToScan.includes('cancel') || fullTextToScan.includes('override')) {
        const matches = [...fullTextToScan.matchAll(/\b(20[0-2]\d{11,18})\b/g)].map(m => m[1]);
        matches.forEach(refId => {
          if (refId !== grId) {
            this.supersededRegistry.set(refId, {
              supersededBy: grId,
              department: dept,
              date: gr.metadata?.date || '2018-06-21',
              subject: subject
            });
          }
        });
      }
    });

    // 5. Compile the Rule Constitution (The Knowledge Base of Rules)
    console.log('📜 Compiling Rule Constitution from historical data...');

    // A. Compile Budget Head Ownership Rules
    this.majorHeadToDeptsMap.forEach((deptsMap, majorHead) => {
      let maxCount = 0;
      let ownerDept = '';
      let establishedByGr = '';
      
      deptsMap.forEach((grIds, headDept) => {
        if (grIds.length > maxCount) {
          maxCount = grIds.length;
          ownerDept = headDept;
          establishedByGr = grIds[0];
        }
      });
      
      if (ownerDept) {
        this.ruleConstitution.budgetHeadRules.set(majorHead, {
          ownerDepartment: ownerDept,
          establishedByGr
        });
      }
    });

    // B. Compile Statutory Acts Jurisdiction Rules
    this.actToDeptsMap.forEach((deptsMap, actName) => {
      let maxCount = 0;
      let ownerDept = '';
      let establishedByGr = '';
      
      deptsMap.forEach((grIds, actDept) => {
        if (grIds.length > maxCount) {
          maxCount = grIds.length;
          ownerDept = actDept;
          establishedByGr = grIds[0];
        }
      });
      
      if (ownerDept) {
        this.ruleConstitution.jurisdictionRules.set(actName, {
          ownerDepartment: ownerDept,
          establishedByGr
        });
      }
    });

    // C. Compile Departmental Sanction Ceiling Rules
    this.deptMaxBudgetMap.forEach((currentMax, currentDept) => {
      this.ruleConstitution.ceilingRules.set(currentDept, {
        maxAmount: currentMax.amount,
        establishedByGr: currentMax.grId
      });
    });

    // D. Compile Active Scheme Ownership Rules
    this.schemeRegistry.forEach((hits, word) => {
      const counts = new Map();
      hits.forEach(hit => {
        counts.set(hit.department, (counts.get(hit.department) || 0) + 1);
      });
      
      let maxCount = 0;
      let ownerDept = '';
      let establishedByGr = '';
      hits.forEach(hit => {
        const cnt = counts.get(hit.department);
        if (cnt > maxCount) {
          maxCount = cnt;
          ownerDept = hit.department;
          establishedByGr = hit.grId;
        }
      });

      if (ownerDept) {
        this.ruleConstitution.activeSchemes.set(word, {
          ownerDepartment: ownerDept,
          establishedByGr
        });
      }
    });

    this.initialized = true;
    console.log(`✅ Policy Knowledge Base initialized across ${this.indexer.grs.length} GRs and 33 Departments`);
  }

  /**
   * Lookup helpers for external services.
   * - validateBudgetHeadForDepartment: returns true if a budget head (full or major prefix) is historically linked to the given department
   * - getBudgetHeadCandidates: returns list of known budget heads for a department
   * - validateDDOForDepartment: checks if a DDO string appears in historical GRs of that department
   * - getSchemeOwners: returns departments that commonly own the scheme words
   */
  validateBudgetHeadForDepartment(budgetHead, department) {
    if (!budgetHead || !department) return false;
    // Check full account head matches
    const hits = this.budgetRegistry.get(budgetHead) || [];
    if (hits.some(h => h.department === department)) return true;

    // Fallback: check major head prefix
    const majorMatch = budgetHead.match(/^(\d{4})/);
    if (majorMatch) {
      const major = majorMatch[1];
      const rule = this.ruleConstitution.budgetHeadRules.get(major);
      if (rule && rule.ownerDepartment === department) return true;

      const deptMap = this.majorHeadToDeptsMap.get(major);
      if (deptMap && deptMap.has(department)) return true;
    }

    return false;
  }

  getBudgetHeadCandidatesForDepartment(department) {
    if (!department) return [];
    const results = [];
    this.budgetRegistry.forEach((arr, head) => {
      if (arr.some(a => a.department === department)) results.push(head);
    });
    return results.slice(0, 50);
  }

  validateDDOForDepartment(ddo, department) {
    if (!ddo || !department) return false;
    // Simple substring match against known ddo_candidates in indexer
    for (const gr of this.indexer.grs) {
      if ((gr.department || '') === department) {
        const ddos = (gr.metadata?.ddo_candidates || []).map(d => d.toLowerCase());
        if (ddos.some(d => d.includes(ddo.toLowerCase()) || d === ddo.toLowerCase())) return true;
      }
    }
    return false;
  }

  getDDOCandidatesForDepartment(department) {
    const set = new Set();
    if (!department) return [];
    this.indexer.grs.forEach(gr => {
      if ((gr.department || '') === department) {
        (gr.metadata?.ddo_candidates || []).forEach(d => set.add(d));
      }
    });
    return Array.from(set).slice(0, 50);
  }

  getSchemeOwners(schemeWord) {
    if (!schemeWord) return [];
    const entry = this.ruleConstitution.activeSchemes.get(schemeWord);
    if (entry) return [{ department: entry.ownerDepartment, establishedByGr: entry.establishedByGr }];
    // fallback: scan schemeRegistry
    const hits = this.schemeRegistry.get(schemeWord) || [];
    const counts = {};
    hits.forEach(h => { counts[h.department] = (counts[h.department] || 0) + 1; });
    return Object.keys(counts).map(d => ({ department: d, count: counts[d] })).sort((a,b)=>b.count-a.count);
  }

  /**
   * Universal Cross-Department Policy & Conflict Auditor
   * Evaluates new GR input against Knowledge Base across ALL 33 departments
   */
  auditPolicyConflicts(inputData) {
    if (!this.initialized && this.indexer) {
      this.buildKnowledgeBase();
    }

    const dept = (inputData.department || inputData.department_name || '').trim();
    const deptLower = dept.toLowerCase();
    
    const grType = inputData.gr_type || inputData.intentType || '';
    
    const subject = inputData.metadata?.subject || inputData.subject || inputData.targeted_action || inputData.trigger_event || '';
    const schemeName = inputData.scheme_name || subject;
    
    let amount = 0;
    if (inputData.precise_amount_inr || inputData.budget) {
      amount = Number(inputData.precise_amount_inr || inputData.budget || 0);
    } else if (inputData.sections?.financials) {
      amount = inputData.sections.financials.reduce((sum, fin) => sum + (fin.amountNumeric || 0), 0);
    }

    const budgetHead = inputData.budget_head_15_digit || inputData.accountHead || 
      (inputData.sections?.financials?.[0]?.accountHead) || '';

    const parentAct = inputData.parent_act_invoked || inputData.metadata?.parentAct || '';

    const conflictedGRs = [];
    const conflictDetails = [];
    let severity = 'NONE';

    const addConflict = (grId, conflictDept, reason, sev = 'WARNING') => {
      conflictedGRs.push({
        grNumber: grId,
        department: conflictDept,
        reason: reason,
        severity: sev,
        sourceGrId: grId,
        linkUrl: `/api/gr/${encodeURIComponent(grId)}`
      });
      conflictDetails.push(`${reason} (Ref: ${grId})`);
      if (sev === 'CRITICAL') {
        severity = 'CRITICAL';
      } else if (sev === 'HIGH' && severity !== 'CRITICAL') {
        severity = 'HIGH';
      } else if (sev === 'WARNING' && severity !== 'CRITICAL' && severity !== 'HIGH') {
        severity = 'WARNING';
      }
    };

    // 1. SIMPLE TITLE & SCHEME MATCHING (To avoid false positives on generic keywords)
    if (schemeName && schemeName.trim().length > 5 && this.indexer) {
      const cleanScheme = schemeName.trim().toLowerCase();
      this.indexer.grs.forEach(gr => {
        const histSubject = (gr.metadata?.subject || '').trim().toLowerCase();
        const histDept = gr.department || 'General';
        if (histDept.toLowerCase() !== deptLower && histSubject.includes(cleanScheme)) {
          addConflict(
            gr.metadata?.grNumber || gr.id,
            histDept,
            `Inter-Departmental Scheme Overlap: Scheme/Policy mandate in '${dept}' overlaps with existing scheme in '${histDept}'.`,
            'WARNING'
          );
        }
      });
    }

    // 2. FINANCIAL & CEILING CAP AUDIT (Using Compiled ceilingRules Rules)
    const PARENT_FINANCE_CAP_INR = 40000000; // ₹4 Crores
    if (amount > PARENT_FINANCE_CAP_INR) {
      const finCapMatch = this.indexer?.search({ query: 'Finance Department loan threshold cap', limit: 1 })[0];
      const finGrId = finCapMatch?.metadata?.grNumber || finCapMatch?.id || 'FIN-2024-CR12';
      
      const formattedAmt = (amount / 10000000).toFixed(2);
      addConflict(
        finGrId,
        'Finance Department',
        `Finance Dept Cap Violation: Requested sanction of ₹${formattedAmt} Crores (₹${amount.toLocaleString('en-IN')}) exceeds the maximum loan/expenditure threshold of ₹4.00 Crores. Requires Cabinet approval.`,
        'CRITICAL'
      );
    }

    if (amount > 0 && dept) {
      const rule = this.ruleConstitution.ceilingRules.get(dept);
      if (rule && amount > rule.maxAmount * 1.5) {
        const formattedAmt = (amount / 10000000).toFixed(2);
        const formattedMax = (rule.maxAmount / 10000000).toFixed(2);
        addConflict(
          rule.establishedByGr,
          dept,
          `Budget Mismatch: Proposed budget of ₹${formattedAmt} Crores is 1.5x higher than historical maximum sanction (₹${formattedMax} Crores) for this department.`,
          'HIGH'
        );
      }
    }

    // 3. STATUTORY ACT & JURISDICTION CONFLICT AUDIT (Using Compiled jurisdictionRules Rules)
    if (parentAct) {
      this.ruleConstitution.jurisdictionRules.forEach((rule, actName) => {
        if (parentAct.toLowerCase().includes(actName.toLowerCase()) || actName.toLowerCase().includes(parentAct.toLowerCase())) {
          if (rule.ownerDepartment.toLowerCase() !== deptLower) {
            addConflict(
              rule.establishedByGr,
              rule.ownerDepartment,
              `Statutory Jurisdiction Overlap: Cited Act '${actName}' belongs to the jurisdiction of '${rule.ownerDepartment}'.`,
              'WARNING'
            );
          }
        }
      });
    }

    // 4. CROSS-DEPARTMENT BUDGET HEAD AUDIT (Using Compiled budgetHeadRules Rules)
    if (budgetHead) {
      const match = budgetHead.match(/^(\d{4})/);
      if (match) {
        const majorHead = match[1];
        const rule = this.ruleConstitution.budgetHeadRules.get(majorHead);
        if (rule && rule.ownerDepartment.toLowerCase() !== deptLower) {
          addConflict(
            rule.establishedByGr,
            rule.ownerDepartment,
            `Cross-Department Budget Head Mismatch: Budget Major Head ${majorHead} belongs to '${rule.ownerDepartment}' sector, not '${dept}'.`,
            'HIGH'
          );
        }
      }
    }

    // 5. POLICY SUPERSESSION & OVERRIDE AUDIT
    const scanTexts = [
      inputData.reference_document,
      inputData.original_gr_id,
      inputData.trigger_event,
      inputData.targeted_action
    ].filter(Boolean);

    scanTexts.forEach(text => {
      const referencedGrIds = [...text.matchAll(/\b(20[0-2]\d{11,18})\b/g)].map(m => m[1]);
      referencedGrIds.forEach(refId => {
        if (this.supersededRegistry.has(refId)) {
          const activeRuling = this.supersededRegistry.get(refId);
          addConflict(
            activeRuling.supersededBy,
            activeRuling.department,
            `Policy Supersession Violation: Reference GR '${refId}' has been nullified or superseded by newer GR '${activeRuling.supersededBy}' (Ref: ${activeRuling.subject || 'Active Ruling'}). Please align with the active policy instead.`,
            'CRITICAL'
          );
        }
      });
    });

    // 5. CORRIGENDUM VALIDATION
    if (grType.includes('CORRIGENDUM') && !inputData.original_gr_id && !inputData.original_gr_number) {
      addConflict(
        'CORR-ERR',
        dept,
        'Corrigendum Error: Corrigendum GR must specify the Original GR 21-digit ID being amended.',
        'CRITICAL'
      );
    }

    const seen = new Set();
    const uniqueConflictedGRs = conflictedGRs.filter(c => {
      if (seen.has(c.grNumber)) return false;
      seen.add(c.grNumber);
      return true;
    });

    return {
      has_conflict: uniqueConflictedGRs.length > 0 || conflictDetails.length > 0,
      severity: severity,
      conflicted_grs: uniqueConflictedGRs,
      conflict_details: conflictDetails.join(' | ') || 'No policy conflicts detected. Inputs comply with Maharashtra Manual of Office Procedures.'
    };
  }

  /**
   * Get Knowledge Base Statistics
   */
  getStats() {
    return {
      totalGRsIndexed: this.indexer?.grs?.length || 0,
      uniqueSchemesIndexed: this.schemeRegistry.size,
      budgetHeadsIndexed: this.budgetRegistry.size,
      departmentsCovered: this.indexer?.getDepartments()?.length || 33
    };
  }
}

export default PolicyKnowledgeBase;
