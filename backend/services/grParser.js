/**
 * GR Parser Service
 * Parses Maharashtra Government Resolution text files and extracts structured data
 */

import fs from 'fs';
import path from 'path';

export class GRParser {
  constructor() {
    this.departmentPatterns = {};
  }

  /**
   * Parse a single GR file and extract structured data
   */
  parseGRFile(fileContent, department, filename) {
    const gr = {
      id: path.basename(filename, path.extname(filename)),
      filename: filename,
      department: department,
      parseDate: new Date().toISOString(),
      sections: {
        read_section_text: '',
        introduction: '',
        preamble_marathi: '',
        preamble_english: '',
        resolution_clauses_marathi: [],
        resolution_clauses_english: [],
        resolutions: [],
        references: [],
        financials: [],
        distribution: [],
        header: ''
      },
      metadata: {
        grNumber: '',
        date: '',
        subject: '',
        departmentName: department,
        keywords: [],
        budget_heads: [],
        ddo_candidates: [],
        scheme_words: []
      },
      districts: []
    };

    // Remove extra whitespace and normalize line breaks
    const cleanContent = fileContent
      .replace(/\r\n/g, '\n')
      .replace(/[\u2000-\u200D\uFEFF]/g, '')
      .trim();

    // Extract all sections
    this._extractHeader(gr, cleanContent);
    this._extractReadSection(gr, cleanContent);
    this._extractPreamble(gr, cleanContent);
    this._extractMetadata(gr, cleanContent);
    this._extractReferences(gr, cleanContent);
    this._extractFinancials(gr, cleanContent);
    this._extractResolutions(gr, cleanContent);
    this._extractDistribution(gr, cleanContent);
    this._extractClauses(gr, cleanContent);

    // Extract districts from content
    gr.districts = this.extractDistricts(cleanContent);

    // Set introduction from preamble if available
    if (!gr.sections.introduction && gr.sections.preamble_english) {
      gr.sections.introduction = gr.sections.preamble_english;
    }

    return gr;
  }

  /**
   * Extract header information
   */
  _extractHeader(gr, content) {
    const lines = content.split('\n').slice(0, 10);
    const headerLines = [];
    let foundHeader = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      if (trimmed.includes('Government of Maharashtra') || 
          trimmed.includes('महाराष्ट्र शासन') ||
          trimmed.includes('Mantralaya') ||
          trimmed.match(/^[A-Z\s]+$/)) {
        headerLines.push(trimmed);
        foundHeader = true;
      } else if (foundHeader && headerLines.length < 5) {
        // Continue collecting header lines
        if (trimmed.length > 0 && !trimmed.match(/^[0-9]/)) {
          headerLines.push(trimmed);
        } else {
          break;
        }
      } else if (foundHeader) {
        break;
      }
    }

    if (headerLines.length > 0) {
      gr.sections.header = headerLines.join('\n');
    }
  }

  /**
   * Extract "Read:" section (references)
   */
  _extractReadSection(gr, content) {
    const readPattern = /(?:Read|वाचा|संदर्भ)[\s:]*\n([\s\S]*?)(?=\n\n|\n(?:Preamble|प्रस्तावना|Resolution|निर्णय|Whereas|जाहीर|हुकूम))/i;
    const readMatch = content.match(readPattern);
    
    if (readMatch) {
      gr.sections.read_section_text = readMatch[1].trim();
      
      // Extract individual references from the read section
      const refLines = readMatch[1].split('\n').filter(line => line.trim().length > 0);
      refLines.forEach((line, idx) => {
        const cleanLine = line.replace(/^[\d]+\.\s*/, '').trim();
        if (cleanLine) {
          gr.sections.references.push({
            order: idx + 1,
            text: cleanLine,
            sourceText: line.trim()
          });
        }
      });
    }
  }

  /**
   * Extract preamble (introduction)
   */
  _extractPreamble(gr, content) {
    // Look for preamble section - English
    const preamblePattern = /(?:Preamble|प्रस्तावना|Whereas|जाहीर|Introduction)[\s:]*\n([\s\S]*?)(?=\n\n|\n(?:Resolution|निर्णय|Government Resolution|शासन निर्णय|Now Therefore))/i;
    const preambleMatch = content.match(preamblePattern);
    
    if (preambleMatch) {
      const preambleText = preambleMatch[1].trim();
      gr.sections.preamble_english = preambleText;
      gr.sections.preamble_marathi = preambleText; // Fallback - use English for both
      gr.sections.introduction = preambleText;
    } else {
      // Fallback: Try to extract from first paragraphs
      const lines = content.split('\n');
      let introLines = [];
      let inIntro = false;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed.includes('Whereas') || 
            trimmed.includes('In view') || 
            trimmed.includes('Keeping in view') ||
            trimmed.includes('प्रस्तावना') ||
            trimmed.includes('जाहीर')) {
          inIntro = true;
        }
        
        if (inIntro && trimmed.length > 20) {
          introLines.push(trimmed);
        }
        
        if (inIntro && trimmed.match(/^(Resolution|निर्णय)/)) {
          break;
        }
        
        // Limit intro to first 15 lines
        if (introLines.length > 15) break;
      }
      
      if (introLines.length > 0) {
        const introText = introLines.join('\n');
        gr.sections.preamble_english = introText;
        gr.sections.preamble_marathi = introText;
        gr.sections.introduction = introText;
      }
    }
  }

  /**
   * Extract metadata: GR number, date, title, subject
   */
  _extractMetadata(gr, content) {
    // GR Number pattern
    const grNumberPattern = /(?:GR\s+No\.|Notification\s+No\.|Reference\s+No\.|GR Number|Resolution No)[\s:]*([^\n]+)/i;
    const grMatch = content.match(grNumberPattern);
    if (grMatch) {
      gr.metadata.grNumber = grMatch[1].trim();
    }

    // Date pattern: "DD Month YYYY"
    const datePattern = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i;
    const dateMatch = content.match(datePattern);
    if (dateMatch) {
      const monthMap = {
        'January': '01', 'February': '02', 'March': '03', 'April': '04',
        'May': '05', 'June': '06', 'July': '07', 'August': '08',
        'September': '09', 'October': '10', 'November': '11', 'December': '12',
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04',
        'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08',
        'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      const monthNum = monthMap[dateMatch[2]] || '01';
      gr.metadata.date = `${dateMatch[3]}-${monthNum}-${dateMatch[1].padStart(2, '0')}`;
    }

    // Alternative date pattern: DD/MM/YYYY
    if (!gr.metadata.date) {
      const altDatePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
      const altDateMatch = content.match(altDatePattern);
      if (altDateMatch) {
        gr.metadata.date = `${altDateMatch[3]}-${altDateMatch[2].padStart(2, '0')}-${altDateMatch[1].padStart(2, '0')}`;
      }
    }

    // Alternative date pattern: YYYY-MM-DD
    if (!gr.metadata.date) {
      const isoDatePattern = /(\d{4})-(\d{2})-(\d{2})/;
      const isoDateMatch = content.match(isoDatePattern);
      if (isoDateMatch) {
        gr.metadata.date = `${isoDateMatch[1]}-${isoDateMatch[2]}-${isoDateMatch[3]}`;
      }
    }

    // Extract title/subject from first meaningful line
    const lines = content.split('\n').filter(l => l.trim().length > 20);
    for (let i = 0; i < Math.min(15, lines.length); i++) {
      const line = lines[i].trim();
      if (
        !line.includes('Government of Maharashtra') &&
        !line.includes('महाराष्ट्र शासन') &&
        !line.match(/^[A-Z\s]+$/) &&
        !line.includes('Read:') &&
        !line.includes('वाचा:') &&
        line.length > 30 &&
        line.length < 200
      ) {
        gr.metadata.subject = line;
        break;
      }
    }
  }

  /**
   * Extract references to other GRs
   */
  _extractReferences(gr, content) {
    // If we already have references from the read section, don't duplicate
    if (gr.sections.references.length > 0) return;

    // Pattern: "GR No. XX/ABC-YY dated DD/MM/YYYY"
    const refPattern = /GR\s+No\.\s+([^\n,;.]+)(?:\s+(?:dated|of|from)\s+)?([^\n,;.]*)/gi;
    let match;
    while ((match = refPattern.exec(content)) !== null) {
      gr.sections.references.push({
        order: gr.sections.references.length + 1,
        grNumber: match[1].trim(),
        date: match[2]?.trim() || null,
        sourceText: match[0],
      });
    }

    // Also extract "Resolution" references
    const resRefPattern = /(?:Earlier\s+)?(?:Resolution|Resolution\s+No\.|शासन निर्णय)\s+([^\n,;.]+)/gi;
    while ((match = resRefPattern.exec(content)) !== null) {
      gr.sections.references.push({
        order: gr.sections.references.length + 1,
        type: 'resolution',
        identifier: match[1].trim(),
        sourceText: match[0],
      });
    }

    // Remove duplicates
    gr.sections.references = [...new Map(gr.sections.references.map(r => [JSON.stringify(r), r])).values()];
  }

  /**
   * Extract financial data: amounts, budgets, allocations
   */
  _extractFinancials(gr, content) {
    // Pattern: Currency amounts in Indian format (₹ or Rs.)
    const amountPattern = /(?:Rs\.|₹|Rupees?)\s*([0-9,]+(?:\.\d{2})?)/gi;
    let match;
    const seen = new Set();

    while ((match = amountPattern.exec(content)) !== null) {
      const amount = match[1];
      if (!seen.has(amount)) {
        seen.add(amount);
        const startIdx = Math.max(0, match.index - 100);
        const endIdx = Math.min(content.length, match.index + 100);
        const context = content.substring(startIdx, endIdx);

        // Try to extract account head from context
        const accountHeadMatch = context.match(/(\d{4}-\d{2}-\d{3}-\d{2}-\d{2}|\d{4}-\d{2}-\d{3})/);
        
        gr.sections.financials.push({
          amount: amount,
          amountNumeric: parseFloat(amount.replace(/,/g, '')),
          context: context.trim(),
          accountHead: accountHeadMatch ? accountHeadMatch[1] : null,
          description: context.split('\n')[0]?.trim() || '',
          sourcePosition: match.index,
        });
      }
    }

    // Extract account heads
    const accountHeadPattern = /(?:Major\s+Head|Sub\s+Head|Minor\s+Head|Detailed\s+Head)[\s:]*([0-9]{4,}(?:-[0-9]{2,})*)[^\n]*/gi;
    while ((match = accountHeadPattern.exec(content)) !== null) {
      const existing = gr.sections.financials.find(f => f.accountHead === match[1].trim());
      if (!existing) {
        gr.sections.financials.push({
          type: 'accountHead',
          accountHead: match[1].trim(),
          description: match[0].split(':')[0]?.trim() || 'Account Head',
        });
      }
    }

    // Extract budget allocation tables
    const budgetTableLines = content
      .split('\n')
      .filter(line => /^\d+\s+/.test(line) && (line.includes('₹') || line.includes('Rs.')));

    budgetTableLines.forEach(line => {
      const parts = line.split(/\s{2,}|₹|Rs\./);
      if (parts.length >= 3) {
        const amountMatch = parts[parts.length - 1]?.match(/([0-9,]+)/);
        gr.sections.financials.push({
          type: 'budgetLine',
          description: parts[0]?.trim() || '',
          amount: amountMatch ? amountMatch[1] : null,
          amountNumeric: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0,
          sourceText: line,
        });
      }
    });
  }

  /**
   * Extract resolution clauses
   */
  _extractResolutions(gr, content) {
    const lines = content.split('\n');
    let currentResolution = '';
    let inResolution = false;
    let resolutionStart = false;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Check for resolution start markers
      if (/^(?:Resolution:|Resolved:|The\s+Government\s+(?:hereby|accords)|Now\s+Therefore|Government\s+Resolution)/i.test(trimmed)) {
        if (currentResolution) {
          gr.sections.resolutions.push({
            text: currentResolution.trim(),
            index: gr.sections.resolutions.length + 1,
          });
        }
        currentResolution = line;
        inResolution = true;
        resolutionStart = true;
      } else if (inResolution && trimmed) {
        currentResolution += '\n' + line;
      } else if (inResolution && !trimmed && currentResolution) {
        // Only save if resolution is long enough
        if (currentResolution.split('\n').filter(l => l.trim()).length > 2) {
          gr.sections.resolutions.push({
            text: currentResolution.trim(),
            index: gr.sections.resolutions.length + 1,
          });
        }
        currentResolution = '';
        inResolution = false;
      }
    }

    if (currentResolution) {
      gr.sections.resolutions.push({
        text: currentResolution.trim(),
        index: gr.sections.resolutions.length + 1,
      });
    }

    // If no resolutions found, try to extract from numbered paragraphs
    if (gr.sections.resolutions.length === 0) {
      const numberedPattern = /^(\d+)\.\s+(.+)$/gm;
      let match;
      while ((match = numberedPattern.exec(content)) !== null) {
        gr.sections.resolutions.push({
          text: match[2].trim(),
          index: parseInt(match[1]),
        });
      }
    }
  }

  /**
   * Extract clauses as string arrays (for compatibility)
   */
  _extractClauses(gr, content) {
    // Extract numbered clauses
    const clausePattern = /^(?:(\d+)\.|\d+\))\s*(.+)$/gm;
    let match;
    const clauses = [];

    while ((match = clausePattern.exec(content)) !== null) {
      clauses.push(match[2].trim());
    }

    // If no numbered clauses found, use resolutions
    if (clauses.length === 0 && gr.sections.resolutions.length > 0) {
      gr.sections.resolutions.forEach(res => {
        if (res.text && res.text.length > 20) {
          clauses.push(res.text);
        }
      });
    }

    // If still no clauses, split by paragraphs
    if (clauses.length === 0) {
      const paragraphs = content
        .split('\n\n')
        .filter(p => p.trim().length > 50 && !p.includes('Read:') && !p.includes('वाचा:'))
        .slice(0, 10);
      
      paragraphs.forEach((p, idx) => {
        const clean = p.replace(/\n/g, ' ').trim();
        if (clean.length > 30) {
          clauses.push(`${idx + 1}. ${clean}`);
        }
      });
    }

    gr.sections.resolution_clauses_english = clauses;
    gr.sections.resolution_clauses_marathi = clauses; // Fallback - use same for both
  }

  /**
   * Extract distribution list
   */
  _extractDistribution(gr, content) {
    const distPattern = /(?:Distribution|Copy\s+to|Sent\s+to|प्रत\s+माहिती|वितरण)[\s:]*([\s\S]*?)(?=\n\nSignature|---|$)/i;
    const distMatch = content.match(distPattern);

    if (distMatch) {
      const distContent = distMatch[1];
      const recipients = distContent
        .split('\n')
        .filter(line => line.trim().length > 0 && !line.match(/^\d+\.\s*$/))
        .slice(0, 15);

      recipients.forEach((recipient, idx) => {
        const clean = recipient.replace(/^\d+\.\s*/, '').trim();
        if (clean) {
          gr.sections.distribution.push({
            order: idx + 1,
            recipient: clean,
          });
          
          // Check for DDO candidates
          if (/drawing\s*&?\s*disbursing|ddo|accountant general|pay and accounts officer/i.test(clean)) {
            gr.metadata.ddo_candidates.push(clean);
          }
        }
      });
    }
  }

  /**
   * Extract district mentions
   */
  extractDistricts(content) {
    const maharashtraDistricts = [
      'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana',
      'Chandrapur', 'Dhule', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon',
      'Jalna', 'Kolhapur', 'Latur', 'Nanded', 'Nandurbar', 'Nashik', 'Nagpur',
      'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri',
      'Sangli', 'Satara', 'Sindhudurg', 'Solapur', 'Thane', 'Wardha', 'Washim', 'Yavatmal',
      'Mumbai', 'Mumbai City', 'Mumbai Suburban'
    ];

    const districts = [];
    const contentLower = content.toLowerCase();
    
    maharashtraDistricts.forEach(district => {
      const regex = new RegExp(`\\b${district}\\b`, 'gi');
      if (regex.test(content)) {
        districts.push(district);
      }
    });

    return [...new Set(districts)];
  }

  /**
   * Batch parse all GR files from a directory
   */
  parseDirectory(directoryPath, department) {
    const grs = [];
    
    if (!fs.existsSync(directoryPath)) {
      console.warn(`⚠️ Directory not found: ${directoryPath}`);
      return grs;
    }

    const files = fs.readdirSync(directoryPath);

    files.forEach(filename => {
      if (filename.endsWith('.en.txt')) {
        const filePath = path.join(directoryPath, filename);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const gr = this.parseGRFile(content, department, filename);
          // Only add if we have some data
          if (gr.metadata.grNumber || gr.metadata.subject || gr.sections.resolutions.length > 0) {
            grs.push(gr);
          }
        } catch (error) {
          console.error(`Error parsing ${filename}:`, error.message);
        }
      }
    });

    return grs;
  }
}

export default GRParser;