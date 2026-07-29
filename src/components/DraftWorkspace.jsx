import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import './DraftWorkspace.css';

export default function DraftWorkspace({ currentGR }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { grId } = useParams();
  const [gr, setGr] = useState(location.state?.gr || currentGR);
  const [alerts, setAlerts] = useState(location.state?.alerts || []);
  const [editingSection, setEditingSection] = useState(null);
  const [savedStatus, setSavedStatus] = useState('saved');
  const [resolvingAlertId, setResolvingAlertId] = useState(null);
  const [checksRun, setChecksRun] = useState(location.state?.checksRun || []);
  const [proposedChange, setProposedChange] = useState(null);
  const [selectedReferenceGR, setSelectedReferenceGR] = useState(null);
  const [selectedReferenceHighlightKeyword, setSelectedReferenceHighlightKeyword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingStep, setSubmittingStep] = useState(0);
  const [similarGrs, setSimilarGrs] = useState([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [loadingReference, setLoadingReference] = useState(false);

  // ============================================
  // MERGE CONFLICT AUDIT INTO ALERTS
  // ============================================
  const mergeConflictAudit = (grData, existingAlerts) => {
    const merged = [...existingAlerts];
    
    if (grData?.conflict_audit?.conflicted_grs) {
      const conflictAlerts = grData.conflict_audit.conflicted_grs.map((c, idx) => ({
        id: `conflict-${c.grNumber || c.sourceGrId || 'unknown'}-${idx}-${Date.now()}`,
        severity: c.severity ? c.severity.toLowerCase() : 'high',
        category: 'conflict',
        title: `🚨 ${c.severity || 'Policy'}: ${c.department || 'Unknown Department'}`,
        description: c.reason || c.conflict_details || 'Policy conflict detected',
        evidence: `Source: ${c.grNumber || 'Unknown'}`,
        remediationSuggestion: c.remediationSuggestion || `Review references or mandates in ${c.grNumber} and coordinate across departments if necessary.`,
        sourceGrId: c.grNumber || c.sourceGrId,
        sourceDepartment: c.department,
        linkUrl: c.linkUrl || `/api/gr/${encodeURIComponent(c.grNumber || '')}`,
        autoResolvable: false,
        conflictType: c.conflictType || 'policy',
        similarityScore: c.similarityScore || null
      }));
      
      // Merge without duplicates (by sourceGrId)
      const existingIds = new Set(merged.map(a => a.sourceGrId).filter(Boolean));
      const newAlerts = conflictAlerts.filter(c => !existingIds.has(c.sourceGrId));
      merged.push(...newAlerts);
      
      console.log('🔍 Merged Conflict Alerts:', conflictAlerts.length);
      console.log('🔍 New Alerts Added:', newAlerts.length);
    }
    
    return merged;
  };

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
    if (gr?.preloadedReferences && gr.preloadedReferences[grNumber]) {
      setSelectedReferenceGR(gr.preloadedReferences[grNumber]);
      return;
    }

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

  // ============================================
  // FETCH GR AND ALERTS - WITH CONFLICT MERGE
  // ============================================
  useEffect(() => {
    const fetchGRAndAlerts = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/gr/${grId}`);
        const grData = response.data.gr;
        const alertsData = response.data.alerts || [];
        const checksRunData = response.data.checksRun || [];
        
        setGr(grData);
        
        // Merge conflict_audit into alerts
        const mergedAlerts = mergeConflictAudit(grData, alertsData);
        setAlerts(mergedAlerts);
        setChecksRun(checksRunData);
        
        console.log('📊 Fetched GR:', grData.id);
        console.log('📊 Conflict Audit:', grData?.conflict_audit);
        console.log('📊 Total Alerts:', mergedAlerts.length);
        
      } catch (error) {
        console.error('Failed to fetch GR and alerts:', error);
      }
    };

    if (grId && !location.state?.gr) {
      fetchGRAndAlerts();
    }
  }, [grId, location.state]);

  // ============================================
  // REACTIVE INSTANT VERIFICATION
  // ============================================
  useEffect(() => {
    if (gr && savedStatus === 'unsaved') {
      const delayVerify = setTimeout(async () => {
        try {
          const response = await axios.post('http://localhost:5000/api/gr/verify-dryrun', gr);
          if (response.data) {
            const mergedAlerts = mergeConflictAudit(gr, response.data.alerts || []);
            setAlerts(mergedAlerts);
            setChecksRun(response.data.checksRun || []);
          }
        } catch (e) {
          console.error('Instant verification failed:', e);
        }
      }, 1000);

      return () => clearTimeout(delayVerify);
    }
  }, [gr, savedStatus]);

  // ============================================
  // REACTIVE AUTOSAVE
  // ============================================
  useEffect(() => {
    if (gr && savedStatus === 'unsaved') {
      const delayAutosave = setTimeout(async () => {
        setSavedStatus('saving');
        try {
          const response = await axios.post('http://localhost:5000/api/gr/save', gr);
          setSavedStatus('saved');
          
          // Merge verification alerts with conflict_audit
          const mergedAlerts = mergeConflictAudit(response.data.gr || gr, response.data.verification?.alerts || []);
          setAlerts(mergedAlerts);
          setChecksRun(response.data.verification?.checksRun || []);
          
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

  // ============================================
  // HANDLE SAVE - WITH CONFLICT MERGE
  // ============================================
  const handleSave = async () => {
    setSavedStatus('saving');
    try {
      const response = await axios.post(`http://localhost:5000/api/gr/save`, gr);
      setSavedStatus('saved');
      
      // Merge verification alerts with conflict_audit
      const mergedAlerts = mergeConflictAudit(response.data.gr || gr, response.data.verification?.alerts || []);
      setAlerts(mergedAlerts);
      setChecksRun(response.data.verification?.checksRun || []);
      
    } catch (error) {
      setSavedStatus('error');
      alert('Failed to save: ' + error.message);
    }
  };

  const renderHighlightedText = (text, keyword) => {
    if (!text) return 'N/A';
    if (!keyword) return text;
    
    const parts = text.split(new RegExp(`(${keyword})`, 'gi'));
    return (
      <>
        {parts.map((part, i) => 
          part.toLowerCase() === keyword.toLowerCase()
            ? <mark key={i} style={{ backgroundColor: '#fde047', color: '#0f172a', padding: '2px 4px', borderRadius: '3px', fontWeight: 'bold' }}>{part}</mark>
            : part
        )}
      </>
    );
  };

  const resolveAlert = (alertId, targetIdx) => {
    setAlerts(prev => prev.filter((a, idx) => (a.id ? a.id !== alertId : idx !== targetIdx)));
  };

  // ============================================
  // HANDLE SUBMIT
  // ============================================
  const handleSubmit = async () => {
    if (alerts.length > 0) {
      alert(`⚠️ Please resolve (Auto-Fix) or dismiss all ${alerts.length} alerts before submitting.`);
      return;
    }
    setSubmitting(true);
    setSubmittingStep(0);
    const interval = setInterval(() => {
      setSubmittingStep(prev => (prev < 4 ? prev + 1 : prev));
    }, 1200);

    try {
      const nextStatus = gr.rejectedBy === 'minister' ? 'pending_signature' : 'pending_approval';
      const updatedGr = { 
        ...gr, 
        status: nextStatus,
        rejectedBy: null
      };

      await new Promise(resolve => setTimeout(resolve, 5000));

      const response = await axios.post(`http://localhost:5000/api/gr/save`, updatedGr);
      clearInterval(interval);
      if (response.data.success) {
        alert(nextStatus === 'pending_signature' ? '🚀 GR submitted directly back to Minister!' : '🚀 GR submitted for review!');
        navigate('/');
      } else {
        alert('Failed to submit: ' + response.data.error);
        setSubmitting(false);
      }
    } catch (error) {
      clearInterval(interval);
      alert('Failed to submit: ' + error.message);
      setSubmitting(false);
    } finally {
      clearInterval(interval);
    }
  };

  const handleCancel = () => {
    navigate('/');
  };

  if (!gr) {
    return <div className="draft-workspace">Loading...</div>;
  }

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
        {originalContent || 'N/A'}
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
          <h2>{gr.metadata?.subject || 'Government Resolution'}</h2>
          <span className="status">{gr.department}</span>
          <span style={{ fontSize: '12px', background: '#F1F5F9', padding: '4px 8px', borderRadius: '4px', border: '1px solid #CBD5E1', marginLeft: '10px' }}>
            ID: <strong>{gr.calculated_21_digit_gr_id || gr.id}</strong>
          </span>
        </div>
        <div className="header-right" style={{ display: 'flex', gap: '10px' }}>
          <button 
            style={{
              background: '#046A38',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
            onClick={() => window.open(`http://localhost:5000/api/gr/${encodeURIComponent(gr.id)}/export/html`, '_blank')}
          >
            🖨️ Official Format & PDF Download
          </button>

          <button className={`save-btn ${savedStatus}`} onClick={handleSave}>
            {savedStatus === 'saved' && '✅ Saved'}
            {savedStatus === 'unsaved' && '💾 Save'}
            {savedStatus === 'saving' && '⏳ Saving...'}
            {savedStatus === 'error' && '❌ Error'}
          </button>
        </div>
      </div>

      {/* ============================================
          POLICY CONFLICT AUDIT WARNING BANNER
          ============================================ */}
      {alerts.length > 0 && (
        <div style={{
          background: alerts.some(a => a.severity === 'critical' || a.severity === 'CRITICAL') ? '#FEE2E2' : '#FEF3C7',
          border: `2px solid ${alerts.some(a => a.severity === 'critical' || a.severity === 'CRITICAL') ? '#DC2626' : '#D97706'}`,
          borderRadius: '8px',
          padding: '20px',
          marginBottom: '20px',
          color: alerts.some(a => a.severity === 'critical' || a.severity === 'CRITICAL') ? '#7F1D1D' : '#78350F'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '8px' }}>
            🚨 TASK A: POLICY & CONFLICT AUDITING ALERT ({alerts.filter(a => a.severity === 'critical' || a.severity === 'CRITICAL').length > 0 ? 'CRITICAL' : 'WARNING'})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {alerts.map((alert, idx) => {
              let highlightWord = '';
              const keywords = ['Krishi', 'Annapurna', 'Sukarmi', 'Saur', 'Solar', 'Yuva', 'Karya', 'Food Processing', 'Cooperative', 'Dhananjayrao', 'Nodal'];
              const found = keywords.find(k => (alert.description || '').toLowerCase().includes(k.toLowerCase()) || (alert.title || '').toLowerCase().includes(k.toLowerCase()));
              if (found) {
                highlightWord = found;
              }

              // Determine if this is a conflict from the audit
              const isConflict = alert.category === 'conflict';

              return (
                <div key={idx} style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: isConflict ? '2px solid #DC2626' : '1px solid rgba(0, 0, 0, 0.05)',
                  borderRadius: '6px',
                  padding: '14px 18px',
                  fontSize: '13.5px',
                  lineHeight: '1.6',
                  color: '#1e293b',
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontWeight: '800', fontSize: '14.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isConflict ? '🚨' : '📌'} {alert.title || alert.category || 'Policy Conflict'}
                      {isConflict && <span style={{ fontSize: '10px', background: '#DC2626', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>CONFLICT</span>}
                    </div>
                    <span style={{ 
                      fontSize: '10px', 
                      fontWeight: 'bold', 
                      textTransform: 'uppercase', 
                      padding: '2px 6px', 
                      borderRadius: '3px',
                      color: 'white',
                      backgroundColor: (alert.severity === 'critical' || alert.severity === 'CRITICAL') ? '#d32f2f' : 
                                     (alert.severity === 'high' || alert.severity === 'HIGH') ? '#f57c00' : 
                                     (alert.severity === 'medium' || alert.severity === 'MEDIUM') ? '#f59e0b' : '#64748b'
                    }}>
                      {alert.severity || 'WARNING'}
                    </span>
                  </div>
                  <div style={{ marginBottom: '8px' }}>
                    <strong>Why it occurred:</strong> {alert.description}
                  </div>
                  {alert.evidence && (
                    <div style={{ fontSize: '12.5px', color: '#475569', background: 'rgba(0, 0, 0, 0.03)', padding: '6px 10px', borderRadius: '4px', marginBottom: '8px' }}>
                      <strong>Evidence:</strong> {alert.evidence}
                    </div>
                  )}
                  {alert.remediationSuggestion && (
                    <div style={{ color: '#0284c7', fontWeight: '600', display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '14px' }}>💡</span>
                      <span><strong>Steps to resolve:</strong> {alert.remediationSuggestion}</span>
                    </div>
                  )}
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '8px' }}>
                    <div>
                      {alert.sourceGrId && (
                        <button 
                          className="btn-view-reference" 
                          onClick={() => {
                            setSelectedReferenceHighlightKeyword(highlightWord);
                            handleViewReferenceText(alert.sourceGrId);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0284c7',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(2, 132, 199, 0.1)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          🔗 View Conflicting GR ({alert.sourceGrId})
                        </button>
                      )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {alert.autoResolvable && (
                        <button 
                          onClick={() => handleAutoResolve(alert)}
                          disabled={resolvingAlertId === alert.id}
                          style={{
                            backgroundColor: '#ff9933',
                            color: 'white',
                            border: 'none',
                            padding: '5px 10px',
                            borderRadius: '4px',
                            fontWeight: '600',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          {resolvingAlertId === alert.id ? '⏳ Resolving...' : '🔧 Auto-Fix'}
                        </button>
                      )}
                      <button 
                        onClick={() => resolveAlert(alert.id, idx)}
                        style={{
                          backgroundColor: '#e2e8f0',
                          color: '#334155',
                          border: 'none',
                          padding: '5px 10px',
                          borderRadius: '4px',
                          fontWeight: '600',
                          fontSize: '12px',
                          cursor: 'pointer'
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

          {/* Similar Resolutions */}
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
          {gr.gr_type === '1_FINANCIAL_SANCTION' && gr.sections.financials && gr.sections.financials.length > 0 && (
            <div className="section-card">
              <div className="section-header">
                <h4>Financial Details (वित्तीय तपशील)</h4>
              </div>
              <table className="financial-table">
                <tbody>
                  {gr.sections.financials.map((fin, idx) => (
                    <tr key={idx}>
                      <td>{fin.description?.substring(0, 40) || 'Budget Head Allocation'}</td>
                      <td className="amount">₹{fin.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Policy / Scheme Details Section */}
          {gr.gr_type === '2_POLICY_SCHEME' && gr.inputPayload && (
            <div className="section-card" style={{ padding: '16px 20px' }}>
              <div className="section-header" style={{ marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1a3a52' }}>Scheme & Policy Parameters (योजना व धोरण तपशील)</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#1e293b', textAlign: 'left' }}>
                <div><strong>Scheme Name:</strong> {gr.inputPayload.scheme_name || 'N/A'}</div>
                <div><strong>Eligibility Criteria:</strong> {gr.inputPayload.eligibility_criteria || 'N/A'}</div>
                <div><strong>Committee Chairman:</strong> {gr.inputPayload.committee_chairman || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* HR / Establishment Details Section */}
          {gr.gr_type === '3_HR_ESTABLISHMENT' && gr.inputPayload && (
            <div className="section-card" style={{ padding: '16px 20px' }}>
              <div className="section-header" style={{ marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1a3a52' }}>HR & Placement Details (आस्थापना व पदस्थापना तपशील)</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#1e293b', textAlign: 'left' }}>
                <div><strong>Appointed Officer(s):</strong> {gr.inputPayload.employee_names_and_cadres || 'N/A'}</div>
                <div><strong>Current Posting:</strong> {gr.inputPayload.current_posting || 'N/A'}</div>
                <div><strong>New Posting / Assignment:</strong> {gr.inputPayload.new_posting || 'N/A'}</div>
                <div><strong>Effective Date:</strong> {gr.inputPayload.effective_date || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Statutory Notification Details Section */}
          {gr.gr_type === '4_STATUTORY_NOTIFICATION' && gr.inputPayload && (
            <div className="section-card" style={{ padding: '16px 20px' }}>
              <div className="section-header" style={{ marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1a3a52' }}>Statutory Scope (वैधानिक कार्यक्षेत्र तपशील)</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#1e293b', textAlign: 'left' }}>
                <div><strong>Parent Act Invoked:</strong> {gr.inputPayload.parent_act_invoked || 'N/A'}</div>
                <div><strong>Geographic Scope:</strong> {gr.inputPayload.geographic_scope || 'N/A'}</div>
                <div><strong>Exempted Entities:</strong> {gr.inputPayload.exempted_entities || 'N/A'}</div>
              </div>
            </div>
          )}

          {/* Corrigendum Details Section */}
          {gr.gr_type === '5_CORRIGENDUM' && gr.inputPayload && (
            <div className="section-card" style={{ padding: '16px 20px' }}>
              <div className="section-header" style={{ marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#1a3a52' }}>Corrigendum Corrections (शुद्धीपत्रक सुधारणा)</h4>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13.5px', color: '#1e293b', textAlign: 'left' }}>
                <div><strong>Original GR Identification:</strong> {gr.inputPayload.original_gr_id || 'N/A'}</div>
                <div><strong>Incorrect Text Reference:</strong> <span style={{ color: '#d32f2f', textDecoration: 'line-through' }}>{gr.inputPayload.incorrect_text_reference}</span></div>
                <div><strong>Corrected Text Placement:</strong> <span style={{ color: '#27ae60', fontWeight: 'bold' }}>{gr.inputPayload.corrected_text_placement}</span></div>
              </div>
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
        </div>
      </div>

      <div className="workspace-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          {alerts.length > 0 && (
            <span style={{ color: '#d97706', fontSize: '13px', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#fef3c7', padding: '6px 12px', borderRadius: '4px', border: '1px solid #f59e0b' }}>
              ⚠️ Resolve (Auto-Fix) or Dismiss all alerts ({alerts.length}) before submitting
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-cancel" onClick={handleCancel}>Cancel</button>
          <button 
            className="btn-submit" 
            onClick={handleSubmit}
            disabled={alerts.length > 0 || submitting}
            style={{
              opacity: (alerts.length > 0 || submitting) ? 0.6 : 1,
              cursor: (alerts.length > 0 || submitting) ? 'not-allowed' : 'pointer'
            }}
          >
            Submit for Review
          </button>
        </div>
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

                {/* Introduction */}
                {selectedReferenceGR.sections?.introduction && (
                  <div style={{ marginBottom: '20px' }}>
                    <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>
                      Introduction (प्रस्तावना)
                    </h5>
                    <p style={{ fontSize: '13.5px', textIndent: '30px', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                      {renderHighlightedText(selectedReferenceGR.sections.introduction, selectedReferenceHighlightKeyword)}
                    </p>
                  </div>
                )}

                {/* References */}
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

                {/* Resolution */}
                <div style={{ marginBottom: '20px' }}>
                  <h5 style={{ fontSize: '14px', fontWeight: 'bold', borderBottom: '1px solid #cbd5e1', paddingBottom: '3px', textTransform: 'uppercase', margin: '15px 0 8px 0', color: '#0f172a' }}>
                    Resolution (शासन निर्णय)
                  </h5>
                  {selectedReferenceGR.sections?.resolutions && selectedReferenceGR.sections.resolutions.length > 0 ? (
                    selectedReferenceGR.sections.resolutions.map((clause, idx) => (
                      <p key={idx} style={{ fontSize: '13.5px', textIndent: '30px', margin: '0 0 10px 0', textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                        {clause.index || idx + 1}. {renderHighlightedText(clause.text, selectedReferenceHighlightKeyword)}
                      </p>
                    ))
                  ) : (
                    <p style={{ fontSize: '13.5px', textIndent: '30px', margin: 0, textAlign: 'justify', whiteSpace: 'pre-wrap' }}>
                      {renderHighlightedText(selectedReferenceGR.sections?.resolution || 'The government hereby resolves to approve the proposals.', selectedReferenceHighlightKeyword)}
                    </p>
                  )}
                </div>

                {/* Financials */}
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

                {/* Distribution */}
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
          background: 'rgba(15, 23, 42, 0.95)',
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
            {/* Saffron-Green Tricolor Spinner */}
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
              शासन निर्णय सादर करत आहे...
            </h3>
            <h4 style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 25px 0', color: '#D4AF37' }}>
              Submitting Resolution and Dispatching to Mantralaya...
            </h4>

            {/* Stepped Progress Checklist */}
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
                { step: 0, label: "Securing draft with 21-Digit check digit algorithm...", mr: "२१-अंकी संकेतांक सुरक्षा अल्गोरिदम लागू करत आहे..." },
                { step: 1, label: "Generating digital integrity checksum verification hash...", mr: "डिजिटल अखंडता पडताळणी हॅश तयार करत आहे..." },
                { step: 2, label: "Updating Departmental workflow & archive databases...", mr: "विभागीय कार्यप्रवाह आणि संग्रहण डेटाबेस अद्ययावत करत आहे..." },
                { step: 3, label: "Dispatching copies to Finance, Law and Mantralaya desks...", mr: "वित्त, विधी आणि मंत्रालय वितरण कक्षांकडे प्रती पाठवत आहे..." },
                { step: 4, label: "Finalizing sign-off and publishing to E-Gazette queue...", mr: "स्वाक्षरी मसुदा अंतिम करत आहे आणि ई-राजपत्र रांगेत पाठवत आहे..." }
              ].map((item, idx) => {
                const isPassed = submittingStep > item.step;
                const isCurrent = submittingStep === item.step;
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
              Updating official departmental queues. Please do not close this window.
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