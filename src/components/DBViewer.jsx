import React, { useState, useEffect } from 'react';
import { Database, Upload, Plus, Trash2, HelpCircle } from 'lucide-react';
import CSVImporter from './CSVImporter.jsx';

export default function DBViewer({ appId, appConfig, onAddLog, onTriggerToast }) {
  const [selectedTable, setSelectedTable] = useState('');
  const [records, setRecords] = useState([]);
  const [aggregatedHeaders, setAggregatedHeaders] = useState([]);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [newRowData, setNewRowData] = useState({});

  useEffect(() => {
    if (appConfig?.tables?.length > 0) {
      setSelectedTable(appConfig.tables[0].name);
    }
  }, [appConfig]);

  const fetchRecords = async () => {
    if (!appId || !selectedTable) return;
    try {
      onAddLog('API', `GET /api/apps/${appId}/data/${selectedTable}`);
      const res = await fetch(`/api/apps/${appId}/data/${selectedTable}`);
      const data = await res.json();
      onAddLog('DB', `SELECT * FROM documents WHERE app_id = '${appId}' AND table_name = '${selectedTable}'`);
      setRecords(data);

      // Aggregate all keys from all records to handle inconsistent schemas dynamically
      const headersSet = new Set();
      
      // First, prioritize fields declared in the JSON schema config
      const schemaTable = appConfig.tables.find(t => t.name === selectedTable);
      if (schemaTable?.fields) {
        schemaTable.fields.forEach(f => headersSet.add(f.id));
      }

      // Next, aggregate other keys present in the database rows (handles inconsistent schema entries)
      data.forEach(row => {
        Object.keys(row).forEach(key => {
          if (!key.startsWith('_')) { // Skip metadata keys like _id, _created_at, _updated_at
            headersSet.add(key);
          }
        });
      });

      setAggregatedHeaders(Array.from(headersSet));
    } catch (err) {
      onTriggerToast('error', `Failed to load schema data: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [appId, selectedTable]);

  const handleAddManualRow = async (e) => {
    e.preventDefault();
    if (Object.keys(newRowData).length === 0) {
      onTriggerToast('warning', 'Row data cannot be completely empty');
      return;
    }

    try {
      onAddLog('API', `POST /api/apps/${appId}/data/${selectedTable}`);
      const res = await fetch(`/api/apps/${appId}/data/${selectedTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRowData)
      });
      const saved = await res.json();
      onAddLog('DB', `INSERT INTO documents (app_id, table_name, data_json) VALUES ('${appId}', '${selectedTable}', '...')`);
      onTriggerToast('success', 'Manual row added successfully');
      setNewRowData({});
      fetchRecords();
    } catch (err) {
      onTriggerToast('error', err.message);
    }
  };

  const handleDeleteRow = async (id) => {
    if (!confirm('Delete this record?')) return;
    try {
      onAddLog('API', `DELETE /api/apps/${appId}/data/${selectedTable}/${id}`);
      await fetch(`/api/apps/${appId}/data/${selectedTable}/${id}`, { method: 'DELETE' });
      onAddLog('DB', `DELETE FROM documents WHERE id = ${id}`);
      onTriggerToast('warning', 'Row removed from database');
      fetchRecords();
    } catch (err) {
      onTriggerToast('error', err.message);
    }
  };

  const handleNewRowInputChange = (header, val) => {
    setNewRowData(prev => ({ ...prev, [header]: val }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>Schema-less Database Explorer</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Columns auto-aggregate across inconsistent document schemas. Missing keys default to (—).
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <select 
            className="form-select"
            style={{ width: 'auto', padding: '6px 14px', fontSize: '0.85rem' }}
            value={selectedTable}
            onChange={(e) => setSelectedTable(e.target.value)}
          >
            {appConfig?.tables?.map(t => (
              <option key={t.name} value={t.name}>{t.name.toUpperCase()} (table)</option>
            ))}
          </select>
          <button className="btn btn-secondary" onClick={() => setShowCSVModal(true)}>
            <Upload size={14} /> Import CSV
          </button>
        </div>
      </div>

      <div className="data-table-container" style={{ flexGrow: 1, overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              {aggregatedHeaders.map(h => (
                <th key={h}>{h}</th>
              ))}
              <th style={{ width: '80px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={aggregatedHeaders.length + 2} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  This table is empty. Add a manual record below or import a CSV file.
                </td>
              </tr>
            ) : (
              records.map(row => (
                <tr key={row._id}>
                  <td style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>#{row._id}</td>
                  {aggregatedHeaders.map(h => (
                    <td key={h}>
                      {row[h] !== undefined ? (
                        String(row[h])
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                  ))}
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      onClick={() => handleDeleteRow(row._id)}
                      style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inline Manual Form to insert records, even with arbitrary new keys to demonstrate schema-less capabilities */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', padding: '16px', borderRadius: '12px' }}>
        <h4 style={{ color: '#fff', fontSize: '0.85rem', marginBottom: '12px' }}>Insert Dynamic Row</h4>
        <form onSubmit={handleAddManualRow} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          {aggregatedHeaders.map(h => (
            <div key={h} style={{ flex: '1 0 120px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                {h}
              </label>
              <input 
                type="text" 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                value={newRowData[h] || ''}
                onChange={(e) => handleNewRowInputChange(h, e.target.value)}
                placeholder="value..."
              />
            </div>
          ))}
          
          <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
            <Plus size={14} /> Add Row
          </button>
        </form>
      </div>

      {showCSVModal && (
        <CSVImporter 
          appId={appId}
          tableName={selectedTable}
          headers={aggregatedHeaders}
          onClose={() => setShowCSVModal(false)}
          onImportSuccess={() => {
            setShowCSVModal(false);
            fetchRecords();
          }}
          onAddLog={onAddLog}
          onTriggerToast={onTriggerToast}
        />
      )}
    </div>
  );
}
