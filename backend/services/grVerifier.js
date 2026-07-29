import PolicyKnowledgeBase from './policyKnowledgeBase.js';

export class GRVerifier {
  constructor(indexer) {
    this.indexer = indexer;
    this.knowledgeBase = new PolicyKnowledgeBase(indexer);
    this.alerts = [];
  }

  /**
   * Verify a generated GR draft
   */
  async verify(draftGR) {
    this.alerts = [];

    // Run basic verification checks
    this._checkDeprecatedAccountHeads(draftGR);
    this._checkBudgetCompliance(draftGR);
    this._checkPolicyConflicts(draftGR);
    this._checkTerminologyConsistency(draftGR);
    this._checkDistrictJurisdiction(draftGR);
    this._checkFinancialOverrun(draftGR);
    this._checkTemporalConflicts(draftGR);
    
    // CRITICAL FIX: Run Policy Knowledge Base conflicts and capture the full audit result
    const auditResult = this._checkPolicyKnowledgeBaseConflicts(draftGR);
    
    await this._checkSemanticClauseConflicts(draftGR);

    // Assign unique IDs to each alert if missing
    this.alerts = this.alerts.map((a, idx) => ({
      ...a,
      id: a.id || `${a.category || 'alert'}-${idx}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`
    }));

    const hasCategory = (cat) => this.alerts.some(a => a.category === cat);

    return {
      grId: draftGR.id,
      alerts: this.alerts,
      summary: {
        critical: this.alerts.filter(a => a.severity === 'critical').length,
        high: this.alerts.filter(a => a.severity === 'high').length,
        medium: this.alerts.filter(a => a.severity === 'medium').length,
        low: this.alerts.filter(a => a.severity === 'low').length,
      },
      passedVerification: this.alerts.filter(a => a.severity === 'critical').length === 0,
      checksRun: [
        { id: 'deprecated', name: "Account Head Check", description: "Verifies that the financial account codes are current and active.", passed: !hasCategory('deprecated') },
        { id: 'budget', name: "Budget Compliance Check", description: "Verifies the budget allocation against department ceiling limit.", passed: !hasCategory('budget') },
        { id: 'conflict', name: "Policy Conflict Check", description: "Checks if resolutions contradict or overlap with existing policies.", passed: !hasCategory('conflict') },
        { id: 'reference', name: "Missing References Check", description: "Ensures the document correctly cites necessary precursor GRs.", passed: !hasCategory('reference') },
        { id: 'terminology', name: "Terminology Consistency Check", description: "Scans for deprecated, outdated, or inconsistent officer names/titles.", passed: !hasCategory('terminology') },
        { id: 'jurisdiction', name: "District Jurisdiction Check", description: "Checks if selected districts are within the department's active zones.", passed: !hasCategory('jurisdiction') },
        { id: 'temporal', name: "Temporal Overlap Check", description: "Checks if an identical resolution has been published within the last 30 days.", passed: !hasCategory('temporal') },
        { id: 'semantic_conflict', name: "Semantic Clause Conflict Check", description: "Detects semantically similar clauses across departments.", passed: !hasCategory('semantic_conflict') }
      ],
      // CRITICAL FIX: Include the full audit result for frontend display
      conflict_audit: auditResult
    };
  }

  /**
   * Check if account heads are deprecated (not used in recent GRs)
   */
  _checkDeprecatedAccountHeads(draftGR) {
    if (!draftGR.sections?.financials) return;

    const recentYears = 2;
    const currentYear = new Date().getFullYear();
    const recentGRs = [];

    this.indexer.grs.forEach(gr => {
      if (gr.metadata?.date) {
        const grYear = parseInt(gr.metadata.date.split('-')[2]);
        if (grYear >= currentYear - recentYears) {
          recentGRs.push(gr);
        }
      }
    });

    draftGR.sections.financials.forEach(fin => {
      if (fin.accountHead) {
        const found = recentGRs.some(gr => {
          if (gr.sections?.financials) {
            return gr.sections.financials.some(f => f.accountHead === fin.accountHead);
          }
          return false;
        });

        if (!found) {
          this.alerts.push({
            severity: 'high',
            category: 'deprecated',
            title: `Deprecated Account Head: ${fin.accountHead}`,
            description: `Account head ${fin.accountHead} has not been used in recent GRs (last ${recentYears} years). Verify if this is still valid.`,
            conflictingPhrase: fin.description || fin.accountHead,
            remediationSuggestion: 'Review recent GRs for current valid account heads in this department.',
            sourceGrId: null,
          });
        }
      }
    });
  }

  /**
   * Check budget ceiling compliance
   */
  _checkBudgetCompliance(draftGR) {
    if (!draftGR.sections?.financials) return;

    const draftAmount = this._getTotalAmount(draftGR);
    if (draftAmount === 0) return;

    const similar = this.indexer.findSimilar(draftGR, 20);
    const similarAmounts = similar
      .map(gr => this._getTotalAmount(gr))
      .filter(a => a > 0);

    if (similarAmounts.length > 0) {
      const avgAmount = similarAmounts.reduce((a, b) => a + b) / similarAmounts.length;
      const maxAmount = Math.max(...similarAmounts);

      if (draftAmount > avgAmount * 2) {
        const sourceGr = similar.find(gr => this._getTotalAmount(gr) === maxAmount);
        this.alerts.push({
          severity: 'high',
          category: 'budget',
          title: `Budget significantly exceeds historical average`,
          description: `Proposed budget (₹${draftAmount.toLocaleString('en-IN')}) is 2x higher than average for similar GRs (avg: ₹${avgAmount.toLocaleString('en-IN')}).`,
          conflictingPhrase: `₹${draftAmount.toLocaleString('en-IN')}`,
          evidence: `Average amount in similar GRs: ₹${avgAmount.toLocaleString('en-IN')}`,
          remediationSuggestion: 'Review budget amount or provide justification for exceptional allocation.',
          sourceGrId: sourceGr?.id,
        });
      }
    }
  }

  /**
   * Check for policy conflicts with existing GRs
   */
  _checkPolicyConflicts(draftGR) {
    if (!draftGR.metadata?.subject) return;

    const similar = this.indexer.findSimilar(draftGR, 10);

    similar.forEach(similarGR => {
      if (
        similarGR.sections?.resolutions &&
        draftGR.sections?.resolutions &&
        this._hasMutuallyExclusiveResolutions(draftGR, similarGR)
      ) {
        this.alerts.push({
          severity: 'critical',
          category: 'conflict',
          title: `Potential policy conflict detected`,
          description: `This GR's mandates may conflict with existing policy in GR ${similarGR.metadata?.grNumber || 'Unknown'} (${similarGR.metadata?.date || 'Unknown date'}).`,
          conflictingPhrase: draftGR.metadata.subject,
          evidence: `Existing GR: ${similarGR.metadata?.subject || 'Unknown'}`,
          remediationSuggestion: 'Review resolution mandates to ensure consistency with prior policies.',
          sourceGrId: similarGR.id,
        });
      }
    });
  }

  _hasMutuallyExclusiveResolutions(gr1, gr2) {
    const conflicts = [
      { word1: 'cancel', word2: 'renew' },
      { word1: 'suspend', word2: 'implementation' },
      { word1: 'revoke', word2: 'reestablish' },
      { word1: 'discontinue', word2: 'continue' },
    ];

    let hasConflict = false;
    gr1.sections.resolutions?.forEach(res1 => {
      gr2.sections.resolutions?.forEach(res2 => {
        conflicts.forEach(conflict => {
          if (
            res1.text?.toLowerCase().includes(conflict.word1) &&
            res2.text?.toLowerCase().includes(conflict.word2)
          ) {
            hasConflict = true;
          }
        });
      });
    });

    return hasConflict;
  }

  /**
   * Check for missing references
   */
  _checkMissingReferences(draftGR) {
    if (!draftGR.sections?.references || draftGR.sections.references.length === 0) {
      this.alerts.push({
        severity: 'medium',
        category: 'reference',
        title: 'No references to prior GRs',
        description: 'This GR does not reference any prior resolutions. Most GRs reference earlier policies.',
        conflictingPhrase: null,
        remediationSuggestion: 'Add references to relevant prior GRs if this supersedes or relates to existing policies.',
        sourceGrId: null,
      });
    } else {
      draftGR.sections.references.forEach(ref => {
        if (ref.grNumber) {
          const found = this.indexer.indices.byGRNumber?.has(ref.grNumber);
          if (!found) {
            this.alerts.push({
              severity: 'low',
              category: 'reference',
              title: `Referenced GR may not exist: ${ref.grNumber}`,
              description: `GR number ${ref.grNumber} was referenced but not found in the database. Verify the reference is correct.`,
              conflictingPhrase: ref.grNumber,
              remediationSuggestion: 'Correct the GR number or verify the reference is valid.',
              sourceGrId: null,
            });
          }
        }
      });
    }
  }

  /**
   * Check terminology consistency
   */
  _checkTerminologyConsistency(draftGR) {
    const outdatedTerms = {
      'Principal Secretary': 'Secretary',
      'Divisional Commissioner': 'Chief Secretary',
      'Revenue Officer': 'Tahsildar',
    };

    let text = (draftGR.metadata?.subject || '') + ' ' + (draftGR.sections?.resolutions?.map(r => r.text).join(' ') || '');

    Object.entries(outdatedTerms).forEach(([outdated, current]) => {
      if (text.includes(outdated)) {
        const similar = this.indexer.findSimilar(draftGR, 10);
        const useCurrent = similar.some(gr => {
          const grText = (gr.metadata?.subject || '') + ' ' + (gr.sections?.resolutions?.map(r => r.text).join(' ') || '');
          return grText.includes(current);
        });

        if (useCurrent) {
          this.alerts.push({
            severity: 'low',
            category: 'terminology',
            title: `Outdated terminology: "${outdated}"`,
            description: `The term "${outdated}" appears to be outdated. Recent GRs use "${current}" instead.`,
            conflictingPhrase: outdated,
            remediationSuggestion: `Replace "${outdated}" with "${current}" for consistency.`,
            sourceGrId: null,
          });
        }
      }
    });
  }

  /**
   * Check district jurisdiction
   */
  _checkDistrictJurisdiction(draftGR) {
    if (!draftGR.districts || draftGR.districts.length === 0) {
      return;
    }

    const deptGRs = this.indexer.indices.byDepartment.get(draftGR.department) || [];
    const deptDistricts = new Set();

    deptGRs.forEach(grId => {
      const gr = this.indexer.getGRById(grId);
      if (gr && gr.districts) {
        gr.districts.forEach(d => deptDistricts.add(d));
      }
    });

    draftGR.districts.forEach(district => {
      if (!deptDistricts.has(district) && deptDistricts.size > 0) {
        this.alerts.push({
          severity: 'low',
          category: 'jurisdiction',
          title: `Unusual district for this department: ${district}`,
          description: `${draftGR.department} has not typically issued GRs for ${district}. Verify this is correct.`,
          conflictingPhrase: district,
          remediationSuggestion: 'Verify the district assignment or document the reason for exception.',
          sourceGrId: null,
        });
      }
    });
  }

  /**
   * Check for financial overruns
   */
  _checkFinancialOverrun(draftGR) {
    if (!draftGR.sections?.financials) return;

    const totalAmount = this._getTotalAmount(draftGR);
    const deptGRs = this.indexer.indices.byDepartment.get(draftGR.department) || [];
    const deptGRsThisYear = deptGRs
      .map(id => this.indexer.getGRById(id))
      .filter(gr => {
        if (gr && gr.metadata?.date) {
          const year = gr.metadata.date.split('-')[2];
          return year === new Date().getFullYear().toString();
        }
        return false;
      });

    const totalDeptBudgetThisYear = deptGRsThisYear.reduce((sum, gr) => sum + this._getTotalAmount(gr), 0);

    if (totalDeptBudgetThisYear + totalAmount > 500000000) {
      this.alerts.push({
        severity: 'high',
        category: 'budget',
        title: 'Department annual budget allocation may be exceeded',
        description: `Adding this GR would bring total allocations to ₹${(totalDeptBudgetThisYear + totalAmount).toLocaleString('en-IN')} this year.`,
        conflictingPhrase: `₹${totalAmount.toLocaleString('en-IN')}`,
        evidence: `Current year budget: ₹${totalDeptBudgetThisYear.toLocaleString('en-IN')}`,
        remediationSuggestion: 'Reduce allocation amount or adjust budget ceiling with Finance Department.',
        sourceGrId: null,
      });
    }
  }

  /**
   * Check for temporal conflicts
   */
  _checkTemporalConflicts(draftGR) {
    if (!draftGR.metadata?.date) return;

    const similar = this.indexer.findSimilar(draftGR, 10);
    const draftDate = new Date(draftGR.metadata.date.split('-').reverse().join('-'));

    similar.forEach(similarGR => {
      if (similarGR.metadata?.date) {
        const similarDate = new Date(similarGR.metadata.date.split('-').reverse().join('-'));
        const daysDiff = Math.abs((draftDate - similarDate) / (1000 * 60 * 60 * 24));

        if (daysDiff < 30 && draftGR.metadata.subject === similarGR.metadata.subject) {
          this.alerts.push({
            severity: 'medium',
            category: 'temporal',
            title: 'Similar GR issued recently',
            description: `A similar GR was issued ${daysDiff.toFixed(0)} days ago. Verify this is not a duplicate.`,
            conflictingPhrase: draftGR.metadata.subject,
            evidence: `Previous GR: ${similarGR.metadata.grNumber} on ${similarGR.metadata.date}`,
            remediationSuggestion: 'Review if this is an amendment or a new policy.',
            sourceGrId: similarGR.id,
          });
        }
      }
    });
  }

  /**
   * Helper: Get total amount from a GR
   */
  _getTotalAmount(gr) {
    if (!gr.sections?.financials) return 0;
    return gr.sections.financials.reduce((sum, fin) => {
      return sum + (fin.amountNumeric || 0);
    }, 0);
  }

  /**
   * Check for policy conflicts using the PolicyKnowledgeBase
   * 
   * CRITICAL FIX: This now returns the full audit result and properly adds alerts
   */
  _checkPolicyKnowledgeBaseConflicts(draftGR) {
    // Create a properly formatted input for the knowledge base
    const auditInput = {
      department: draftGR.department || draftGR.metadata?.departmentName,
      department_name: draftGR.department || draftGR.metadata?.departmentName,
      gr_type: draftGR.metadata?.intentType || draftGR.metadata?.grType,
      intentType: draftGR.metadata?.intentType || draftGR.metadata?.grType,
      subject: draftGR.metadata?.subject,
      targeted_action: draftGR.metadata?.subject,
      trigger_event: draftGR.metadata?.subject,
      precise_amount_inr: this._getTotalAmount(draftGR) || 0,
      budget: this._getTotalAmount(draftGR) || 0,
      budget_head_15_digit: draftGR.sections?.financials?.[0]?.accountHead || '',
      accountHead: draftGR.sections?.financials?.[0]?.accountHead || '',
      drawing_disbursing_officer: draftGR.sections?.financials?.[0]?.ddo || '',
      utilization_certificate_deadline: draftGR.metadata?.ucDeadline || '',
      sections: draftGR.sections || {},
      metadata: draftGR.metadata || {},
      type_specific_variables: draftGR.metadata?.typeSpecificVariables || {}
    };

    // Run the audit
    const auditResult = this.knowledgeBase.auditPolicyConflicts(auditInput);
    
    // Debug log
    console.log('\n🔍 === GRVERIFIER: KNOWLEDGE BASE AUDIT RESULT ===');
    console.log('Has Conflict:', auditResult.has_conflict);
    console.log('Severity:', auditResult.severity);
    console.log('Conflicts Count:', auditResult.conflicted_grs?.length || 0);
    console.log('Conflict Details:', auditResult.conflict_details);
    console.log('==================================================\n');

    // Add alerts for each conflict
    if (auditResult.has_conflict && auditResult.conflicted_grs) {
      auditResult.conflicted_grs.forEach(c => {
        let sev = 'warning';
        if (c.severity === 'CRITICAL') {
          sev = 'critical';
        } else if (c.severity === 'HIGH') {
          sev = 'high';
        } else if (c.severity === 'MEDIUM') {
          sev = 'medium';
        }

        this.alerts.push({
          severity: sev,
          category: 'conflict',
          title: `🚨 Policy Conflict: ${c.department}`,
          description: c.reason,
          conflictingPhrase: draftGR.metadata?.subject || '',
          evidence: `Source: ${c.grNumber}`,
          remediationSuggestion: `Review references or mandates in ${c.grNumber} and coordinate across departments if necessary.`,
          sourceGrId: c.grNumber,
          sourceDepartment: c.department,
          linkUrl: c.linkUrl || `/api/gr/${encodeURIComponent(c.grNumber)}`
        });
      });
    }

    // Return the full audit result for the frontend
    return auditResult;
  }

  /**
   * Semantic clause conflict detection
   */
  async _checkSemanticClauseConflicts(draftGR) {
    if (!draftGR || !draftGR.sections) return;

    // Check if indexer has the clause embedding index ready
    if (!this.indexer.clauseIndexReady) {
      await this.indexer.buildClauseEmbeddingIndex();
    }

    const threshold = parseFloat(process.env.SEMANTIC_CONFLICT_THRESHOLD || '0.80');
    const topN = parseInt(process.env.SEMANTIC_CONFLICT_TOPN || '8', 10);
    const clauses = this._extractDraftClauses(draftGR);
    
    if (clauses.length === 0) return;

    const seenConflictKeys = new Set();

    for (let idx = 0; idx < clauses.length; idx++) {
      const clauseText = clauses[idx];
      const matches = await this.indexer.searchClauseConflicts(clauseText, topN, threshold);
      
      matches.forEach(match => {
        if (match.grId === draftGR.id) return;
        const conflictKey = `${idx}-${match.grId}-${match.clauseIndex}`;
        if (seenConflictKeys.has(conflictKey)) return;
        seenConflictKeys.add(conflictKey);

        const severity = match.score >= 0.92 ? 'critical' : match.score >= 0.86 ? 'high' : 'medium';
        const conflictType = this._classifyClauseConflict(clauseText, match.clauseText);

        this.alerts.push({
          severity,
          category: 'semantic_conflict',
          title: `Semantic clause conflict detected (${match.department})`,
          description: `Clause ${idx + 1} is semantically similar to clause ${match.clauseIndex} in GR ${match.grNumber} (${match.department}).`,
          conflictingPhrase: clauseText.slice(0, 180),
          evidence: `Matched clause: ${match.clauseText.slice(0, 180)} | Similarity: ${match.score.toFixed(3)}`,
          remediationSuggestion: this._suggestResolution(clauseText, match.clauseText, conflictType),
          sourceGrId: match.grId,
          sourceDepartment: match.department,
          sourceLink: match.sourceLink,
          conflictType,
          similarityScore: match.score
        });
      });
    }
  }

  _extractDraftClauses(draftGR) {
    const clauses = [];
    if (draftGR.sections?.resolution_clauses_english && Array.isArray(draftGR.sections.resolution_clauses_english)) {
      draftGR.sections.resolution_clauses_english.forEach(clause => {
        if (clause && String(clause).trim().length > 20) {
          clauses.push(String(clause).trim());
        }
      });
    }

    if (clauses.length === 0 && draftGR.sections?.resolutions) {
      draftGR.sections.resolutions.forEach(item => {
        if (item?.text && String(item.text).trim().length > 20) {
          clauses.push(String(item.text).trim());
        }
      });
    }

    if (clauses.length === 0 && draftGR.sections?.resolution) {
      const text = String(draftGR.sections.resolution || '');
      clauses.push(...this._splitTextIntoClauses(text));
    }

    return clauses;
  }

  _splitTextIntoClauses(text) {
    const results = [];
    if (!text || !text.trim()) return results;

    const normalized = text.replace(/\r\n/g, '\n');
    const lines = normalized.split('\n');
    let buffer = '';

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;
      if (/^\d+\./.test(trimmed) || /^\([a-z0-9]+\)/i.test(trimmed)) {
        if (buffer.trim()) {
          results.push(buffer.trim());
        }
        buffer = trimmed;
      } else {
        buffer += ' ' + trimmed;
      }
    });

    if (buffer.trim()) {
      results.push(buffer.trim());
    }

    return results.filter(c => c.length > 20);
  }

  _classifyClauseConflict(clauseA, clauseB) {
    const lowKeywords = ['duplicate', 'similar', 'same', 'also', 'repeat'];
    const highKeywords = ['conflict', 'contradict', 'unless', 'except', 'not'];
    const text = `${clauseA} ${clauseB}`.toLowerCase();
    if (highKeywords.some(word => text.includes(word))) return 'contradiction';
    if (lowKeywords.some(word => text.includes(word))) return 'duplication';
    return 'overlap';
  }

  _suggestResolution(clauseA, clauseB, conflictType) {
    if (conflictType === 'contradiction') {
      return 'Review both clauses for opposing mandates and align the new GR with the earlier policy or seek departmental concurrence.';
    }
    if (conflictType === 'duplication') {
      return 'Verify whether this clause is already covered by the referenced GR and avoid redundant provisions.';
    }
    return 'Review the overlapping policy intent across departments and consolidate or clarify the clause wording.';
  }

  /**
   * Real-time verification of individual form input fields against historical GR indexer
   */
  verifyField(fieldName, fieldValue, _department) {
    if (!fieldValue || String(fieldValue).trim().length === 0) {
      return { valid: true, status: 'empty', message: '' };
    }

    const val = String(fieldValue).trim();

    if (fieldName === 'budget_head_15_digit' || fieldName === 'accountHead') {
      const isFormatValid = /^\d{4}-\d{2}-\d{3}-\d{2}-\d{2}$/.test(val) || /^\d{4}/.test(val);
      let foundInDB = false;

      if (this.indexer) {
        foundInDB = this.indexer.grs.some(gr => 
          gr.sections?.financials?.some(f => f.accountHead && f.accountHead.includes(val))
        );
      }

      if (foundInDB) {
        return { valid: true, status: 'verified', message: '✅ Active 15-digit Budget Head verified in historical records.' };
      } else if (isFormatValid) {
        return { valid: true, status: 'warning', message: 'ℹ️ Valid format, but not recently used in this department.' };
      } else {
        return { valid: false, status: 'error', message: '⚠️ Invalid format. Expected 15-digit format: e.g. 2202-01-101-01-03' };
      }
    }

    if (fieldName === 'drawing_disbursing_officer') {
      let matches = [];
      if (this.indexer) {
        matches = this.indexer.search({ keyword: val, limit: 3 });
      }
      if (matches.length > 0) {
        return { valid: true, status: 'verified', message: `✅ Verified Officer title (Matches ${matches.length} historical GRs)` };
      }
      return { valid: true, status: 'info', message: 'ℹ️ Custom DDO Title' };
    }

    if (fieldName === 'precise_amount_inr' || fieldName === 'budget') {
      const num = Number(val);
      if (num > 100000000) {
        return { valid: false, status: 'critical', message: `🚨 CRITICAL: ₹${(num / 10000000).toFixed(2)} Crores exceeds Parent Finance Cap (₹10.00 Crores). Requires Cabinet approval.` };
      }
      return { valid: true, status: 'verified', message: '✅ Amount within standard departmental sanction ceiling.' };
    }

    return { valid: true, status: 'verified', message: '✅ Valid input' };
  }
}

export default GRVerifier;