import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import './DraftWorkspace.css';

export default function DraftWorkspace({ currentGR, user }) {
  const navigate = useNavigate();
  const { grId } = useParams();
  const [gr, setGr] = useState(currentGR);
  const [alerts, setAlerts] = useState([]);
  const [editingSection, setEditingSection] = useState(null);
  const [savedStatus, setSavedStatus] = useState('saved');
  const [resolvingAlertId, setResolvingAlertId] = useState(null);
  const [checksRun, setChecksRun] = useState([]);
  const [proposedChange, setProposedChange] = useState(null);
  const [selectedReferenceGR, setSelectedReferenceGR] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [similarGrs, setSimilarGrs] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [loadingReference, setLoadingReference] = useState(false);

  useEffect(() => {
    const fetchSimilar = async () => {
      setLoadingSimilar(true);
      try {
        const response = await axios.post('http://localhost:5000/api/similar-grs', gr);
        setSimilarGrs(response.data.similar || []);
      } catch (e) {
        console.error('Failed to fetch similar GRs:', e);
      } finally {
        setLoadingSimilar(false);
      }
    };

    if (gr && gr.metadata?.subject) {
      fetchSimilar();
    }
  }, [gr]);

  const handleViewReferenceText = async (grNumber) => {
    setLoadingReference(true);
    try {
      const response = await axios.get(`http://localhost:5000/api/gr/${encodeURIComponent(grNumber)}`);
      if (response.data && response.data.gr) {
        setSelectedReferenceGR(response.data.gr);
      } else {
        alert('Could not locate referenced resolution text.');
      }
    } catch (e) {
      alert('Error loading referenced resolution: ' + e.message);
    } finally {
      setLoadingReference(false);
    }
  };

  const getLineDiff = (originalText, updatedText) => {
    const originalLines = (originalText || '').split('\n');
    const updatedLines = (updatedText || '').split('\n');
    
    const diff = [];
    const maxLines = Math.max(originalLines.length, updatedLines.length);
    
    for (let i = 0; i < maxLines; i++) {
      const orig = originalLines[i];
      const upd = updatedLines[i];
      
      if (orig === upd) {
        if (orig !== undefined) diff.push({ type: 'unchanged', text: orig });
      } else {
        if (orig !== undefined) diff.push({ type: 'removed', text: orig });
        if (upd !== undefined) diff.push({ type: 'added', text: upd });
      }
    }
    return diff;
  };

  const handleAutoResolve = async (alertObj) => {
    setResolvingAlertId(alertObj.id);
    try {
      const response = await axios.post('http://localhost:5000/api/gr/auto-resolve', {
        gr,
        alert: alertObj
      });
      if (response.data.success) {
        setProposedChange({
          alertId: alertObj.id,
          originalGr: gr,
          updatedGr: response.data.gr,
          verification: response.data.verification
        });
      } else {
        alert('Failed to auto-resolve alert: ' + response.data.error);
      }
    } catch (err) {
      alert('Error auto-resolving: ' + err.message);
    } finally {
      setResolvingAlertId(null);
    }
  };

  useEffect(() => {
    const fetchGRAndAlerts = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/gr/${grId}`);
        setGr(response.data.gr);
        setAlerts(response.data.alerts || []);
        setChecksRun(response.data.checksRun || []);
      } catch (error) {
        console.error('Failed to fetch GR and alerts:', error);
      }
    };

    if (grId) {
      fetchGRAndAlerts();
    }
  }, [grId]);

  // Reactive Instant Verification (1-second debounce)
  useEffect(() => {
    if (gr && savedStatus === 'unsaved') {
      const delayVerify = setTimeout(async () => {
        try {
          const response = await axios.post('http://localhost:5000/api/gr/verify-dryrun', gr);
          if (response.data) {
            setAlerts(response.data.alerts || []);
            setChecksRun(response.data.checksRun || []);
          }
        } catch (e) {
          console.error('Instant verification failed:', e);
        }
      }, 1000);

      return () => clearTimeout(delayVerify);
    }
  }, [gr, savedStatus]);

  // Reactive Autosave (3-second debounce)
  useEffect(() => {
    if (gr && savedStatus === 'unsaved') {
      const delayAutosave = setTimeout(async () => {
        setSavedStatus('saving');
        try {
          const response = await axios.post('http://localhost:5000/api/gr/save', gr);
          setSavedStatus('saved');
          if (response.data.verification) {
            setAlerts(response.data.verification.alerts || []);
            setChecksRun(response.data.verification.checksRun || []);
          }
        } catch (error) {
          setSavedStatus('error');
          console.error('Autosave failed:', error);
        }
      }, 3000);

      return () => clearTimeout(delayAutosave);
    }
  }, [gr, savedStatus]);

  const handleSectionEdit = (section, content) => {
    setSavedStatus('unsaved');
    setGr(prev => ({
      ...prev,
      sections: {
        ...prev.sections,
        [section]: content,
      },
    }));
  };

  const handleSave = async () => {
    setSavedStatus('saving');
    try {
      const response = await axios.post(`http://localhost:5000/api/gr/save`, gr);
      setSavedStatus('saved');
      if (response.data.verification) {
        setAlerts(response.data.verification.alerts || []);
        setChecksRun(response.data.verification.checksRun || []);
      }
    } catch (error) {
      setSavedStatus('error');
      alert('Failed to save: ' + error.message);
    }
  };

  const resolveAlert = (alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const nextStatus = gr.rejectedBy === 'minister' ? 'pending_signature' : 'pending_approval';
      const updatedGr = { 
        ...gr, 
        status: nextStatus,
        rejectedBy: null // Clear once re-submitted
      };
      const response = await axios.post(`http://localhost:5000/api/gr/save`, updatedGr);
      if (response.data.success) {
        alert(nextStatus === 'pending_signature' ? '🚀 GR submitted directly back to Minister!' : '🚀 GR submitted for review!');
        navigate('/');
      } else {
        alert('Failed to submit: ' + response.data.error);
        setSubmitting(false);
      }
    } catch (error) {
      alert('Failed to submit: ' + error.message);
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (!gr) {
    return <div className="draft-workspace">Loading...</div>;
  }

  const severityColors = {
    critical: '#d32f2f',
    high: '#f57c00',
    medium: '#f39c12',
    low: '#388e3c',
  };

  const alertCount = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    high: alerts.filter(a => a.severity === 'high').length,
    medium: alerts.filter(a => a.severity === 'medium').length,
    low: alerts.filter(a => a.severity === 'low').length,
  };

  const renderSectionContent = (sectionKey, originalContent) => {
    const hasStagedChange = proposedChange && proposedChange.updatedGr?.sections?.[sectionKey] !== gr.sections?.[sectionKey];

    if (hasStagedChange) {
      const orig = gr.sections[sectionKey] || '';
      const upd = proposedChange.updatedGr.sections[sectionKey] || '';
      const diff = getLineDiff(orig, upd);

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            background: '#0f172a',
            color: '#f8fafc',
            padding: '12px 16px',
            borderRadius: '6px',
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '12px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
            textAlign: 'left'
          }}>
            {diff.map((line, lIdx) => (
              <div key={lIdx} style={{
                backgroundColor: line.type === 'added' ? 'rgba(46, 125, 50, 0.25)' : line.type === 'removed' ? 'rgba(198, 40, 40, 0.25)' : 'transparent',
                color: line.type === 'added' ? '#4ade80' : line.type === 'removed' ? '#f87171' : '#cbd5e1',
                padding: '2px 8px',
                borderLeft: line.type === 'added' ? '3px solid #2e7d32' : line.type === 'removed' ? '3px solid #c62828' : 'none'
              }}>
                {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                {line.text}
              </div>
            ))}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#fff3e0',
            border: '1px solid #ffe0b2',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px'
          }}>
            <span style={{ color: '#e65100', fontWeight: 'bold' }}>🤖 AI Suggestion</span>
            <button style={{
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '11px'
            }} onClick={() => {
              setGr(proposedChange.updatedGr);
              setAlerts(proposedChange.verification?.alerts || []);
              setChecksRun(proposedChange.verification?.checksRun || []);
              setSavedStatus('unsaved');
              setProposedChange(null);
            }}>Accept ✓</button>
            <button style={{
              backgroundColor: '#64748b',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '11px'
            }} onClick={() => {
              setProposedChange(null);
            }}>Reject</button>
          </div>
        </div>
      );
    }

    if (editingSection === sectionKey) {
      return (
        <textarea
          className="section-editor"
          value={originalContent || ''}
          onChange={(e) => handleSectionEdit(sectionKey, e.target.value)}
        />
      );
    }

    return (
      <div className="section-preview">
        {sectionKey === 'header' || sectionKey === 'resolution'
          ? (originalContent || 'N/A')
          : (originalContent?.substring(0, 200) || 'N/A') + (originalContent?.length > 200 ? '...' : '')}
      </div>
    );
  };

  return (
    <div className="draft-workspace" style={{ paddingTop: '20px', position: 'relative' }}>
      <div className="tricolor-accent" style={{ display: 'flex', height: '6px', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 10 }}>
        <div style={{ flex: 1, backgroundColor: '#FF9933' }}></div>
        <div style={{ flex: 1, backgroundColor: '#FFFFFF' }}></div>
        <div style={{ flex: 1, backgroundColor: '#138808' }}></div>
      </div>

      <div className="workspace-header">
        <div className="header-left">
          <h2>{gr.metadata?.subject || 'New GR'}</h2>
          <span className="status">{gr.department}</span>
        </div>
        <div className="header-right">
          <button className={`save-btn ${savedStatus}`} onClick={handleSave}>
            {savedStatus === 'saved' && '✅ Saved'}
            {savedStatus === 'unsaved' && '💾 Save'}
            {savedStatus === 'saving' && '⏳ Saving...'}
            {savedStatus === 'error' && '❌ Error'}
          </button>
        </div>
      </div>

      <div className="workspace-container">
        {/* Left: Draft Editor */}
        <div className="draft-pane">
          <div className="pane-title">
            <h3>📝 Draft Sections (मसुदा विभाग)</h3>
          </div>

          {/* Header Section */}
          <div className="section-card">
            <div className="section-header">
              <h4>Header (शीर्षक)</h4>
              <button className="edit-btn" onClick={() => setEditingSection(editingSection === 'header' ? null : 'header')}>
                {editingSection === 'header' ? '✓' : '✎'}
              </button>
            </div>
            {renderSectionContent('header', gr.sections.header)}
          </div>

          {/* Introduction Section */}
          <div className="section-card">
            <div className="section-header">
              <h4>Introduction (प्रस्तावना)</h4>
              <button className="edit-btn" onClick={() => setEditingSection(editingSection === 'introduction' ? null : 'introduction')}>
                {editingSection === 'introduction' ? '✓' : '✎'}
              </button>
            </div>
            {renderSectionContent('introduction', gr.sections.introduction)}
          </div>

          {/* References Section */}
          <div className="section-card">
            <div className="section-header">
              <h4>References (संदर्भ)</h4>
              <span className="count">{gr.sections.references?.length || 0}</span>
            </div>
            <div className="references-list">
              {gr.sections.references?.map((ref, idx) => (
                <div key={idx} className="ref-item">
                  <a 
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleViewReferenceText(ref.grNumber);
                    }}
                    className="ref-link"
                    style={{
                      color: '#ff9933',
                      textDecoration: 'none',
                      fontWeight: '600'
                    }}
                  >
                    🔗 GR {ref.grNumber}
                  </a>
                  {ref.date && <span className="ref-date">{ref.date}</span>}
                </div>
              )) || <p>No references</p>}
            </div>
          </div>

          {/* Similar Resolutions (Historical context library) */}
          <div className="section-card">
            <div className="section-header">
              <h4>📚 Similar Resolutions (शासन निर्णय लायब्ररी)</h4>
              <span className="count">{similarGrs?.length || 0}</span>
            </div>
            <div className="references-list" style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {loadingSimilar ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', color: '#64748b', fontSize: '12px' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(26, 58, 82, 0.2)',
                    borderTop: '2px solid #ff9933',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></div>
                  <span>Loading similar resolutions... (लायब्ररी शोधत आहे...)</span>
                </div>
              ) : similarGrs && similarGrs.length > 0 ? (
                similarGrs.map((sim, idx) => (
                  <div key={idx} className="ref-item" style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <a 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handleViewReferenceText(sim.metadata?.grNumber || sim.id);
                      }}
                      className="ref-link"
                      style={{
                        color: '#ff9933',
                        textDecoration: 'none',
                        fontWeight: '600',
                        fontSize: '12px'
                      }}
                    >
                      🔗 GR {sim.metadata?.grNumber || sim.id}
                    </a>
                    <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {sim.metadata?.subject}
                    </span>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: '12px', color: '#64748b' }}>No similar resolutions found.</p>
              )}
            </div>
          </div>

          {/* Resolution Section */}
          <div className="section-card">
            <div className="section-header">
              <h4>Resolution (शासन निर्णय)</h4>
              <button className="edit-btn" onClick={() => setEditingSection(editingSection === 'resolution' ? null : 'resolution')}>
                {editingSection === 'resolution' ? '✓' : '✎'}
              </button>
            </div>
            {renderSectionContent('resolution', gr.sections.resolution)}
          </div>

          {/* Financials Section */}
          {gr.sections.financials && gr.sections.financials.length > 0 && (
            <div className="section-card">
              <div className="section-header">
                <h4>Financial Details (वित्तीय तपशील)</h4>
              </div>
              <table className="financial-table">
                <tbody>
                  {gr.sections.financials.map((fin, idx) => (
                    <tr key={idx}>
                      <td>{fin.description?.substring(0, 40)}</td>
                      <td className="amount">₹{fin.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Alerts Panel */}
        <div className="alerts-pane">
          {/* Trust Verification Checklist */}
          {checksRun && checksRun.length > 0 && (
            <div className="verification-checklist-card" style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              textAlign: 'left'
            }}>
              <h4 style={{ fontSize: '13px', color: '#1a3a52', margin: '0 0 12px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🛡️ Trust Verification Checklist (विश्वासार्हता पडताळणी)
              </h4>
              <div className="checklist-items" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {checksRun.map((check, idx) => (
                  <div key={idx} className="checklist-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px' }}>
                    <span className="check-icon" style={{
                      color: check.passed ? '#27ae60' : '#d32f2f',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      lineHeight: '1',
                      marginTop: '2px'
                    }}>
                      {check.passed ? '✓' : '✗'}
                    </span>
                    <div className="check-details">
                      <strong style={{ color: '#0f172a' }}>{check.name}</strong>
                      <span style={{ display: 'block', color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{check.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pane-title">
            <h3>⚠️ Verification Alerts (पडताळणी इशारे)</h3>
          </div>

          <div className="alerts-summary">
            <div className="alert-badge critical">{alertCount.critical} Critical</div>
            <div className="alert-badge high">{alertCount.high} High</div>
            <div className="alert-badge medium">{alertCount.medium} Medium</div>
            <div className="alert-badge low">{alertCount.low} Low</div>
          </div>

          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">
                <span className="icon">✅</span>
                <p>All checks passed! (सर्व पडताळणी यशस्वी!)</p>
              </div>
            ) : (
              alerts.map((alert, idx) => (
                <div key={idx} className={`alert-card ${alert.severity}`}>
                  <div className="alert-header">
                    <span className="severity-badge" style={{ backgroundColor: severityColors[alert.severity] }}>
                      {alert.severity.toUpperCase()}
                    </span>
                    <span className="category">{alert.category}</span>
                  </div>
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-description">{alert.description}</div>
                  {alert.evidence && (
                    <div className="alert-evidence">
                      <strong>Evidence:</strong> {alert.evidence}
                    </div>
                  )}
                  {alert.remediationSuggestion && (
                    <div className="alert-suggestion">
                      💡 {alert.remediationSuggestion}
                    </div>
                  )}
                  <div className="alert-actions" style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                    <button 
                      className="auto-resolve-btn" 
                      onClick={() => handleAutoResolve(alert)}
                      disabled={resolvingAlertId === alert.id}
                      style={{
                        backgroundColor: '#ff9933',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontWeight: '600',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {resolvingAlertId === alert.id ? '⏳ Resolving...' : '✨ Auto Resolve'}
                    </button>
                    <button className="resolve-btn" onClick={() => resolveAlert(alert.id)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="workspace-footer">
        <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
        <button className="btn-submit" onClick={handleSubmit}>Submit for Review</button>
      </div>


      {/* Referenced GR Document Viewer Modal */}
      {selectedReferenceGR && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
          backdropFilter: 'blur(4px)'
        }} onClick={() => setSelectedReferenceGR(null)}>
          <div className="modal-content" style={{
            background: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '800px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
            textAlign: 'left'
          }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{
              padding: '16px 24px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#1a3a52', fontWeight: '700' }}>
                🔗 Referenced Resolution: {selectedReferenceGR.metadata?.grNumber || selectedReferenceGR.id}
              </h3>
              <button className="close-x" style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#64748b' }} onClick={() => setSelectedReferenceGR(null)}>×</button>
            </div>
            <div className="modal-body" style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#f8fafc' }}>
              <div style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '30px',
                fontFamily: 'Georgia, serif',
                lineHeight: '1.6',
                color: '#1e293b',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
              }}>
                {/* Government Head */}
                <div style={{ textAlign: 'center', borderBottom: '2px double #475569', paddingBottom: '15px', marginBottom: '20px' }}>
                  <div style={{ fontSize: '32px', marginBottom: '5px' }}>🏛️</div>
                  <h2 style={{ fontSize: '18px', fontWeight: 'bold', textTransform: 'uppercase', margin: '4px 0', color: '#0f172a' }}>Government of Maharashtra</h2>
                  <h3 style={{ fontSize: '15px', fontWeight: '500', margin: '2px 0', color: '#334155' }}>Department of {selectedReferenceGR.department || 'Administration'}</h3>
                  <h4 style={{ fontSize: '13px', fontWeight: 'normal', margin: '2px 0', color: '#64748b' }}>Mantralaya, Mumbai - 400032</h4>
                </div>

                {/* Metadata details */}
                <table style={{ width: '100%', marginBottom: '20px', fontSize: '13px', borderCollapse: 'collapse' }}>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '120px', padding: '4px 0' }}>Resolution No:</td>
                      <td style={{ padding: '4px 0' }}><strong>{selectedReferenceGR.metadata?.grNumber || selectedReferenceGR.id}</strong></td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Date:</td>
                      <td style={{ padding: '4px 0' }}>{selectedReferenceGR.metadata?.date || 'N/A'}</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', padding: '4px 0' }}>Subject:</td>
                      <td style={{ padding: '4px 0' }}><strong>{selectedReferenceGR.metadata?.subject}</strong></td>
                    </tr>
                  </tbody>
                </table>

                {/* Introduction (प्रस्तावना) */}
                {selectedReferenceGR.sections?.introduction && (
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>
                      Introduction (प्रस्तावना)
                    </h5>
                    <p style={{ fontSize: '13.5px', textIndent: '30px', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                      {selectedReferenceGR.sections.introduction}
                    </p>
                  </div>
                )}

                {/* References (संदर्भ) */}
                {selectedReferenceGR.sections?.references && selectedReferenceGR.sections.references.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>
                      References (संदर्भ)
                    </h5>
                    <ol style={{ fontSize: '13px', paddingLeft: '20px', margin: 0 }}>
                      {selectedReferenceGR.sections.references.map((ref, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>
                          GR No. <strong>{ref.grNumber}</strong> {ref.date ? `dated ${ref.date}` : ''} {ref.subject ? `- ${ref.subject}` : ''}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* Resolution (शासन निर्णय) */}
                <div style={{ marginBottom: '20px' }}>
                  <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>
                    Resolution (शासन निर्णय)
                  </h5>
                  {selectedReferenceGR.sections?.resolutions && selectedReferenceGR.sections.resolutions.length > 0 ? (
                    selectedReferenceGR.sections.resolutions.map((clause, idx) => (
                      <p key={idx} style={{ fontSize: '13.5px', textIndent: '30px', margin: '0 0 10px 0', textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                        {clause.index || idx + 1}. {clause.text}
                      </p>
                    ))
                  ) : (
                    <p style={{ fontSize: '13.5px', textIndent: '30px', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                      {selectedReferenceGR.sections?.resolution || 'The government hereby resolves to approve the proposals.'}
                    </p>
                  )}
                </div>

                {/* Financials (वित्तीय तपशील) */}
                {selectedReferenceGR.sections?.financials && selectedReferenceGR.sections.financials.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>
                      Financial Details (वित्तीय तपशील)
                    </h5>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', margin: '10px 0' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f1f5f9' }}>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', textAlign: 'left' }}>Description</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', textAlign: 'left' }}>Account Head</th>
                          <th style={{ border: '1px solid #cbd5e1', padding: '6px 10px', textAlign: 'right' }}>Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedReferenceGR.sections.financials.map((fin, idx) => (
                          <tr key={idx}>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px' }}>{fin.description || 'Budget Allocation'}</td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px' }}><code>{fin.accountHead || 'N/A'}</code></td>
                            <td style={{ border: '1px solid #cbd5e1', padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                              {fin.amount ? fin.amount.toLocaleString('en-IN') : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Distribution (वितरण) */}
                {selectedReferenceGR.sections?.distribution && selectedReferenceGR.sections.distribution.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>
                      Distribution (वितरण)
                    </h5>
                    <ol style={{ fontSize: '13px', paddingLeft: '20px', margin: 0 }}>
                      {selectedReferenceGR.sections.distribution.map((dist, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{dist.recipient}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn-close" style={{ backgroundColor: '#ff9933' }} onClick={() => setSelectedReferenceGR(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Submitting Overlay */}
      {submitting && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(6px)',
          color: 'white'
        }}>
          <div className="submitting-spinner-box" style={{ textAlign: 'center' }}>
            <div className="spinner" style={{
              width: '60px',
              height: '60px',
              border: '6px solid rgba(255, 255, 255, 0.2)',
              borderTop: '6px solid #ff9933',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginBottom: '20px',
              display: 'inline-block'
            }}></div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '20px', fontWeight: '700', letterSpacing: '0.5px' }}>
              Submitting Resolution
            </h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
              Publishing documents and updating official queues...
            </p>
          </div>
        </div>
      )}

      {/* Loading Reference Document Spinner Overlay */}
      {loadingReference && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(2px)',
          color: 'white'
        }}>
          <div style={{
            background: 'white',
            padding: '20px 30px',
            borderRadius: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#1a3a52'
          }}>
            <div style={{
              width: '24px',
              height: '24px',
              border: '3px solid rgba(26, 58, 82, 0.2)',
              borderTop: '2px solid #ff9933',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <strong style={{ fontSize: '14px' }}>Loading Resolution Document...</strong>
          </div>
        </div>
      )}
    </div>
  );
}
