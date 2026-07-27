import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

export default function Dashboard({ user, setCurrentGR }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalHistoricalGRs: 0,
    activeDraftsCount: 0,
    pendingApprovalsCount: 0,
    pendingSignaturesCount: 0,
    approvedCount: 0,
    departments: [],
  });
  const [grList, setGrList] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search state
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    department: '',
  });
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, grsRes, deptsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/analytics/dashboard'),
        axios.get('http://localhost:5000/api/grs'),
        axios.get('http://localhost:5000/api/departments'),
      ]);

      const historicalTotal = analyticsRes.data.departments.reduce((sum, d) => sum + d.count, 0);
      const dbGrs = grsRes.data.grs || [];

      setGrList(dbGrs);
      setDepartmentsList(deptsRes.data.departments || []);
      setStats({
        totalHistoricalGRs: historicalTotal,
        activeDraftsCount: dbGrs.filter(g => g.status === 'draft' || g.status === 'rejected').length,
        pendingApprovalsCount: dbGrs.filter(g => g.status === 'pending_approval').length,
        pendingSignaturesCount: dbGrs.filter(g => g.status === 'pending_signature').length,
        approvedCount: dbGrs.filter(g => g.status === 'approved').length,
        departments: analyticsRes.data.departments.slice(0, 5),
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  const handleEditDraft = (gr) => {
    setCurrentGR(gr);
    navigate(`/draft/${gr.id}`);
  };

  const handleReviewGR = (gr) => {
    navigate(`/approve/${gr.id}`);
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    setSearchParams(prev => ({ ...prev, [name]: value }));
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    if (!searchParams.keyword && !searchParams.department) {
      alert('Please enter a keyword or select a department to search');
      return;
    }
    setSearching(true);
    setSearchTriggered(true);
    try {
      const response = await axios.post('http://localhost:5000/api/search', searchParams);
      setSearchResults(response.data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed: ' + error.message);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchParams({ keyword: '', department: '' });
    setSearchResults([]);
    setSearchTriggered(false);
  };

  if (loading) {
    return <div className="dashboard loading">Loading resolution data...</div>;
  }

  // Filter GR lists according to role
  const clerkDrafts = grList.filter(g => g.status === 'draft' || g.status === 'rejected');
  const clerkSubmitted = grList.filter(g => g.status === 'pending_approval' || g.status === 'pending_signature');
  const officerQueue = grList.filter(g => g.status === 'pending_approval');
  const ministerQueue = grList.filter(g => g.status === 'pending_signature');
  const approvedGRs = grList.filter(g => g.status === 'approved');

  return (
    <div className="dashboard">
      <div className="breadcrumb">
        <span>Home</span> / <span>Dashboard</span>
      </div>

      <h2 className="page-title" style={{ color: '#1a3a52', marginBottom: '8px' }}>
        Welcome back, {user.name}!
      </h2>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        Role: <strong style={{ color: '#ff9933' }}>{user.role.toUpperCase().replace('_', ' ')}</strong> | Department of Administration
      </p>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/analytics')}>
          <div className="stat-icon" style={{ background: '#e1f5fe' }}>🏛️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalHistoricalGRs.toLocaleString()}</div>
            <div className="stat-label">Historical GR Base</div>
          </div>
        </div>

        {user.role === 'clerk' && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fff3e0' }}>📝</div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeDraftsCount}</div>
              <div className="stat-label">Active Drafts</div>
            </div>
          </div>
        )}

        {user.role === 'senior_officer' && (
          <div className="stat-card" onClick={() => navigate('/approve/pending')}>
            <div className="stat-icon" style={{ background: '#ffe0b2' }}>⏳</div>
            <div className="stat-content">
              <div className="stat-value">{stats.pendingApprovalsCount}</div>
              <div className="stat-label">Pending Review</div>
            </div>
          </div>
        )}

        {user.role === 'minister' && (
          <div className="stat-card" onClick={() => navigate('/approve/pending')}>
            <div className="stat-icon" style={{ background: '#ffe0b2' }}>✍️</div>
            <div className="stat-content">
              <div className="stat-value">{stats.pendingSignaturesCount}</div>
              <div className="stat-label">Awaiting Signature</div>
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e8f5e9' }}>✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.approvedCount}</div>
            <div className="stat-label">Signed Resolutions</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', color: '#1a3a52' }}>Quick Actions</h3>
        <div className="action-buttons" style={{ marginTop: '12px' }}>
          {user.role === 'clerk' && (
            <button className="action-btn primary" onClick={() => navigate('/create')}>
              <span className="icon">➕</span> Create New GR
            </button>
          )}
          {(user.role === 'senior_officer' || user.role === 'minister') && (
            <button className="action-btn primary" onClick={() => navigate('/approve/pending')}>
              <span className="icon">🗳️</span> Go to Review Queue
            </button>
          )}
          <button className="action-btn secondary" onClick={() => navigate('/analytics')}>
            <span className="icon">📊</span> View Analytics
          </button>
        </div>
      </div>

      {/* Historical GR Search Section */}
      <div className="quick-actions" style={{ background: '#fcfcfc', border: '1px solid #1a3a52' }}>
        <h3 style={{ color: '#1a3a52', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
          🔍 Search Historical Resolution Database ({stats.totalHistoricalGRs.toLocaleString()} GRs)
        </h3>
        <form onSubmit={handleSearchSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#1a3a52' }}>Keyword / Topic</label>
            <input
              type="text"
              name="keyword"
              placeholder="e.g., scheme, budget, grant, solar"
              value={searchParams.keyword}
              onChange={handleSearchChange}
              style={{ width: '100%', padding: '8px', border: '2px solid #1a3a52', borderRadius: '4px', backgroundColor: '#ffffff', color: '#111111', fontWeight: '600', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px', color: '#1a3a52' }}>Department</label>
            <select
              name="department"
              value={searchParams.department}
              onChange={handleSearchChange}
              style={{ width: '100%', padding: '8px', border: '2px solid #1a3a52', borderRadius: '4px', backgroundColor: '#ffffff', color: '#111111', fontWeight: '600', boxSizing: 'border-box' }}
            >
              <option value="">All Departments</option>
              {departmentsList.map(dept => (
                <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            <button type="submit" className="action-btn primary" style={{ width: '100%', justifyContent: 'center' }} disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
            {searchTriggered && (
              <button type="button" className="action-btn secondary" onClick={handleClearSearch} style={{ padding: '10px' }}>
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Search Results */}
        {searchTriggered && (
          <div style={{ marginTop: '20px', background: 'white', padding: '16px', borderRadius: '4px', border: '1px solid #ddd' }}>
            <h4 style={{ color: '#1a3a52', marginBottom: '12px' }}>Search Results ({searchResults.length} matches found)</h4>
            {searchResults.length === 0 ? (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No matching resolutions found in the historical database.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #eee', color: '#1a3a52', background: '#f5f5f5' }}>
                      <th style={{ padding: '10px 8px' }}>Subject / Date</th>
                      <th style={{ padding: '10px 8px' }}>Department</th>
                      <th style={{ padding: '10px 8px' }}>Resolution ID</th>
                      <th style={{ padding: '10px 8px' }}>Reference Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map(result => (
                      <tr key={result.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                        <td style={{ padding: '10px 8px' }}>
                          <div><strong>{result.metadata?.subject}</strong></div>
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>Date: {result.metadata?.date || 'N/A'}</div>
                        </td>
                        <td style={{ padding: '10px 8px', color: '#555' }}>{result.department?.replace(/_/g, ' ')}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <span style={{ display: 'inline-block', background: '#e1f5fe', color: '#0288d1', padding: '3px 8px', borderRadius: '4px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {result.id}
                          </span>
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <a 
                            href={`http://localhost:5000/api/gr/${result.id}/export/html`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#ff9933', fontWeight: 'bold', textDecoration: 'underline', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <span>📄</span> View Official GR
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Role-Based Tables */}
      <div className="dashboard-tables" style={{ display: 'grid', gap: '24px', margin: '24px 0' }}>
        
        {/* Clerk Drafts Table */}
        {user.role === 'clerk' && (
          <div className="recent-activity" style={{ padding: '20px' }}>
            <h3 style={{ color: '#1a3a52', marginBottom: '16px' }}>My Active Drafts & Rejections</h3>
            {clerkDrafts.length === 0 ? (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No active drafts. Click "Create New GR" to begin drafting.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', paddingBottom: '8px' }}>
                      <th style={{ padding: '10px' }}>Subject</th>
                      <th style={{ padding: '10px' }}>Department</th>
                      <th style={{ padding: '10px' }}>Status</th>
                      <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clerkDrafts.map(gr => (
                      <tr key={gr.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 10px', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>{gr.metadata?.subject || 'No Subject'}</strong>
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: '13px' }}>{gr.department}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: gr.status === 'rejected' ? '#ffebee' : '#f5f5f5',
                            color: gr.status === 'rejected' ? '#d32f2f' : '#666',
                          }}>
                            {gr.status.toUpperCase()}
                          </span>
                          {gr.rejected_reason && (
                            <div style={{ fontSize: '11px', color: '#c62828', marginTop: '4px' }}>
                              Reason: "{gr.rejected_reason}"
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            className="action-btn secondary"
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => handleEditDraft(gr)}
                          >
                            ✎ Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Clerk Submitted Table */}
        {user.role === 'clerk' && (
          <div className="recent-activity" style={{ padding: '20px' }}>
            <h3 style={{ color: '#1a3a52', marginBottom: '16px' }}>Submitted Resolutions</h3>
            {clerkSubmitted.length === 0 ? (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No resolutions submitted yet.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', paddingBottom: '8px' }}>
                      <th style={{ padding: '10px' }}>Subject</th>
                      <th style={{ padding: '10px' }}>Department</th>
                      <th style={{ padding: '10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clerkSubmitted.map(gr => (
                      <tr key={gr.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 10px', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>{gr.metadata?.subject}</strong>
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: '13px' }}>{gr.department}</td>
                        <td style={{ padding: '12px 10px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            background: '#fff3e0',
                            color: '#e65100',
                          }}>
                            {gr.status.toUpperCase().replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Officer Pending Approval Queue */}
        {user.role === 'senior_officer' && (
          <div className="recent-activity" style={{ padding: '20px' }}>
            <h3 style={{ color: '#1a3a52', marginBottom: '16px' }}>Awaiting My Review</h3>
            {officerQueue.length === 0 ? (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No pending resolutions in your queue.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', paddingBottom: '8px' }}>
                      <th style={{ padding: '10px' }}>Subject</th>
                      <th style={{ padding: '10px' }}>Department</th>
                      <th style={{ padding: '10px' }}>Districts</th>
                      <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {officerQueue.map(gr => (
                      <tr key={gr.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 10px', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>{gr.metadata?.subject}</strong>
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: '13px' }}>{gr.department}</td>
                        <td style={{ padding: '12px 10px', fontSize: '13px' }}>
                          {gr.districts && gr.districts.length > 0 ? gr.districts.join(', ') : 'State-wide'}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            className="action-btn primary"
                            style={{ padding: '6px 12px', fontSize: '12px', background: '#ff9933' }}
                            onClick={() => handleReviewGR(gr)}
                          >
                            🗳️ Review
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Minister Signature Queue */}
        {user.role === 'minister' && (
          <div className="recent-activity" style={{ padding: '20px' }}>
            <h3 style={{ color: '#1a3a52', marginBottom: '16px' }}>Awaiting Final Signature</h3>
            {ministerQueue.length === 0 ? (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No pending resolutions in your queue.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd', paddingBottom: '8px' }}>
                      <th style={{ padding: '10px' }}>Subject</th>
                      <th style={{ padding: '10px' }}>Department</th>
                      <th style={{ padding: '10px' }}>Districts</th>
                      <th style={{ padding: '10px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ministerQueue.map(gr => (
                      <tr key={gr.id} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '12px 10px', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <strong>{gr.metadata?.subject}</strong>
                        </td>
                        <td style={{ padding: '12px 10px', fontSize: '13px' }}>{gr.department}</td>
                        <td style={{ padding: '12px 10px', fontSize: '13px' }}>
                          {gr.districts && gr.districts.length > 0 ? gr.districts.join(', ') : 'State-wide'}
                        </td>
                        <td style={{ padding: '12px 10px' }}>
                          <button
                            className="action-btn primary"
                            style={{ padding: '6px 12px', fontSize: '12px', background: '#ff9933' }}
                            onClick={() => handleReviewGR(gr)}
                          >
                            ✍️ Sign Off
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Approved Resolutions List (All roles see this) */}
        <div className="recent-activity" style={{ padding: '20px' }}>
          <h3 style={{ color: '#1a3a52', marginBottom: '16px' }}>Signed & Published Resolutions</h3>
          {approvedGRs.length === 0 ? (
            <p style={{ color: '#777', fontStyle: 'italic' }}>No signed resolutions published yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', paddingBottom: '8px' }}>
                    <th style={{ padding: '10px' }}>Subject</th>
                    <th style={{ padding: '10px' }}>Department</th>
                    <th style={{ padding: '10px' }}>Status</th>
                    <th style={{ padding: '10px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedGRs.map(gr => (
                    <tr key={gr.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '12px 10px', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        <strong>{gr.metadata?.subject}</strong>
                      </td>
                      <td style={{ padding: '12px 10px', fontSize: '13px' }}>{gr.department}</td>
                      <td style={{ padding: '12px 10px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          background: '#e8f5e9',
                          color: '#2e7d32',
                        }}>
                          PUBLISHED
                        </span>
                      </td>
                      <td style={{ padding: '12px 10px' }}>
                        <button
                          className="action-btn secondary"
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                          onClick={() => window.open(`http://localhost:5000/api/gr/${gr.id}/export/html`, '_blank')}
                        >
                          📄 View HTML/PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Historical Departments statistics summary */}
      <div className="recent-activity">
        <h3 style={{ color: '#1a3a52', marginBottom: '16px' }}>Top Departments (Historical Database)</h3>
        <div className="dept-list">
          {stats.departments.map((dept, idx) => (
            <div key={idx} className="dept-item">
              <div className="dept-name">{dept.name.replace(/_/g, ' ')}</div>
              <div className="dept-count">{dept.count.toLocaleString()} GRs</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
