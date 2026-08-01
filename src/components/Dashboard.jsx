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
  
  // Search state matching the official layout
  const [searchParams, setSearchParams] = useState({
    keyword: '',
    department: '',
    fromDate: '',
    byDate: '',
    codeNumber: '',
    captchaInput: '',
  });
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [departmentsList, setDepartmentsList] = useState([]);
  const [captchaCode, setCaptchaCode] = useState('');
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const itemsPerPage = 10;

  const generateCaptcha = () => {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    setCaptchaCode(code);
  };

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
    generateCaptcha();
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
    if (e && e.preventDefault) e.preventDefault();

    setSearching(true);
    setSearchTriggered(true);
    setCurrentPage(1);

    try {
      const response = await axios.post('http://localhost:5000/api/search', {
        keyword: searchParams.keyword,
        department: searchParams.department,
        fromDate: '',
        byDate: '',
        codeNumber: ''
      });
      setSearchResults(response.data.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      alert('Search failed: ' + error.message);
    } finally {
      setSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchParams({
      keyword: '',
      department: '',
      fromDate: '',
      byDate: '',
      codeNumber: '',
      captchaInput: '',
    });
    setSearchResults([]);
    setSearchTriggered(false);
    setCurrentPage(1);
  };

  // Pagination calculations
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResults = searchResults.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.max(1, Math.ceil(searchResults.length / itemsPerPage));

  useEffect(() => {
    setPageInput(currentPage.toString());
  }, [currentPage]);

  const handlePageGo = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const parsedPage = parseInt(pageInput, 10);
    if (!isNaN(parsedPage) && parsedPage >= 1 && parsedPage <= totalPages) {
      setCurrentPage(parsedPage);
    } else {
      alert(`Please enter a valid page number between 1 and ${totalPages}`);
      setPageInput(currentPage.toString());
    }
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
        Role: <strong style={{ color: '#ff9933' }}>{user.role.toUpperCase().replace('_', ' ')}</strong> | Department of {user.department || 'Administration'}
      </p>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card" onClick={() => navigate('/analytics')}>
          <div className="stat-icon" style={{ background: '#e1f5fe' }}><Building2 size={32} strokeWidth={1.5} color="#0277bd" /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalHistoricalGRs.toLocaleString()}</div>
            <div className="stat-label">Historical GR Base</div>
          </div>
        </div>

        {user.role === 'clerk' && (
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#fff3e0' }}><FileText size={32} strokeWidth={1.5} color="#e65100" /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.activeDraftsCount}</div>
              <div className="stat-label">Active Drafts</div>
            </div>
          </div>
        )}

        {user.role === 'senior_officer' && (
          <div className="stat-card" onClick={() => navigate('/approve/pending')}>
            <div className="stat-icon" style={{ background: '#ffe0b2' }}><Clock size={32} strokeWidth={1.5} color="#e65100" /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.pendingApprovalsCount}</div>
              <div className="stat-label">Pending Review</div>
            </div>
          </div>
        )}

        {user.role === 'minister' && (
          <div className="stat-card" onClick={() => navigate('/approve/pending')}>
            <div className="stat-icon" style={{ background: '#ffe0b2' }}><PenTool size={32} strokeWidth={1.5} color="#e65100" /></div>
            <div className="stat-content">
              <div className="stat-value">{stats.pendingSignaturesCount}</div>
              <div className="stat-label">Awaiting Signature</div>
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-icon" style={{ background: '#e8f5e9' }}><CheckCircle size={32} strokeWidth={1.5} color="#2e7d32" /></div>
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
              <span className="icon"><Plus size={16} strokeWidth={2} /></span> Create New GR
            </button>
          )}
          {(user.role === 'senior_officer' || user.role === 'minister') && (
            <button className="action-btn primary" onClick={() => navigate('/approve/pending')}>
              <span className="icon"><File size={16} strokeWidth={2} /></span> Go to Review Queue
            </button>
          )}
          <button className="action-btn secondary" onClick={() => navigate('/analytics')}>
            <span className="icon"><BarChart size={16} strokeWidth={2} /></span> View Analytics
          </button>
        </div>
      </div>

      {/* Historical GR Search Section */}
      <div className="simple-search-card">
        <h3 className="simple-search-title">
          <Search size={20} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Search Historical Resolution Database (98,980 GRs)
        </h3>

        <form onSubmit={handleSearchSubmit}>
          <div className="simple-search-row">
            <div className="simple-search-field">
              <label>Keyword / Topic</label>
              <input
                type="text"
                name="keyword"
                value={searchParams.keyword}
                onChange={handleSearchChange}
                placeholder="e.g., scheme, budget, grant, policy"
              />
            </div>
            
            <div className="simple-search-field">
              <label>Department</label>
              <select
                name="department"
                value={searchParams.department}
                onChange={handleSearchChange}
              >
                <option value="">All Departments</option>
                {departmentsList.map(dept => (
                  <option key={dept} value={dept}>{dept.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <button type="submit" className="simple-search-btn" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>
      </div>

        {/* Search Results */}
        {searchTriggered && (
          <div className="search-results-wrapper">
            <div className="search-results-info-bar">
              <div className="total-items-badge">
                Total items : {searchResults.length}
              </div>
              
              <form onSubmit={handlePageGo} className="page-go-form">
                <span>Page No. : </span>
                <input
                  type="text"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  className="page-no-input"
                />
                <span> / {totalPages} </span>
                <button type="submit" className="go-btn">Go</button>
              </form>

              {/* Render Pagination Links */}
              <div className="pagination-links-container">
                {currentPage > 1 && (
                  <span className="page-link-num" onClick={() => setCurrentPage(1)}>&lt;&lt; First</span>
                )}
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pNum = idx + 1;
                  // Show current page, and up to 2 pages around it
                  if (pNum === 1 || pNum === totalPages || Math.abs(pNum - currentPage) <= 2) {
                    return (
                      <span 
                        key={pNum} 
                        className={`page-link-num ${pNum === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(pNum)}
                      >
                        {pNum}
                      </span>
                    );
                  }
                  if (pNum === 2 || pNum === totalPages - 1) {
                    return <span key={pNum} className="page-link-ellipse">...</span>;
                  }
                  return null;
                }).filter((el, idx, self) => {
                  // filter out duplicate ellipses
                  if (el && el.type === 'span' && el.props.className === 'page-link-ellipse') {
                    const nextEl = self[idx + 1];
                    if (nextEl && nextEl.type === 'span' && nextEl.props.className === 'page-link-ellipse') {
                      return false;
                    }
                  }
                  return true;
                })}
                {currentPage < totalPages && (
                  <span className="page-link-num" onClick={() => setCurrentPage(currentPage + 1)}>Next &gt;</span>
                )}
                {currentPage < totalPages && (
                  <span className="page-link-num" onClick={() => setCurrentPage(totalPages)}>Last &gt;&gt;</span>
                )}
              </div>
            </div>

            {searchResults.length === 0 ? (
              <p className="no-results-msg">No matching resolutions found in the historical database.</p>
            ) : (
              <div className="results-table-container">
                <table className="official-results-table">
                  <thead>
                    <tr>
                      <th style={{ width: '6%' }}>Number</th>
                      <th style={{ width: '22%' }}>Department name</th>
                      <th style={{ width: '38%' }}>Title</th>
                      <th style={{ width: '14%' }}>Code number</th>
                      <th style={{ width: '10%' }}>G.R. dated</th>
                      <th style={{ width: '5%' }}>Size (KB)</th>
                      <th style={{ width: '5%' }}>Download</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedResults.map((result, idx) => {
                      const cleanCodeNumber = result.id ? result.id.split('.')[0] : 'N/A';
                      const sizeKb = result.sections ? Math.round(JSON.stringify(result).length / 1024) || 120 : 120;
                      return (
                        <tr key={result.id}>
                          <td style={{ textAlign: 'center' }}>{startIndex + idx + 1}</td>
                          <td>{result.department ? result.department.replace(/_/g, ' ') : 'N/A'}</td>
                          <td>
                            <div className="result-subject-title">{result.metadata?.subject || 'No Subject'}</div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 'bold', color: '#1a3a52', textAlign: 'center' }}>
                            {cleanCodeNumber}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {result.metadata?.date || 'N/A'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {sizeKb}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <a 
                              href={`http://localhost:5000/api/gr/${result.id}/export/html`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="pdf-download-link"
                            >
                              <div className="pdf-icon-badge" title="View Official PDF">
                                <File size={20} strokeWidth={2} />
                              </div>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

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
                            <Edit size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Edit
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
                            <File size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Review
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
                            <PenTool size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Sign Off
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
                          <File size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> View HTML/PDF
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

      {/* Top Departments Visual Card Grid */}
      <div className="recent-activity" style={{ padding: '24px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
        <h3 style={{ color: '#0A2540', marginBottom: '16px', fontSize: '18px', fontWeight: '800' }}>
          <Building2 size={24} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Key Administrative Departments (Historical GR Index)
        </h3>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '-10px', marginBottom: '20px' }}>
          Click any department card to explore historical Government Resolutions and precursor policies.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {stats.departments.map((dept, idx) => (
            <div 
              key={idx} 
              style={{
                background: '#FFFFFF',
                border: '1.5px solid #CBD5E1',
                borderRadius: '8px',
                padding: '16px 20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onClick={() => {
                setSearchParams({ keyword: '', department: dept.name });
                setSearching(true);
                setSearchTriggered(true);
                axios.post('http://localhost:5000/api/search', { department: dept.name }).then(res => {
                  setSearchResults(res.data.results || []);
                  setSearching(false);
                });
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px' }}>
                    {dept.name.toLowerCase().includes('finance') ? <DollarSign size={32} strokeWidth={1.5} color="#2e7d32" /> : 
                     dept.name.toLowerCase().includes('education') ? <GraduationCap size={32} strokeWidth={1.5} color="#1565c0" /> : 
                     dept.name.toLowerCase().includes('urban') ? <Building size={32} strokeWidth={1.5} color="#6d4c41" /> : 
                     dept.name.toLowerCase().includes('health') ? <Stethoscope size={32} strokeWidth={1.5} color="#c62828" /> : <Scroll size={32} strokeWidth={1.5} color="#6a1b9a" />}
                  </span>
                  <span style={{ background: '#FF671F', color: 'white', padding: '3px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold' }}>
                    {dept.count.toLocaleString()} GRs
                  </span>
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#0A2540', marginBottom: '6px' }}>
                  {dept.name.replace(/_/g, ' ')}
                </div>
              </div>

              <div style={{ marginTop: '12px', borderTop: '1px solid #F1F5F9', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: '#0056b3', fontWeight: 'bold' }}>
                <span>Browse Resolutions</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
