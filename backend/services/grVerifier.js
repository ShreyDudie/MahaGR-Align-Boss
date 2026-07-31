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

    // Sync edited raw resolution string to resolutions array for verifications
    if (draftGR.sections && typeof draftGR.sections.resolution === 'string') {
      const cleanText = draftGR.sections.resolution.trim();
      const clauses = cleanText.split(/\n+/).map(c => c.trim()).filter(c => c.length > 5);
      draftGR.sections.resolutions = clauses.map((text, idx) => ({
        text,
        index: idx + 1
      }));
    }

    // Extract references from draft text first
    this._extractReferencesFromDraft(draftGR);

    // Run basic verification checks
    this._checkDeprecatedAccountHeads(draftGR);
    this._checkBudgetCompliance(draftGR);
    this._checkPolicyConflicts(draftGR);
    this._checkTerminologyConsistency(draftGR);
    this._checkDistrictJurisdiction(draftGR);
    this._checkFinancialOverrun(draftGR);
    this._checkTemporalConflicts(draftGR);
    this._checkPolicyKnowledgeBaseConflicts(draftGR);
    this._checkMissingReferences(draftGR);
    this._checkTemplateCompliance(draftGR);

    // Run semantic conflict detection
    try {
      await this._checkSemanticConflicts(draftGR);
    } catch (semErr) {
      console.error('Semantic conflict detection failed:', semErr.message);
    }

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
        { id: 'template', name: "Template Compliance Check", description: "Enforces structure defined in Maharashtra Manual of Office Procedure.", passed: !hasCategory('template') }
      ]
    };
  }

  /**
   * Check if account heads are deprecated (not used in recent GRs)
   */
  _checkDeprecatedAccountHeads(draftGR) {
    if (!draftGR.sections.financials) return;

    const recentYears = 2; // Check last 2 years
    const currentYear = new Date().getFullYear();
    const recentGRs = [];

    this.indexer.grs.forEach(gr => {
      if (gr.metadata.date) {
        const grYear = parseInt(gr.metadata.date.split('-')[2]);
        if (grYear >= currentYear - recentYears) {
          recentGRs.push(gr);
        }
      }
    });

    draftGR.sections.financials.forEach(fin => {
      if (fin.accountHead) {
        const found = recentGRs.some(gr => {
          if (gr.sections.financials) {
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
    if (!draftGR.sections.financials) return;

    const draftAmount = this._getTotalAmount(draftGR);
    if (draftAmount === 0) return;

    // Find similar GRs (same department, similar subject)
    const similar = this.indexer.findSimilar(draftGR, 20);
    const similarAmounts = similar
      .map(gr => this._getTotalAmount(gr))
      .filter(a => a > 0);

    if (similarAmounts.length > 0) {
      const avgAmount = similarAmounts.reduce((a, b) => a + b) / similarAmounts.length;
      const maxAmount = Math.max(...similarAmounts);

      // Alert if budget is significantly higher than average
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
    if (!draftGR.metadata || !draftGR.metadata.subject) return;

    // Find GRs on same topic from same department
    const similar = this.indexer.findSimilar(draftGR, 10);

    similar.forEach(similarGR => {
      // Check if there's a potential contradiction or overlap
      if (
        similarGR.sections.resolutions &&
        draftGR.sections.resolutions &&
        this._hasMutuallyExclusiveResolutions(draftGR, similarGR)
      ) {
        this.alerts.push({
          severity: 'critical',
          category: 'conflict',
          title: `Potential policy conflict detected`,
          description: `This GR's mandates may conflict with existing policy in GR ${similarGR.metadata.grNumber} (${similarGR.metadata.date}).`,
          conflictingPhrase: draftGR.metadata.subject,
          evidence: `Existing GR: ${similarGR.metadata.subject}`,
          remediationSuggestion: 'Review resolution mandates to ensure consistency with prior policies.',
          sourceGrId: similarGR.id,
          autoResolvable: true,
        });
      }
    });
  }

  /**
   * Check if resolutions are mutually exclusive
   */
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
            res1.text.toLowerCase().includes(conflict.word1) &&
            res2.text.toLowerCase().includes(conflict.word2)
          ) {
            hasConflict = true;
          }
        });
      });
    });

    return hasConflict;
  }

  /**
   * Extract cited GRs, circulars, and court orders from draft preamble/read section/inputs
   */
  _extractReferencesFromDraft(draftGR) {
    const references = [];
    const seenText = new Set();

    const textSources = [
      draftGR.sections?.read_section_text,
      draftGR.sections?.introduction,
      draftGR.sections?.preamble_marathi,
      draftGR.sections?.preamble_english,
      draftGR.inputPayload?.reference_document,
      draftGR.inputPayload?.original_gr_id
    ];

    const fullText = textSources
      .filter(Boolean)
      .map(t => String(t))
      .join('\n');

    // 1. Extract 21-digit GR IDs (e.g. 201803171122508601)
    const grIdRegex = /\b(20[0-2]\d{11,18})\b/g;
    let match;
    while ((match = grIdRegex.exec(fullText)) !== null) {
      const id = match[1];
      if (!seenText.has(id)) {
        seenText.add(id);
        references.push({
          type: 'gr',
          grNumber: id,
          date: null,
          sourceText: match[0]
        });
      }
    }

    const stopWords = /\s+(?:and|or|pursuant|with|read|dated|of|from|to|for|is|are|in|on|at|by|under|here)\b/i;

    // 2. Extract GRs (e.g. "Government Resolution No. PLN-2026/CR-45" or "GR No. Asank-1004/...")
    // Support optional department name e.g. "Government Resolution, Finance Department, No. ..."
    const grRegex = /(?:Government\s+Resolution|GR|Resolution)(?:,\s*[A-Za-z\s,&]+Department,?)?\s+(?:No\.?|Number|No:)?\s*([A-Za-z0-9\-\/\.\(\)#_]{2,80}(?:\s+[A-Za-z0-9\-\/\.\(\)#_]{1,40}){0,6})/gi;
    grRegex.lastIndex = 0;
    while ((match = grRegex.exec(fullText)) !== null) {
      const sourceText = match[0].trim();
      let grNumber = match[1].trim();

      // Clean up trailing punctuation
      grNumber = grNumber.replace(/[\.,;\s]+$/, '').trim();

      // Truncate stop words
      const stopMatch = grNumber.match(stopWords);
      if (stopMatch) {
        grNumber = grNumber.substring(0, stopMatch.index).trim();
      }

      // Check if it contains digits to avoid matching plain words
      if (grNumber.length > 3 && /\d/.test(grNumber) && !seenText.has(sourceText) && !seenText.has(grNumber)) {
        const postText = fullText.substring(match.index + sourceText.length, match.index + sourceText.length + 50);
        const dateMatch = postText.match(/(?:dated|of|from|dt\.|d\.)\s*(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b|\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b)/i);
        const date = dateMatch ? dateMatch[1].trim() : null;

        seenText.add(sourceText);
        seenText.add(grNumber);
        references.push({
          type: 'gr',
          grNumber: grNumber,
          date: date,
          sourceText: sourceText + (dateMatch ? ' ' + dateMatch[0] : '')
        });
      }
    }

    // 3. Extract Circulars
    const circularRegex = /(?:Government\s+Circular|Circular)(?:,\s*[A-Za-z\s,&]+Department,?)?\s+(?:No\.?|Number|No:)?\s*([A-Za-z0-9\-\/\.\(\)#_]{2,80}(?:\s+[A-Za-z0-9\-\/\.\(\)#_]{1,40}){0,6})/gi;
    circularRegex.lastIndex = 0;
    while ((match = circularRegex.exec(fullText)) !== null) {
      const sourceText = match[0].trim();
      let circularNumber = match[1].trim();

      circularNumber = circularNumber.replace(/[\.,;\s]+$/, '').trim();

      const stopMatch = circularNumber.match(stopWords);
      if (stopMatch) {
        circularNumber = circularNumber.substring(0, stopMatch.index).trim();
      }

      if (circularNumber.length > 3 && /\d/.test(circularNumber) && !seenText.has(sourceText) && !seenText.has(circularNumber)) {
        const postText = fullText.substring(match.index + sourceText.length, match.index + sourceText.length + 50);
        const dateMatch = postText.match(/(?:dated|of|from|dt\.|d\.)\s*(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b|\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b)/i);
        const date = dateMatch ? dateMatch[1].trim() : null;

        seenText.add(sourceText);
        seenText.add(circularNumber);
        references.push({
          type: 'circular',
          grNumber: circularNumber,
          date: date,
          sourceText: sourceText + (dateMatch ? ' ' + dateMatch[0] : '')
        });
      }
    }

    // 4. Extract Court Orders
    const courtOrderRegex = /\b(?:Writ\s+Petition|W\.P\.|WP|ULP|ULP\s+Complaint|Civil\s+Appeal|Special\s+Leave\s+Petition|SLP|Original\s+Application|O\.A\.|OA)\s+(?:\(Civil\)\s+)?(?:No\.?|Number|No:)?\s*([A-Za-z0-9\-\/\.\(\)#_]{1,80}(?:\s+[A-Za-z0-9\-\/\.\(\)#_]{1,40}){0,6})/gi;
    courtOrderRegex.lastIndex = 0;
    while ((match = courtOrderRegex.exec(fullText)) !== null) {
      const sourceText = match[0].trim();
      let orderNumber = match[1].trim();

      orderNumber = orderNumber.replace(/[\.,;\s]+$/, '').trim();

      const stopMatch = orderNumber.match(stopWords);
      if (stopMatch) {
        orderNumber = orderNumber.substring(0, stopMatch.index).trim();
      }

      if (orderNumber.length > 0 && /\d/.test(orderNumber) && !seenText.has(sourceText) && !seenText.has(orderNumber)) {
        const postText = fullText.substring(match.index + sourceText.length, match.index + sourceText.length + 50);
        const dateMatch = postText.match(/(?:dated|of|from|dt\.|d\.)\s*(\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4}\b|\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b)/i);
        const date = dateMatch ? dateMatch[1].trim() : null;

        seenText.add(sourceText);
        seenText.add(orderNumber);
        references.push({
          type: 'court_order',
          grNumber: orderNumber,
          date: date,
          sourceText: sourceText + (dateMatch ? ' ' + dateMatch[0] : '')
        });
      }
    }

    draftGR.sections.references = references;
  }

  /**
   * Check for missing or invalid references (verify against 98k indexer)
   */
  _checkMissingReferences(draftGR) {
    if (draftGR.sections.references && draftGR.sections.references.length > 0) {
      draftGR.sections.references.forEach(ref => {
        if (ref.grNumber) {
          const cleanRefNum = ref.grNumber.trim();
          const cleanNormRef = cleanRefNum.toLowerCase().replace(/[^a-z0-9]/g, '');

          let found = false;
          let sourceGrId = null;

          if (this.indexer) {
            // 1. Try direct get by ID
            let doc = this.indexer.getGRById(cleanRefNum);
            if (doc) {
              found = true;
              sourceGrId = doc.id;
            }

            // 2. Try normalized ID/GR Number lookup
            if (!found && cleanNormRef) {
              const matchedId = this.indexer.indices.byGRNumberNormalized?.get(cleanNormRef);
              if (matchedId) {
                found = true;
                sourceGrId = matchedId;
              }
            }

            // 3. Try direct byGRNumber map lookup
            if (!found) {
              const matchedId = this.indexer.indices.byGRNumber?.get(cleanRefNum);
              if (matchedId) {
                found = true;
                sourceGrId = matchedId;
              }
            }

            // 4. Try matching normalized substring in ID
            if (!found && cleanNormRef) {
              const matchingGr = this.indexer.grs.find(gr => {
                const normId = gr.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                return normId.includes(cleanNormRef);
              });
              if (matchingGr) {
                found = true;
                sourceGrId = matchingGr.id;
              }
            }

            // 5. Try fuzzy codeNumber search
            if (!found) {
              const searchHits = this.indexer.search({ codeNumber: cleanRefNum });
              if (searchHits.length > 0) {
                found = true;
                sourceGrId = searchHits[0].id;
              }
            }

            // 6. For Court Orders / Circulars: scan for presence in any of the 98,000 documents
            if (!found && (ref.type === 'court_order' || ref.type === 'circular')) {
              const searchStr = cleanNormRef;
              if (searchStr.length >= 3) {
                const matchingGr = this.indexer.grs.find(gr => {
                  const fullText = (gr.metadata?.subject || '') + ' ' + 
                                   (gr.sections?.read_section_text || '') + ' ' + 
                                   (gr.sections?.introduction || '') + ' ' +
                                   (gr.sections?.resolutions?.map(r => r.text).join(' ') || '');
                  const normFullText = fullText.toLowerCase().replace(/[^a-z0-9]/g, '');
                  return normFullText.includes(searchStr);
                });
                if (matchingGr) {
                  found = true;
                  sourceGrId = matchingGr.id;
                }
              }
            }
          }

          if (!found) {
            const typeLabel = ref.type === 'circular' ? 'Circular' : (ref.type === 'court_order' ? 'Court Order' : 'GR');
            this.alerts.push({
              severity: 'low',
              category: 'reference',
              title: `Referenced ${typeLabel} may not exist: ${ref.grNumber}`,
              description: `${typeLabel} reference "${ref.grNumber}" was cited but not found in the official archive database. Verify if the reference is correct.`,
              conflictingPhrase: ref.grNumber,
              remediationSuggestion: `Correct the ${typeLabel} details, check the spelling/numbers, or verify the reference is valid.`,
              sourceGrId: null,
            });
          } else if (sourceGrId) {
            ref.sourceGrId = sourceGrId;
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

    let text = (draftGR.metadata?.subject || '') + ' ' + (draftGR.sections.resolutions?.map(r => r.text).join(' ') || '');

    Object.entries(outdatedTerms).forEach(([outdated, current]) => {
      if (text.includes(outdated)) {
        // Check if current term is used elsewhere
        const similar = this.indexer.findSimilar(draftGR, 10);
        const useCurrent = similar.some(gr => {
          const grText = (gr.metadata.subject || '') + ' ' + (gr.sections.resolutions?.map(r => r.text).join(' ') || '');
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
            autoResolvable: true,
          });
        }
      }
    });

    // Bilingual Department Glossary Mismatch Check
    const glossary = {
      'Finance Department': 'वित्त विभाग',
      'Public Health Department': 'सार्वजनिक आरोग्य विभाग',
      'School Education and Sports Department': 'शालेय शिक्षण व क्रीडा विभाग',
      'Agriculture Department': 'कृषी विभाग',
      'Home Department': 'गृह विभाग',
      'Housing Department': 'गृहनिर्माण विभाग'
    };

    const currentDept = draftGR.department || '';
    const marathiText = (draftGR.sections.introduction || '') + ' ' + (draftGR.sections.preamble_marathi || '') + ' ' + (draftGR.sections.resolution || '');

    Object.entries(glossary).forEach(([engDept, marDept]) => {
      if (currentDept.toLowerCase().trim() === engDept.toLowerCase().trim()) {
        Object.entries(glossary).forEach(([otherEng, otherMar]) => {
          if (otherEng !== engDept && marathiText.includes(otherMar)) {
            this.alerts.push({
              severity: 'medium',
              category: 'terminology',
              title: `Bilingual Term Mismatch: ${otherMar}`,
              description: `Draft department is '${engDept}', but the Marathi text cites '${otherMar}' (associated with '${otherEng}').`,
              conflictingPhrase: otherMar,
              remediationSuggestion: `Verify if '${otherMar}' is correct or align it with the '${engDept}' ('${marDept}').`,
              autoResolvable: true,
            });
          }
        });
      }
    });

    // Controlled Bilingual Legal Glossary Validation (FR-7, FR-8, FR-9)
    const legalGlossary = [
      { english: 'sanction', marathi: 'मंजुरी', approved: ['मंजुरी', 'मंजूर'], unapproved: ['परवानगी', 'मंजूरा'] },
      { english: 'expenditure', marathi: 'खर्च', approved: ['खर्च', 'व्यय'], unapproved: ['खर्चा'] },
      { english: 'corrigendum', marathi: 'शुद्धीपत्रक', approved: ['शुद्धीपत्रक'], unapproved: ['दुरुस्ती पत्रक', 'दुरुस्तीपत्रक'] },
      { english: 'moratorium', marathi: 'स्थगिती', approved: ['स्थगिती'], unapproved: ['बंदी'] },
      { english: 'resolution', marathi: 'शासन निर्णय', approved: ['शासन निर्णय', 'शासननिर्णय'], unapproved: ['सरकारी निर्णय'] },
      { english: 'appoint', marathi: 'नियुक्ती', approved: ['नियुक्ती', 'नेमणूक'], unapproved: ['भरती'] }
    ];

    legalGlossary.forEach(item => {
      // Check if English term or unapproved Marathi terms are present in the GR text
      const hasEnglish = text.toLowerCase().includes(item.english);
      if (hasEnglish) {
        item.unapproved.forEach(unapp => {
          if (marathiText.includes(unapp)) {
            this.alerts.push({
              severity: 'low',
              category: 'terminology',
              title: `Unapproved terminology: "${unapp}"`,
              description: `The unapproved Marathi term "${unapp}" was found. For standard administrative English term "${item.english}", the approved translation is "${item.marathi}".`,
              conflictingPhrase: unapp,
              remediationSuggestion: `Replace "${unapp}" with the approved standard term "${item.marathi}".`,
              autoResolvable: true,
            });
          }
        });
      }
    });
  }

  /**
   * Check district jurisdiction
   */
  _checkDistrictJurisdiction(draftGR) {
    if (!draftGR.districts || draftGR.districts.length === 0) {
      return; // No district specified is OK
    }

    // Check if department typically issues GRs for these districts
    const deptGRs = this.indexer.indices.byDepartment.get(draftGR.department) || [];
    const deptDistricts = new Set();

    deptGRs.forEach(grId => {
      const gr = this.indexer.getGRById(grId);
      if (gr && gr.districts) {
        gr.districts.forEach(d => deptDistricts.add(d));
      }
    });

    draftGR.districts.forEach(district => {
      if (!deptDistricts.has(district)) {
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
    if (!draftGR.sections.financials) return;

    // Check total financial commitment
    const totalAmount = this._getTotalAmount(draftGR);

    // Find annual budget ceiling for this department
    const deptGRs = this.indexer.indices.byDepartment.get(draftGR.department) || [];
    const deptGRsThisYear = deptGRs
      .map(id => this.indexer.getGRById(id))
      .filter(gr => {
        if (gr && gr.metadata.date) {
          const year = gr.metadata.date.split('-')[2];
          return year === new Date().getFullYear().toString();
        }
        return false;
      });

    const totalDeptBudgetThisYear = deptGRsThisYear.reduce((sum, gr) => sum + this._getTotalAmount(gr), 0);

    // Alert if total + existing > threshold
    if (totalDeptBudgetThisYear + totalAmount > 500000000) {
      // 500 crore threshold
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
   * Check for temporal conflicts (same policy issued twice in overlapping timeframes)
   */
  _checkTemporalConflicts(draftGR) {
    if (!draftGR.metadata || !draftGR.metadata.date) return;

    const similar = this.indexer.findSimilar(draftGR, 10);
    const draftDate = new Date(draftGR.metadata.date.split('-').reverse().join('-'));

    similar.forEach(similarGR => {
      if (similarGR.metadata.date) {
        const similarDate = new Date(similarGR.metadata.date.split('-').reverse().join('-'));
        // Check if issued within 30 days
        const daysDiff = Math.abs((draftDate - similarDate) / (1000 * 60 * 60 * 24));

        if (daysDiff < 30 && draftGR.metadata?.subject === similarGR.metadata?.subject) {
          this.alerts.push({
            severity: 'medium',
            category: 'temporal',
            title: 'Similar GR issued recently',
            description: `A similar GR was issued ${daysDiff.toFixed(0)} days ago. Verify this is not a duplicate.`,
            conflictingPhrase: draftGR.metadata?.subject || '',
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
    if (!gr.sections.financials) return 0;

    return gr.sections.financials.reduce((sum, fin) => {
      return sum + (fin.amountNumeric || 0);
    }, 0);
  }

  /**
   * Check for policy conflicts using the PolicyKnowledgeBase
   */
  _checkPolicyKnowledgeBaseConflicts(draftGR) {
    const auditResult = this.knowledgeBase.auditPolicyConflicts(draftGR);
    if (auditResult.has_conflict && auditResult.conflicted_grs) {
      auditResult.conflicted_grs.forEach(c => {
        let sev = 'warning';
        if (c.severity === 'CRITICAL') {
          sev = 'critical';
        } else if (c.severity === 'HIGH') {
          sev = 'high';
        }

        this.alerts.push({
          severity: sev,
          category: 'conflict',
          title: `Policy Conflict: ${c.department}`,
          description: c.reason,
          conflictingPhrase: draftGR.metadata?.subject || '',
          remediationSuggestion: `Review references or mandates in ${c.grNumber} and coordinate across departments if necessary.`,
          sourceGrId: c.grNumber, // Links to precursor GR
          autoResolvable: true,
        });
      });
    }
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
        matches = this.indexer.search({ query: val, limit: 3 });
      }
      if (matches.length > 0) {
        return { valid: true, status: 'verified', message: `✅ Verified Officer title (Matches ${matches.length} historical GRs)` };
      }
      return { valid: true, status: 'info', message: 'ℹ️ Custom DDO Title' };
    }

    if (fieldName === 'precise_amount_inr' || fieldName === 'budget') {
      const num = Number(val);
      if (num > 40000000) {
        return { valid: false, status: 'critical', message: `🚨 CRITICAL: ₹${(num / 10000000).toFixed(2)} Crores exceeds Parent Finance Cap (₹4.00 Crores). Requires Cabinet approval.` };
      }
      return { valid: true, status: 'verified', message: '✅ Amount within standard departmental sanction ceiling.' };
    }

    return { valid: true, status: 'verified', message: '✅ Valid input' };
  }

  /**
   * Verify GR structure compliance with Maharashtra Manual of Office Procedure
   */
  _checkTemplateCompliance(draftGR) {
    if (!draftGR.sections) return;

    // 1. Check Preamble / Introduction
    if (!draftGR.sections.introduction || draftGR.sections.introduction.trim().length < 10) {
      this.alerts.push({
        severity: 'critical',
        category: 'template',
        title: 'Missing Preamble/Introduction',
        description: 'The GR must contain an Introduction/Preamble introducing the background of the resolution.',
        conflictingPhrase: null,
        remediationSuggestion: 'Add an introduction or preamble describing the context and background.'
      });
    }

    // 2. Check Reference (Read) Section (Disabled)

    // 3. Check Resolution Section
    if (!draftGR.sections.resolution || draftGR.sections.resolution.trim().length < 10) {
      if (!draftGR.sections.resolutions || draftGR.sections.resolutions.length === 0) {
        this.alerts.push({
          severity: 'critical',
          category: 'template',
          title: 'Missing Resolution Mandates',
          description: 'The GR must contain a "Resolution" (शासन निर्णय) section detailing the official executive orders.',
          conflictingPhrase: null,
          remediationSuggestion: 'Add resolution clauses outlining the government orders.'
        });
      }
    }

    // 4. Check Financial Sanction Block (for Financial GRs)
    if (draftGR.metadata?.intentType === '1_FINANCIAL_SANCTION' || draftGR.gr_type === '1_FINANCIAL_SANCTION') {
      if (!draftGR.sections.financials || draftGR.sections.financials.length === 0) {
        this.alerts.push({
          severity: 'critical',
          category: 'template',
          title: 'Missing Financial Sanction Block',
          description: 'Financial Sanction GRs must contain a Financial Sanction Block specifying the sanctioned amount, account head, and DDO.',
          conflictingPhrase: null,
          remediationSuggestion: 'Provide the budget details including amount, budget head, and drawing/disbursing officer.'
        });
      } else {
        // Validate Budget Head format (e.g. 2054-00-101-02 or 15-digit code)
        draftGR.sections.financials.forEach(fin => {
          if (!fin.accountHead) {
            this.alerts.push({
              severity: 'critical',
              category: 'template',
              title: 'Missing Budget Head',
              description: 'Financial allocation is missing a Budget Account Head.',
              conflictingPhrase: null,
              remediationSuggestion: 'Specify the 15-digit or 4-digit Budget Account Head (e.g., 2054-00-101-01-01).'
            });
          } else {
            const cleanHead = fin.accountHead.trim();
            const isValidFormat = /^\d{4}-\d{2}-\d{3}-\d{2}-\d{2}$/.test(cleanHead) || /^\d{4}/.test(cleanHead) || /^\d{15}$/.test(cleanHead);
            if (!isValidFormat) {
              this.alerts.push({
                severity: 'critical',
                category: 'template',
                title: 'Incorrect Budget Head Format',
                description: `Budget head "${fin.accountHead}" does not follow standard formats (e.g. 2054-00-101-02-01 or 15-digit numeric).`,
                conflictingPhrase: fin.accountHead,
                remediationSuggestion: 'Correct the budget head format to match: XXXX-XX-XXX-XX-XX.'
              });
            }
          }
        });
      }
    }

    // 5. Check Signature Headers
    if (!draftGR.sections.signature || draftGR.sections.signature.trim().length < 10) {
      this.alerts.push({
        severity: 'critical',
        category: 'template',
        title: 'Missing Signature block',
        description: 'The GR must contain an official Signature Block declaring the signing authority and Governor name.',
        conflictingPhrase: null,
        remediationSuggestion: 'Add the signature details, e.g., "By order and in the name of the Governor of Maharashtra".'
      });
    } else {
      const sigText = draftGR.sections.signature.toLowerCase();
      const hasGovernorName = sigText.includes('governor') || sigText.includes('राज्यपाल') || sigText.includes('order and in the name');
      if (!hasGovernorName) {
        this.alerts.push({
          severity: 'high',
          category: 'template',
          title: 'Incorrect Signature Header format',
          description: 'The signature block does not cite the Governor of Maharashtra as the executive sanctioning authority.',
          conflictingPhrase: draftGR.sections.signature.substring(0, 100),
          remediationSuggestion: 'Include: "By order and in the name of the Governor of Maharashtra" in the signature block.'
        });
      }
    }
  }

  /**
   * Check resolutions for semantic conflicts against GRs from other departments
   */
  async _checkSemanticConflicts(draftGR) {
    if (!draftGR.sections?.resolutions || draftGR.sections.resolutions.length === 0) {
      return;
    }

    const SEMANTIC_IGNORE_WORDS = new Set([
      'department', 'departments', 'under', 'scheme', 'schemes', 'finance', 'financial', 'government', 'resolution', 'resolutions',
      'dated', 'approved', 'crore', 'crores', 'lakh', 'lakhs', 'rupees', 'state', 'office', 'offices', 'officer', 'officers',
      'commissioner', 'administrative', 'approval', 'current', 'year', 'decision', 'policy', 'budget', 'grant', 'grants',
      'assistance', 'fund', 'funds', 'implementation', 'implement', 'subject', 'preamble', 'introduction', 'section', 'hereby',
      'thereto', 'pursuant', 'direction', 'directions', 'annexure', 'schedule', 'table', 'number', 'circular', 'order',
      'court', 'court_order', 'petition', 'appeal', 'the', 'and', 'with', 'from', 'for', 'about'
    ]);

    const currentDept = (draftGR.department || '').trim();
    const geminiKey = process.env.GEMINI_API_KEY;
    const allDetectedConflicts = [];

    // Process each clause in the draft
    for (const clause of draftGR.sections.resolutions) {
      const clauseText = clause.text || '';
      if (clauseText.trim().length < 15) continue;

      // Extract search keywords from indexer, filter out very common words
      let searchTerms = '';
      if (this.indexer && typeof this.indexer._extractKeywords === 'function') {
        const rawKeywords = this.indexer._extractKeywords(clauseText);
        searchTerms = rawKeywords
          .filter(w => !SEMANTIC_IGNORE_WORDS.has(w.toLowerCase()))
          .slice(0, 5)
          .join(' ');
      } else {
        searchTerms = clauseText.split(/\W+/)
          .filter(w => w.length > 3 && !SEMANTIC_IGNORE_WORDS.has(w.toLowerCase()))
          .slice(0, 5)
          .join(' ');
      }

      if (!searchTerms) continue;

      // Query indexer for matching candidate documents
      const candidates = this.indexer.search({ keyword: searchTerms });
      
      // Filter out candidates belonging to the current department
      const crossDeptCandidates = candidates.filter(c => 
        c.department && c.department.toLowerCase().trim() !== currentDept.toLowerCase().trim()
      ).slice(0, 50);

      if (crossDeptCandidates.length === 0) continue;

      // Extract clauses from cross-department candidate documents
      const candidateClauses = [];
      crossDeptCandidates.forEach(gr => {
        if (gr.sections?.resolutions) {
          gr.sections.resolutions.forEach(c => {
            if (c.text && c.text.trim().length > 15) {
              candidateClauses.push({
                grId: gr.id,
                grNumber: gr.metadata?.grNumber || gr.id,
                department: gr.department,
                text: c.text
              });
            }
          });
        }
      });

      if (candidateClauses.length === 0) continue;

      let similarities = [];

      if (geminiKey) {
        // Option A: Dense vector embeddings from Gemini API
        try {
          const textsToEmbed = [clauseText, ...candidateClauses.map(cc => cc.text)];
          
          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:batchEmbedContents?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              requests: textsToEmbed.map(text => ({
                model: 'models/text-embedding-004',
                content: { parts: [{ text }] }
              }))
            })
          });

          if (response.ok) {
            const data = await response.json();
            const embeddings = data.embeddings || [];
            if (embeddings.length >= 2) {
              const draftVector = embeddings[0].values;
              
              for (let i = 0; i < candidateClauses.length; i++) {
                const candidateVector = embeddings[i + 1]?.values;
                if (candidateVector) {
                  const score = this._cosineSimilarity(draftVector, candidateVector);
                  similarities.push({
                    candidate: candidateClauses[i],
                    draftText: clauseText,
                    score: score
                  });
                }
              }
            }
          } else {
            console.warn('Gemini embedding request failed, falling back to local TF-IDF:', response.status);
            similarities = this._computeLocalTfidfSimilarities(clauseText, candidateClauses);
          }
        } catch (apiErr) {
          console.warn('Gemini embedding error, falling back to local TF-IDF:', apiErr.message);
          similarities = this._computeLocalTfidfSimilarities(clauseText, candidateClauses);
        }
      } else {
        // Option B: Sparse vector TF-IDF embeddings (Fallback)
        similarities = this._computeLocalTfidfSimilarities(clauseText, candidateClauses);
      }

      allDetectedConflicts.push(...similarities);
    }

    // Sort detected conflicts by similarity score descending
    allDetectedConflicts.sort((a, b) => b.score - a.score);

    // Capture the top 3 overall conflicts above the 70% threshold
    const similarityThreshold = 0.70;
    const topConflicts = allDetectedConflicts
      .filter(conflict => conflict.score >= similarityThreshold)
      .slice(0, 3);

    topConflicts.forEach(conf => {
      const scorePercent = (conf.score * 100).toFixed(0);
      this.alerts.push({
        severity: 'high',
        category: 'conflict',
        title: `Semantic Conflict (${scorePercent}% similarity)`,
        description: `Draft clause overlaps with existing policy in '${conf.candidate.department}' (GR ID: ${conf.candidate.grNumber}).`,
        conflictingPhrase: conf.draftText.substring(0, 100) + (conf.draftText.length > 100 ? '...' : ''),
        evidence: `Conflicting sentence in ${conf.candidate.grNumber}: "${conf.matchedSentence || conf.candidate.text}"`,
        remediationSuggestion: `Align or coordinate this mandate with ${conf.candidate.department}'s policy to prevent overlap or contradictions.`,
        sourceGrId: conf.candidate.grId,
        autoResolvable: true,
      });
    });
  }

  _cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  _computeLocalTfidfSimilarities(draftText, candidateClauses) {
    const vectorizer = new LocalTfidfVectorizer();
    
    // Split each candidate clause into sentences and keep track of parent clause
    const sentenceCandidates = [];
    candidateClauses.forEach(cc => {
      const sentences = cc.text.split(/[.।\n\r]+/).map(s => s.trim()).filter(s => s.length > 15);
      sentences.forEach(s => {
        sentenceCandidates.push({
          parentClause: cc,
          text: s
        });
      });
    });

    if (sentenceCandidates.length === 0) return [];

    const texts = [draftText, ...sentenceCandidates.map(sc => sc.text)];
    
    try {
      const vectors = vectorizer.fitAndTransform(texts);
      const draftVector = vectors[0];
      const similarities = [];

      for (let i = 0; i < sentenceCandidates.length; i++) {
        const candidateVector = vectors[i + 1];
        const score = this._cosineSimilarity(draftVector, candidateVector);
        similarities.push({
          sentenceCandidate: sentenceCandidates[i],
          score: score
        });
      }

      // Group back by parent clause and take the maximum score
      const clauseScoreMap = new Map();
      similarities.forEach(sim => {
        const key = sim.sentenceCandidate.parentClause;
        const currentMax = clauseScoreMap.get(key) || { score: -1, text: '' };
        if (sim.score > currentMax.score) {
          clauseScoreMap.set(key, { score: sim.score, text: sim.sentenceCandidate.text });
        }
      });

      const finalSimilarities = [];
      clauseScoreMap.forEach((val, candidate) => {
        finalSimilarities.push({
          candidate: candidate,
          draftText: draftText,
          score: val.score,
          matchedSentence: val.text
        });
      });

      return finalSimilarities;
    } catch (err) {
      console.error('Local TF-IDF similarity calculation failed:', err.message);
      return [];
    }
  }
}

/**
 * High-speed local TF-IDF Vector space model
 */
class LocalTfidfVectorizer {
  constructor() {
    this.vocabulary = new Map();
    this.idf = [];
    this.docs = [];
  }

  fitAndTransform(documents) {
    this.docs = documents.map(doc => doc.toLowerCase().split(/\W+/).filter(w => w.length > 2));
    const termDocCounts = new Map();
    this.docs.forEach(tokens => {
      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(token => {
        termDocCounts.set(token, (termDocCounts.get(token) || 0) + 1);
      });
    });

    let index = 0;
    termDocCounts.forEach((count, term) => {
      this.vocabulary.set(term, index);
      this.idf[index] = Math.log(documents.length / (1 + count));
      index++;
    });

    return this.docs.map(tokens => {
      const vector = new Array(this.vocabulary.size).fill(0);
      const tf = new Map();
      tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
      tf.forEach((count, term) => {
        const vocabIndex = this.vocabulary.get(term);
        if (vocabIndex !== undefined) {
          vector[vocabIndex] = (count / tokens.length) * this.idf[vocabIndex];
        }
      });
      return vector;
    });
  }

  transform(document) {
    const tokens = document.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    const vector = new Array(this.vocabulary.size).fill(0);
    const tf = new Map();
    tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
    tf.forEach((count, term) => {
      const vocabIndex = this.vocabulary.get(term);
      if (vocabIndex !== undefined) {
        vector[vocabIndex] = (count / tokens.length) * this.idf[vocabIndex];
      }
    });
    return vector;
  }
}

export default GRVerifier;
export { LocalTfidfVectorizer };

