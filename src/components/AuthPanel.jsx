import React, { useState } from 'react';
import { Shield, Lock, Key, UserCheck, LogOut, CheckCircle } from 'lucide-react';

export default function AuthPanel({ user, onLogin, onLogout, onAddLog, onTriggerToast }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [tokenVal, setTokenVal] = useState('');
  const [activeMethod, setActiveMethod] = useState('password'); // password, token, anonymous
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) return;
    try {
      setLoading(true);
      onAddLog('API', `POST /api/auth/login/password`);
      const res = await fetch('/api/auth/login/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      onTriggerToast('success', `Logged in via Credentials: ${data.user.username}`);
      onLogin(data.token, data.user);
    } catch (err) {
      onTriggerToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenLogin = async (e) => {
    e.preventDefault();
    if (!tokenVal) return;
    try {
      setLoading(true);
      onAddLog('API', `POST /api/auth/login/token`);
      const res = await fetch('/api/auth/login/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenVal })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Token validation failed');

      onTriggerToast('success', `Authenticated via API Developer Token: ${data.user.username}`);
      onLogin(data.token, data.user);
    } catch (err) {
      onTriggerToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      setLoading(true);
      onAddLog('API', `POST /api/auth/login/anonymous`);
      const res = await fetch('/api/auth/login/anonymous', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed anonymous access');

      onTriggerToast('success', `Logged in anonymously as ${data.user.username}`);
      onLogin(data.token, data.user);
    } catch (err) {
      onTriggerToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '30px', height: '100%' }}>
      {/* Configuration Column */}
      <div style={{ borderRight: '1px solid var(--panel-border)', paddingRight: '30px' }}>
        <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={16} style={{ color: 'var(--primary)' }} />
          Authentication Gateway
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Demonstrate Multi-Auth login by authenticating the session using three independent credential protocols.
        </p>

        {user ? (
          <div style={{
            background: 'var(--success-glow)',
            border: '1px solid var(--success)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: '12px'
          }}>
            <CheckCircle size={36} style={{ color: 'var(--success)' }} />
            <div>
              <h4 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600 }}>Active Session Authenticated</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                Identity: <strong>{user.username}</strong> ({user.role})
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px', wordBreak: 'break-all' }}>
                Token Level: {user.apiToken || 'Session JWT'}
              </p>
            </div>
            <button className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={onLogout}>
              <LogOut size={14} /> End Session
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className={`nav-item ${activeMethod === 'password' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }}
              onClick={() => setActiveMethod('password')}
            >
              <Lock size={14} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Credentials Authentication</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Email/Password standard login</span>
              </div>
            </button>
            
            <button 
              className={`nav-item ${activeMethod === 'token' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }}
              onClick={() => setActiveMethod('token')}
            >
              <Key size={14} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Developer Token</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Static API Bearer Token</span>
              </div>
            </button>
            
            <button 
              className={`nav-item ${activeMethod === 'anonymous' ? 'active' : ''}`}
              style={{ justifyContent: 'flex-start', textAlign: 'left', width: '100%' }}
              onClick={() => setActiveMethod('anonymous')}
            >
              <UserCheck size={14} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Anonymous Access</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Temporary session tokens</span>
              </div>
            </button>
          </div>
        )}
      </div>

      {/* Forms Column */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {!user ? (
          <div style={{ background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
            {activeMethod === 'password' && (
              <form onSubmit={handlePasswordLogin}>
                <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '16px', fontWeight: 600 }}>Login with Credentials</h4>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '15px' }}>
                  <span>Default credentials:</span>
                  <code>admin / admin123</code>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Authenticating...' : 'Sign In'}
                </button>
              </form>
            )}

            {activeMethod === 'token' && (
              <form onSubmit={handleTokenLogin}>
                <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '16px', fontWeight: 600 }}>API Token Login</h4>
                <div className="form-group">
                  <label className="form-label">API Bearer Token</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="tok_..." 
                    value={tokenVal} 
                    onChange={(e) => setTokenVal(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Validating Token...' : 'Authorize Session'}
                </button>
              </form>
            )}

            {activeMethod === 'anonymous' && (
              <div style={{ textAlign: 'center' }}>
                <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '12px', fontWeight: 600 }}>Guest Registration</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '20px' }}>
                  No password required. Requests a limited-access JWT session valid for 2 hours.
                </p>
                <button onClick={handleAnonymousLogin} className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                  {loading ? 'Registering Guest...' : 'Access Anonymously'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>
            Active login profile active. Close session to switch protocols.
          </div>
        )}
      </div>
    </div>
  );
}
