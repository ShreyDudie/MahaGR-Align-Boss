/**
 * GR Indexer Service
 * Builds searchable indices of all Government Resolutions
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

      // Index by year from metadata date
      if (gr.metadata.date) {
        const year = gr.metadata.date.split('-')[2];
        if (!this.indices.byYear.has(year)) {
          this.indices.byYear.set(year, []);
        }
        this.indices.byYear.get(year).push(gr.id);
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
        keywords.forEach(keyword => {
          if (!this.indices.byKeyword.has(keyword)) {
            this.indices.byKeyword.set(keyword, []);
          }
          this.indices.byKeyword.get(keyword).push(gr.id);
        });
      }

      // Index by account heads
      if (gr.sections.financials) {
        const seenAccountHeads = new Set();
        gr.sections.financials.forEach(fin => {
          if (fin.accountHead && !seenAccountHeads.has(fin.accountHead)) {
            seenAccountHeads.add(fin.accountHead);
            if (!this.indices.byAccountHead.has(fin.accountHead)) {
              this.indices.byAccountHead.set(fin.accountHead, []);
            }
            this.indices.byAccountHead.get(fin.accountHead).push(gr.id);
          }
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
