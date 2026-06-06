import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Trash2, ShieldCheck, Database, Play } from 'lucide-react';

export default function LogInspector({ logs = [], onClear }) {
  const feedRef = useRef(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [logs]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'db') return log.type === 'DB';
    if (filter === 'workflow') return log.type === 'WORKFLOW';
    if (filter === 'api') return log.type === 'API';
    return true;
  });

  const getIcon = (type) => {
    switch (type) {
      case 'DB': return <Database size={12} style={{ color: 'var(--success)' }} />;
      case 'WORKFLOW': return <Play size={12} style={{ color: 'var(--warning)' }} />;
      case 'API': return <ShieldCheck size={12} style={{ color: 'var(--primary)' }} />;
      default: return <Terminal size={12} style={{ color: 'var(--text-secondary)' }} />;
    }
  };

  return (
    <div className="inspector-panel">
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid var(--panel-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(11, 17, 32, 0.9)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={14} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-heading)' }}>
            Real-Time Engine Inspector
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
            style={{
              background: 'var(--bg-dark)',
              border: '1px solid var(--panel-border)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              fontSize: '0.75rem',
              padding: '2px 8px',
              outline: 'none'
            }}
          >
            <option value="all">All Logs</option>
            <option value="db">DB Queries</option>
            <option value="workflow">Workflows</option>
            <option value="api">API Endpoints</option>
          </select>
          <button 
            onClick={onClear} 
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-muted)', 
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Clear Console"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="log-feed" ref={feedRef}>
        {filteredLogs.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textAlign: 'center', padding: '20px' }}>
            Console idle. Trigger actions in preview to inspect logs.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="log-entry">
              <span className="log-timestamp">[{log.time}]</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                {getIcon(log.type)} {log.type}
              </span>
              <span style={{ color: '#e2e8f0', flexGrow: 1, whiteSpace: 'pre-wrap' }}>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
