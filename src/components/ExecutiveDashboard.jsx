import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './ExecutiveDashboard.css';

export default function ExecutiveDashboard({ user }) {
  const { grId } = useParams();
  const [grs, setGrs] = useState([]);
  const [selectedGR, setSelectedGR] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectActionType, setRejectActionType] = useState('request_changes');

  useEffect(() => {
    const fetchGRs = async () => {
      try {
        const status = user.role === 'minister' ? 'pending_signature' : 'pending_approval';
        const response = await axios.get(`http://localhost:5000/api/grs?status=${status}`);
        setGrs(response.data.grs);
        
        if (grId && grId !== 'pending' && response.data.grs.length > 0) {
          const match = response.data.grs.find(g => g.id === grId);
          if (match) setSelectedGR(match);
        }
      } catch (error) {
        console.error('Failed to fetch GRs:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGRs();
  }, [user, grId]);

  const handleApprove = async (grId) => {
    try {
      const nextStatus = user.role === 'minister' ? 'approved' : 'pending_signature';
      await axios.post(`http://localhost:5000/api/gr/${grId}/approve`, {
        userId: user.id,
        status: nextStatus,
      });
      setGrs(prev => prev.filter(gr => gr.id !== grId));
      setSelectedGR(null);
      alert(user.role === 'minister' ? '✅ GR approved and signed off!' : '✅ GR approved and forwarded to Minister!');
    } catch (error) {
      alert('Error approving GR: ' + error.message);
    }
  };

  const handleReject = async (grId, reason, actionType = 'request_changes') => {
    try {
      await axios.post(`http://localhost:5000/api/gr/${grId}/reject`, {
        userId: user.id,
        role: user.role,
        reason,
        actionType
      });
      setGrs(prev => prev.filter(gr => gr.id !== grId));
      setSelectedGR(null);
      setShowRejectModal(false);
      setRejectReason('');
      if (actionType === 'reject') {
        alert('❌ GR permanently rejected.');
      } else {
        alert('📝 Revision comments sent back to Desk Officer.');
      }
    } catch (error) {
      alert('Error rejecting GR: ' + error.message);
    }
  };

  // ============================================
  // HELPER: Get all conflicts from conflict_audit
  // ============================================
  const getConflictAlerts = (gr) => {
    if (!gr?.conflict_audit?.conflicted_grs) return [];
    return gr.conflict_audit.conflicted_grs.map(c => ({
      severity: c.severity?.toLowerCase() || 'high',
      title: `🚨 ${c.severity || 'Policy'}: ${c.department || 'Unknown'}`,
      description: c.reason || c.conflict_details || 'Policy conflict detected',
      sourceGrId: c.grNumber || c.sourceGrId,
      linkUrl: c.linkUrl || `/api/gr/${encodeURIComponent(c.grNumber || '')}`
    }));
  };

  // ============================================
  // HELPER: Get all alerts (verification + conflict)
  // ============================================
  const getAllAlerts = (gr) => {
    const verificationAlerts = gr?.verification?.alerts || [];
    const conflictAlerts = getConflictAlerts(gr);
    return [...verificationAlerts, ...conflictAlerts];
  };

  // ============================================
  // HELPER: Check if there are critical issues
  // ============================================
  const hasCriticalIssues = (gr) => {
    const allAlerts = getAllAlerts(gr);
    return allAlerts.some(a => 
      a.severity === 'critical' || 
      a.severity === 'CRITICAL' ||
      a.severity === 'high' ||
      a.severity === 'HIGH'
    );
  };

  if (loading) {
    return <div className="executive-dashboard">Loading...</div>;
  }

  if (grs.length === 0) {
    return (
      <div className="executive-dashboard">
        <div className="empty-state">
          <span className="icon">✅</span>
          <h3>No pending approvals</h3>
          <p>All Government Resolutions are up to date.</p>
        </div>
      </div>
    );
  }

  const selected = selectedGR || grs[0];
  const allAlerts = getAllAlerts(selected);
  const conflictAlerts = getConflictAlerts(selected);
  const hasIssues = hasCriticalIssues(selected);

  return (
    <div className="executive-dashboard">
      <div className="dashboard-title">
        <h2>Executive Review</h2>
        <p>30-second approval workflow for senior officers</p>
      </div>

      <div className="dashboard-container">
        {/* Queue List */}
        <div className="approval-queue">
          <h3>Pending Review ({grs.length})</h3>
          <div className="queue-list">
            {grs.map(gr => {
              const grHasIssues = hasCriticalIssues(gr);
              const grConflictCount = gr?.conflict_audit?.conflicted_grs?.length || 0;
              
              return (
                <div
                  key={gr.id}
                  className={`queue-item ${selected?.id === gr.id ? 'active' : ''}`}
                  onClick={() => setSelectedGR(gr)}
                >
                  <div className="queue-header">
                    <span className="queue-dept">{gr.department}</span>
                    <span className="queue-priority">
                      {grHasIssues ? '🔴 Critical' : '🟡 Review'}
                      {grConflictCount > 0 && (
                        <span style={{ 
                          background: '#DC2626', 
                          color: 'white', 
                          padding: '2px 8px', 
                          borderRadius: '12px', 
                          fontSize: '10px',
                          marginLeft: '6px'
                        }}>
                          {grConflictCount} conflicts
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="queue-subject">{gr.metadata?.subject?.substring(0, 50)}</div>
                  <div className="queue-meta">
                    <span className="queue-date">{gr.created_at?.split('T')[0]}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review Panel */}
        {selected && (
          <div className="approval-panel">
            <div className="review-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <img src="/emblem_india_maharashtra.png" style={{ height: '42px', objectFit: 'contain' }} alt="State Emblem" />
                <img src="/maharashtra_rajmudra_seal.png" style={{ height: '42px', objectFit: 'contain' }} alt="Rajmudra Seal" />
                <h3 style={{ margin: 0, fontSize: '16px' }}>{selected.metadata?.subject}</h3>
              </div>
              <div className={`compliance-badge ${hasIssues ? 'warning' : 'success'}`}>
                {hasIssues ? '⚠️ Review Issues' : '✅ Compliant'}
                {conflictAlerts.length > 0 && (
                  <span style={{ 
                    background: '#DC2626', 
                    color: 'white', 
                    padding: '2px 10px', 
                    borderRadius: '12px', 
                    fontSize: '11px',
                    marginLeft: '8px'
                  }}>
                    {conflictAlerts.length} Conflicts
                  </span>
                )}
              </div>
            </div>

            {/* Key Metrics */}
            <div className="metrics-grid">
              <div className="metric">
                <span className="label">Department</span>
                <span className="value">{selected.department}</span>
              </div>
              <div className="metric">
                <span className="label">Created By</span>
                <span className="value">{selected.created_by || 'Clerk'}</span>
              </div>
              {selected.sections.financials?.[0]?.amount && (
                <div className="metric">
                  <span className="label">Budget</span>
                  <span className="value">₹{selected.sections.financials[0].amount}</span>
                </div>
              )}
              <div className="metric">
                <span className="label">Effective Date</span>
                <span className="value">{selected.metadata?.effectiveDate || 'Immediate'}</span>
              </div>
            </div>

            {/* ============================================
                CONFLICT AUDIT SECTION (CRITICAL)
                ============================================ */}
            {conflictAlerts.length > 0 && (
              <div className="issues-panel" style={{ 
                background: '#FEF2F2', 
                border: '2px solid #DC2626',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '16px'
              }}>
                <h4 style={{ color: '#7F1D1D', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  🚨 POLICY CONFLICTS DETECTED ({conflictAlerts.length})
                </h4>
                <div className="issues-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {conflictAlerts.map((alert, idx) => (
                    <div key={idx} className={`issue-item ${alert.severity}`} style={{
                      background: 'white',
                      padding: '12px 16px',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${alert.severity === 'critical' || alert.severity === 'CRITICAL' ? '#DC2626' : '#F59E0B'}`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="severity" style={{
                          fontWeight: 'bold',
                          fontSize: '12px',
                          color: alert.severity === 'critical' || alert.severity === 'CRITICAL' ? '#DC2626' : '#D97706'
                        }}>
                          {alert.severity?.toUpperCase() || 'HIGH'}
                        </span>
                        {alert.sourceGrId && (
                          <a 
                            href={alert.linkUrl || `#`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ 
                              fontSize: '12px', 
                              color: '#0284c7',
                              textDecoration: 'none',
                              fontWeight: '600'
                            }}
                          >
                            🔗 View GR {alert.sourceGrId}
                          </a>
                        )}
                      </div>
                      <div className="issue-title" style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                        {alert.title}
                      </div>
                      <div style={{ fontSize: '13px', color: '#334155', marginTop: '4px' }}>
                        {alert.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Issues */}
            {selected.verification?.alerts && selected.verification.alerts.length > 0 && (
              <div className="issues-panel">
                <h4>Verification Issues ({selected.verification.alerts.length})</h4>
                <div className="issues-list">
                  {selected.verification.alerts.slice(0, 5).map((alert, idx) => (
                    <div key={idx} className={`issue-item ${alert.severity}`}>
                      <span className="severity">{alert.severity.toUpperCase()}</span>
                      <span className="issue-title">{alert.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Log / History */}
            {selected.history && selected.history.length > 0 && (
              <div className="issues-panel" style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                <h4 style={{ color: '#0f172a' }}>📜 Audit Trail & Action Log ({selected.history.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px', color: '#334155' }}>
                  {selected.history.map((log, idx) => (
                    <div key={idx} style={{ background: 'white', padding: '8px 12px', borderRadius: '4px', borderLeft: '3px solid #0284c7' }}>
                      <strong>{log.action}</strong> by <em>{log.performedBy}</em> <span style={{ color: '#64748b', fontSize: '11px' }}>({new Date(log.timestamp).toLocaleString()})</span>
                      {log.comments && <div style={{ marginTop: '2px', color: '#475569' }}>"{log.comments}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick View */}
            <div className="quick-view">
              <h4>Resolution Preview</h4>
              <div className="preview-box">
                {selected.sections.introduction?.substring(0, 200) || selected.sections.resolution?.substring(0, 200)}
                ...
              </div>
              <button 
                className="view-full"
                onClick={() => {
                  window.open(`http://localhost:5000/api/gr/${selected.id}/export/html`, '_blank');
                }}
              >
                View Full Document →
              </button>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-approve"
                onClick={() => handleApprove(selected.id)}
                style={{ flex: 1, backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', padding: '10px', minWidth: '120px' }}
              >
                ✅ Approve & Sign
              </button>
              <button
                className="btn"
                onClick={() => {
                  setRejectActionType('request_changes');
                  setShowRejectModal(true);
                }}
                style={{ flex: 1, backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', padding: '10px', minWidth: '120px' }}
              >
                📝 Request Changes
              </button>
              <button
                className="btn btn-reject"
                onClick={() => {
                  setRejectActionType('reject');
                  setShowRejectModal(true);
                }}
                style={{ flex: 1, backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', padding: '10px', minWidth: '120px' }}
              >
                ❌ Reject Document
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="modal-content" style={{
            background: 'white',
            padding: '24px',
            borderRadius: '8px',
            maxWidth: '500px',
            width: '90%',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h3 style={{ margin: '0 0 16px 0' }}>
              {rejectActionType === 'reject' ? '❌ Reject Document' : '📝 Request Changes'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
              {rejectActionType === 'reject' 
                ? 'Specify the official reason for complete rejection of this GR:' 
                : 'Specify the revisions / feedback comments required from the Desk Officer:'}
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={rejectActionType === 'reject' 
                ? 'Enter rejection reason...' 
                : 'Enter feedback for revisions...'}
              style={{
                width: '100%',
                minHeight: '100px',
                padding: '10px',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                  background: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (rejectReason.trim()) {
                    handleReject(selected.id, rejectReason, rejectActionType);
                  } else {
                    alert('Please provide a reason.');
                  }
                }}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '4px',
                  background: rejectActionType === 'reject' ? '#dc2626' : '#d97706',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {rejectActionType === 'reject' ? '❌ Reject' : '📝 Send Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}