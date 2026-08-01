import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './LoginPage.css';

function LoginPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Extract name from email if full name not provided
    const displayName = formData.fullName || formData.email.split('@')[0];
    const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1).toLowerCase();
    
    // For demo purposes, authenticate as clerk with actual user data
    const userData = {
      role: 'clerk',
      name: formattedName,
      id: 'clerk_001',
      email: formData.email,
      department: 'Administration'
    };
    login(userData);
    navigate('/');
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="logos-section">
            <img 
              src="/emblem_india_maharashtra.png" 
              alt="State Emblem of India - Government of Maharashtra" 
              className="emblem-logo"
            />
            <img 
              src="/maharashtra_rajmudra_seal.png" 
              alt="Maharashtra Rajmudra Seal" 
              className="seal-logo"
            />
          </div>
          <h1>MAHARASHTRA GR-Align</h1>
          <p className="login-subtitle">Digital Desk Officer & Policy Auditor System</p>
          <p className="login-subtitle-marathi">डिजिटल कक्षा अधिकारी व धोरण लेखापरीक्षण प्रणाली</p>
        </div>
        
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="fullName">Full Name</label>
            <input
              type="text"
              id="fullName"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Enter your full name"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Enter your password"
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
              </button>
            </div>
          </div>

          <div className="form-options">
            <label className="remember-me">
              <input type="checkbox" name="remember" />
              <span>Remember me</span>
            </label>
            <a href="/forgot-password" className="forgot-password">Forgot password?</a>
          </div>

          <button type="submit" className="login-button">Sign In</button>

          <div className="login-footer">
            <p>&copy; Government of Maharashtra</p>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
