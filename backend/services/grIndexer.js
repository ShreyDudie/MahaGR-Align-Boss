/**
 * GR Indexer Service
 * Builds searchable indices of all Government Resolutions
 *
 * CHANGES FOR METADATA-AWARE RAG:
 * - Extracts structured metadata (budget_heads, ddo_candidates, scheme_words, financial_year)
 * - Populates indices usable for department-aware retrieval and validation
 * - Keeps backward-compatible indices used elsewhere in the codebase
 */

import fs from "fs";

export class GRIndexer {
  constructor() {
    this.grs = [];

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

    // Clause-level semantic search
    this.clauseIndex = [];
    this.clauseIndexReady = false;

    // Embedding configuration - FIXED MODEL NAME
    this.embeddingModel =
      process.env.GEMINI_EMBEDDING_MODEL ||
      process.env.EMBEDDING_MODEL ||
      "embedding-001"; // Changed from text-embedding-004 to embedding-001

    this.embeddingKey =
      process.env.GEMINI_API_KEY ||
      process.env.EMBEDDING_API_KEY ||
      null;
  }

  indexGRs(parsedGRs = []) {
    this.grs = Array.isArray(parsedGRs) ? parsedGRs : [];

    this.grs.forEach((gr) => {
      if (!gr) return;

      // Ensure objects exist
      gr.metadata = gr.metadata || {};
      gr.sections = gr.sections || {};

      gr.metadata.keywords ??= [];
      gr.metadata.budget_heads ??= [];
      gr.metadata.ddo_candidates ??= [];
      gr.metadata.scheme_words ??= [];

      // Index by department
      const department = gr.department || "General";
      if (!this.indices.byDepartment.has(department)) {
        this.indices.byDepartment.set(department, []);
      }
      this.indices.byDepartment.get(department).push(gr.id);

      // Index by year from metadata date and compute financial year
      if (gr.metadata?.date) {
        const parts = String(gr.metadata.date || "").split("-");
        const year = Number(parts.at(-1));
        if (year && !this.indices.byYear.has(year)) {
          this.indices.byYear.set(year, []);
        }
        if (year) {
          this.indices.byYear.get(year).push(gr.id);
        }

        // Compute simple financial year (e.g., 2023-24) from month name/number when possible
        try {
          const monthPart = parts[1] || '';
          const monthLower = monthPart.toString().toLowerCase();
          const monthMap = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12 };
          let month = parseInt(monthPart, 10);
          if (isNaN(month)) {
            Object.keys(monthMap).forEach(k => { 
              if (monthLower.startsWith(k)) month = monthMap[k]; 
            });
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
      if (Array.isArray(gr.districts) && gr.districts.length) {
        gr.districts.forEach((district) => {
          if (!this.indices.byDistrict.has(district)) {
            this.indices.byDistrict.set(district, []);
          }
          this.indices.byDistrict.get(district).push(gr.id);
        });
      }

      // Index by GR Number
      if (gr.metadata?.grNumber) {
        const grNumber = String(gr.metadata.grNumber).trim();
        this.indices.byGRNumber.set(grNumber, gr.id);

        const normalized = grNumber
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        if (normalized) {
          this.indices.byGRNumberNormalized.set(normalized, gr.id);
        }
      }

      if (gr.id) {
        const normalizedId = String(gr.id)
          .toLowerCase()
          .replace(/[^a-z0-9]/g, "");

        if (normalizedId) {
          this.indices.byGRNumberNormalized.set(normalizedId, gr.id);
        }
      }

      // Subject Keyword Index
      if (gr.metadata?.subject) {
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
      gr.metadata.budget_heads ??= [];
      gr.metadata.ddo_candidates ??= [];
      gr.metadata.scheme_words ??= [];

      // Financial Metadata
      if (Array.isArray(gr.sections?.financials)) {
        const seenHeads = new Set();

        gr.sections.financials.forEach(fin => {
          if (!fin) return;

          const accountHead =
            fin.accountHead ||
            fin.account_head ||
            fin.accountHeadRaw ||
            "";

          if (accountHead) {
            if (!seenHeads.has(accountHead)) {
              seenHeads.add(accountHead);

              if (!this.indices.byAccountHead.has(accountHead)) {
                this.indices.byAccountHead.set(accountHead, []);
              }
              this.indices.byAccountHead.get(accountHead).push(gr.id);
            }

            if (!gr.metadata.budget_heads.includes(accountHead)) {
              gr.metadata.budget_heads.push(accountHead);
            }
          }

          // DDO Detection
          if (
            fin.context &&
            /drawing\s*&?\s*disbursing|ddo|drawing disbursing officer/i.test(fin.context)
          ) {
            const match = fin.context.match(
              /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,3})/
            );

            if (
              match &&
              match[1] &&
              !gr.metadata.ddo_candidates.includes(match[1].trim())
            ) {
              gr.metadata.ddo_candidates.push(match[1].trim());
            }
          }
        });
      }

      // Distribution Metadata
      if (Array.isArray(gr.sections?.distribution)) {
        gr.sections.distribution.forEach(item => {
          const recipient = item?.recipient || "";

          if (
            /drawing\s*&?\s*disbursing|ddo|accountant general|pay and accounts officer|director of/i.test(
              recipient.toLowerCase()
            )
          ) {
            if (!gr.metadata.ddo_candidates.includes(recipient.trim())) {
              gr.metadata.ddo_candidates.push(recipient.trim());
            }
          }
        });
      }

      // Scheme Words
      if (gr.metadata?.subject) {
        const schemeWords = this
          ._extractKeywords(gr.metadata.subject)
          .slice(0, 6);

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
    if (!text) return [];

    const stopwords = new Set([
      "the","a","an","and","or","but","in","of","to","for",
      "is","are","be","was","were","been","being",
      "have","has","had","do","does","did",
      "will","shall","should","may","might","can","could","must",
      "from","by","with","as","on","at","about","up","down","out",
      "this","that","govt","government","resolution","gr","etc","no"
    ]);

    return [...new Set(
      String(text)
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter(word =>
          word &&
          word.length > 3 &&
          !stopwords.has(word)
        )
    )];
  }

  search(query = {}) {
    let results = [...this.grs];

    if (query.department) {
      results = results.filter(gr =>
        (gr.department || "")
          .toLowerCase()
          ===
        query.department.toLowerCase()
      );
    }

    if (query.keyword) {
      const searchTerms = query.keyword
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

      results = results.filter(gr => {
        const subject =
          (gr.metadata?.subject || "").toLowerCase();

        return searchTerms.some(term =>
          subject.includes(term)
        );
      });
    }

    if (query.district) {
      results = results.filter(gr =>
        Array.isArray(gr.districts) &&
        gr.districts.includes(query.district)
      );
    }

    if (query.yearFrom && query.yearTo) {
      const from = Number(query.yearFrom);
      const to = Number(query.yearTo);

      results = results.filter(gr => {
        const date = gr.metadata?.date;
        if (!date) return false;
        const year = Number(date.split("-").pop());
        return year >= from && year <= to;
      });
    }

    return results.slice(0, 50);
  }

  /**
   * Build clause-level semantic index for the entire GR corpus.
   * This is used by the verifier to detect cross-department clause conflicts.
   */
  async buildClauseEmbeddingIndex() {
    if (this.clauseIndexReady) return;

    this.clauseIndex = [];

    for (const gr of this.grs) {
      const clauses = this._extractClausesFromGR(gr);

      for (let i = 0; i < clauses.length; i++) {
        const clause = clauses[i];
        const embedding = await this._embedText(clause);
        if (!embedding) continue;

        this.clauseIndex.push({
          grId: gr.id,
          grNumber: gr.metadata?.grNumber || gr.id,
          department: gr.department || "General",
          subject: gr.metadata?.subject || "",
          clauseText: clause,
          clauseIndex: i + 1,
          embedding,
          sourceLink: `/api/gr/${encodeURIComponent(
            gr.metadata?.grNumber || gr.id
          )}`
        });
      }
    }

    this.clauseIndexReady = true;
  }

  _extractClausesFromGR(gr) {
    const clauses = [];

    if (Array.isArray(gr.sections?.resolution_clauses_english)) {
      gr.sections.resolution_clauses_english.forEach(c => {
        if (String(c).trim().length > 20)
          clauses.push(String(c).trim());
      });
    }

    if (clauses.length === 0 && Array.isArray(gr.sections?.resolutions)) {
      gr.sections.resolutions.forEach(item => {
        if (item?.text?.trim().length > 20)
          clauses.push(item.text.trim());
      });
    }

    if (clauses.length === 0 && gr.sections?.resolution) {
      clauses.push(
        ...this._splitTextIntoClauses(
          gr.sections.resolution
        )
      );
    }

    return clauses;
  }

  _splitTextIntoClauses(text) {
    if (!text) return [];

    const clauses = [];
    const lines = text
      .replace(/\r\n/g, "\n")
      .split("\n");

    let current = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (
        /^\d+\./.test(trimmed) ||
        /^\([a-z0-9]+\)/i.test(trimmed)
      ) {
        if (current.trim()) {
          clauses.push(current.trim());
        }
        current = trimmed;
      } else {
        current += " " + trimmed;
      }
    }

    if (current.trim()) {
      clauses.push(current.trim());
    }

    return clauses.filter(c => c.length > 20);
  }

  /**
   * Generate embedding for text - FIXED API ENDPOINT
   */
async _embedText(text) {
    const normalized = String(text || "").trim();

    if (!normalized) return null;

    // Always use local embeddings
    return this._localTextVector(normalized);
}
  /**
   * Local fallback embedding
   */
  _localTextVector(text) {
    const DIMENSION = 256;
    const vector = new Array(DIMENSION).fill(0);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);

    words.slice(0, 150).forEach(word => {
      let hash = 0;
      for (const ch of word) {
        hash = (hash * 31 + ch.charCodeAt(0)) % DIMENSION;
      }
      vector[hash]++;
    });

    const norm = Math.sqrt(
      vector.reduce((s, v) => s + v * v, 0)
    );

    if (norm > 0) {
      for (let i = 0; i < DIMENSION; i++) {
        vector[i] /= norm;
      }
    }

    return vector;
  }

  /**
   * Cosine similarity
   */
  _cosineSimilarity(vecA, vecB) {
    if (!Array.isArray(vecA) || !Array.isArray(vecB)) {
      return 0;
    }

    if (vecA.length !== vecB.length) {
      return 0;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dot += vecA[i] * vecB[i];
      magA += vecA[i] * vecA[i];
      magB += vecB[i] * vecB[i];
    }

    if (magA === 0 || magB === 0) {
      return 0;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
  }

  /**
   * Semantic clause search
   */
  async searchClauseConflicts(
    clauseText,
    topN = 10,
    threshold = 0.80
  ) {
    if (!this.clauseIndexReady) {
      await this.buildClauseEmbeddingIndex();
    }

    const queryEmbedding = await this._embedText(clauseText);
    if (!queryEmbedding) {
      return [];
    }

    const matches = [];

    for (const clause of this.clauseIndex) {
      const score = this._cosineSimilarity(
        queryEmbedding,
        clause.embedding
      );

      if (score >= threshold) {
        matches.push({
          ...clause,
          score
        });
      }
    }

    matches.sort(
      (a, b) => b.score - a.score
    );

    return matches.slice(0, topN);
  }

  /**
   * Find similar GRs
   */
  findSimilar(gr, limit = 5) {
    if (!gr) return [];

    const candidates = new Set();

    // Keyword similarity
    if (gr.metadata?.subject) {
      const keywords = this._extractKeywords(gr.metadata.subject);

      for (const keyword of keywords) {
        const hits = this.indices.byKeyword.get(keyword) || [];
        hits.forEach(id => {
          if (id !== gr.id) {
            candidates.add(id);
          }
        });
      }
    }

    // Same department
    if (candidates.size < limit && gr.department) {
      const deptHits = this.indices.byDepartment.get(gr.department) || [];
      deptHits.forEach(id => {
        if (id !== gr.id && candidates.size < limit * 2) {
          candidates.add(id);
        }
      });
    }

    return [...candidates]
      .slice(0, limit)
      .map(id => this.getGRById(id))
      .filter(Boolean);
  }

  /**
   * Get GR by ID
   */
  getGRById(id) {
    return this.grs.find(gr => gr.id === id) || null;
  }

  getStatistics() {
    return {
      totalGRs: this.grs.length,
      totalDepartments: this.indices.byDepartment.size,
      totalYears: this.indices.byYear.size,
      totalDistricts: this.indices.byDistrict.size,
      totalKeywords: this.indices.byKeyword.size,
      totalAccountHeads: this.indices.byAccountHead.size,
      totalClauses: this.clauseIndex.length,
      departmentBreakdown: [...this.indices.byDepartment.entries()]
        .map(([department, ids]) => ({
          department,
          count: ids.length
        }))
        .sort((a, b) => b.count - a.count),
      yearBreakdown: [...this.indices.byYear.entries()]
        .map(([year, ids]) => ({
          year,
          count: ids.length
        }))
        .sort((a, b) => Number(a.year) - Number(b.year))
    };
  }

  /**
   * Analytics Dashboard
   */
  getAnalytics() {
    const departments = {};
    const districts = {};
    const yearlyTrend = {};
    const budgetByDepartment = {};

    this.grs.forEach(gr => {
      const dept = gr.department || "General";

      if (!departments[dept]) {
        departments[dept] = {
          count: 0,
          totalBudget: 0
        };
      }
      departments[dept].count++;

      if (Array.isArray(gr.sections?.financials)) {
        gr.sections.financials.forEach(fin => {
          const amount = Number(fin.amountNumeric || 0);
          if (amount > 0) {
            departments[dept].totalBudget += amount;
            budgetByDepartment[dept] =
              (budgetByDepartment[dept] || 0) + amount;
          }
        });
      }

      if (Array.isArray(gr.districts)) {
        gr.districts.forEach(district => {
          districts[district] =
            (districts[district] || 0) + 1;
        });
      }

      if (gr.metadata?.date) {
        const year = gr.metadata.date.split("-").pop();
        yearlyTrend[year] =
          (yearlyTrend[year] || 0) + 1;
      }
    });

    return {
      departments: Object.entries(departments)
        .map(([name, value]) => ({
          name,
          ...value
        }))
        .sort((a, b) => b.count - a.count),
      districts: Object.entries(districts)
        .map(([name, count]) => ({
          name,
          count
        }))
        .sort((a, b) => b.count - a.count),
      budgetByDepartment: Object.entries(budgetByDepartment)
        .map(([department, budget]) => ({
          department,
          budget
        }))
        .sort((a, b) => b.budget - a.budget),
      yearlyTrend: Object.entries(yearlyTrend)
        .map(([year, count]) => ({
          year,
          count
        }))
        .sort((a, b) => Number(a.year) - Number(b.year))
    };
  }

  /**
   * Get all departments
   */
  getDepartments() {
    return [...this.indices.byDepartment.keys()]
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get all districts
   */
  getDistricts() {
    return [...this.indices.byDistrict.keys()]
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Get GRs related to a topic over time (Timeline Visualization)
   */
  getPolicyEvolution(keyword, _years = 6) {
    if (!keyword) return [];

    const evolution = [];

    const keywordMatches =
      this.indices.byKeyword.get(keyword.toLowerCase()) || [];

    keywordMatches.forEach(grId => {
      const gr = this.getGRById(grId);

      if (!gr?.metadata?.date) return;

      const parts = String(gr.metadata.date).split("-");

      const day = parts[0] || "01";
      const month = parts[1] || "01";
      const year = parts[2] || "2000";

      evolution.push({
        grId,
        date: gr.metadata.date,
        day,
        month,
        year,
        title: gr.metadata.subject || gr.metadata.grNumber || gr.id,
        department: gr.department || "General",
      });
    });

    evolution.sort((a, b) => {
      const dateA = new Date(
        Number(a.year),
        Number(a.month) - 1,
        Number(a.day)
      );
      const dateB = new Date(
        Number(b.year),
        Number(b.month) - 1,
        Number(b.day)
      );
      return dateA - dateB;
    });

    return evolution;
  }
}

export default GRIndexer;