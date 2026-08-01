import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import GRWizard from './components/GRWizard'
import DraftWorkspace from './components/DraftWorkspace'
import ExecutiveDashboard from './components/ExecutiveDashboard'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import ChatAssistant from './components/ChatAssistant'
import LoginPage from './components/LoginPage'
import Profile from './components/Profile'
import ProtectedRoute from './components/ProtectedRoute'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LayoutDashboard, FilePlus, Search, BarChart3, User, LogOut, ChevronDown } from 'lucide-react'
import './App.css'

function AppContent() {
  const { user, updateUser, logout } = useAuth()
  const [currentGR, setCurrentGR] = useState(null)
  
  const navigate = useNavigate();
  const location = useLocation();

  // Handle role-based navigation and progress preservation
  const handleRoleChange = (newRole) => {
    let userData = { ...user, role: newRole };
    // Preserve the actual user's name, only update role and ID
    if (newRole === 'clerk') {
      userData.id = 'clerk_001';
    } else if (newRole === 'senior_officer') {
      userData.id = 'officer_002';
    } else if (newRole === 'minister') {
      userData.id = 'minister_003';
    }

    updateUser(userData);

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


  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="app">
      {/* Tricolor Header Bar */}
      <div className="tricolor-header-bar"></div>

      {/* Header - Government of Maharashtra Portal Style */}
      <header className="header">
        <div className="header-container">
          <div className="logo-section">
            <img 
              src="/emblem_india_maharashtra.png" 
              alt="State Emblem of India - Government of Maharashtra" 
              style={{ height: '56px', width: 'auto', objectFit: 'contain', background: '#ffffff', padding: '4px 8px', borderRadius: '4px' }}
            />
          </div>
          <div className="header-text">
            <div className="marathi-title">महाराष्ट्र शासन (Government of Maharashtra)</div>
            <h1>MAHARASHTRA GR-Align</h1>
            <p className="subtitle">डिजिटल कक्षा अधिकारी व धोरण लेखापरीक्षण प्रणाली | Digital Desk Officer & Policy Auditor System</p>
          </div>
          <div className="emblem-section">
            <img 
              src="/maharashtra_rajmudra_seal.png" 
              alt="Maharashtra Rajmudra Seal" 
              style={{ height: '56px', width: 'auto', objectFit: 'contain', borderRadius: '50%', background: '#ffffff', padding: '2px' }}
            />
          </div>
          <div className="user-section">
            <div className="user-profile-menu">
              <button className="profile-toggle">
                <div className="user-avatar">
                  <span className="avatar-initial">{user.name.charAt(0)}</span>
                </div>
                <div className="user-details">
                  <span className="user-name">{user.name}</span>
                  <span className="user-role">{user.role.replace('_', ' ').toUpperCase()}</span>
                </div>
                <ChevronDown size={16} strokeWidth={2} className="dropdown-arrow" />
              </button>
              <div className="profile-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">
                    <span className="avatar-initial">{user.name.charAt(0)}</span>
                  </div>
                  <div className="dropdown-user-info">
                    <span className="dropdown-user-name">{user.name}</span>
                    <span className="dropdown-user-role">{user.role.replace('_', ' ').toUpperCase()}</span>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item">
                  <User size={16} strokeWidth={2} className="dropdown-icon" />
                  <span>My Profile</span>
                </button>
                <button className="dropdown-item">
                  <LayoutDashboard size={16} strokeWidth={2} className="dropdown-icon" />
                  <span>Settings</span>
                </button>
                <button className="dropdown-item">
                  <FilePlus size={16} strokeWidth={2} className="dropdown-icon" />
                  <span>Change Password</span>
                </button>
                <div className="dropdown-divider"></div>
                <button className="dropdown-item logout-item" onClick={logout}>
                  <LogOut size={16} strokeWidth={2} className="dropdown-icon" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
          <nav className="nav-menu">
            <NavLink to="/" className="nav-item">
              <LayoutDashboard size={20} strokeWidth={2} className="nav-icon" />
              <span className="label">Dashboard</span>
            </NavLink>
            {user.role === 'clerk' && (
              <NavLink to="/create" className="nav-item">
                <FilePlus size={20} strokeWidth={2} className="nav-icon" />
                <span className="label">Create GR (कक्षा अधिकारी)</span>
              </NavLink>
            )}
            {(user.role === 'senior_officer' || user.role === 'minister') && (
              <NavLink to={`/approve/pending`} className="nav-item">
                <FilePlus size={20} strokeWidth={2} className="nav-icon" />
                <span className="label">Executive Review</span>
              </NavLink>
            )}
            <NavLink to="/analytics" className="nav-item">
              <BarChart3 size={20} strokeWidth={2} className="nav-icon" />
              <span className="label">Analytics & Audit</span>
            </NavLink>
          </nav>

          <div className="sidebar-footer">
            <NavLink to="/profile" className="nav-item footer-nav-item">
              <User size={20} strokeWidth={2} className="nav-icon" />
              <span className="label">Profile</span>
            </NavLink>
            <button className="nav-item footer-nav-item logout-btn" onClick={logout}>
              <LogOut size={20} strokeWidth={2} className="nav-icon" />
              <span className="label">Logout</span>
            </button>
          </div>

          <div className="sidebar-emblem-quote">
            <div className="quote-marathi">"प्रतिपच्चंद्रलेखेव वर्धिष्णुर्विश्ववंदिता"</div>
            <div className="quote-sub">Government of Maharashtra Official Portal</div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="main-content">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard user={user} setCurrentGR={setCurrentGR} />
              </ProtectedRoute>
            } />
            <Route path="/create" element={
              <ProtectedRoute>
                <GRWizard setCurrentGR={setCurrentGR} user={user} />
              </ProtectedRoute>
            } />
            <Route path="/draft/:grId" element={
              <ProtectedRoute>
                <DraftWorkspace currentGR={currentGR} user={user} />
              </ProtectedRoute>
            } />
            <Route path="/approve/:grId" element={
              <ProtectedRoute>
                <ExecutiveDashboard user={user} />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute>
                <AnalyticsDashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
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
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App