import React, { useState } from 'react';
import { X, FileText, ArrowRight, AlertCircle } from 'lucide-react';

export default function CSVImporter({ appId, tableName, headers, onClose, onImportSuccess, onAddLog, onTriggerToast }) {
  const [csvText, setCsvText] = useState('');
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [mapping, setMapping] = useState({}); // csvHeader -> dbHeader
  const [step, setStep] = useState(1); // 1 = input CSV, 2 = mapping
  const [loading, setLoading] = useState(false);

  const parseHeadersFromText = (text) => {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return [];
    const firstLine = lines[0];
    return firstLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  };

  const handleNextStep = () => {
    let headersFound = [];
    if (file) {
      // For simple local parsing of first line of file before upload
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        headersFound = parseHeadersFromText(text);
        if (headersFound.length === 0) {
          onTriggerToast('error', 'No columns identified in CSV file');
          return;
        }
        setCsvHeaders(headersFound);
        // Pre-configure auto matching
        const initialMap = {};
        headersFound.forEach(h => {
          // find matching db header case-insensitively
          const match = headers.find(dbH => dbH.toLowerCase() === h.toLowerCase());
          initialMap[h] = match || '';
        });
        setMapping(initialMap);
        setStep(2);
      };
      reader.readAsText(file);
    } else if (csvText.trim()) {
      headersFound = parseHeadersFromText(csvText);
      if (headersFound.length === 0) {
        onTriggerToast('error', 'Please enter some CSV content');
        return;
      }
      setCsvHeaders(headersFound);
      const initialMap = {};
      headersFound.forEach(h => {
        const match = headers.find(dbH => dbH.toLowerCase() === h.toLowerCase());
        initialMap[h] = match || '';
      });
      setMapping(initialMap);
      setStep(2);
    } else {
      onTriggerToast('error', 'Upload a file or paste CSV text to continue');
    }
  };

  const handleMappingChange = (csvH, dbH) => {
    setMapping(prev => ({ ...prev, [csvH]: dbH }));
  };

  const handleUploadSubmit = async () => {
    try {
      setLoading(true);
      const formData = new FormData();
      
      if (file) {
        formData.append('csvFile', file);
      } else {
        // Create virtual file from text
        const blob = new Blob([csvText], { type: 'text/csv' });
        formData.append('csvFile', blob, 'pasted-data.csv');
      }

      formData.append('mapping', JSON.stringify(mapping));
      onAddLog('API', `POST /api/apps/${appId}/data/${tableName}/import-csv`);

      const res = await fetch(`/api/apps/${appId}/data/${tableName}/import-csv`, {
        method: 'POST',
        body: formData
      });
      
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to import CSV');

      onAddLog('DB', `Bulk INSERT transactions into ${tableName}`);
      onTriggerToast('success', resData.message || 'CSV imported successfully!');
      onImportSuccess();
    } catch (err) {
      onTriggerToast('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '550px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--panel-border)', paddingBottom: '10px' }}>
          <h3 style={{ color: '#fff', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: 'var(--primary)' }} />
            Import CSV data to table "{tableName}"
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>

        {step === 1 ? (
          <div>
            <div className="form-group">
              <label className="form-label">Option A: Upload CSV File</label>
              <input 
                type="file" 
                accept=".csv" 
                className="form-input" 
                onChange={(e) => {
                  setFile(e.target.files[0]);
                  setCsvText('');
                }}
              />
            </div>
            
            <div style={{ textAlign: 'center', margin: '15px 0', color: 'var(--text-muted)', fontSize: '0.8rem', position: 'relative' }}>
              <span style={{ background: 'var(--bg-deep)', padding: '0 10px', position: 'relative', zIndex: 1 }}>OR PASTE TEXT</span>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'var(--panel-border)', zIndex: 0 }}></div>
            </div>

            <div className="form-group">
              <label className="form-label">Option B: Paste Comma-Separated Values</label>
              <textarea 
                className="form-textarea"
                placeholder="name,email,company&#10;Alice Smith,alice@google.com,Google&#10;Bob Jones,bob@microsoft.com,Microsoft"
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setFile(null);
                }}
                style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleNextStep}>
                Next <ArrowRight size={14} />
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--panel-border)', borderRadius: '8px', marginBottom: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <AlertCircle size={14} style={{ color: 'var(--primary)', minWidth: '14px' }} />
              Map CSV columns on the left to target database columns on the right.
            </div>

            <div style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {csvHeaders.map(csvH => (
                <div key={csvH} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-dark)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--panel-border)' }}>
                  <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                    {csvH}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  <select 
                    className="form-select" 
                    style={{ width: '180px', padding: '4px 8px', fontSize: '0.8rem' }}
                    value={mapping[csvH] || ''}
                    onChange={(e) => handleMappingChange(csvH, e.target.value)}
                  >
                    <option value="">(Ignore Column)</option>
                    {headers.map(dbH => (
                      <option key={dbH} value={dbH}>{dbH}</option>
                    ))}
                    {/* Fallback to let them bind it as custom column */}
                    {!headers.includes(csvH) && (
                      <option value={csvH}>+ Create "{csvH}" field</option>
                    )}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)} disabled={loading}>Back</button>
              <button className="btn btn-primary" onClick={handleUploadSubmit} disabled={loading}>
                {loading ? 'Importing...' : 'Start Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
