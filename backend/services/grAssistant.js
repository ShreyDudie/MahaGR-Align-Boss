/**
 * GR Assistant Service
 * Conversational AI Search & Policy Synthesis Engine across 98,000+ Maharashtra GRs
 *
 * ENHANCED: Full Gemini API integration for general questions + GR database search
 * - Answers GR-specific queries from the 98k database
 * - Answers general government questions using Gemini API
 * - Answers website, policy, and scheme questions
 * - Intelligent fallback between GR database and Gemini
 */

class GRAssistant {
  constructor(indexer, geminiKey = null, geminiModel = 'gemini-1.5-flash') {
    // Allow geminiKey to be passed from environment or as parameter
    const effectiveKey = geminiKey || process.env.GEMINI_API_KEY || null;
    
    this.indexer = indexer;
    this.geminiKey = effectiveKey;
    this.geminiModel = geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    
    // Cache for recent queries
    this.responseCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    
    // Track if Gemini is available
    this.geminiAvailable = !!effectiveKey;
    
    // Department name mapping
    this.departmentDisplayNames = {
      'Agriculture,_Dairy_Development,_Animal_Husbandry_and_Fisheries_Department': 'Agriculture Department',
      'Co-operation,_Textiles_and_Marketing_Department': 'Co-operation Department',
      'Finance_Department': 'Finance Department',
      'Public_Health_Department': 'Public Health Department',
      'Medical_Education_and_Drugs_Department': 'Medical Education Department',
      'School_Education_and_Sports_Department': 'School Education Department',
      'Higher_and_Technical_Education_Department': 'Higher Education Department',
      'Social_Justice_and_Special_Assistance_Department': 'Social Justice Department',
      'Tribal_Development_Department': 'Tribal Development Department',
      'Industries,_Energy_and_Labour_Department': 'Industries Department',
      'Soil_and_Water_Conservation_Department': 'Water Conservation Department',
      'Minorities_Development_Department': 'Minorities Department',
      'Other_Backward_Bahujan_Welfare_Department': 'OBC Welfare Department'
    };

    // ===== General Knowledge Base =====
    this.generalKnowledge = {
      websites: {
        'maharashtra.gov.in': {
          description: 'Official Government of Maharashtra portal',
          url: 'https://www.maharashtra.gov.in',
          services: ['Notifications', 'Documents', 'Schemes', 'Departments', 'Citizen Services']
        },
        'mahaonline.gov.in': {
          description: 'Maharashtra e-Governance portal for citizen services',
          url: 'https://www.mahaonline.gov.in',
          services: ['Land Records', 'Property Registration', 'Certificates', 'Licenses']
        },
        'msrtc.maharashtra.gov.in': {
          description: 'Maharashtra State Road Transport Corporation',
          url: 'https://msrtc.maharashtra.gov.in',
          services: ['Bus Schedule', 'Online Booking', 'Timetable']
        }
      },
      governmentStructure: {
        head: 'Governor of Maharashtra',
        executive: 'Chief Minister and Council of Ministers',
        legislative: 'Maharashtra Legislative Assembly & Legislative Council',
        judiciary: 'Bombay High Court',
        administrative: 'Mantralaya (Secretariat), District Collectors, Local Bodies'
      },
      facts: {
        capital: 'Mumbai (Summer: Nagpur)',
        area: '307,713 sq km (3rd largest state)',
        population: '~124 million (2nd most populous)',
        officialLanguage: 'Marathi',
        established: 'May 1, 1960',
        districts: '36 districts',
        literacy: '82.34%'
      },
      departments: {
        'Agriculture': 'Handles agricultural policies, farmer welfare, dairy, animal husbandry, and fisheries.',
        'Finance': 'Manages state budget, expenditure, financial rules, taxation, and banking.',
        'Health': 'Oversees public health services, hospitals, medical education, and disease control.',
        'Education': 'Manages school education, curriculum development, higher education, and sports.',
        'Social Justice': 'Implements welfare schemes for SC/ST, OBC, and other disadvantaged communities.',
        'Tribal Development': 'Focuses on development and welfare of tribal communities.',
        'Industries': 'Promotes industrial development, energy, and labour welfare.',
        'Co-operation': 'Manages co-operative societies, marketing, and textile sectors.',
        'Public Works': 'Handles infrastructure, roads, bridges, and public buildings.',
        'Water Resources': 'Manages irrigation, water supply, and water conservation projects.',
        'Energy': 'Oversees electricity generation, distribution, and renewable energy.',
        'Urban Development': 'Handles urban planning, housing, and municipal governance.',
        'Rural Development': 'Implements rural infrastructure, employment, and development schemes.',
        'Women & Child': 'Focuses on women empowerment, child welfare, and nutrition programs.',
        'Food & Civil Supplies': 'Manages food distribution, PDS, and essential commodities.'
      },
      scholarships: {
        'post_matric': {
          name: 'Post Matric Scholarship for SC/ST/OBC',
          description: 'Financial assistance for students belonging to SC/ST/OBC categories pursuing post-matric education.',
          eligibility: 'SC/ST/OBC students with family income below ₹2.5 lakh per annum',
          benefits: 'Tuition fees, maintenance allowance, and other educational expenses',
          how_to_apply: 'Apply online through the MahaDBT portal (www.mahadbt.maharashtra.gov.in)'
        },
        'pre_matric': {
          name: 'Pre Matric Scholarship for SC/ST',
          description: 'Scholarship for SC/ST students studying in Class 9 and 10.',
          eligibility: 'SC/ST students with family income below ₹1 lakh per annum',
          benefits: 'Up to ₹10,000 per annum for day scholars, ₹15,000 for hostellers',
          how_to_apply: 'Apply through the respective school or MahaDBT portal'
        },
        'fellowship': {
          name: 'National Fellowship for Higher Education',
          description: 'Fellowship for pursuing M.Phil and PhD for SC/ST candidates.',
          eligibility: 'SC/ST candidates with post-graduate degree, cleared NET/JRF',
          benefits: 'Monthly stipend of ₹25,000-₹28,000 plus contingency grant',
          how_to_apply: 'Apply through UGC portal (www.ugc.ac.in)'
        }
      }
    };
  }

  /**
   * Get cached response or null if expired
   */
  _getCachedResponse(query) {
    const key = query.toLowerCase().trim();
    const cached = this.responseCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
      return cached.response;
    }
    if (cached) {
      this.responseCache.delete(key);
    }
    return null;
  }

  /**
   * Cache a response
   */
  _cacheResponse(query, response) {
    const key = query.toLowerCase().trim();
    this.responseCache.set(key, {
      response: { ...response },
      timestamp: Date.now()
    });
  }

  /**
   * Detect intent type from user query
   */
  _detectIntent(userQuery) {
    const queryLower = userQuery.toLowerCase();
    
    // Check for scholarship queries
    if (queryLower.includes('scholarship') || queryLower.includes('fellowship') || 
        queryLower.includes('educational') || queryLower.includes('student') ||
        (queryLower.includes('sc') && queryLower.includes('st') && queryLower.includes('scholarship'))) {
      return 'scholarship';
    }

    // Check for GR-specific queries
    const grKeywords = ['gr', 'resolution', 'sanction', 'order', 'notification', 'circular'];
    const isGRQuery = grKeywords.some(k => queryLower.includes(k)) || 
                       queryLower.includes('government resolution');

    // Check for website-related queries
    const websiteKeywords = ['website', 'portal', 'site', 'online', 'download', 'upload', 
                             'login', 'register', 'maharashtra.gov.in', 'mahaonline', 'msrtc'];
    const isWebsiteQuery = websiteKeywords.some(k => queryLower.includes(k));
    
    // Check for general government queries
    const isGovernmentQuery = (queryLower.includes('government') || queryLower.includes('department') || 
                               queryLower.includes('minister') || queryLower.includes('capital') ||
                               queryLower.includes('population') || queryLower.includes('language') ||
                               queryLower.includes('structure') || queryLower.includes('district'));

    // Check for policy/scheme queries
    const isPolicyQuery = queryLower.includes('policy') || queryLower.includes('scheme') || 
                          queryLower.includes('fund') || queryLower.includes('subsidy') ||
                          queryLower.includes('loan') || queryLower.includes('benefit') ||
                          queryLower.includes('welfare') || queryLower.includes('grant');

    // Determine primary intent
    if (isGRQuery) return 'gr';
    if (isWebsiteQuery) return 'website';
    if (isGovernmentQuery) return 'government';
    if (isPolicyQuery) return 'policy';
    
    return 'general';
  }

  /**
   * Generate response for scholarship queries
   */
  _generateScholarshipResponse(userQuery) {
    const queryLower = userQuery.toLowerCase();
    const responses = [];

    if (queryLower.includes('sc') || queryLower.includes('st')) {
      const postMatric = this.generalKnowledge.scholarships.post_matric;
      responses.push(`**${postMatric.name}**\n• ${postMatric.description}\n• **Eligibility:** ${postMatric.eligibility}\n• **Benefits:** ${postMatric.benefits}\n• **How to Apply:** ${postMatric.how_to_apply}`);
      
      const preMatric = this.generalKnowledge.scholarships.pre_matric;
      responses.push(`\n**${preMatric.name}**\n• ${preMatric.description}\n• **Eligibility:** ${preMatric.eligibility}\n• **Benefits:** ${preMatric.benefits}`);
    }

    if (queryLower.includes('fellowship') || queryLower.includes('phd') || queryLower.includes('mphil')) {
      const fellowship = this.generalKnowledge.scholarships.fellowship;
      responses.push(`**${fellowship.name}**\n• ${fellowship.description}\n• **Eligibility:** ${fellowship.eligibility}\n• **Benefits:** ${fellowship.benefits}\n• **How to Apply:** ${fellowship.how_to_apply}`);
    }

    if (responses.length === 0) {
      responses.push(`**Scholarship Schemes in Maharashtra**

📚 **Government Scholarships:**
• Post Matric Scholarship for SC/ST/OBC
• Pre Matric Scholarship for SC/ST
• National Fellowship for Higher Education
• Merit-cum-Means Scholarship

💻 **How to Apply:**
1. Visit the MahaDBT portal: www.mahadbt.maharashtra.gov.in
2. Register with your mobile number and Aadhaar
3. Fill the application form
4. Upload required documents

📋 **Documents Required:**
• Aadhaar Card
• Caste Certificate
• Income Certificate
• Previous Academic Marksheet
• Bank Account Details

**For more details, visit:** www.mahadbt.maharashtra.gov.in`);
    }

    return responses.join('\n\n');
  }

  /**
   * Generate response for website-related queries
   */
  _generateWebsiteResponse(userQuery) {
    const queryLower = userQuery.toLowerCase();
    const responses = [];

    if (queryLower.includes('maharashtra.gov.in') || queryLower.includes('official website')) {
      const site = this.generalKnowledge.websites['maharashtra.gov.in'];
      responses.push(`The official Government of Maharashtra website is **${site.url}**. ${site.description}. Services include: ${site.services.join(', ')}.`);
    }

    if (queryLower.includes('download') || queryLower.includes('document') || queryLower.includes('form')) {
      responses.push('You can download official forms, documents, and GRs from the "Documents" or "Notifications" section of the respective department websites or from the central portal www.maharashtra.gov.in.');
    }

    if (queryLower.includes('mahaonline') || queryLower.includes('online portal')) {
      const site = this.generalKnowledge.websites['mahaonline.gov.in'];
      responses.push(`**MahaOnline** (${site.url}) is the official e-governance portal for Maharashtra. Services include: ${site.services.join(', ')}.`);
    }

    if (queryLower.includes('login') || queryLower.includes('register')) {
      responses.push('Most government portals offer secure login for citizens. For GR access, you can register on the Maharashtra Government portal using your mobile number and email for authenticated access.');
    }

    if (queryLower.includes('mahadbt') || queryLower.includes('scholarship portal')) {
      responses.push('**MahaDBT** (www.mahadbt.maharashtra.gov.in) is the Direct Benefit Transfer portal for Maharashtra. It is used for scholarship applications, student welfare schemes, and various benefit transfers.');
    }

    if (responses.length === 0) {
      responses.push('The Government of Maharashtra provides multiple online portals for citizen services. The main portal is **www.maharashtra.gov.in**. For specific services, visit the respective department websites linked from the main portal.');
    }

    return responses.join('\n');
  }

  /**
   * Generate response for general government queries
   */
  _generateGeneralGovernmentResponse(userQuery) {
    const queryLower = userQuery.toLowerCase();
    const responses = [];

    // Structure of government
    if (queryLower.includes('structure') || queryLower.includes('organization') || queryLower.includes('how is')) {
      const structure = this.generalKnowledge.governmentStructure;
      responses.push(`The Government of Maharashtra structure:\n• **Head of State**: ${structure.head}\n• **Executive**: ${structure.executive}\n• **Legislative**: ${structure.legislative}\n• **Judiciary**: ${structure.judiciary}\n• **Administrative**: ${structure.administrative}`);
    }

    // State facts
    if (queryLower.includes('capital')) {
      responses.push(`The capital of Maharashtra is **${this.generalKnowledge.facts.capital}**.`);
    }
    if (queryLower.includes('population') || queryLower.includes('people')) {
      responses.push(`Maharashtra has a population of **${this.generalKnowledge.facts.population}**.`);
    }
    if (queryLower.includes('area') || queryLower.includes('size')) {
      responses.push(`Maharashtra covers **${this.generalKnowledge.facts.area}**.`);
    }
    if (queryLower.includes('language') || queryLower.includes('official language')) {
      responses.push(`The official language of Maharashtra is **${this.generalKnowledge.facts.officialLanguage}**.`);
    }
    if (queryLower.includes('district') || queryLower.includes('districts')) {
      responses.push(`Maharashtra has **${this.generalKnowledge.facts.districts}** districts.`);
    }
    if (queryLower.includes('literacy')) {
      responses.push(`Maharashtra's literacy rate is **${this.generalKnowledge.facts.literacy}**.`);
    }

    // Department descriptions
    for (const [dept, description] of Object.entries(this.generalKnowledge.departments)) {
      if (queryLower.includes(dept.toLowerCase())) {
        const grCount = (this.indexer?.indices?.byDepartment?.get(dept) || []).length;
        responses.push(`The **${dept} Department** ${description} It has ${grCount} GRs in our database.`);
      }
    }

    if (responses.length === 0) {
      responses.push('The Government of Maharashtra is the state government of Maharashtra, India, with its headquarters in Mumbai. It operates through various departments, each headed by a minister, and implements policies, schemes, and services for the welfare of citizens.');
    }

    return responses.join('\n\n');
  }

  /**
   * Get display name for department
   */
  _getDepartmentDisplayName(deptKey) {
    if (!deptKey) return 'Government Department';
    
    if (this.departmentDisplayNames[deptKey]) {
      return this.departmentDisplayNames[deptKey];
    }

    for (const [key, value] of Object.entries(this.departmentDisplayNames)) {
      if (deptKey.toLowerCase().includes(key.toLowerCase()) || 
          key.toLowerCase().includes(deptKey.toLowerCase())) {
        return value;
      }
    }

    return deptKey.replace(/_/g, ' ').replace(/Department$/i, '').trim() || 'Government Department';
  }

  /**
   * Search database for top matching GRs
   */
  _findRelevantGRs(userQuery) {
    if (!this.indexer || !this.indexer.grs || this.indexer.grs.length === 0) return [];

    const queryLower = userQuery.toLowerCase();
    
    const stopwords = new Set([
      'what', 'when', 'where', 'which', 'who', 'how', 'is', 'are', 'was', 'were',
      'the', 'about', 'regarding', 'launched', 'issued', 'show', 'tell', 'me', 'find',
      'search', 'gr', 'grs', 'policy', 'rules', 'rule', 'government', 'resolution',
      'there', 'any', 'for', 'details', 'give', 'provide', 'information', 'department',
      'state', 'maharashtra', 'with', 'under', 'from', 'this', 'that', 'have', 'has',
      'had', 'does', 'did'
    ]);

    const keywords = queryLower.replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 1 && !stopwords.has(w));

    if (keywords.length === 0) {
      return [];
    }

    const scored = [];
    this.indexer.grs.forEach(gr => {
      let score = 0;
      const subject = (gr.metadata?.subject || '').toLowerCase();
      const schemeWords = (gr.metadata?.scheme_words || []).map(s => s.toLowerCase());

      const schemeMatchCount = keywords.filter(k => schemeWords.includes(k)).length;
      score += schemeMatchCount * 30;

      const subjectMatchCount = keywords.filter(k => subject.includes(k)).length;
      score += subjectMatchCount * 10;

      if (score > 0) scored.push({ gr, score });
    });

    scored.sort((a, b) => b.score - a.score);
    let results = scored.map(s => s.gr).slice(0, 6);

    // Fallback search
    if (results.length === 0) {
      const fallback = [];
      this.indexer.grs.forEach(gr => {
        const subject = (gr.metadata?.subject || '').toLowerCase();
        const subjectMatchCount = keywords.filter(k => subject.includes(k)).length;
        if (subjectMatchCount > 0) fallback.push({ gr, score: subjectMatchCount });
      });
      fallback.sort((a, b) => b.score - a.score);
      results = fallback.map(s => s.gr).slice(0, 6);
    }

    return results;
  }

  /**
   * Ask Gemini API for ANY question - enhanced with context
   */
  async _askGemini(userQuery) {
    if (!this.geminiKey || !this.geminiAvailable) {
      return null;
    }

    const prompt = `You are the MahaGR AI Assistant for the Government of Maharashtra. You are an expert on Maharashtra government, policies, schemes, and general information.

IMPORTANT: Answer the user's question as accurately and helpfully as possible. Use your general knowledge to provide a comprehensive answer.

User Question: "${userQuery}"

Guidelines:
1. If the question is about Maharashtra government, policies, or schemes, provide specific and accurate information
2. If the question is general knowledge, provide a helpful answer
3. Keep your response concise (under 200 words)
4. Use bullet points (•) for key points when helpful
5. Be conversational and helpful

Response:`;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 400,
              temperature: 0.3,
              topP: 0.8
            }
          }),
          signal: controller.signal
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('Gemini API error:', response.status);
        return null;
      }

      const data = await response.json();
      const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (answerText && answerText.length > 10) {
        return answerText.trim();
      }
      
      return null;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('Gemini API request timed out');
      } else {
        console.warn('Gemini API error:', error.message);
      }
      return null;
    }
  }

  /**
   * Generate response for policy/scheme queries
   */
  _generatePolicyResponse(userQuery) {
    const queryLower = userQuery.toLowerCase();
    const responses = [];

    if (queryLower.includes('farmer') || queryLower.includes('loan') || queryLower.includes('subsidy') || queryLower.includes('crop')) {
      responses.push('**Farmer Support & Agricultural Schemes in Maharashtra**\n• Crop loan interest subvention schemes\n• Farmer welfare and support programs\n• Agricultural input subsidies\n• Cooperative credit support\n• FRP payment support for sugarcane\n\nFor specific GRs, ask: "Find GRs about farmer loans" or "Find GRs about agriculture subsidies"');
    }

    if (queryLower.includes('education') || queryLower.includes('student') || queryLower.includes('scholarship')) {
      responses.push('**Education & Scholarship Schemes**\n• Post Matric Scholarship for SC/ST/OBC\n• Pre Matric Scholarship for SC/ST\n• National Fellowship for Higher Education\n• Merit-cum-Means Scholarship\n• MahaDBT portal for applications\n\nApply through: www.mahadbt.maharashtra.gov.in');
    }

    if (queryLower.includes('health') || queryLower.includes('medical') || queryLower.includes('hospital')) {
      responses.push('**Public Health & Medical Schemes**\n• Public health services and hospitals\n• Disease control and prevention programs\n• Medical education and drug regulation\n• Health insurance and welfare schemes\n\nContact the Public Health Department for specific schemes.');
    }

    if (queryLower.includes('women') || queryLower.includes('child') || queryLower.includes('tribal')) {
      responses.push('**Social Welfare Schemes**\n• Women empowerment programs\n• Child welfare and nutrition schemes\n• Tribal development and welfare\n• Social justice and assistance programs\n\nVisit the respective department portals for details.');
    }

    if (responses.length === 0) {
      responses.push('**Government Policies & Schemes in Maharashtra**\n• Agricultural and farmer welfare schemes\n• Education and scholarship programs\n• Public health and medical schemes\n• Social welfare and tribal development\n• Infrastructure and urban development\n• Energy and industrial policies\n\nAsk about specific departments or schemes for more details.');
    }

    return responses.join('\n\n');
  }

  /**
   * Main chat method - ENHANCED with full Gemini integration
   */
  async chat(userQuery) {
    const qClean = userQuery.toLowerCase().trim().replace(/[?.]/g, '');
    
    // Check cache first
    const cachedResponse = this._getCachedResponse(userQuery);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Greeting responses
    const greetings = new Set(['hi', 'hello', 'hey', 'greetings', 'hola', 'namaste', 'good morning', 'good afternoon', 'good evening']);
    if (greetings.has(qClean) || greetings.has(qClean.split(' ')[0])) {
      const response = {
        answer: "Namaste! I am your MahaGR AI Assistant, your expert guide to 98,000+ Maharashtra Government Resolutions. I can help you with:\n\n• **Policy & GR Search** - Find specific resolutions, schemes, and sanctions\n• **Government Information** - Learn about departments, structure, and services\n• **Website Guidance** - Navigate official portals and download forms\n• **Scheme Details** - Understand eligibility, benefits, and application processes\n\nWhat would you like to know about Maharashtra's governance today?",
        matchingGRs: [],
        source: 'welcome'
      };
      this._cacheResponse(userQuery, response);
      return response;
    }

    // Help responses
    const helpQueries = ['what can you do', 'help', 'who are you', 'how to use', 'capabilities', 'features'];
    if (helpQueries.some(hq => qClean.includes(hq))) {
      const response = {
        answer: "I am an AI assistant with comprehensive knowledge of:\n\n📜 **98,000+ Government Resolutions** - Search and summarize policies, schemes, and orders across all departments\n\n🏛️ **Maharashtra Governance** - Information about departments, structure, and administration\n\n🌐 **Official Websites** - Guide you to the right portals for services and downloads\n\n📋 **Schemes & Benefits** - Details on eligibility, application processes, and documentation\n\n**Example queries:**\n• 'Find GRs about farmer loan schemes'\n• 'What is the structure of Maharashtra government?'\n• 'How to download forms from maharashtra.gov.in?'\n• 'Tell me about the MahaDBT scholarship'\n• 'What is the population of Maharashtra?'\n\nWhat can I help you with today?",
        matchingGRs: [],
        source: 'help'
      };
      this._cacheResponse(userQuery, response);
      return response;
    }

    // Detect intent
    const intent = this._detectIntent(userQuery);
    
    // Handle scholarship queries
    if (intent === 'scholarship') {
      const response = {
        answer: this._generateScholarshipResponse(userQuery),
        matchingGRs: [],
        source: 'general_knowledge'
      };
      this._cacheResponse(userQuery, response);
      return response;
    }

    // Handle website queries
    if (intent === 'website') {
      const response = {
        answer: this._generateWebsiteResponse(userQuery),
        matchingGRs: [],
        source: 'website'
      };
      this._cacheResponse(userQuery, response);
      return response;
    }

    // Handle policy queries
    if (intent === 'policy') {
      const policyResponse = this._generatePolicyResponse(userQuery);
      if (policyResponse && policyResponse.length > 20) {
        const response = {
          answer: policyResponse,
          matchingGRs: [],
          source: 'general_knowledge'
        };
        this._cacheResponse(userQuery, response);
        return response;
      }
    }

    // Handle government queries
    if (intent === 'government') {
      // First check for GR matches
      const matchingGRs = this._findRelevantGRs(userQuery);
      
      if (matchingGRs.length > 0) {
        const grResponse = await this._generateGRResponse(userQuery, matchingGRs);
        this._cacheResponse(userQuery, grResponse);
        return grResponse;
      }

      // No GR found - try general knowledge
      const generalResponse = this._generateGeneralGovernmentResponse(userQuery);
      
      if (generalResponse && generalResponse.length > 20) {
        const response = {
          answer: generalResponse,
          matchingGRs: [],
          source: 'general_knowledge'
        };
        this._cacheResponse(userQuery, response);
        return response;
      }

      // FALLBACK: Use Gemini API for any government question
      if (this.geminiAvailable) {
        const geminiAnswer = await this._askGemini(userQuery);
        if (geminiAnswer) {
          const response = {
            answer: geminiAnswer,
            matchingGRs: [],
            source: 'gemini'
          };
          this._cacheResponse(userQuery, response);
          return response;
        }
      }

      const response = {
        answer: "I don't have specific information about that. You can ask about GRs, departments, or general government information.",
        matchingGRs: [],
        source: 'fallback'
      };
      this._cacheResponse(userQuery, response);
      return response;
    }

    // Handle GR-specific queries
    const matchingGRs = this._findRelevantGRs(userQuery);

    if (matchingGRs.length === 0) {
      // Try policy response
      const policyResponse = this._generatePolicyResponse(userQuery);
      if (policyResponse && policyResponse.length > 20) {
        const response = {
          answer: policyResponse,
          matchingGRs: [],
          source: 'general_knowledge'
        };
        this._cacheResponse(userQuery, response);
        return response;
      }

      // Check if it's a general government question
      if (qClean.includes('government') || qClean.includes('department') || qClean.includes('minister')) {
        const generalResponse = this._generateGeneralGovernmentResponse(userQuery);
        if (generalResponse && generalResponse.length > 20) {
          const response = {
            answer: generalResponse,
            matchingGRs: [],
            source: 'general_knowledge'
          };
          this._cacheResponse(userQuery, response);
          return response;
        }
      }

      // FALLBACK: Use Gemini API for ANY question
      if (this.geminiAvailable) {
        const geminiAnswer = await this._askGemini(userQuery);
        if (geminiAnswer) {
          const response = {
            answer: geminiAnswer,
            matchingGRs: [],
            source: 'gemini'
          };
          this._cacheResponse(userQuery, response);
          return response;
        }
      }

      const response = {
        answer: "I could not find specific Government Resolutions matching your query. However, you can ask me about:\n\n• General government information\n• Department details\n• Website guidance\n• Schemes and benefits\n• Policies and regulations\n\nPlease try a different question or ask about specific GR topics.",
        matchingGRs: [],
        source: 'no_results'
      };
      this._cacheResponse(userQuery, response);
      return response;
    }

    // Generate GR-based response
    const grResponse = await this._generateGRResponse(userQuery, matchingGRs);
    this._cacheResponse(userQuery, grResponse);
    return grResponse;
  }

  /**
   * Generate response for GR-specific queries
   */
  async _generateGRResponse(userQuery, matchingGRs) {
    const topGR = matchingGRs[0];
    const bulletSummary = this._extractShortBulletPoints(topGR, userQuery);

    // If Gemini is available, use it for better summarization
    if (this.geminiAvailable) {
      const grContext = matchingGRs.slice(0, 3).map((gr, i) => {
        const shortSubject = (gr.metadata?.subject || '').slice(0, 150);
        return `[GR #${i + 1}] Number: ${gr.metadata?.grNumber || gr.id} | Dept: ${this._getDepartmentDisplayName(gr.department)} | Date: ${gr.metadata?.date || 'N/A'} | Subject: ${shortSubject}`;
      }).join('\n');

      const prompt = `You are an expert administrative assistant for the Government of Maharashtra.

USER QUERY: "${userQuery}"

RELEVANT GR DOCUMENTS:
${grContext}

Based on the GR documents above, provide a concise, conversational answer to the user's query. Be direct and helpful.

Guidelines:
1. Start with a direct answer
2. Use bullet points for key details
3. Keep it under 100 words
4. Be specific with numbers, amounts, and dates

Response:`;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                maxOutputTokens: 250,
                temperature: 0.2
              }
            }),
            signal: controller.signal
          }
        );

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const answerText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (answerText && answerText.length > 10 && answerText.length < 1000) {
            return {
              answer: answerText.trim(),
              matchingGRs: matchingGRs.map(gr => ({
                id: gr.metadata?.grNumber || gr.id,
                department: this._getDepartmentDisplayName(gr.department),
                subject: gr.metadata?.subject,
                date: gr.metadata?.date
              })),
              source: 'gr_database'
            };
          }
        }
      } catch (err) {
        console.warn('Gemini GR summarization error:', err.message);
      }
    }

    // Fallback to bullet summary
    return {
      answer: bulletSummary,
      matchingGRs: matchingGRs.map(gr => ({
        id: gr.metadata?.grNumber || gr.id,
        department: this._getDepartmentDisplayName(gr.department),
        subject: gr.metadata?.subject,
        date: gr.metadata?.date
      })),
      source: 'gr_database'
    };
  }

  /**
   * Extract short bullet points from GR
   */
  _extractShortBulletPoints(topGR, userQuery = '') {
    if (!topGR) {
      return 'No Government Resolution found matching your query.';
    }
    
    const dept = this._getDepartmentDisplayName(topGR.department);
    const subject = topGR.metadata?.subject || 'Government Resolution';
    const date = topGR.metadata?.date || 'N/A';
    const grNumber = topGR.metadata?.grNumber || topGR.id || 'Unknown';
    
    const directAnswer = `I found a Government Resolution regarding **${subject}**. It was issued by the **${dept}** on **${date}** under Resolution No. **${grNumber}**.`;
    
    const bullets = [];
    
    // Core Mandates / Resolution clauses
    const clauses = topGR.sections?.resolutions || [];
    if (clauses.length > 0) {
      clauses.slice(0, 2).forEach((c, idx) => {
        const cleanText = c.text ? c.text.substring(0, 120).replace(/\n/g, ' ').trim() : '';
        if (cleanText) {
          bullets.push(`• **Clause ${idx + 1}**: "${cleanText}${c.text && c.text.length > 120 ? '...' : ''}"`);
        }
      });
    }

    // Financial allocations
    const mainFin = (topGR.sections?.financials || []).find(f => f.amountNumeric || f.amount);
    if (mainFin) {
      const amount = mainFin.amount || mainFin.amountNumeric || 0;
      bullets.push(`• **Financial Sanction**: ₹${Number(amount).toLocaleString('en-IN')}`);
    }
    
    // Districts
    if (topGR.districts && topGR.districts.length > 0) {
      bullets.push(`• **Jurisdiction**: ${topGR.districts.join(', ')}`);
    }

    if (bullets.length === 0) {
      bullets.push('• This resolution contains administrative orders and policy directives.');
    }

    return `${directAnswer}\n\nHere are the key points:\n${bullets.join('\n')}`;
  }
}

// ✅ CORRECT EXPORT - Only at the end
export default GRAssistant;