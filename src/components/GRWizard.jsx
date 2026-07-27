import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './GRWizard.css';

export default function GRWizard({ setCurrentGR, user }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [departments, setDepartments] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    department: '',
    intentType: 'Policy Change',
    district: '',
    subject: '',
    budget: '',
    beneficiaries: '',
    accountHead: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    otherDetails: '',
  });

  const [generatedGR, setGeneratedGR] = useState(null);
  const [showFullDraft, setShowFullDraft] = useState(false);
  const [deptDetails, setDeptDetails] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptsRes, distsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/departments'),
          axios.get('http://localhost:5000/api/districts'),
        ]);
        setDepartments(deptsRes.data.departments);
        setDistricts(distsRes.data.districts);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };

    fetchData();
  }, []);

  const getDepartmentFields = (dept) => {
    const formattedDept = dept.toLowerCase().replace(/_/g, ' ');
    if (formattedDept.includes('finance')) {
      return [
        { name: 'fundSource', label: 'Source of Funds', type: 'select', options: ['Consolidated Fund of the State', 'Contingency Fund', 'Centrally Sponsored Scheme', 'State Plan Scheme'] },
        { name: 'auditAuthority', label: 'Audit Authority', type: 'text', placeholder: 'e.g., Accountant General (A&E)' },
        { name: 'treasuryCode', label: 'Treasury Code', type: 'text', placeholder: 'e.g., TRS-FIN-2026-004' }
      ];
    } else if (formattedDept.includes('planning')) {
      return [
        { name: 'schemeName', label: 'Scheme/Project Name', type: 'text', placeholder: 'e.g., Chief Minister Employment Generation Program' },
        { name: 'implementingAgency', label: 'Implementing Agency', type: 'text', placeholder: 'e.g., MIDC, Mhada, CIDCO' },
        { name: 'targetYear', label: 'Target Completion Year', type: 'number', placeholder: 'e.g., 2028' }
      ];
    } else if (formattedDept.includes('urban') || formattedDept.includes('development')) {
      return [
        { name: 'municipalArea', label: 'Municipal Corporation / Local Body', type: 'text', placeholder: 'e.g., BMC, PMC, NMMC' },
        { name: 'infrastructureCategory', label: 'Infrastructure Category', type: 'select', options: ['Water Supply & Sewerage', 'Roads & Bridges', 'Solid Waste Management', 'Public Transport', 'Town Planning'] },
        { name: 'dcrReference', label: 'DCR Rule Reference Number', type: 'text', placeholder: 'e.g., DCR-2034/Sec-4(2)' }
      ];
    } else if (formattedDept.includes('housing')) {
      return [
        { name: 'housingScheme', label: 'Housing Scheme Name', type: 'select', options: ['Pradhan Mantri Awas Yojana (PMAY)', 'MHADA Allotment Scheme', 'Ramai Awas Yojana', 'Shabari Gharkul Yojana'] },
        { name: 'houseUnits', label: 'Number of Housing Units to Create', type: 'number', placeholder: 'e.g., 2500' },
        { name: 'allotmentCriteria', label: 'Allotment Target / Criteria', type: 'select', options: ['Below Poverty Line (BPL) Families', 'Income-based (LIG/MIG) Applicants', 'SC / ST Beneficiaries', 'Divyangjan / Differently Abled'] }
      ];
    } else if (formattedDept.includes('home')) {
      return [
        { name: 'policeRange', label: 'Police Range / District Jurisdiction', type: 'text', placeholder: 'e.g., Pune Rural, Mumbai City' },
        { name: 'postCreation', label: 'Post / Rank Creation Title', type: 'text', placeholder: 'e.g., Police Sub-Inspector, Constable' },
        { name: 'policeCodeRef', label: 'IPC / CrPC Reference Clause', type: 'text', placeholder: 'e.g., Section 144 / Police Act Clause' }
      ];
    } else if (formattedDept.includes('education')) {
      return [
        { name: 'institutionType', label: 'Institution Type', type: 'select', options: ['Government Engineering College', 'Industrial Training Institute (ITI)', 'Secondary Higher School', 'State University'] },
        { name: 'seatIntake', label: 'Additional Seat Intake Number', type: 'number', placeholder: 'e.g., 120' },
        { name: 'affiliationBoard', label: 'Affiliation Board', type: 'text', placeholder: 'e.g., MSBTE, Savitribai Phule Pune University' }
      ];
    } else if (formattedDept.includes('social') || formattedDept.includes('justice') || formattedDept.includes('welfare')) {
      return [
        { name: 'targetClass', label: 'Target Beneficiary Class', type: 'select', options: ['Scheduled Castes (SC)', 'Divyangjan (Disabled)', 'Senior Citizens', 'Nomadic Tribes (VJNT)'] },
        { name: 'allowanceAmount', label: 'Monthly Pension / Financial Aid (₹)', type: 'number', placeholder: 'e.g., 1500' },
        { name: 'dbtScheme', label: 'Direct Benefit Transfer (DBT) Portal Name', type: 'text', placeholder: 'e.g., MahaDBT Social Welfare' }
      ];
    } else if (formattedDept.includes('revenue') || formattedDept.includes('forest')) {
      return [
        { name: 'surveyNumber', label: 'Land Survey Number / Survey Area', type: 'text', placeholder: 'e.g., Survey No. 45/A, Taluka Haveli' },
        { name: 'landClass', label: 'Land Classification', type: 'select', options: ['Forest Land (Protected)', 'Revenue Land', 'Agricultural Land', 'Non-Agricultural (Commercial/Residential)'] },
        { name: 'taluka', label: 'Taluka / Tehsil', type: 'text', placeholder: 'e.g., Haveli, Mulshi' }
      ];
    } else if (formattedDept.includes('agri')) {
      return [
        { name: 'cropSeason', label: 'Crop / Season Type', type: 'select', options: ['Kharif Season', 'Rabi Season', 'Summer Season', 'All Crops'] },
        { name: 'subsidyPercent', label: 'Subsidy Percentage (%)', type: 'number', placeholder: 'e.g., 80' },
        { name: 'farmerCategory', label: 'Target Farmer Category', type: 'select', options: ['Small & Marginal Farmers', 'SC / ST Farmers', 'Women Farmers', 'All Landholding Farmers'] }
      ];
    } else if (formattedDept.includes('health')) {
      return [
        { name: 'hospitalLevel', label: 'Hospital Facility Level', type: 'select', options: ['Primary Health Centre (PHC)', 'Rural Hospital (RH)', 'Sub-District Hospital (SDH)', 'District Civil Hospital', 'Government Medical College (GMC)'] },
        { name: 'equipmentDetails', label: 'Equipment / Medicine Procurement Description', type: 'text', placeholder: 'e.g., ICU Ventilator Procurement' },
        { name: 'procurementAgency', label: 'Procurement Agency', type: 'text', placeholder: 'e.g., Haffkine Bio-Pharmaceutical Corp' }
      ];
    } else {
      return [
        { name: 'policyClause', label: 'Key Section / Policy Clause description', type: 'textarea', placeholder: 'Describe specific terms, criteria, or policy revisions to enforce...' },
        { name: 'officerInCharge', label: 'Nodal Officer / Officer In Charge', type: 'text', placeholder: 'e.g., Deputy Secretary / Director' },
        { name: 'committeeMembers', label: 'Monitoring Committee Members', type: 'text', placeholder: 'e.g., Joint Secretary (Planning), Under Secretary (Finance)' }
      ];
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'department') {
      setDeptDetails({});
    }
  };

  const handleDeptDetailsChange = (e) => {
    const { name, value } = e.target;
    setDeptDetails(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    if (!formData.subject || !formData.department) {
      alert('Please fill in required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('http://localhost:5000/api/gr/generate', {
        ...formData,
        districts: formData.district ? [formData.district] : [],
        deptDetails,
        userId: user ? user.id : 'junior_clerk_001',
      });

      if (response.data.success) {
        setGeneratedGR(response.data);
        setCurrentGR(response.data.draft);
        setStep(4);
      } else {
        alert('Failed to generate GR: ' + response.data.error);
      }
    } catch (error) {
      alert('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wizard" style={{ paddingTop: '20px', position: 'relative' }}>
      <div className="tricolor-accent" style={{ display: 'flex', height: '6px', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
        <div style={{ flex: 1, backgroundColor: '#FF9933' }}></div>
        <div style={{ flex: 1, backgroundColor: '#FFFFFF' }}></div>
        <div style={{ flex: 1, backgroundColor: '#138808' }}></div>
      </div>

      <div className="wizard-header">
        <h2>Create New Government Resolution (नवीन शासन निर्णय तयार करा)</h2>
        <div className="step-indicator">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`step ${step === s ? 'active' : step > s ? 'completed' : ''}`}>
              {s}
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-form">
        {/* Step 1: Department & Intent */}
        {step === 1 && (
          <div className="form-step">
            <h3>Step 1: Department & Intent (विभाग आणि हेतू)</h3>
            <div className="form-group">
              <label>Department *</label>
              <select
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                required
              >
                <option value="">Select Department</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Intent Type *</label>
              <select
                name="intentType"
                value={formData.intentType}
                onChange={handleInputChange}
              >
                <option value="Policy Change">Policy Change</option>
                <option value="Financial Sanction">Financial Sanction</option>
                <option value="Service Transfer">Service Transfer</option>
                <option value="Scheme Launch">Scheme Launch</option>
                <option value="Administrative">Administrative</option>
              </select>
            </div>

            <div className="form-actions">
              <button
                className="btn-next"
                onClick={() => formData.department && setStep(2)}
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Basic Information */}
        {step === 2 && (
          <div className="form-step">
            <h3>Step 2: Basic Information (मूलभूत माहिती)</h3>

            <div className="form-group">
              <label>District (optional)</label>
              <select
                name="district"
                value={formData.district}
                onChange={handleInputChange}
              >
                <option value="">State-wide</option>
                {districts.map(dist => (
                  <option key={dist} value={dist}>{dist}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Subject/Title *</label>
              <textarea
                name="subject"
                value={formData.subject}
                onChange={handleInputChange}
                placeholder="Enter the subject of the resolution..."
                rows="3"
                required
              />
            </div>

            <div className="form-group">
              <label>Effective Date</label>
              <input
                type="date"
                name="effectiveDate"
                value={formData.effectiveDate}
                onChange={handleInputChange}
              />
            </div>

            <div className="form-group">
              <label>Other Resolution Specifics / Custom Notes (optional)</label>
              <textarea
                name="otherDetails"
                value={formData.otherDetails}
                onChange={handleInputChange}
                placeholder="Enter any other specific details, clauses, or instructions that must be included in the resolution..."
                rows="4"
              />
            </div>

            {/* Department Specific Specifications */}
            {formData.department && (
              <div className="dept-specs-section" style={{ marginTop: '20px', borderTop: '1px dashed #ddd', paddingTop: '15px' }}>
                <h4 style={{ fontSize: '14px', color: '#1a3a52', marginBottom: '15px' }}>Department-Specific Details (विभाग-विशिष्ट तपशील)</h4>
                {getDepartmentFields(formData.department).map(field => (
                  <div className="form-group" key={field.name}>
                    <label>{field.label}</label>
                    {field.type === 'select' ? (
                      <select
                        name={field.name}
                        value={deptDetails[field.name] || ''}
                        onChange={handleDeptDetailsChange}
                      >
                        <option value="">Select option</option>
                        {field.options.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        name={field.name}
                        value={deptDetails[field.name] || ''}
                        onChange={handleDeptDetailsChange}
                        placeholder={field.placeholder}
                        rows="3"
                      />
                    ) : (
                      <input
                        type={field.type}
                        name={field.name}
                        value={deptDetails[field.name] || ''}
                        onChange={handleDeptDetailsChange}
                        placeholder={field.placeholder}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="form-actions">
              <button className="btn-back" onClick={() => setStep(1)}>
                ← Back
              </button>
              <button className="btn-next" onClick={() => setStep(3)}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Financial Details */}
        {step === 3 && (
          <div className="form-step">
            <h3>Step 3: Financial Details (वित्तीय तपशील)</h3>

            <div className="form-group">
              <label>Budget Amount (₹)</label>
              <input
                type="number"
                name="budget"
                value={formData.budget}
                onChange={handleInputChange}
                placeholder="Enter budget amount"
              />
            </div>

            <div className="form-group">
              <label>Beneficiaries</label>
              <textarea
                name="beneficiaries"
                value={formData.beneficiaries}
                onChange={handleInputChange}
                placeholder="Describe target beneficiaries..."
                rows="3"
              />
            </div>

            <div className="form-group">
              <label>Account Head</label>
              <input
                type="text"
                name="accountHead"
                value={formData.accountHead}
                onChange={handleInputChange}
                placeholder="e.g., 2071-00-99"
              />
            </div>

            <div className="form-actions">
              <button className="btn-back" onClick={() => setStep(2)}>
                ← Back
              </button>
              <button
                className="btn-generate"
                onClick={handleGenerate}
                disabled={loading}
              >
                {loading ? 'Generating...' : 'Generate GR →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review Generated GR */}
        {step === 4 && generatedGR && (
          <div className="form-step">
            <h3>Step 4: Review Generated Resolution</h3>

            <div className="verification-summary">
              <div className="summary-header">
                <h4>Verification Results</h4>
                <span className={`badge ${generatedGR.verification.passedVerification ? 'success' : 'warning'}`}>
                  {generatedGR.verification.passedVerification ? '✅ Passed' : '⚠️ Review Needed'}
                </span>
              </div>

              <div className="summary-stats">
                <div className="stat">
                  <span className="label">Critical:</span>
                  <span className={`value ${generatedGR.verification.summary.critical > 0 ? 'error' : ''}`}>
                    {generatedGR.verification.summary.critical}
                  </span>
                </div>
                <div className="stat">
                  <span className="label">High:</span>
                  <span className={`value ${generatedGR.verification.summary.high > 0 ? 'warning' : ''}`}>
                    {generatedGR.verification.summary.high}
                  </span>
                </div>
                <div className="stat">
                  <span className="label">Medium:</span>
                  <span className="value">{generatedGR.verification.summary.medium}</span>
                </div>
              </div>
            </div>

            <div className="gr-preview">
              <h4>Generated Resolution Preview</h4>
              <div className="preview-content">
                {generatedGR.draft.sections.header && (
                  <div className="preview-section">
                    <strong>{generatedGR.draft.sections.header}</strong>
                  </div>
                )}
                {generatedGR.draft.sections.introduction && (
                  <div className="preview-section">
                    <p>{generatedGR.draft.sections.introduction.substring(0, 200)}...</p>
                  </div>
                )}
              </div>
              <button className="btn-expand" onClick={() => setShowFullDraft(true)}>View Full Draft</button>
            </div>

            <div className="form-actions">
              <button className="btn-back" onClick={() => setStep(3)}>
                ← Back
              </button>
              <button 
                className="btn-proceed"
                onClick={() => {
                  if (generatedGR && generatedGR.draft) {
                    navigate(`/draft/${generatedGR.draft.id}`);
                  }
                }}
              >
                Proceed to Workspace →
              </button>
            </div>
          </div>
        )}
      </div>

      {showFullDraft && generatedGR && (
        <div className="modal-overlay" onClick={() => setShowFullDraft(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Full Generated Government Resolution</h3>
              <button className="close-x" onClick={() => setShowFullDraft(false)}>×</button>
            </div>
            <div className="modal-body">
              {generatedGR.draft.sections.fullText || generatedGR.draft.sections.resolution}
            </div>
            <div className="modal-footer">
              <button className="btn-close" onClick={() => setShowFullDraft(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
