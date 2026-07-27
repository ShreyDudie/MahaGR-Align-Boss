/**
 * GR Generator Service
 * Generates new Government Resolution drafts using Claude API
 */

import Anthropic from '@anthropic-ai/sdk';

export class GRGenerator {
  constructor(indexer, config) {
    this.indexer = indexer;
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
   * Generate a fallback GR locally without calling external APIs
   */
  _generateFallbackGR(inputData) {
    const today = new Date().toLocaleDateString('en-GB');
    const departmentName = inputData.department.replace(/_/g, ' ');
    const grNumber = `GR-${Date.now().toString().slice(-6)}`;

    let deptSpecsText = '';
    if (inputData.deptDetails && Object.keys(inputData.deptDetails).length > 0) {
      deptSpecsText = '\nDEPARTMENT SPECIFIC DETAILS:\n';
      Object.entries(inputData.deptDetails).forEach(([key, val]) => {
        if (val) {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          deptSpecsText += `- ${label}: ${val}\n`;
        }
      });
    }

    let otherSpecsText = '';
    if (inputData.otherDetails) {
      otherSpecsText = `\nADDITIONAL RESOLUTION CLAUSES / NOTES:\n- ${inputData.otherDetails}\n`;
    }

    return `=== GOVERNMENT RESOLUTION ===
GOVERNMENT OF MAHARASHTRA
${departmentName}
Resolution No: ${grNumber}
Date: ${today}

=== INTRODUCTION ===
In view of the developmental requirements regarding ${inputData.subject}, the Government has been considering a comprehensive scheme to address these challenges. Based on representations received from public representatives and administrative departments, the following decision is being made.
${deptSpecsText}${otherSpecsText}

=== REFERENCES ===
1. Government Resolution, Finance Department, No. Budget-2023/C.R.45/UD-1, Dated 12th April 2023.
2. Government Resolution, Planning Department, No. Planning-2024/C.R.12/UD-2, Dated 15th January 2024.

=== RESOLUTION ===
1. The Government hereby accords sanction to execute the policy changes and administrative provisions regarding "${inputData.subject}".
2. All executive functions will be supervised by the Director of the Department in coordination with local district officers.
3. Monthly progress reports shall be submitted directly to the Principal Secretary for administrative review.
4. Any variations in implementation must be approved by the Finance Department prior to execution.

=== FINANCIAL DETAILS ===
Total Budget Sanctioned: INR ${inputData.budgetAmount || inputData.budget || '0'}
Target Account Head: ${inputData.accountHead || 'N/A'}
District Allocations: ${inputData.districts?.join(', ') || 'State-wide'}
The expenditure shall be charged to the budget head of the respective department for the current financial year.

=== DISTRIBUTION ===
1. The Principal Secretary to the Honorable Governor.
2. The Principal Secretary to the Honorable Chief Minister.
3. The Accountant General (A&E), Maharashtra, Mumbai/Nagpur.
4. All District Collectors of the state of Maharashtra.
5. Guard File (Planning/Finance/Department).
`;
  }

  /**
   * Generate a new GR draft from user input
   */
  async generateGR(inputData) {
    // Find similar GRs to use as style reference
    const draftGR = {
      id: `draft_${Date.now()}`,
      department: inputData.department,
      metadata: {
        subject: inputData.subject,
        departmentName: inputData.department,
      },
      sections: {
        references: [],
        resolutions: [],
        financials: [],
      },
      districts: inputData.districts || [],
    };

    const similar = this.indexer.findSimilar(draftGR, 3);
    const styleContext = this._buildStyleContext(similar);

    // Build prompt
    const prompt = this._buildGeneratorPrompt(inputData, styleContext);

    try {
      let generatedText = '';
      let inputTokens = 0;
      let outputTokens = 0;

      if (this.config.type === 'fallback' || !this.config.key) {
        generatedText = this._generateFallbackGR(inputData);
        inputTokens = 0;
        outputTokens = 0;
      } else {
        try {
          if (this.config.type === 'gemini') {
            const modelName = this.config.model || 'gemini-1.5-flash';
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.config.key}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      {
                        text: prompt
                      }
                    ]
                  }
                ],
                generationConfig: {
                  maxOutputTokens: 2048,
                  temperature: 0.2
                }
              })
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error?.message || `Gemini API error: ${response.statusText}`);
            }

            const data = await response.json();
            generatedText = data.candidates[0].content.parts[0].text;
            inputTokens = data.usageMetadata?.promptTokenCount || 0;
            outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
          } else if (this.config.type === 'openrouter') {
            const modelName = this.config.model || 'meta-llama/llama-3-8b-instruct:free';
            const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.key}`,
                'HTTP-Referer': 'http://localhost:5173',
                'X-Title': 'Maharashtra GR-Align',
              },
              body: JSON.stringify({
                model: modelName,
                messages: [
                  {
                    role: 'user',
                    content: prompt
                  }
                ],
                max_tokens: 2048,
                temperature: 0.2
              })
            });

            if (!response.ok) {
              const errData = await response.json().catch(() => ({}));
              throw new Error(errData.error?.message || `OpenRouter API error: ${response.statusText}`);
            }

            const data = await response.json();
            generatedText = data.choices[0].message.content;
            inputTokens = data.usage?.prompt_tokens || 0;
            outputTokens = data.usage?.completion_tokens || 0;
          } else {
            // Call Claude API
            const message = await this.client.messages.create({
              model: this.model,
              max_tokens: 2048,
              messages: [
                {
                  role: 'user',
                  content: prompt,
                },
              ],
            });

            generatedText = message.content[0].text;
            inputTokens = message.usage.input_tokens;
            outputTokens = message.usage.output_tokens;
          }
        } catch (apiError) {
          console.warn('⚠️ API Call failed. Falling back to local draft generation. Error:', apiError.message);
          generatedText = this._generateFallbackGR(inputData);
          inputTokens = 0;
          outputTokens = 0;
        }
      }

      const parsedGR = this._parseGeneratedGR(generatedText, inputData, similar);

      return {
        success: true,
        grId: draftGR.id,
        draft: parsedGR,
        rawOutput: generatedText,
        tokensUsed: inputTokens + outputTokens,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        grId: draftGR.id,
      };
    }
  }

  /**
   * Build style context from similar GRs
   */
  _buildStyleContext(similarGRs) {
    if (similarGRs.length === 0) return '';

    let context = 'Below are actual similar historical Government Resolutions (GRs) from this department. Study their structure, legal language, formatting, list of references, and financial sections carefully to format the new GR exactly like them:\n\n';
    similarGRs.forEach((gr, idx) => {
      context += `HISTORICAL REFERENCE GR ${idx + 1}:\n`;
      context += `GR ID/Number: ${gr.metadata.grNumber || gr.id || 'N/A'}\n`;
      context += `Department: ${gr.department}\n`;
      context += `Subject: ${gr.metadata.subject}\n`;
      if (gr.sections.references && gr.sections.references.length > 0) {
        context += `References:\n`;
        gr.sections.references.forEach((ref, rIdx) => {
          context += `  ${rIdx + 1}. GR No. ${ref.grNumber || ref} ${ref.date ? `dated ${ref.date}` : ''}\n`;
        });
      }
      if (gr.sections.resolution) {
        context += `Resolution Details:\n${gr.sections.resolution.substring(0, 1200)}\n`;
      }
      if (gr.sections.financials && gr.sections.financials.length > 0) {
        context += `Financial Structure:\n`;
        gr.sections.financials.forEach(fin => {
          context += `  - Account Head: ${fin.accountHead || 'N/A'}, Amount: ₹${fin.amount || 'N/A'}, Description: ${fin.description || 'N/A'}\n`;
        });
      }
      context += '\n--------------------\n\n';
    });

    return context;
  }

  /**
   * Build the prompt for GR generation
   */
  _buildGeneratorPrompt(inputData, styleContext) {
    let deptSpecs = '';
    if (inputData.deptDetails && Object.keys(inputData.deptDetails).length > 0) {
      deptSpecs = '\nDEPARTMENT SPECIFIC DETAILS:\n';
      Object.entries(inputData.deptDetails).forEach(([key, val]) => {
        if (val) {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          deptSpecs += `- ${label}: ${val}\n`;
        }
      });
    }

    let otherSpecs = '';
    if (inputData.otherDetails) {
      otherSpecs = `\nADDITIONAL RESOLUTION CLAUSES / USER SPECIFICATIONS:\n- ${inputData.otherDetails}\n`;
    }

    return `You are an expert in Government of Maharashtra administration and policy-making. Generate a formal Government Resolution (GR) based on the following specifications:

DEPARTMENT: ${inputData.department}
INTENT TYPE: ${inputData.intentType || 'Policy Change'}
SUBJECT: ${inputData.subject}
DATE: ${new Date().toLocaleDateString('en-IN')}
DISTRICTS AFFECTED: ${inputData.districts?.join(', ') || 'State-wide'}
BUDGET ALLOCATION: ${inputData.budget ? `₹${inputData.budget}` : 'Not specified'}
BENEFICIARIES: ${inputData.beneficiaries || 'Not specified'}
ACCOUNT HEAD: ${inputData.accountHead || 'To be determined'}
EFFECTIVE DATE: ${inputData.effectiveDate || 'Immediate'}
${deptSpecs}${otherSpecs}

${styleContext}

INSTRUCTIONS:
1. Write in formal Government of Maharashtra style (passive voice, legal language)
2. Format output strictly with the following section markers:
=== GOVERNMENT RESOLUTION ===
=== INTRODUCTION ===
=== REFERENCES ===
=== RESOLUTION ===
=== FINANCIAL DETAILS ===
=== DISTRIBUTION ===

3. Under "=== REFERENCES ===", you MUST cite the actual GR numbers and dates of the similar resolutions provided in the HISTORICAL REFERENCE GRs style context above. Do not invent fake GR numbers; reuse the actual ones provided to maintain valid administrative history!
4. Use proper numbering and formatting (point numbers like 1., 2., etc. for resolutions)
5. Include realistic policy references and committee compositions when relevant
6. Ensure amounts are in Indian Rupees with proper formatting
7. Keep language consistent with official government terminology
8. Make it realistic, highly detailed, and implementable - not generic or vague. Write full details about the scheme, allocation rules, taluka distribution, and implementing officers.

=== GOVERNMENT RESOLUTION ===
=== INTRODUCTION ===
=== REFERENCES ===
=== RESOLUTION ===
=== FINANCIAL DETAILS ===
=== DISTRIBUTION ===

Start generating:`;
  }

  /**
   * Parse the generated GR text into structured format
   */
  _parseGeneratedGR(text, inputData, similarGRs = []) {
    const resolutionText = this._extractSection(text, 'RESOLUTION');
    const resolutionClauses = resolutionText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((line, idx) => ({
        text: line,
        index: idx + 1,
      }));

    let references = this._extractReferences(text);
    if ((!references || references.length === 0) && similarGRs && similarGRs.length > 0) {
      references = similarGRs.map(sim => ({
        grNumber: sim.metadata?.grNumber || sim.id,
        date: sim.metadata?.date || null,
        subject: sim.metadata?.subject || ''
      }));
    }

    const gr = {
      id: `draft_${Date.now()}`,
      department: inputData.department,
      status: 'draft',
      metadata: {
        subject: inputData.subject,
        departmentName: inputData.department,
        intentType: inputData.intentType,
        generatedAt: new Date().toISOString(),
      },
      sections: {
        header: this._extractSection(text, 'GOVERNMENT RESOLUTION'),
        introduction: this._extractSection(text, 'INTRODUCTION'),
        references: references,
        resolution: resolutionText,
        resolutions: resolutionClauses,
        financials: this._extractFinancialDetails(text, inputData),
        distribution: this._extractDistribution(text),
        fullText: text,
      },
      districts: inputData.districts || [],
    };

    return gr;
  }

  /**
   * Extract section from generated text
   */
  _extractSection(text, sectionName) {
    const regex = new RegExp(`===\\s*${sectionName}\\s*===\\s*([^===]+)(?===|$)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract references from generated text
   */
  _extractReferences(text) {
    const references = [];
    const refPattern = /GR\s+No\.\s+([^\n,;.]+)(?:\s+(?:dated|of)\s+)?([^\n,;.]*)/gi;
    let match;

    while ((match = refPattern.exec(text)) !== null) {
      references.push({
        grNumber: match[1].trim(),
        date: match[2]?.trim() || null,
      });
    }

    return references;
  }

  /**
   * Extract financial details
   */
  _extractFinancialDetails(text, inputData) {
    const financials = [];

    // Add budget if provided
    if (inputData.budget) {
      financials.push({
        type: 'budget',
        description: inputData.subject,
        amount: inputData.budget,
        amountNumeric: parseFloat(inputData.budget),
      });
    }

    // Extract amounts from text
    const amountPattern = /(?:Rs\.|₹|Rupees?)\s*([0-9,]+(?:\.\d{2})?)/gi;
    let match;
    const seen = new Set();

    while ((match = amountPattern.exec(text)) !== null) {
      if (!seen.has(match[1])) {
        seen.add(match[1]);
        const startIdx = Math.max(0, match.index - 50);
        const endIdx = Math.min(text.length, match.index + 50);
        const context = text.substring(startIdx, endIdx);

        financials.push({
          type: 'allocation',
          description: context.replace(/[\n\r]/g, ' ').trim(),
          amount: match[1],
          amountNumeric: parseFloat(match[1].replace(/,/g, '')),
        });
      }
    }

    return financials;
  }

  /**
   * Extract distribution list
   */
  _extractDistribution(text) {
    const distribution = [];
    const distPattern = /===\s*DISTRIBUTION\s*===\s*([^===]+)/i;
    const distMatch = text.match(distPattern);

    if (distMatch) {
      const distContent = distMatch[1];
      const lines = distContent
        .split('\n')
        .filter(line => line.trim().length > 0 && !line.includes('==='))
        .slice(0, 10);

      lines.forEach((line, idx) => {
        distribution.push({
          order: idx + 1,
          recipient: line.replace(/^\d+\.\s*/, '').trim(),
        });
      });
    }

    return distribution;
  }
}

export default GRGenerator;
