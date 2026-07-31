import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import GRWizard from './components/GRWizard'
import DraftWorkspace from './components/DraftWorkspace'
import ExecutiveDashboard from './components/ExecutiveDashboard'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import ChatAssistant from './components/ChatAssistant'
import './App.css'

function AppContent() {
  const [user, setUser] = useState({ role: 'clerk', name: 'John Doe (Desk Officer)', id: 'clerk_001' })
  const [currentGR, setCurrentGR] = useState(null)
  
  const navigate = useNavigate();
  const location = useLocation();

  // Handle role-based navigation and progress preservation
  const handleRoleChange = (newRole) => {
    let userData = {};
    if (newRole === 'clerk') {
      userData = { role: 'clerk', name: 'John Doe (Desk Officer)', id: 'clerk_001' };
    } else if (newRole === 'senior_officer') {
      userData = { role: 'senior_officer', name: 'Officer Deshmukh (Joint Secy)', id: 'officer_002' };
    } else if (newRole === 'minister') {
      userData = { role: 'minister', name: 'Hon. Minister Patil', id: 'minister_003' };
    }

    setUser(userData);

    // Navigation logic:
    // If Clerk is on Create GR page, and switches to Minister/Senior Officer, automatically switch to executive review
    if (newRole !== 'clerk' && location.pathname === '/create') {
      navigate('/approve/pending');
    }
    // If Minister/Senior Officer is on review pages, and switches to Clerk, direct them to Create GR page
    if (newRole === 'clerk' && (location.pathname === '/approve/pending' || location.pathname.startsWith('/approve/'))) {
      navigate('/create');
    }
  };

  // Determine theme colors based on role for clear visual distinction and higher contrast
  const getRoleThemeStyles = () => {
    if (user.role === 'clerk') {
      return {
        headerBg: 'linear-gradient(135deg, #1e3a8a 0%, #172554 100%)', // Deep Cobalt Blue
        badgeBg: '#ff9933', // Saffron
        badgeColor: '#ffffff',
        borderBottomColor: '#ff9933'
      };
    } else if (user.role === 'senior_officer') {
      return {
        headerBg: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', // Charcoal Slate
        badgeBg: '#e2e8f0', // Light Gray badge
        badgeColor: '#0f172a', // Dark text
        borderBottomColor: '#cbd5e1'
      };
    } else if (user.role === 'minister') {
      return {
        headerBg: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)', // Deep Emerald Green
        badgeBg: '#f59e0b', // Amber/Gold badge
        badgeColor: '#000000',
        borderBottomColor: '#f59e0b'
      };
    }
    return {
      headerBg: 'linear-gradient(135deg, #0A2540 0%, #103459 100%)',
      badgeBg: '#ff9933',
      badgeColor: '#ffffff',
      borderBottomColor: '#D4AF37'
    };
  };

  const theme = getRoleThemeStyles();

  return (
    <div className="app">
      {/* Tricolor Header Bar */}
      <div className="tricolor-header-bar"></div>

      {/* Header - Government of Maharashtra Portal Style */}
      <header className="header" style={{ background: theme.headerBg, borderBottom: `3px solid ${theme.borderBottomColor}` }}>
        <div className="header-container">
          <div className="logo-section" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img 
              src="/emblem_india_maharashtra.png" 
              alt="State Emblem of India - Government of Maharashtra" 
              style={{ height: '56px', width: 'auto', objectFit: 'contain', background: '#ffffff', padding: '4px 8px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
            />
            <img 
              src="/maharashtra_rajmudra_seal.png" 
              alt="Maharashtra Rajmudra Seal" 
              style={{ height: '56px', width: 'auto', objectFit: 'contain', borderRadius: '50%', background: '#ffffff', padding: '2px', boxShadow: '0 2px 4px rgba(0,0,0,0.15)' }}
            />
            <div className="header-text">
              <div className="marathi-title">महाराष्ट्र शासन (Government of Maharashtra)</div>
              <h1>MAHARASHTRA GR-Align</h1>
              <p className="subtitle">डिजिटल कक्षा अधिकारी व धोरण लेखापरीक्षण प्रणाली | Digital Desk Officer & Policy Auditor System</p>
            </div>
          </div>
          <div className="user-section">
            <div className="user-info">
              <span className="user-role-badge" style={{ backgroundColor: theme.badgeBg, color: theme.badgeColor }}>
                {user.role.toUpperCase().replace('_', ' ')}
              </span>
              <span className="user-name">{user.name}</span>
            </div>
            <select 
              className="role-selector" 
              value={user.role} 
              onChange={(e) => handleRoleChange(e.target.value)}
            >
              <option value="clerk" style={{color: 'black'}}>Clerk: John Doe (Desk Officer)</option>
              <option value="senior_officer" style={{color: 'black'}}>Senior Officer: Officer Deshmukh</option>
              <option value="minister" style={{color: 'black'}}>Minister: Hon. Minister Patil</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <nav className="nav-menu">
            <NavLink to="/" className="nav-item">
              <span className="icon">🏛️</span>
              <span className="label">Dashboard</span>
            </NavLink>
            {user.role === 'clerk' && (
              <NavLink to="/create" className="nav-item">
                <span className="icon">✍️</span>
                <span className="label">Create GR (कक्षा अधिकारी)</span>
              </NavLink>
            )}
            {(user.role === 'senior_officer' || user.role === 'minister') && (
              <NavLink to={`/approve/pending`} className="nav-item">
                <span className="icon">🗳️</span>
                <span className="label">Executive Review</span>
              </NavLink>
            )}
            <NavLink to="/analytics" className="nav-item">
              <span className="icon">📈</span>
              <span className="label">Analytics & Audit</span>
            </NavLink>
          </nav>

          <div className="sidebar-emblem-quote">
            <div className="quote-marathi">"प्रतिपच्चंद्रलेखेव वर्धिष्णुर्विश्ववंदिता"</div>
            <div className="quote-sub">Government of Maharashtra Official Portal</div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard user={user} setCurrentGR={setCurrentGR} />} />
            <Route path="/create" element={<GRWizard setCurrentGR={setCurrentGR} user={user} />} />
            <Route path="/draft/:grId" element={<DraftWorkspace currentGR={currentGR} user={user} />} />
            <Route path="/approve/:grId" element={<ExecutiveDashboard user={user} />} />
            <Route path="/analytics" element={<AnalyticsDashboard />} />
          </Routes>
        </main>
      </div>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <p>&copy; 2026 Government of Maharashtra | Manual of Office Procedure Compliant Engine</p>
          <div className="footer-links">
            <a href="#help">Help / मार्गदर्शक तत्त्वे</a>
            <a href="#rules">Rules Engine</a>
            <a href="#contact">Contact Mantralaya</a>
          </div>
        </div>
      </footer>
      {/* AI Policy Search Assistant Chatbot Widget */}
      <ChatAssistant />
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppContent />
    </Router>
  );
}

export default App