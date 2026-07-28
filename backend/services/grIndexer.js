/**
 * GR Indexer Service
 * Builds searchable indices of all Government Resolutions
 *
 * CHANGES FOR METADATA-AWARE RAG:
 * - Extracts structured metadata (budget_heads, ddo_candidates, scheme_words, financial_year)
 * - Populates indices usable for department-aware retrieval and validation
 * - Keeps backward-compatible indices used elsewhere in the codebase
 */

export class GRIndexer {
  constructor() {
    this.grs = []; // All parsed GRs
    this.indices = {
      byDepartment: new Map(),
      byYear: new Map(),
      byDistrict: new Map(),
      byKeyword: new Map(),
      byAccountHead: new Map(),
      byDate: new Map(),
      byGRNumber: new Map(),
      byGRNumberNormalized: new Map(),
    };
  }

  /**
   * Index a collection of parsed GRs
   */
  indexGRs(parsedGRs) {
    this.grs = parsedGRs;

    parsedGRs.forEach(gr => {
      // Index by department
      if (gr.department) {
        if (!this.indices.byDepartment.has(gr.department)) {
          this.indices.byDepartment.set(gr.department, []);
        }
        this.indices.byDepartment.get(gr.department).push(gr.id);
      }

      // Index by year from metadata date and compute financial year
      if (gr.metadata.date) {
        const parts = String(gr.metadata.date).split('-');
        const year = parts[parts.length - 1];
        if (!this.indices.byYear.has(year)) {
          this.indices.byYear.set(year, []);
        }
        this.indices.byYear.get(year).push(gr.id);

        // Compute simple financial year (e.g., 2023-24) from month name/number when possible
        try {
          const monthPart = parts[1] || '';
          const monthLower = monthPart.toString().toLowerCase();
          const monthMap = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
          let month = parseInt(monthPart, 10);
          if (isNaN(month)) {
            Object.keys(monthMap).forEach(k => { if (monthLower.startsWith(k)) month = monthMap[k]; });
          }
          if (!isNaN(month) && month > 0) {
            const y = parseInt(year, 10);
            const fyStart = month <= 3 ? y - 1 : y;
            gr.metadata.financial_year = `${fyStart}-${String(fyStart + 1).slice(-2)}`;
          }
        } catch (e) {
          // ignore
        }
      }

      // Index by districts
      if (gr.districts && gr.districts.length > 0) {
        gr.districts.forEach(district => {
          if (!this.indices.byDistrict.has(district)) {
            this.indices.byDistrict.set(district, []);
          }
          this.indices.byDistrict.get(district).push(gr.id);
        });
      }

      // Index by GR number
      if (gr.metadata.grNumber) {
        this.indices.byGRNumber.set(gr.metadata.grNumber, gr.id);
        const norm = gr.metadata.grNumber.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (norm) {
          this.indices.byGRNumberNormalized.set(norm, gr.id);
        }
      }
      if (gr.id) {
        const normId = gr.id.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normId) {
          this.indices.byGRNumberNormalized.set(normId, gr.id);
        }
      }

      // Index by keywords from subject
      if (gr.metadata.subject) {
        const keywords = this._extractKeywords(gr.metadata.subject);
        gr.metadata.keywords = keywords;
        keywords.forEach(keyword => {
          if (!this.indices.byKeyword.has(keyword)) {
            this.indices.byKeyword.set(keyword, []);
          }
          this.indices.byKeyword.get(keyword).push(gr.id);
        });
      }

      // Ensure metadata containers for structured fields
      if (!gr.metadata.budget_heads) gr.metadata.budget_heads = [];
      if (!gr.metadata.ddo_candidates) gr.metadata.ddo_candidates = [];
      if (!gr.metadata.scheme_words) gr.metadata.scheme_words = [];

      // Index by account heads and extract budget head metadata
      if (gr.sections.financials) {
        const seenAccountHeads = new Set();
        gr.sections.financials.forEach(fin => {
          // Normalize possible accountHead field
          const accountHead = fin.accountHead || fin.account_head || fin.accountHeadRaw;
          if (accountHead) {
            if (!seenAccountHeads.has(accountHead)) {
              seenAccountHeads.add(accountHead);
              if (!this.indices.byAccountHead.has(accountHead)) {
                this.indices.byAccountHead.set(accountHead, []);
              }
              this.indices.byAccountHead.get(accountHead).push(gr.id);
            }

            // Add to structured metadata for this GR
            if (!gr.metadata.budget_heads.includes(accountHead)) {
              gr.metadata.budget_heads.push(accountHead);
            }
          }

          // Heuristic: attempt to find DDO mentions in context
          if (fin.context && /drawing\s*&?\s*disbursing|ddo|drawing disbursing officer/i.test(fin.context)) {
            const match = fin.context.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/);
            if (match && match[1]) {
              gr.metadata.ddo_candidates.push(match[1].trim());
            }
          }
        });
      }

      // Additional heuristic: scan distribution list for DDO titles or officer names
      if (gr.sections.distribution) {
        gr.sections.distribution.forEach(d => {
          const r = d.recipient || '';
          if (/drawing\s*&?\s*disbursing|ddo|accountant general|pay and accounts officer|director of/i.test(r.toLowerCase())) {
            gr.metadata.ddo_candidates.push(r.trim());
          }
        });
      }

      // Derive simple scheme words from subject for quick matching
      if (gr.metadata.subject) {
        const schemeWords = this._extractKeywords(gr.metadata.subject).slice(0, 6);
        gr.metadata.scheme_words = schemeWords;
        schemeWords.forEach(word => {
          if (!this.indices.byKeyword.has(word)) {
            this.indices.byKeyword.set(word, []);
          }
          this.indices.byKeyword.get(word).push(gr.id);
        });
      }

      // Index by full date
      if (gr.metadata.date) {
        if (!this.indices.byDate.has(gr.metadata.date)) {
          this.indices.byDate.set(gr.metadata.date, []);
        }
        this.indices.byDate.get(gr.metadata.date).push(gr.id);
      }
    });
  }

  /**
   * Extract keywords from text
   */
  _extractKeywords(text) {
    const stopwords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'of', 'to', 'for', 'is', 'are',
      'be', 'was', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'shall', 'should', 'may', 'might', 'can', 'could', 'must', 'from',
      'by', 'with', 'as', 'on', 'at', 'about', 'up', 'down', 'out', 'this', 'that',
      'govt', 'government', 'resolution', 'gr', 'no', 'etc'
    ]);

    const keywords = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopwords.has(w));

    return [...new Set(keywords)];
  }

  /**
   * Get GR by ID
   */
  getGRById(grId) {
    return this.grs.find(gr => gr.id === grId);
  }

  search(query) {
    let results = [...this.grs];

    // Filter by department
    if (query.department) {
      results = results.filter(gr => gr.department === query.department);
    }

    // Filter by title / subject keywords (case-insensitive phrase or keyword overlap matching)
    if (query.keyword) {
      const searchTerms = query.keyword.toLowerCase().split(/\s+/).filter(t => t.length > 1);
      if (searchTerms.length > 0) {
        results = results.filter(gr => {
          const subject = (gr.metadata?.subject || '').toLowerCase();
          return searchTerms.some(term => subject.includes(term));
        });
      }
    }

    if (query.district) {
      results = results.filter(gr => gr.districts && gr.districts.includes(query.district));
    }

    if (query.yearFrom && query.yearTo) {
      const from = parseInt(query.yearFrom);
      const to = parseInt(query.yearTo);
      results = results.filter(gr => {
        if (!gr.metadata.date) return false;
        const parts = gr.metadata.date.split('-');
        const year = parseInt(parts[parts.length - 1]);
        return year >= from && year <= to;
      });
    }

    return results.filter(Boolean).slice(0, 50);
  }

  /**
   * Find similar GRs based on department and keywords
   */
  findSimilar(gr, limit = 5) {
    const similarSet = new Set();

    // 1. Keywords match (specific semantic match)
    if (gr.metadata && gr.metadata.subject) {
      const keywords = this._extractKeywords(gr.metadata.subject);
      for (const kw of keywords) {
        if (similarSet.size >= limit * 2) break;
        const matches = this.indices.byKeyword.get(kw) || [];
        for (const id of matches) {
          if (id !== gr.id) {
            similarSet.add(id);
            if (similarSet.size >= limit * 2) break;
          }
        }
      }
    }

    // 2. Same department fallback (fill the remainder up to limit)
    if (similarSet.size < limit && gr.department) {
      const deptGRs = this.indices.byDepartment.get(gr.department) || [];
      for (const id of deptGRs) {
        if (id !== gr.id && !similarSet.has(id)) {
          similarSet.add(id);
          if (similarSet.size >= limit) break;
        }
      }
    }

    const ids = Array.from(similarSet).slice(0, limit);
    return ids.map(id => this.getGRById(id)).filter(Boolean);
  }

  /**
   * Get statistics
   */
  getStatistics() {
    return {
      totalGRs: this.grs.length,
      totalDepartments: this.indices.byDepartment.size,
      departmentBreakdown: Array.from(this.indices.byDepartment.entries()).map(([dept, ids]) => ({
        department: dept,
        count: ids.length,
      })),
      yearBreakdown: Array.from(this.indices.byYear.entries())
        .map(([year, ids]) => ({ year, count: ids.length }))
        .sort((a, b) => a.year - b.year),
      districtCoverage: this.indices.byDistrict.size,
      totalKeywords: this.indices.byKeyword.size,
      totalAccountHeads: this.indices.byAccountHead.size,
    };
  }

  /**
   * Get analytics data
   */
  getAnalytics() {
    const departments = {};
    const districts = {};
    const budgetByDept = {};
    const yearlyTrend = {};

    this.grs.forEach(gr => {
      // Department stats
      if (!departments[gr.department]) {
        departments[gr.department] = { count: 0, totalBudget: 0 };
      }
      departments[gr.department].count += 1;

      // Budget calculation
      if (gr.sections.financials) {
        gr.sections.financials.forEach(fin => {
          if (fin.amountNumeric) {
            departments[gr.department].totalBudget += fin.amountNumeric;
            if (!budgetByDept[gr.department]) {
              budgetByDept[gr.department] = 0;
            }
            budgetByDept[gr.department] += fin.amountNumeric;
          }
        });
      }

      // District stats
      if (gr.districts) {
        gr.districts.forEach(district => {
          if (!districts[district]) {
            districts[district] = 0;
          }
          districts[district] += 1;
        });
      }

      // Yearly trend
      if (gr.metadata.date) {
        const year = gr.metadata.date.split('-')[2];
        if (!yearlyTrend[year]) {
          yearlyTrend[year] = 0;
        }
        yearlyTrend[year] += 1;
      }
    });

    return {
      departments: Object.entries(departments)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.count - a.count),
      districts: Object.entries(districts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count),
      budgetByDepartment: Object.entries(budgetByDept)
        .map(([dept, budget]) => ({ department: dept, budget }))
        .sort((a, b) => b.budget - a.budget),
      yearlyTrend: Object.entries(yearlyTrend)
        .map(([year, count]) => ({ year, count }))
        .sort((a, b) => parseInt(a.year) - parseInt(b.year)),
    };
  }

  /**
   * Get all departments
   */
  getDepartments() {
    return Array.from(this.indices.byDepartment.keys()).sort();
  }

  /**
   * Get all districts
   */
  getDistricts() {
    return Array.from(this.indices.byDistrict.keys()).sort();
  }

  /**
   * Get GRs related to a topic over time (for timeline visualization)
   */
  getPolicyEvolution(keyword, _years = 6) {
    const evolution = [];
    const keywordMatches = this.indices.byKeyword.get(keyword.toLowerCase()) || [];

    keywordMatches.forEach(grId => {
      const gr = this.getGRById(grId);
      if (gr && gr.metadata.date) {
        const [_day, month, year] = gr.metadata.date.split('-');
        evolution.push({
          grId,
          date: gr.metadata.date,
          year,
          month,
          title: gr.metadata.subject || gr.metadata.grNumber,
          department: gr.department,
        });
      }
    });

    return evolution.sort((a, b) => {
      const dateA = new Date(a.year, parseInt(a.month) - 1, a.day);
      const dateB = new Date(b.year, parseInt(b.month) - 1, b.day);
      return dateA - dateB;
    });
  }
}

export default GRIndexer;
