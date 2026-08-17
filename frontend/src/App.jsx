import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Register from './pages/Register';
import EmployeeDashboard from './pages/EmployeeDashboard';
import ManagerDashboard from './pages/ManagerDashboard';

export default function App() {
  const [page, setPage] = useState('login');
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [toasts, setToasts] = useState([]);

  // Session Restore on bootup
  useEffect(() => {
    const savedToken = localStorage.getItem('leave_mgmt_token');
    const savedUser = localStorage.getItem('leave_mgmt_user');

    if (savedToken && savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setToken(savedToken);
      setUser(parsedUser);
      if (parsedUser.role === 'manager') {
        setPage('manager-dashboard');
      } else {
        setPage('employee-dashboard');
      }
    }
  }, []);

  // Toast System
  const addToast = (title, message, type = 'info') => {
    const id = Date.now() + Math.random().toString(36).substr(2, 9);
    const newToast = { id, title, message, type };
    
    setToasts((prev) => [...prev, newToast]);

    // Self destroy after 4.5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4500);
  };

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLoginSuccess = (userToken, userData) => {
    setToken(userToken);
    setUser(userData);
    localStorage.setItem('leave_mgmt_token', userToken);
    localStorage.setItem('leave_mgmt_user', JSON.stringify(userData));

    if (userData.role === 'manager') {
      setPage('manager-dashboard');
    } else {
      setPage('employee-dashboard');
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('leave_mgmt_token');
    localStorage.removeItem('leave_mgmt_user');
    setPage('login');
    addToast('Logged Out', 'You have been signed out of the system', 'info');
  };

  const navigate = (destination) => {
    // Basic state routing
    setPage(destination);
  };

  // Render correct page view
  const renderPage = () => {
    switch (page) {
      case 'login':
        return (
          <Login 
            onLoginSuccess={handleLoginSuccess} 
            navigate={navigate} 
            addToast={addToast} 
          />
        );
      case 'register':
        return (
          <Register 
            navigate={navigate} 
            addToast={addToast} 
          />
        );
      case 'employee-dashboard':
        return token && user && user.role === 'employee' ? (
          <EmployeeDashboard 
            token={token} 
            user={user} 
            onLogout={handleLogout} 
            addToast={addToast} 
          />
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} navigate={navigate} addToast={addToast} />
        );
      case 'manager-dashboard':
        return token && user && user.role === 'manager' ? (
          <ManagerDashboard 
            token={token} 
            user={user} 
            onLogout={handleLogout} 
            addToast={addToast} 
          />
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} navigate={navigate} addToast={addToast} />
        );
      default:
        return <Login onLoginSuccess={handleLoginSuccess} navigate={navigate} addToast={addToast} />;
    }
  };

  return (
    <div className="app-shell" style={{ position: 'relative', minHeight: '100vh' }}>
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className={`toast toast-${toast.type}`}
            id={`toast-${toast.id}`}
          >
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => removeToast(toast.id)}>
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Renders the current view */}
      {renderPage()}
    </div>
  );
}
