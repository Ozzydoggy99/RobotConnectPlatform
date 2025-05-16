import { useState } from 'react';
import { useLocation } from 'wouter';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setLocation] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    
    try {
      // For now, hardcode the credentials as specified in requirements
      if (username === 'Ozzydog' && password === 'Ozzydog') {
        // Store auth token and user data in localStorage
        localStorage.setItem('auth', 'true');
        localStorage.setItem('username', username);
        localStorage.setItem('lastLogin', new Date().toISOString());
        
        // Navigate to dashboard
        setLocation('/dashboard');
      } else {
        setError('Invalid username or password');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Simple inline styles to avoid component dependencies
  const pageStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#111827',
    padding: '1rem'
  };
  
  const cardStyle = {
    maxWidth: '400px',
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    padding: '2rem',
    color: '#f3f4f6',
    border: '1px solid #374151'
  };
  
  const headingStyle = {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    background: 'linear-gradient(to right, #10b981, #059669)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem',
    textAlign: 'center' as const
  };
  
  const subheadingStyle = {
    color: '#9ca3af',
    fontSize: '1.125rem',
    marginBottom: '2rem',
    textAlign: 'center' as const
  };
  
  const titleStyle = {
    fontSize: '1.5rem',
    textAlign: 'center' as const,
    marginBottom: '1.5rem',
    color: '#f3f4f6'
  };
  
  const formGroupStyle = {
    marginBottom: '1.5rem'
  };
  
  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    color: '#d1d5db'
  };
  
  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    backgroundColor: '#1f2937',
    border: '1px solid #374151',
    borderRadius: '4px',
    color: '#f3f4f6',
    fontSize: '1rem'
  };
  
  const buttonStyle = {
    width: '100%',
    padding: '0.75rem',
    background: 'linear-gradient(to right, #10b981, #065f46)',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontWeight: 'bold',
    fontSize: '1rem',
    cursor: 'pointer'
  };
  
  const errorStyle = {
    backgroundColor: 'rgba(220, 38, 38, 0.2)',
    color: '#f87171',
    padding: '0.75rem',
    borderRadius: '4px',
    marginBottom: '1rem',
    border: '1px solid #ef4444'
  };
  
  const footerStyle = {
    marginTop: '1.5rem',
    textAlign: 'center' as const,
    color: '#6b7280',
    fontSize: '0.875rem'
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div>
          <h1 style={headingStyle}>SKYTECH AUTOMATED</h1>
          <p style={subheadingStyle}>Robot Fleet Management System</p>
        </div>
        
        <h2 style={titleStyle}>Admin Login</h2>
        
        {error && (
          <div style={errorStyle}>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div style={formGroupStyle}>
            <label htmlFor="username" style={labelStyle}>Username</label>
            <input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
              autoFocus
              required
            />
          </div>
          
          <div style={formGroupStyle}>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
              required
            />
          </div>
          
          <button 
            type="submit" 
            style={buttonStyle}
            disabled={isLoading}
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div style={footerStyle}>
          <p>Fleet Management Admin Portal</p>
          <p style={{fontSize: '0.75rem', marginTop: '0.5rem'}}>
            Access credentials: Ozzydog / Ozzydog
          </p>
        </div>
      </div>
    </div>
  );
}