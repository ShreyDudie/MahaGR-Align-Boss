import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Check for stored authentication on mount
    const storedAuth = localStorage.getItem('mahaGR_auth');
    if (storedAuth) {
      try {
        const authData = JSON.parse(storedAuth);
        setUser(authData.user);
        setIsAuthenticated(true);
      } catch (error) {
        console.error('Failed to parse stored auth data:', error);
        localStorage.removeItem('mahaGR_auth');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData) => {
    const authData = {
      user: userData,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('mahaGR_auth', JSON.stringify(authData));
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('mahaGR_auth');
    setUser(null);
    setIsAuthenticated(false);
    navigate('/login');
  };

  const updateUser = (userData) => {
    setUser(userData);
    const storedAuth = localStorage.getItem('mahaGR_auth');
    if (storedAuth) {
      const authData = JSON.parse(storedAuth);
      authData.user = userData;
      localStorage.setItem('mahaGR_auth', JSON.stringify(authData));
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
