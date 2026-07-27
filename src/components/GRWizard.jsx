import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './GRWizard.css';

// 33 Standard Departments of Government of Maharashtra
const MAHA_DEPARTMENTS = [
  'School Education and Sports Department',
  'Finance Department',
  'Planning Department',
  'Urban Development Department',
  'Housing Department',
  'Home Department',
  'Public Health Department',
  'Agriculture, Dairy Development, Animal Husbandry and Fisheries Department',
  'Revenue and Forests Department',
  'Social Justice and Special Assistance Department',
  'Higher and Technical Education Department',
  'Water Resources Department',
  'Water Supply and Sanitation Department',
  'Public Works Department',
  'Industries, Energy and Labour Department',
  'Rural Development and Panchayat Raj Department',
  'Tribal Development Department',
  'Co-operation, Marketing and Textiles Department',
  'Women and Child Development Department',
  'Medical Education and Drugs Department',
  'Environment and Climate Change Department',
  'Tourism and Cultural Affairs Department',
  'Law and Judiciary Department',
  'General Administration Department',
  'Information Technology Department',
  'Food, Civil Supplies and Consumer Protection Department',
  'Soil and Water Conservation Department',
  'Skill Development, Employment and Entrepreneurship Department',
  'Minorities Development Department',
  'Transport Department',
  'Disaster Management, Relief and Rehabilitation Department',
  'OBC, VJNT, SBC Welfare Department',
  'Parliamentary Affairs Department'
];

export default function GRWizard({ setCurrentGR, user }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem('wizard_step');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);

  // 1. Global Header Inputs
  const [globalHeader, setGlobalHeader] = useState(() => {
    const saved = localStorage.getItem('wizard_globalHeader');
    return saved ? JSON.parse(saved) : {
      department_name: 'Finance Department',
      gr_date: new Date().toISOString().split('T')[0],
      signee_designation: 'Under Secretary to Government of Maharashtra',
      gr_language: 'marathi_english'
    };
  });

  // 2. Mandatory Preamble Micro-Inputs
  const [preambleInputs, setPreambleInputs] = useState(() => {
    const saved = localStorage.getItem('wizard_preambleInputs');
    return saved ? JSON.parse(saved) : {
      trigger_event: '',
      reference_document: '',
      targeted_action: ''
    };
  });

  // 3. Archetype Selection & Polymorphic Payloads
  const [selectedArchetype, setSelectedArchetype] = useState(() => {
    const saved = localStorage.getItem('wizard_selectedArchetype');
    return saved || '1_FINANCIAL_SANCTION';
  });

  const [typeVariables, setTypeVariables] = useState(() => {
    const saved = localStorage.getItem('wizard_typeVariables');
    return saved ? JSON.parse(saved) : {
      // Financial Sanction
      precise_amount_inr: 70000000,
      budget_head_15_digit: '2202-01-101-01-03',
      drawing_disbursing_officer: 'Director of Primary Education, Pune',
      utilization_certificate_deadline: '2027-03-31',
      repayment_moratorium: '',

      // Policy Scheme
      scheme_name: 'Mukhyamantri Yuva Karya Prashikshan Yojana',
      eligibility_criteria: 'Age 18-30, Minimum 12th Pass, Resident of Maharashtra',
      committee_chairman: 'District Collector',

      // HR Establishment
      employee_names_and_cadres: 'Shri. R. R. Patil (MPSC IAS 2018)',
      current_posting: 'Deputy Collector, Thane',
      new_posting: 'Chief Executive Officer, ZP Wardha',
      effective_date: 'Immediate',

      // Statutory Notification
      parent_act_invoked: 'Section 25 of the Negotiable Instruments Act, 1881',
      geographic_scope: 'Mumbai Metropolitan Region (MMR)',
      exempted_entities: 'Hospitals, Fire Brigade, Water Supply, and Emergency Units',

      // Corrigendum
      original_gr_id: '202511041420119901',
      incorrect_text_reference: 'Amount allocated: Rs. 5,00,000/-',
      corrected_text_placement: 'Amount allocated: Rs. 50,000/-'
    };
  });

  // Dynamic Flex-Fields (additional_custom_parameters)
  const [flexFields, setFlexFields] = useState(() => {
    const saved = localStorage.getItem('wizard_flexFields');
    return saved ? JSON.parse(saved) : [
      { parameter_name: 'Interest Accrual Rate', parameter_value: 'Calculated at a fixed 6.5% per annum on the outstanding balance' }
    ];
  });

  // Save states to localStorage on change
  useEffect(() => {
    localStorage.setItem('wizard_step', step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem('wizard_globalHeader', JSON.stringify(globalHeader));
  }, [globalHeader]);

  useEffect(() => {
    localStorage.setItem('wizard_preambleInputs', JSON.stringify(preambleInputs));
  }, [preambleInputs]);

  useEffect(() => {
    localStorage.setItem('wizard_selectedArchetype', selectedArchetype);
  }, [selectedArchetype]);

  useEffect(() => {
    localStorage.setItem('wizard_typeVariables', JSON.stringify(typeVariables));
  }, [typeVariables]);

  useEffect(() => {
    localStorage.setItem('wizard_flexFields', JSON.stringify(flexFields));
  }, [flexFields]);

  // Live Field Verification State
  const [fieldVerification, setFieldVerification] = useState({});

  // Verify field against DB asynchronously
  const verifyInput = async (fieldName, fieldValue) => {
    try {
      const res = await axios.post('http://localhost:5000/api/gr/verify-fields', {
        fieldName,
        fieldValue,
        department: globalHeader.department_name
      });
      setFieldVerification(prev => ({ ...prev, [fieldName]: res.data }));
    } catch (e) {
      console.error('Verification error:', e);
    }
  };

  const handleTypeVarChange = (fieldName, val) => {
    setTypeVariables(prev => ({ ...prev, [fieldName]: val }));
    verifyInput(fieldName, val);
  };

  // Add Dynamic Flex-Field Row
  const handleAddFlexField = () => {
    setFlexFields([...flexFields, { parameter_name: '', parameter_value: '' }]);
  };

  const handleFlexFieldChange = (index, key, val) => {
    const updated = [...flexFields];
    updated[index][key] = val;
    setFlexFields(updated);
  };

  const handleRemoveFlexField = (index) => {
    setFlexFields(flexFields.filter((_, i) => i !== index));
  };

  const handleGenerateGR = async () => {
    if (!preambleInputs.trigger_event || !preambleInputs.targeted_action) {
      alert('Please fill out the Trigger Event and Targeted Action micro-text boxes.');
      return;
    }

    setLoading(true);
    setLoadingStep(0);

    const interval = setInterval(() => {
      setLoadingStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 1500);

    const getFilteredTypeVariables = () => {
      const vars = {};
      if (selectedArchetype === '1_FINANCIAL_SANCTION') {
        vars.precise_amount_inr = typeVariables.precise_amount_inr;
        vars.budget_head_15_digit = typeVariables.budget_head_15_digit;
        vars.drawing_disbursing_officer = typeVariables.drawing_disbursing_officer;
        vars.utilization_certificate_deadline = typeVariables.utilization_certificate_deadline;
        vars.repayment_moratorium = typeVariables.repayment_moratorium;
      } else if (selectedArchetype === '2_POLICY_SCHEME') {
        vars.scheme_name = typeVariables.scheme_name;
        vars.eligibility_criteria = typeVariables.eligibility_criteria;
        vars.committee_chairman = typeVariables.committee_chairman;
      } else if (selectedArchetype === '3_HR_ESTABLISHMENT') {
        vars.employee_names_and_cadres = typeVariables.employee_names_and_cadres;
        vars.current_posting = typeVariables.current_posting;
        vars.new_posting = typeVariables.new_posting;
        vars.effective_date = typeVariables.effective_date;
      } else if (selectedArchetype === '4_STATUTORY_NOTIFICATION') {
        vars.parent_act_invoked = typeVariables.parent_act_invoked;
        vars.geographic_scope = typeVariables.geographic_scope;
        vars.exempted_entities = typeVariables.exempted_entities;
      } else if (selectedArchetype === '5_CORRIGENDUM') {
        vars.original_gr_id = typeVariables.original_gr_id;
        vars.incorrect_text_reference = typeVariables.incorrect_text_reference;
        vars.corrected_text_placement = typeVariables.corrected_text_placement;
      }
      return vars;
    };

    const filteredVars = getFilteredTypeVariables();

    const payload = {
      department_name: globalHeader.department_name,
      department: globalHeader.department_name,
      gr_date: globalHeader.gr_date,
      signee_designation: globalHeader.signee_designation,
      gr_language: globalHeader.gr_language,
      
      trigger_event: preambleInputs.trigger_event,
      reference_document: preambleInputs.reference_document,
      targeted_action: preambleInputs.targeted_action,
      subject: preambleInputs.targeted_action,

      gr_type: selectedArchetype,
      intentType: selectedArchetype.replace(/^\d+_/, '').replace(/_/g, ' '),

      // Send type specific variables according to archetype
      ...filteredVars,

      type_specific_variables: {
        ...filteredVars
      },

      additional_custom_parameters: flexFields.filter(f => f.parameter_name && f.parameter_value),
      userId: user ? user.id : 'clerk_001'
    };

    try {
      const startTime = Date.now();
      const res = await axios.post('http://localhost:5000/api/gr/generate', payload);
      
      const elapsed = Date.now() - startTime;
      const minDuration = 6000;
      if (elapsed < minDuration) {
        await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
      }
      
      clearInterval(interval);
      if (res.data.success) {
        localStorage.removeItem('wizard_step');
        localStorage.removeItem('wizard_globalHeader');
        localStorage.removeItem('wizard_preambleInputs');
        localStorage.removeItem('wizard_selectedArchetype');
        localStorage.removeItem('wizard_typeVariables');
        localStorage.removeItem('wizard_flexFields');
        setCurrentGR(res.data.draft);
        navigate(`/draft/${res.data.grId}`, { 
          state: { 
            gr: res.data.draft, 
            alerts: res.data.verification?.alerts || [], 
            checksRun: res.data.verification?.checksRun || [] 
          } 
        });
      } else {
        alert('Failed to generate GR: ' + res.data.error);
      }
    } catch (err) {
      clearInterval(interval);
      alert('Error generating GR: ' + err.message);
    } finally {
      clearInterval(interval);
      setLoading(false);
    }
  };

  return (
    <div className="gr-wizard-container">
      {/* Tricolor Header Accent */}
      <div className="tricolor-stripe-bar"></div>

      <div className="wizard-title-block">
        <div className="title-left">
          <h2>कक्षा अधिकारी कार्यपीठा - नवीन शासन निर्णय (Mad-Libs Form Setup)</h2>
          <p className="sub-text">Maharashtra State Manual of Office Procedure Compliant GR Generator & Policy Auditor</p>
        </div>
        <div className="steps-pills">
          <div className={`step-pill ${step === 1 ? 'active' : 'completed'}`} onClick={() => setStep(1)}>1. Global & Micro Inputs</div>
          <div className={`step-pill ${step === 2 ? 'active' : ''}`} onClick={() => setStep(2)}>2. Archetype & Rules</div>
        </div>
      </div>

      {step === 1 && (
        <div className="wizard-step-content">
          {/* SECTION 1: GLOBAL HEADER INPUTS */}
          <div className="form-card">
            <div className="card-header-badge">Step 1A: Global Header Inputs (शासकीय विभाग व अधिकारी)</div>
            
            <div className="form-grid-3">
              <div className="form-group">
                <label>Department Name (शासकीय विभाग) *</label>
                <select 
                  className="form-control-styled"
                  value={globalHeader.department_name}
                  onChange={(e) => setGlobalHeader({ ...globalHeader, department_name: e.target.value })}
                >
                  {MAHA_DEPARTMENTS.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>GR Date (दिनांक) *</label>
                <input 
                  type="date"
                  className="form-control-styled"
                  value={globalHeader.gr_date}
                  onChange={(e) => setGlobalHeader({ ...globalHeader, gr_date: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Signee Designation (स्वाक्षरी अधिकारी पदनाम) *</label>
                <select
                  className="form-control-styled"
                  value={globalHeader.signee_designation}
                  onChange={(e) => setGlobalHeader({ ...globalHeader, signee_designation: e.target.value })}
                >
                  <option value="Under Secretary to Government of Maharashtra">Under Secretary (अवर सचिव)</option>
                  <option value="Deputy Secretary to Government of Maharashtra">Deputy Secretary (उप सचिव)</option>
                  <option value="Joint Secretary to Government of Maharashtra">Joint Secretary (सह सचिव)</option>
                  <option value="Secretary to Government of Maharashtra">Secretary (सचिव)</option>
                  <option value="Additional Chief Secretary to Government of Maharashtra">Additional Chief Secretary (अप्पर मुख्य सचिव)</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECTION 2: PREAMBLE MAD-LIBS MICRO-INPUTS */}
          <div className="form-card highlight-card">
            <div className="card-header-badge accent-badge">Step 1B: Preamble "Mad-Libs" Micro-Inputs (प्रस्तावना सूक्ष्म-प्रविष्टी)</div>
            <p className="card-desc">Provide exact facts to eliminate fluff and anchor the legal preamble.</p>

            <div className="form-group">
              <label>1. The Trigger / Incident (कारण / घटना) *</label>
              <input 
                type="text"
                className="form-control-styled"
                placeholder="e.g., Severe outbreak of Lumpy Skin Disease in cattle across 4 rural districts."
                value={preambleInputs.trigger_event}
                onChange={(e) => setPreambleInputs({ ...preambleInputs, trigger_event: e.target.value })}
              />
              <span className="field-hint">Defines the specific "Why" driving the resolution.</span>
            </div>

            <div className="form-group">
              <label>2. The Reference File/Letter (संदर्भ पत्र / नस्ती क्र.) *</label>
              <input 
                type="text"
                className="form-control-styled"
                placeholder="e.g., Cabinet Decision No. CAB-102, Dated 12/03/2026 or Letter ref VET-2026-09"
                value={preambleInputs.reference_document}
                onChange={(e) => setPreambleInputs({ ...preambleInputs, reference_document: e.target.value })}
              />
              <span className="field-hint">Legal tracking reference ID required by office manual.</span>
            </div>

            <div className="form-group">
              <label>3. The Targeted Action / Executive Order (शासकीय आदेश) *</label>
              <input 
                type="text"
                className="form-control-styled"
                placeholder="e.g., Release emergency procurement funds of Rs 50 Lakhs for instant vaccine distribution."
                value={preambleInputs.targeted_action}
                onChange={(e) => setPreambleInputs({ ...preambleInputs, targeted_action: e.target.value })}
              />
              <span className="field-hint">Direct Action Verb and Core Mandate.</span>
            </div>

            <div className="form-actions-right">
              <button className="btn-primary-styled" onClick={() => setStep(2)}>Next: Select GR Archetype →</button>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="wizard-step-content">
          {/* SECTION 3: ARCHETYPE SELECTION & TYPE-SPECIFIC VARIABLES */}
          <div className="form-card">
            <div className="card-header-badge">Step 2A: Select GR Archetype (शासन निर्णय प्रकार)</div>
            
            <div className="archetype-tabs">
              <button 
                className={`tab-btn ${selectedArchetype === '1_FINANCIAL_SANCTION' ? 'active' : ''}`}
                onClick={() => setSelectedArchetype('1_FINANCIAL_SANCTION')}
              >
                💰 1. Financial Sanction
              </button>
              <button 
                className={`tab-btn ${selectedArchetype === '2_POLICY_SCHEME' ? 'active' : ''}`}
                onClick={() => setSelectedArchetype('2_POLICY_SCHEME')}
              >
                📜 2. Policy / Scheme
              </button>
              <button 
                className={`tab-btn ${selectedArchetype === '3_ESTABLISHMENT_HR' ? 'active' : ''}`}
                onClick={() => setSelectedArchetype('3_ESTABLISHMENT_HR')}
              >
                👔 3. HR / Establishment
              </button>
              <button 
                className={`tab-btn ${selectedArchetype === '4_STATUTORY_NOTIFICATION' ? 'active' : ''}`}
                onClick={() => setSelectedArchetype('4_STATUTORY_NOTIFICATION')}
              >
                ⚖️ 4. Statutory Notification
              </button>
              <button 
                className={`tab-btn ${selectedArchetype === '5_CORRIGENDUM' ? 'active' : ''}`}
                onClick={() => setSelectedArchetype('5_CORRIGENDUM')}
              >
                ✏️ 5. Corrigendum (शुद्धिपत्र)
              </button>
            </div>

            {/* TAB 1: FINANCIAL SANCTION */}
            {selectedArchetype === '1_FINANCIAL_SANCTION' && (
              <div className="archetype-fields-panel">
                <h4>Type-Specific Variables: Financial Sanction (वित्तीय मान्यता)</h4>
                
                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Precise Amount (INR ₹) *</label>
                    <input 
                      type="number"
                      className="form-control-styled"
                      value={typeVariables.precise_amount_inr}
                      onChange={(e) => handleTypeVarChange('precise_amount_inr', e.target.value)}
                    />
                    {fieldVerification['precise_amount_inr'] && (
                      <div className={`verification-badge ${fieldVerification['precise_amount_inr'].status}`}>
                        {fieldVerification['precise_amount_inr'].message}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>15-Digit Budget Head Code (लेखाशीर्ष) *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. 2202-01-101-01-03"
                      value={typeVariables.budget_head_15_digit}
                      onChange={(e) => handleTypeVarChange('budget_head_15_digit', e.target.value)}
                    />
                    {fieldVerification['budget_head_15_digit'] && (
                      <div className={`verification-badge ${fieldVerification['budget_head_15_digit'].status}`}>
                        {fieldVerification['budget_head_15_digit'].message}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Drawing & Disbursing Officer (DDO) *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. Director of Primary Education, Pune"
                      value={typeVariables.drawing_disbursing_officer}
                      onChange={(e) => handleTypeVarChange('drawing_disbursing_officer', e.target.value)}
                    />
                    {fieldVerification['drawing_disbursing_officer'] && (
                      <div className={`verification-badge ${fieldVerification['drawing_disbursing_officer'].status}`}>
                        {fieldVerification['drawing_disbursing_officer'].message}
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Utilization Certificate (UC) Deadline *</label>
                    <input 
                      type="date"
                      className="form-control-styled"
                      value={typeVariables.utilization_certificate_deadline}
                      onChange={(e) => handleTypeVarChange('utilization_certificate_deadline', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: POLICY SCHEME */}
            {selectedArchetype === '2_POLICY_SCHEME' && (
              <div className="archetype-fields-panel">
                <h4>Type-Specific Variables: Policy Scheme (नवीन योजना)</h4>
                
                <div className="form-group">
                  <label>Scheme Name (योजनेचे नाव) *</label>
                  <input 
                    type="text"
                    className="form-control-styled"
                    placeholder="e.g. Mukhyamantri Yuva Karya Prashikshan Yojana"
                    value={typeVariables.scheme_name}
                    onChange={(e) => handleTypeVarChange('scheme_name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Eligibility Criteria (पात्रतेचे निकष) *</label>
                  <textarea 
                    className="form-control-styled"
                    rows="2"
                    placeholder="e.g. Age 18-30, Minimum 12th Pass, Resident of Maharashtra"
                    value={typeVariables.eligibility_criteria}
                    onChange={(e) => handleTypeVarChange('eligibility_criteria', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Committee Chairman (समिती अध्यक्ष - Leave blank if none)</label>
                  <input 
                    type="text"
                    className="form-control-styled"
                    placeholder="e.g. District Collector"
                    value={typeVariables.committee_chairman}
                    onChange={(e) => handleTypeVarChange('committee_chairman', e.target.value)}
                  />
                  <span className="field-hint">If left empty, committee clause is completely dropped without breaking clause numbering.</span>
                </div>
              </div>
            )}

            {/* TAB 3: HR ESTABLISHMENT */}
            {selectedArchetype === '3_ESTABLISHMENT_HR' && (
              <div className="archetype-fields-panel">
                <h4>Type-Specific Variables: Establishment & HR (आस्थापना / बदली)</h4>
                
                <div className="form-group">
                  <label>Employee Names and Cadres *</label>
                  <input 
                    type="text"
                    className="form-control-styled"
                    placeholder="e.g. Shri. R. R. Patil (MPSC IAS 2018)"
                    value={typeVariables.employee_names_and_cadres}
                    onChange={(e) => handleTypeVarChange('employee_names_and_cadres', e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Current Posting (वर्तमान पदस्थापना) *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. Deputy Collector, Thane"
                      value={typeVariables.current_posting}
                      onChange={(e) => handleTypeVarChange('current_posting', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>New Posting (नवीन पदस्थापना) *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. Chief Executive Officer, ZP Wardha"
                      value={typeVariables.new_posting}
                      onChange={(e) => handleTypeVarChange('new_posting', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: STATUTORY NOTIFICATION */}
            {selectedArchetype === '4_STATUTORY_NOTIFICATION' && (
              <div className="archetype-fields-panel">
                <h4>Type-Specific Variables: Statutory Notification (वैधानिक अधिसूचना)</h4>
                
                <div className="form-group">
                  <label>Parent Act Invoked *</label>
                  <input 
                    type="text"
                    className="form-control-styled"
                    placeholder="e.g. Section 25 of the Negotiable Instruments Act, 1881"
                    value={typeVariables.parent_act_invoked}
                    onChange={(e) => handleTypeVarChange('parent_act_invoked', e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Geographic Scope *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. Mumbai Metropolitan Region (MMR)"
                      value={typeVariables.geographic_scope}
                      onChange={(e) => handleTypeVarChange('geographic_scope', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Exempted Entities *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. Hospitals, Fire Brigade, Water Supply"
                      value={typeVariables.exempted_entities}
                      onChange={(e) => handleTypeVarChange('exempted_entities', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: CORRIGENDUM */}
            {selectedArchetype === '5_CORRIGENDUM' && (
              <div className="archetype-fields-panel">
                <h4>Type-Specific Variables: Corrigendum (शुद्धिपत्र)</h4>
                
                <div className="form-group">
                  <label>Original GR 21-Digit ID / Number *</label>
                  <input 
                    type="text"
                    className="form-control-styled"
                    placeholder="e.g. 202511041420119901"
                    value={typeVariables.original_gr_id}
                    onChange={(e) => handleTypeVarChange('original_gr_id', e.target.value)}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label>Incorrect Text Reference *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. Amount allocated: Rs. 5,00,000/-"
                      value={typeVariables.incorrect_text_reference}
                      onChange={(e) => handleTypeVarChange('incorrect_text_reference', e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Corrected Text Placement *</label>
                    <input 
                      type="text"
                      className="form-control-styled"
                      placeholder="e.g. Amount allocated: Rs. 50,000/-"
                      value={typeVariables.corrected_text_placement}
                      onChange={(e) => handleTypeVarChange('corrected_text_placement', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 4: DYNAMIC FLEX-FIELDS */}
          <div className="form-card">
            <div className="card-header-badge">Step 2B: Dynamic Flex-Fields (अनपेक्षित नियम / Dynamic Custom Rules)</div>
            <p className="card-desc">Add unique rules or custom conditions without database schema changes.</p>

            {flexFields.map((field, idx) => (
              <div key={idx} className="flex-field-row">
                <div className="flex-col">
                  <label>Rule Category (संक्षिप्त नाव)</label>
                  <input 
                    type="text"
                    className="form-control-styled"
                    placeholder="e.g. Interest Accrual Rate"
                    value={field.parameter_name}
                    onChange={(e) => handleFlexFieldChange(idx, 'parameter_name', e.target.value)}
                  />
                </div>
                <div className="flex-col-large">
                  <label>Rule Condition (विशिष्ट अट)</label>
                  <input 
                    type="text"
                    className="form-control-styled"
                    placeholder="e.g. Calculated at 6.5% per annum on outstanding balance"
                    value={field.parameter_value}
                    onChange={(e) => handleFlexFieldChange(idx, 'parameter_value', e.target.value)}
                  />
                </div>
                <button className="btn-remove-row" onClick={() => handleRemoveFlexField(idx)}>✕</button>
              </div>
            ))}

            <button className="btn-add-flex" onClick={handleAddFlexField}>
              ➕ Add Custom Rule (+ Add Custom Rule)
            </button>
          </div>

          <div className="wizard-final-actions">
            <button className="btn-secondary-styled" onClick={() => setStep(1)}>← Back</button>
            <button className="btn-generate-main" onClick={handleGenerateGR} disabled={loading}>
              {loading ? '⚡ Executing Policy Auditor & Generating GR...' : '🚀 Generate Government Resolution (GR)'}
            </button>
          </div>
        </div>
      )}

      {/* Immersive Stepped Progress Loading Overlay (HCI Concepts) */}
      {loading && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 37, 64, 0.92)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3000,
          backdropFilter: 'blur(8px)',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ textAlign: 'center', maxWidth: '500px', width: '90%' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 30px auto' }}>
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '80px',
                height: '80px',
                border: '6px solid rgba(255, 255, 255, 0.1)',
                borderTop: '6px solid #FF671F',
                borderBottom: '6px solid #046A38',
                borderRadius: '50%',
                animation: 'spin 1.5s linear infinite'
              }}></div>
              <img 
                src="https://upload.wikimedia.org/wikipedia/commons/f/fa/Emblem_of_Maharashtra.svg" 
                alt="Rajmudra Emblem" 
                style={{
                  position: 'absolute',
                  top: '15px',
                  left: '15px',
                  width: '50px',
                  height: '50px',
                  animation: 'pulse 2s ease-in-out infinite'
                }}
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            </div>

            <h3 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 10px 0', letterSpacing: '0.5px', color: '#FFFFFF' }}>
              धोरण व अनुपालन लेखापरीक्षण सुरू आहे
            </h3>
            <h4 style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 25px 0', color: '#D4AF37' }}>
              Executing Policy Audit & GR Document Generation...
            </h4>

            <div style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '20px',
              textAlign: 'left',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '20px'
            }}>
              {[
                { step: 0, label: "Connecting to Maharashtra GR-Align compliance engine...", mr: "अनुपालन इंजिनशी जोडत आहे..." },
                { step: 1, label: "Scanning 98,980 historical precursor GRs for overlaps...", mr: "ऐतिहासिक शासन निर्णयांची तपासणी सुरू आहे..." },
                { step: 2, label: "Verifying Finance Department ceiling caps & allocations...", mr: "वित्तीय मर्यादा आणि लेखाशीर्षांची पडताळणी..." },
                { step: 3, label: "Auditing statutory acts and department jurisdiction bounds...", mr: "वैधानिक कायदे आणि विभाग अधिकार क्षेत्राचे ऑडिट..." },
                { step: 4, label: "Compiling official bilingual (मराठी & English) clauses...", mr: "अधिकृत द्विभाषिक शासन निर्णय मसुदा संकलित करत आहे..." }
              ].map((item, idx) => {
                const isPassed = loadingStep > item.step;
                const isCurrent = loadingStep === item.step;
                return (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    opacity: isPassed || isCurrent ? 1 : 0.35,
                    transition: 'all 0.3s'
                  }}>
                    <span style={{ 
                      fontSize: '14px',
                      color: isPassed ? '#27ae60' : isCurrent ? '#ff9933' : '#94a3b8',
                      fontWeight: 'bold'
                    }}>
                      {isPassed ? '✅' : isCurrent ? '⚡' : '○'}
                    </span>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: isCurrent ? '#ff9933' : '#ffffff' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                        {item.mr}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>
              This takes about 5-8 seconds to audit the full 98k GR policy catalog.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
