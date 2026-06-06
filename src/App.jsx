import React, { useState, useEffect } from 'react';
import { 
  Code2, 
  Database, 
  Play, 
  Bell, 
  ShieldAlert, 
  ArrowDownToLine, 
  Sparkles, 
  Trash2,
  Moon,
  Laptop,
  Smartphone
} from 'lucide-react';
import JSONEditor from './components/JSONEditor.jsx';
import LogInspector from './components/LogInspector.jsx';
import LivePreview from './components/LivePreview.jsx';
import DBViewer from './components/DBViewer.jsx';
import WorkflowBuilder from './components/WorkflowBuilder.jsx';
import AuthPanel from './components/AuthPanel.jsx';
import { TEMPLATES } from './templates.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('editor'); // editor, data, workflows, notifications, auth
  const [activeAppId, setActiveAppId] = useState('crm-app');
  const [appName, setAppName] = useState('CRM Lead Tracker');
  const [appConfig, setAppConfig] = useState(TEMPLATES.crm.config);
  const [configText, setConfigText] = useState(JSON.stringify(TEMPLATES.crm.config, null, 2));
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Studio logs & notifications
  const [logs, setLogs] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toasts, setToasts] = useState([]);

  // Multi-Auth credentials state
  const [user, setUser] = useState(null);
  const [token, setToken] = useState('');

  // -------------------------------------------------------------
  // Logging Helpers
  // -------------------------------------------------------------
  const addLog = (type, message) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { id: Math.random(), time, type, message }]);
  };

  const clearLogs = () => setLogs([]);

  // -------------------------------------------------------------
  // Toast notifications
  // -------------------------------------------------------------
  const triggerToast = (type, message) => {
    const id = Math.random();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // -------------------------------------------------------------
  // Authentication Actions
  // -------------------------------------------------------------
  const handleLogin = (sessionToken, userData) => {
    setToken(sessionToken);
    setUser(userData);
    localStorage.setItem('studio_token', sessionToken);
    localStorage.setItem('studio_user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setToken('');
    setUser(null);
    localStorage.removeItem('studio_token');
    localStorage.removeItem('studio_user');
    addLog('API', 'Session logs ended. Bearer Token revoked.');
    triggerToast('warning', 'Logged out of session');
  };

  // -------------------------------------------------------------
  // App Configurations & Sync
  // -------------------------------------------------------------
  // Load templates
  const handleImportTemplate = (templateKey) => {
    const template = TEMPLATES[templateKey];
    if (template) {
      setActiveAppId(template.id);
      setAppName(template.name);
      setAppConfig(template.config);
      const str = JSON.stringify(template.config, null, 2);
      setConfigText(str);
      addLog('API', `Loaded Template Config: ${template.name}`);
      triggerToast('info', `Template loaded: ${template.name}`);
    }
  };

  // Save active configuration to backend
  const handleSaveConfig = async (newConfig) => {
    try {
      addLog('API', `POST /api/apps`);
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeAppId,
          name: appName,
          config: newConfig
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to sync schema');

      setAppConfig(data.config);
      setConfigText(JSON.stringify(data.config, null, 2));
      addLog('DB', `INSERT OR UPDATE apps SET config_json = '...' WHERE id = '${activeAppId}'`);
      triggerToast('success', 'Runtime configuration synchronized!');
    } catch (err) {
      triggerToast('error', `Synchronization failed: ${err.message}`);
    }
  };

  // Export Bundle ZIP
  const handleExportZip = () => {
    addLog('API', `GET /api/apps/${activeAppId}/export`);
    window.location.href = `/api/apps/${activeAppId}/export`;
    triggerToast('success', 'Standalone PWA deployment package initiated');
  };

  // -------------------------------------------------------------
  // Polling Real-time Notification Engine
  // -------------------------------------------------------------
  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
        
        // Count unread notifications
        const unreads = data.filter(n => n.is_read === 0);
        setUnreadCount(unreads.length);

        // If there is a new notification, pop up a toast in the workspace!
        if (unreads.length > 0) {
          // Check if we need to toast the latest one
          const latest = unreads[0];
          // Simple verification to prevent repeating toasts
          const lastNotifiedId = localStorage.getItem('last_notified_id');
          if (lastNotifiedId !== String(latest.id)) {
            localStorage.setItem('last_notified_id', String(latest.id));
            triggerToast(latest.type || 'info', `Workflow: ${latest.message}`);
            addLog('WORKFLOW', `Real-time Notification Added: ${latest.message}`);
          }
        }
      }
    } catch (err) {
      console.warn('Poller failed: ', err);
    }
  };

  const clearAllNotifications = async () => {
    try {
      addLog('API', 'POST /api/notifications/clear');
      await fetch('/api/notifications/clear', { method: 'POST' });
      addLog('DB', 'UPDATE notifications SET is_read = 1');
      fetchNotifications();
      triggerToast('info', 'All notifications cleared');
    } catch (err) {
      triggerToast('error', 'Failed to clear notifications');
    }
  };

  // Run on mount
  useEffect(() => {
    // Attempt session restore
    const savedToken = localStorage.getItem('studio_token');
    const savedUser = localStorage.getItem('studio_user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }

    // Auto-create/sync CRM app on first load so it's in the DB
    handleSaveConfig(TEMPLATES.crm.config);

    // Poll for notifications from workflow runner
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="studio-container">
      {/* Left Sidebar */}
      <aside className="sidebar">
        <div>
          <div className="logo-container">
            <div className="logo-icon">A</div>
            <div className="logo-text">AppForge Studio</div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', marginBottom: '8px' }}>
              Active Environment
            </label>
            <input 
              type="text" 
              className="form-input" 
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderStyle: 'dashed' }}
              value={appName}
              onChange={(e) => {
                setAppName(e.target.value);
                setActiveAppId(e.target.value.toLowerCase().replace(/\s+/g, '-'));
              }}
              placeholder="App Name"
            />
          </div>

          <ul className="nav-links">
            <li className={`nav-item ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>
              <Code2 size={16} /> JSON Blueprint
            </li>
            <li className={`nav-item ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
              <Database size={16} /> Dynamic Schema
            </li>
            <li className={`nav-item ${activeTab === 'workflows' ? 'active' : ''}`} onClick={() => setActiveTab('workflows')}>
              <Play size={16} /> Automation
            </li>
            <li className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
              <Bell size={16} /> Notifications 
              {unreadCount > 0 && (
                <span style={{ marginLeft: 'auto', background: 'var(--primary)', color: '#fff', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                  {unreadCount}
                </span>
              )}
            </li>
            <li className={`nav-item ${activeTab === 'auth' ? 'active' : ''}`} onClick={() => setActiveTab('auth')}>
              <ShieldAlert size={16} /> Multi-Auth Gateway
            </li>
          </ul>
        </div>

        <div>
          <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px', marginBottom: '16px' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}></div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  Identity: <strong>{user.username}</strong>
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Not authenticated</span>
              </div>
            )}
          </div>

          <button className="btn btn-secondary" style={{ width: '100%', gap: '6px' }} onClick={handleExportZip}>
            <ArrowDownToLine size={14} /> Code Export
          </button>
        </div>
      </aside>

      {/* Main Studio Area */}
      <main className="workspace">
        {/* Left Side: Builder Work Area */}
        <section className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              {activeTab === 'editor' && 'JSON Code Editor'}
              {activeTab === 'data' && 'Database Spreadsheet'}
              {activeTab === 'workflows' && 'Automator Builder'}
              {activeTab === 'notifications' && 'System Notifications Tray'}
              {activeTab === 'auth' && 'Developer Authenticator'}
            </h2>
            <Sparkles size={16} style={{ color: 'var(--primary)' }} />
          </div>

          <div className="panel-content">
            {activeTab === 'editor' && (
              <JSONEditor 
                configText={configText}
                onChange={setConfigText}
                onSave={handleSaveConfig}
                onImportTemplate={handleImportTemplate}
              />
            )}
            
            {activeTab === 'data' && (
              <DBViewer 
                appId={activeAppId}
                appConfig={appConfig}
                onAddLog={addLog}
                onTriggerToast={triggerToast}
              />
            )}

            {activeTab === 'workflows' && (
              <WorkflowBuilder 
                appId={activeAppId}
                appConfig={appConfig}
                onSave={handleSaveConfig}
                onTriggerToast={triggerToast}
              />
            )}

            {activeTab === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Log of alerts dispatched by the runtime engine.</span>
                  <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} onClick={clearAllNotifications}>
                    <Trash2 size={12} style={{ marginRight: '4px' }} /> Clear Tray
                  </button>
                </div>
                <div style={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px', fontSize: '0.85rem' }}>
                      No notifications recorded.
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        style={{
                          padding: '12px 16px',
                          borderRadius: '8px',
                          background: 'rgba(255,255,255,0.01)',
                          border: '1px solid var(--panel-border)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          borderLeft: '3px solid',
                          borderLeftColor: n.type === 'success' ? 'var(--success)' : n.type === 'warning' ? 'var(--warning)' : n.type === 'error' ? 'var(--error)' : 'var(--primary)'
                        }}
                      >
                        <span style={{ fontSize: '0.85rem', color: '#fff', flexGrow: 1 }}>{n.message}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{new Date(n.created_at).toLocaleTimeString()}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'auth' && (
              <AuthPanel 
                user={user}
                onLogin={handleLogin}
                onLogout={handleLogout}
                onAddLog={addLog}
                onTriggerToast={triggerToast}
              />
            )}
          </div>
        </section>

        {/* Right Side: Interactive Preview & Console Logs */}
        <section style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <div style={{ flexGrow: 1, overflow: 'auto', background: 'var(--bg-deep)' }}>
            <LivePreview 
              appId={activeAppId}
              appConfig={appConfig}
              isMobileView={isMobileView}
              onToggleView={setIsMobileView}
              onAddLog={addLog}
              onTriggerToast={triggerToast}
            />
          </div>
          <LogInspector logs={logs} onClear={clearLogs} />
        </section>
      </main>

      {/* Toasts Popup Overlay Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
