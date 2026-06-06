import React, { useState, useEffect } from 'react';
import { Play, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';

export default function JSONEditor({ configText, onChange, onSave, onImportTemplate }) {
  const [localText, setLocalText] = useState(configText);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLocalText(configText);
    setError(null);
  }, [configText]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setLocalText(val);
    
    // Quick lint check on keyup
    try {
      if (val.trim() === '') {
        setError('Configuration cannot be empty');
      } else {
        JSON.parse(val);
        setError(null);
      }
    } catch (err) {
      setError(`JSON Syntax Error: ${err.message}`);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(localText);
      const formatted = JSON.stringify(parsed, null, 2);
      setLocalText(formatted);
      onChange(formatted);
      setError(null);
    } catch (err) {
      setError(`Cannot format. Fix syntax error first: ${err.message}`);
    }
  };

  const handleSaveClick = () => {
    try {
      const parsed = JSON.parse(localText);
      setError(null);
      onSave(parsed);
    } catch (err) {
      setError(`Cannot save invalid JSON: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>App Blueprint Definition</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Modify layout, schema fields, and actions in real-time JSON format.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={handleFormat} title="Beautify JSON spacing">
            Format
          </button>
          <button className="btn btn-primary" onClick={handleSaveClick}>
            <Play size={14} /> Sync Runner
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 16px',
          background: 'var(--error-glow)',
          border: '1px solid var(--error)',
          borderRadius: '8px',
          color: 'var(--error)',
          fontSize: '0.85rem'
        }}>
          <AlertCircle size={16} style={{ minWidth: '16px' }} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ flexGrow: 1, position: 'relative' }}>
        <textarea
          style={{
            width: '100%',
            height: '100%',
            background: 'var(--bg-deep)',
            border: '1px solid var(--panel-border)',
            borderRadius: '12px',
            color: '#34d399',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.85rem',
            padding: '16px',
            outline: 'none',
            resize: 'none',
            lineHeight: '1.5'
          }}
          value={localText}
          onChange={handleTextChange}
          spellCheck="false"
        />
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
        <Sparkles size={16} style={{ color: 'var(--primary)' }} />
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Quick Templates:</span>
        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => onImportTemplate('crm')}>
          CRM Lead Tracker
        </button>
        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => onImportTemplate('helpdesk')}>
          IT Support Tickets
        </button>
      </div>
    </div>
  );
}
