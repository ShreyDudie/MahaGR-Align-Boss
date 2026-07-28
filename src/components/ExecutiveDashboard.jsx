import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './ExecutiveDashboard.css';

export default function ExecutiveDashboard({ user }) {
  const { grId } = useParams();
  const [grs, setGrs] = useState([]);
  const [selectedGR, setSelectedGR] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGRs = async () => {
      try {
        const status = user.role === 'minister' ? 'pending_signature' : 'pending_approval';
        const response = await axios.get(`http://localhost:5000/api/grs?status=${status}`);
        setGrs(response.data.grs);
        
        // Auto-select GR if grId parameter is passed and valid
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
      if (actionType === 'reject') {
        alert('❌ GR permanently rejected.');
      } else {
        alert('📝 Revision comments sent back to Desk Officer.');
      }
    } catch (error) {
      alert('Error rejecting GR: ' + error.message);
    }
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
  const hasIssues = selected.verification?.summary?.critical > 0 || selected.verification?.summary?.high > 0;

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
            {grs.map(gr => (
              <div
                key={gr.id}
                className={`queue-item ${selected?.id === gr.id ? 'active' : ''}`}
                onClick={() => setSelectedGR(gr)}
              >
                <div className="queue-header">
                  <span className="queue-dept">{gr.department}</span>
                  <span className="queue-priority">
                    {(gr.verification?.summary?.critical || 0) > 0 ? '🔴 Critical' : '🟡 Review'}
                  </span>
                </div>
                <div className="queue-subject">{gr.metadata?.subject?.substring(0, 50)}</div>
                <div className="queue-meta">
                  <span className="queue-date">{gr.created_at?.split('T')[0]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Review Panel */}
        {selected && (
          <div className="approval-panel">
            <div className="review-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="/emblem_india_maharashtra.png" style={{ height: '42px', objectFit: 'contain' }} alt="State Emblem" />
                <img src="/maharashtra_rajmudra_seal.png" style={{ height: '42px', objectFit: 'contain' }} alt="Rajmudra Seal" />
                <h3 style={{ margin: 0 }}>{selected.metadata?.subject}</h3>
              </div>
              <div className={`compliance-badge ${hasIssues ? 'warning' : 'success'}`}>
                {hasIssues ? '⚠️ Review Issues' : '✅ Compliant'}
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

            {/* Audit Log / History for Transparency */}
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
            <div className="action-buttons" style={{ display: 'flex', gap: '10px' }}>
              <button
                className="btn btn-approve"
                onClick={() => handleApprove(selected.id)}
                style={{ flex: 1, backgroundColor: '#059669' }}
              >
                ✅ Approve & Sign
              </button>
              <button
                className="btn"
                onClick={() => {
                  const reason = prompt('Specify revisions / feedback comments required from Desk Officer:');
                  if (reason) handleReject(selected.id, reason, 'request_changes');
                }}
                style={{ flex: 1, backgroundColor: '#d97706', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', padding: '10px' }}
              >
                📝 Request Changes
              </button>
              <button
                className="btn btn-reject"
                onClick={() => {
                  const reason = prompt('Specify official reason for complete rejection:');
                  if (reason) handleReject(selected.id, reason, 'reject');
                }}
                style={{ flex: 1, backgroundColor: '#dc2626' }}
              >
                ❌ Reject Document
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
