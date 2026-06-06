import React, { useState, useEffect } from 'react';
import { Monitor, Smartphone, RefreshCw, AlertTriangle, Plus, Trash2, Edit2 } from 'lucide-react';

export default function LivePreview({ appId, appConfig, isMobileView, onToggleView, onAddLog, onTriggerToast }) {
  const [currentPageId, setCurrentPageId] = useState('');
  const [tableData, setTableData] = useState({}); // tableName -> array
  const [formInputs, setFormInputs] = useState({}); // tableName -> fieldKeyValues
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState(null); // { table, row }

  // Set default page
  useEffect(() => {
    if (appConfig?.pages?.length > 0) {
      setCurrentPageId(appConfig.pages[0].id);
    }
  }, [appConfig]);

  // Load database data for active preview tables
  const fetchTableData = async (tableName) => {
    if (!appId || !tableName) return;
    try {
      onAddLog('API', `GET /api/apps/${appId}/data/${tableName}`);
      const res = await fetch(`/api/apps/${appId}/data/${tableName}`);
      const data = await res.json();
      onAddLog('DB', `SELECT * FROM documents WHERE app_id = '${appId}' AND table_name = '${tableName}'`);
      setTableData(prev => ({ ...prev, [tableName]: data }));
    } catch (err) {
      console.error(err);
      onAddLog('API', `Failed to fetch data for ${tableName}: ${err.message}`);
    }
  };

  // Trigger loading data for all tables defined in config
  const reloadAllData = () => {
    if (appConfig?.tables) {
      appConfig.tables.forEach(table => {
        if (table.name) fetchTableData(table.name);
      });
    }
  };

  useEffect(() => {
    reloadAllData();
  }, [appId, appConfig]);

  const handleInputChange = (tableName, fieldId, value) => {
    setFormInputs(prev => ({
      ...prev,
      [tableName]: {
        ...(prev[tableName] || {}),
        [fieldId]: value
      }
    }));
  };

  const handleFormSubmit = async (e, tableName, successMessage) => {
    e.preventDefault();
    const payload = formInputs[tableName] || {};
    
    try {
      setLoading(true);
      if (editingRow) {
        onAddLog('API', `PUT /api/apps/${appId}/data/${tableName}/${editingRow._id}`);
        const res = await fetch(`/api/apps/${appId}/data/${tableName}/${editingRow._id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const updated = await res.json();
        onAddLog('DB', `UPDATE documents SET data_json = '...' WHERE id = ${editingRow._id}`);
        onTriggerToast('success', 'Record updated successfully!');
        setEditingRow(null);
      } else {
        onAddLog('API', `POST /api/apps/${appId}/data/${tableName}`);
        const res = await fetch(`/api/apps/${appId}/data/${tableName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const saved = await res.json();
        onAddLog('DB', `INSERT INTO documents (app_id, table_name, data_json) VALUES ('${appId}', '${tableName}', '...')`);
        onTriggerToast('success', successMessage || 'Record saved successfully!');
      }

      // Reset inputs
      setFormInputs(prev => ({ ...prev, [tableName]: {} }));
      fetchTableData(tableName);
    } catch (err) {
      onTriggerToast('error', `Failed to save record: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRecord = async (tableName, id) => {
    if (!confirm('Are you sure you want to delete this record?')) return;
    try {
      onAddLog('API', `DELETE /api/apps/${appId}/data/${tableName}/${id}`);
      await fetch(`/api/apps/${appId}/data/${tableName}/${id}`, { method: 'DELETE' });
      onAddLog('DB', `DELETE FROM documents WHERE id = ${id}`);
      onTriggerToast('warning', 'Record removed');
      fetchTableData(tableName);
    } catch (err) {
      onTriggerToast('error', `Delete failed: ${err.message}`);
    }
  };

  const startEdit = (tableName, row) => {
    setEditingRow(row);
    // Populate form inputs
    const inputs = { ...row };
    delete inputs._id;
    delete inputs._created_at;
    delete inputs._updated_at;
    setFormInputs(prev => ({
      ...prev,
      [tableName]: inputs
    }));
  };

  // Helper: Get table field metadata by name
  const getTableFields = (tableName) => {
    const table = appConfig?.tables?.find(t => t.name === tableName);
    return table?.fields || [];
  };

  const activePage = appConfig?.pages?.find(p => p.id === currentPageId);

  return (
    <div className="device-frame-container">
      <div className="device-toggle-bar">
        <button 
          className={`device-toggle-btn ${!isMobileView ? 'active' : ''}`}
          onClick={() => onToggleView(false)}
        >
          <Monitor size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Desktop View
        </button>
        <button 
          className={`device-toggle-btn ${isMobileView ? 'active' : ''}`}
          onClick={() => onToggleView(true)}
        >
          <Smartphone size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
          Mobile View
        </button>
        <button 
          className="device-toggle-btn"
          onClick={reloadAllData}
          title="Refresh Data"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      <div className={`device-viewport ${isMobileView ? 'mobile' : 'desktop'}`}>
        {isMobileView && <div style={{
          height: '22px',
          background: '#000',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#555',
          fontSize: '0.65rem'
        }}>
          <div style={{ width: '60px', height: '12px', background: '#202538', borderRadius: '10px' }} />
        </div>}

        <div className="app-preview-header">
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>
            🚀 {appConfig?.name || 'Dynamic Runtime'}
          </span>
          <div className="app-preview-nav">
            {appConfig?.pages?.map(page => (
              <span 
                key={page.id}
                className={`app-preview-nav-item ${currentPageId === page.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPageId(page.id);
                  setEditingRow(null);
                }}
              >
                {page.title}
              </span>
            ))}
          </div>
        </div>

        <div className="app-preview-body">
          {activePage ? (
            activePage.components?.map((comp, idx) => {
              // Graceful Unknown component handling without crashing
              if (!comp.type) {
                return (
                  <div key={idx} className="unknown-component-card">
                    <AlertTriangle size={14} style={{ marginRight: '6px' }} />
                    Component type is unspecified (skipped safely).
                  </div>
                );
              }

              // Text Block Component
              if (comp.type === 'text_block') {
                return (
                  <div key={comp.id || idx} style={{ marginBottom: '20px', padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: '1.5', whiteSpace: 'pre-line' }}>
                      {comp.content || 'Default text block content'}
                    </div>
                  </div>
                );
              }

              // Form View Component
              if (comp.type === 'form_view') {
                const tableName = comp.table;
                const fields = getTableFields(tableName);
                
                return (
                  <div key={comp.id || idx} style={{ marginBottom: '20px', padding: '20px', background: '#161b2c', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.15)' }}>
                    <h4 style={{ color: '#fff', fontSize: '0.95rem', marginBottom: '16px', fontWeight: 600 }}>
                      {editingRow ? 'Edit Record' : comp.title || `Submit Data to ${tableName}`}
                    </h4>
                    
                    <form onSubmit={(e) => handleFormSubmit(e, tableName, comp.successMessage)}>
                      {fields.map(field => (
                        <div key={field.id} className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label" style={{ fontSize: '0.8rem' }}>{field.label}</label>
                          {field.type === 'select' ? (
                            <select 
                              className="form-select"
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                              value={formInputs[tableName]?.[field.id] || ''}
                              onChange={(e) => handleInputChange(tableName, field.id, e.target.value)}
                              required
                            >
                              <option value="">Select option...</option>
                              {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input 
                              type={field.type || 'text'}
                              className="form-input"
                              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
                              value={formInputs[tableName]?.[field.id] || ''}
                              onChange={(e) => handleInputChange(tableName, field.id, e.target.value)}
                              required
                            />
                          )}
                        </div>
                      ))}
                      
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="submit" className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} disabled={loading}>
                          {editingRow ? 'Update' : 'Submit'}
                        </button>
                        {editingRow && (
                          <button 
                            type="button" 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                            onClick={() => {
                              setEditingRow(null);
                              setFormInputs(prev => ({ ...prev, [tableName]: {} }));
                            }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                );
              }

              // Table View Component
              if (comp.type === 'table_view') {
                const tableName = comp.table;
                const fields = getTableFields(tableName);
                const records = tableData[tableName] || [];

                return (
                  <div key={comp.id || idx} style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <h4 style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600 }}>
                        {comp.title || `Records list: ${tableName}`}
                      </h4>
                    </div>

                    <div className="data-table-container" style={{ maxHeight: '250px' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            {fields.map(f => (
                              <th key={f.id} style={{ padding: '8px 12px', fontSize: '0.7rem' }}>{f.label}</th>
                            ))}
                            <th style={{ padding: '8px 12px', fontSize: '0.7rem', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {records.length === 0 ? (
                            <tr>
                              <td colSpan={fields.length + 1} style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '12px' }}>
                                No records found. Add some data.
                              </td>
                            </tr>
                          ) : (
                            records.map((row) => (
                              <tr key={row._id}>
                                {fields.map(f => (
                                  <td key={f.id} style={{ padding: '8px 12px', fontSize: '0.8rem' }}>{row[f.id] || '—'}</td>
                                ))}
                                <td style={{ padding: '8px 12px', fontSize: '0.8rem', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                                  <button 
                                    onClick={() => startEdit(tableName, row)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                    title="Edit Row"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteRecord(tableName, row._id)}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                    title="Delete Row"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              // Handle unknown component gracefully without breaking
              return (
                <div key={comp.id || idx} className="unknown-component-card">
                  <AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline' }} />
                  Unknown component class <strong>"{comp.type}"</strong> detected (skipped rendering gracefully).
                </div>
              );
            })
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '40px' }}>
              No pages configured. Add pages to your JSON configuration.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
