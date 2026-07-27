import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import GRWizard from './components/GRWizard'
import DraftWorkspace from './components/DraftWorkspace'
import ExecutiveDashboard from './components/ExecutiveDashboard'
import AnalyticsDashboard from './components/AnalyticsDashboard'
import './App.css'

function App() {
  const [user, setUser] = useState({ role: 'clerk', name: 'John Doe', id: 'clerk_001' })
  const [currentGR, setCurrentGR] = useState(null)

  return (
    <Router>
      <div className="app">
        {/* Header */}
        <header className="header">
          <div className="header-container">
            <div className="logo-section">
              <div className="gov-logo">🏛️</div>
              <div className="header-text">
                <h1>MAHARASHTRA GR-Align</h1>
                <p>Government Resolution Management System</p>
              </div>
            </div>
            <div className="user-section">
              <span className="user-role">{user.role.toUpperCase()}</span>
              <select 
                className="role-selector" 
                value={user.role} 
                onChange={(e) => {
                  const role = e.target.value;
                  if (role === 'clerk') {
                    setUser({ role: 'clerk', name: 'John Doe', id: 'clerk_001' });
                  } else if (role === 'senior_officer') {
                    setUser({ role: 'senior_officer', name: 'Officer Deshmukh', id: 'officer_002' });
                  } else if (role === 'minister') {
                    setUser({ role: 'minister', name: 'Minister Patil', id: 'minister_003' });
                  }
                }}
                style={{
                  background: 'transparent',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '14px',
                  outline: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                <option value="clerk" style={{color: 'black'}}>Clerk: John Doe</option>
                <option value="senior_officer" style={{color: 'black'}}>Senior Officer: Officer Deshmukh</option>
                <option value="minister" style={{color: 'black'}}>Minister: Minister Patil</option>
              </select>
            </div>
          </div>
        </header>

        {/* Main Container */}
        <div className="app-container">
          {/* Sidebar */}
          <aside className="sidebar">
            <nav className="nav-menu">
              <NavLink to="/" className="nav-item">
                <span className="icon">📊</span>
                <span className="label">Dashboard</span>
              </NavLink>
              {user.role === 'clerk' && (
                <NavLink to="/create" className="nav-item">
                  <span className="icon">✍️</span>
                  <span className="label">Create GR</span>
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
                <span className="label">Analytics</span>
              </NavLink>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="main-content">
            <Routes>
              <Route path="/" element={<Dashboard user={user} setCurrentGR={setCurrentGR} />} />
              <Route path="/create" element={<GRWizard setCurrentGR={setCurrentGR} />} />
              <Route path="/draft/:grId" element={<DraftWorkspace currentGR={currentGR} user={user} />} />
              <Route path="/approve/:grId" element={<ExecutiveDashboard user={user} />} />
              <Route path="/analytics" element={<AnalyticsDashboard />} />
            </Routes>
          </main>
        </div>

        {/* Footer */}
        <footer className="footer">
          <div className="footer-content">
            <p>&copy; 2026 Government of Maharashtra | Version 1.0.0</p>
            <div className="footer-links">
              <a href="#">Help</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </Router>
  )
}

export default App