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
      sections: {},
      metadata: {},
    };

    // Remove extra whitespace and normalize line breaks
    const cleanContent = fileContent
      .replace(/\r\n/g, '\n')
      .replace(/[\u2000-\u200D\uFEFF]/g, '')
      .trim();

    // Extract key sections and metadata
    this._extractMetadata(gr, cleanContent);
    this._extractReferences(gr, cleanContent);
    this._extractFinancials(gr, cleanContent);
    this._extractResolutions(gr, cleanContent);
    this._extractDistribution(gr, cleanContent);

    return gr;
  }

  /**
   * Extract metadata: GR number, date, title, subject
   */
  _extractMetadata(gr, content) {
    // GR Number pattern: "GR No. XX/ABC-YY" or "Notification No. XXX"
    const grNumberPattern = /(?:GR\s+No\.|Notification\s+No\.|Reference\s+No\.)[\s:]*([^\n]+)/i;
    const grMatch = content.match(grNumberPattern);
    if (grMatch) {
      let num = grMatch[1].trim();
      const stopWords = ['has', 'is', 'was', 'dated', 'been', 'regarding'];
      for (const sw of stopWords) {
        const idx = num.toLowerCase().indexOf(' ' + sw + ' ');
        if (idx !== -1) {
          num = num.substring(0, idx);
        }
      }
      if (num.length > 50) {
        num = num.substring(0, 50).trim() + '...';
      }
      gr.metadata.grNumber = num.trim();
    }

    // Date pattern: "DD Month YYYY" or "DD/MM/YYYY" or "YYYY-MM-DD"
    const datePattern = /(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i;
    const dateMatch = content.match(datePattern);
    if (dateMatch) {
      gr.metadata.date = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    }

    // Alternative date pattern: DD/MM/YYYY
    if (!gr.metadata.date) {
      const altDatePattern = /(\d{1,2})\/(\d{1,2})\/(\d{4})/;
      const altDateMatch = content.match(altDatePattern);
      if (altDateMatch) {
        gr.metadata.date = `${altDateMatch[1]}-${altDateMatch[2]}-${altDateMatch[3]}`;
      }
    }

    // Extract title/subject from first meaningful line
    const lines = content.split('\n').filter(l => l.trim().length > 20);
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      if (
        !line.includes('Government of Maharashtra') &&
        !line.match(/^[A-Z\s]+$/) &&
        line.length > 30 &&
        line.length < 200
      ) {
        gr.metadata.subject = line;
        break;
      }
    }

    // Extract department from department folder or content
    if (!gr.metadata.departmentName) {
      gr.metadata.departmentName = gr.department;
    }
  }

  /**
   * Extract references to other GRs
   */
  _extractReferences(gr, content) {
    gr.sections.references = [];

    // Pattern: "GR No. XX/ABC-YY dated DD/MM/YYYY" or similar
    const refPattern = /GR\s+No\.\s+([^\n,;.]+)(?:\s+(?:dated|of|from)\s+)?([^\n,;.]*)/gi;
    let match;
    while ((match = refPattern.exec(content)) !== null) {
      gr.sections.references.push({
        grNumber: match[1].trim(),
        date: match[2]?.trim() || null,
        sourceText: match[0],
      });
    }

    // Also extract "Resolution" references
    const resRefPattern = /(?:Earlier\s+)?(?:Resolution|Resolution\s+No\.)\s+([^\n,;.]+)/gi;
    while ((match = resRefPattern.exec(content)) !== null) {
      gr.sections.references.push({
        type: 'resolution',
        identifier: match[1].trim(),
        sourceText: match[0],
      });
    }

    gr.sections.references = [...new Map(gr.sections.references.map(r => [JSON.stringify(r), r])).values()];
  }

  /**
   * Extract financial data: amounts, budgets, allocations
   */
  _extractFinancials(gr, content) {
    gr.sections.financials = [];

    // Pattern: Currency amounts in Indian format (₹ or Rs.)
    const amountPattern = /(?:Rs\.|₹|Rupees?)\s*([0-9,]+(?:\.\d{2})?)/gi;
    let match;
    const seen = new Set();

    while ((match = amountPattern.exec(content)) !== null) {
      const amount = match[1];
      if (!seen.has(amount)) {
        seen.add(amount);
        // Extract context around the amount
        const startIdx = Math.max(0, match.index - 100);
        const endIdx = Math.min(content.length, match.index + 100);
        const context = content.substring(startIdx, endIdx);

        gr.sections.financials.push({
          amount: amount,
          amountNumeric: parseFloat(amount.replace(/,/g, '')),
          context: context.trim(),
          sourcePosition: match.index,
        });
      }
    }

    // Extract account heads (typically formatted as "Major Head", "Sub Head", etc.)
    const accountHeadPattern = /(?:Major\s+Head|Sub\s+Head|Minor\s+Head|Detailed\s+Head)[\s:]*([0-9]{4}|[0-9]{4}-[0-9]{2}|-[0-9]{4})[^\n]*/gi;
    while ((match = accountHeadPattern.exec(content)) !== null) {
      gr.sections.financials.push({
        type: 'accountHead',
        accountHead: match[1].trim(),
        description: match[0],
      });
    }

    // Extract budget allocation tables
    const budgetTableLines = content
      .split('\n')
      .filter(line => /^\d+\s+/.test(line) && line.includes('₹') || line.includes('Rs.'));

    budgetTableLines.forEach(line => {
      const parts = line.split(/\s{2,}|₹|Rs\./);
      if (parts.length >= 3) {
        gr.sections.financials.push({
          type: 'budgetLine',
          description: parts[0]?.trim(),
          amount: parts[parts.length - 1]?.trim(),
          sourceText: line,
        });
      }
    });
  }

  /**
   * Extract resolution clauses and mandates
   */
  _extractResolutions(gr, content) {
    gr.sections.resolutions = [];

    // Split by resolution markers
    const lines = content.split('\n');
    let currentResolution = '';
    let inResolution = false;

    lines.forEach((line) => {
      // Check for resolution start markers
      if (/^(?:Resolution:|Resolved:|The\s+Government)/.test(line.trim())) {
        if (currentResolution) {
          gr.sections.resolutions.push({
            text: currentResolution.trim(),
            index: gr.sections.resolutions.length + 1,
          });
        }
        currentResolution = line;
        inResolution = true;
      } else if (inResolution && line.trim()) {
        currentResolution += '\n' + line;
      } else if (inResolution && !line.trim() && currentResolution) {
        gr.sections.resolutions.push({
          text: currentResolution.trim(),
          index: gr.sections.resolutions.length + 1,
        });
        currentResolution = '';
        inResolution = false;
      }
    });

    if (currentResolution) {
      gr.sections.resolutions.push({
        text: currentResolution.trim(),
        index: gr.sections.resolutions.length + 1,
      });
    }

    // Extract committees/roles if present
    gr.sections.committees = [];
    const committeePattern = /(?:Committee|Board|Council|Authority)[\s:]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\n(?:Committee|Board|Resolution))/gi;
    let match;
    while ((match = committeePattern.exec(content)) !== null) {
      gr.sections.committees.push({
        name: match[1].split('\n')[0].trim(),
        details: match[1],
      });
    }
  }

  /**
   * Extract distribution list
   */
  _extractDistribution(gr, content) {
    gr.sections.distribution = [];

    // Look for distribution section
    const distPattern = /(?:Distribution|Copy\s+to|Sent\s+to)[\s:]*([^\n]+(?:\n[^\n]+)*?)(?=\n\n|\nSignature|---)/i;
    const distMatch = content.match(distPattern);

    if (distMatch) {
      const distContent = distMatch[1];
      const recipients = distContent
        .split('\n')
        .filter(line => line.trim().length > 0 && !line.match(/^\d+\.\s*$/))
        .slice(0, 10); // Limit to first 10 recipients

      recipients.forEach((recipient, idx) => {
        gr.sections.distribution.push({
          order: idx + 1,
          recipient: recipient.replace(/^\d+\.\s*/, '').trim(),
        });
      });
    }
  }

  /**
   * Extract district mentions
   */
  extractDistricts(content) {
    const maharashtraDistricts = [
      'Ahmednagar', 'Akola', 'Amravati', 'Aurangabad', 'Beed', 'Bhandara', 'Buldhana',
      'Chandrapur', 'Dhule', 'Diu', 'Gadchiroli', 'Gondia', 'Hingoli', 'Jalgaon',
      'Jalna', 'Jhalawar', 'Kolhapur', 'Latur', 'Madhya Pradesh', 'Mahbubnagar',
      'Mahabubnagar', 'Nanded', 'Nandurbar', 'Nashik', 'Nagpur', 'Nashik', 'Navi Mumbai',
      'New Mumbai', 'Osmansagar', 'Palghar', 'Parbhani', 'Pune', 'Raigad', 'Ratnagiri',
      'Sangli', 'Satara', 'Satpur', 'Sindhudurg', 'Solapur', 'Thane', 'Valsad',
      'Vasai', 'Vododara', 'Wardha', 'Washim', 'Yavatmal', 'Maharashtra',
    ];

    const districts = [];
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
    const files = fs.readdirSync(directoryPath);

    files.forEach(filename => {
      if (filename.endsWith('.en.txt')) {
        // Only process English versions to avoid duplicates
        const filePath = path.join(directoryPath, filename);
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const gr = this.parseGRFile(content, department, filename);
          gr.districts = this.extractDistricts(content);
          grs.push(gr);
        } catch (error) {
          console.error(`Error parsing ${filename}:`, error.message);
        }
      }
    });

    return grs;
  }
}

export default GRParser;
