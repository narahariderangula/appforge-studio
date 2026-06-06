import React, { useState } from 'react';
import { Play, Plus, Trash2, HelpCircle, AlertCircle, Settings } from 'lucide-react';

export default function WorkflowBuilder({ appId, appConfig, onSave, onTriggerToast }) {
  const [activeWorkflowId, setActiveWorkflowId] = useState('');

  const workflows = appConfig?.workflows || [];
  const tables = appConfig?.tables || [];

  const handleCreateWorkflow = () => {
    const newId = 'wf_' + Math.random().toString(36).substring(7);
    const newWorkflow = {
      id: newId,
      name: 'New Custom Automator',
      trigger: {
        type: 'on_create',
        table: tables[0]?.name || 'items'
      },
      actions: [
        {
          type: 'send_notification',
          message: 'Alert triggered for table item!',
          notificationType: 'info'
        }
      ]
    };

    const updated = {
      ...appConfig,
      workflows: [...workflows, newWorkflow]
    };
    onSave(updated);
    setActiveWorkflowId(newId);
    onTriggerToast('success', 'Workflow rule created. Sync config to save.');
  };

  const handleDeleteWorkflow = (id) => {
    const updated = {
      ...appConfig,
      workflows: workflows.filter(w => w.id !== id)
    };
    onSave(updated);
    if (activeWorkflowId === id) {
      setActiveWorkflowId('');
    }
    onTriggerToast('warning', 'Workflow rule deleted');
  };

  const handleUpdateWorkflow = (wfId, updatedFields) => {
    const updated = {
      ...appConfig,
      workflows: workflows.map(w => {
        if (w.id === wfId) {
          return { ...w, ...updatedFields };
        }
        return w;
      })
    };
    onSave(updated);
  };

  const handleAddAction = (wfId) => {
    const wf = workflows.find(w => w.id === wfId);
    if (!wf) return;

    const newAction = {
      type: 'send_notification',
      message: 'New event summary text.',
      notificationType: 'info'
    };

    handleUpdateWorkflow(wfId, {
      actions: [...(wf.actions || []), newAction]
    });
  };

  const handleDeleteAction = (wfId, index) => {
    const wf = workflows.find(w => w.id === wfId);
    if (!wf) return;

    const updatedActions = [...wf.actions];
    updatedActions.splice(index, 1);

    handleUpdateWorkflow(wfId, {
      actions: updatedActions
    });
  };

  const handleActionChange = (wfId, index, key, value) => {
    const wf = workflows.find(w => w.id === wfId);
    if (!wf) return;

    const updatedActions = wf.actions.map((act, i) => {
      if (i === index) {
        // Reset fields when type changes to prevent dirty configuration
        if (key === 'type') {
          if (value === 'send_notification') {
            return { type: 'send_notification', message: 'Task added: {{data.title}}', notificationType: 'info' };
          }
          if (value === 'call_webhook') {
            return { type: 'call_webhook', url: 'https://httpbin.org/post', payload: { event: 'create', data: '{{data}}' } };
          }
          if (value === 'delay') {
            return { type: 'delay', duration: 2000 };
          }
        }
        return { ...act, [key]: value };
      }
      return act;
    });

    handleUpdateWorkflow(wfId, {
      actions: updatedActions
    });
  };

  const selectedWf = workflows.find(w => w.id === activeWorkflowId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '20px', height: '100%' }}>
      {/* Sidebar List */}
      <div style={{ borderRight: '1px solid var(--panel-border)', paddingRight: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <h4 style={{ color: '#fff', fontSize: '0.9rem', marginBottom: '4px' }}>Workflows</h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexGrow: 1, overflowY: 'auto' }}>
          {workflows.map(wf => (
            <div 
              key={wf.id}
              onClick={() => setActiveWorkflowId(wf.id)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                background: activeWorkflowId === wf.id ? 'var(--primary-glow)' : 'rgba(255,255,255,0.01)',
                border: '1px solid',
                borderColor: activeWorkflowId === wf.id ? 'var(--primary)' : 'var(--panel-border)',
                color: activeWorkflowId === wf.id ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '110px' }}>
                {wf.name}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteWorkflow(wf.id);
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={handleCreateWorkflow}>
          <Plus size={12} /> Add Rule
        </button>
      </div>

      {/* Designer Workspace */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', overflowY: 'auto' }}>
        {selectedWf ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <input 
                type="text"
                className="form-input"
                style={{ fontSize: '1rem', fontWeight: 600, width: '250px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--panel-border)', borderRadius: 0, padding: '4px 0' }}
                value={selectedWf.name}
                onChange={(e) => handleUpdateWorkflow(selectedWf.id, { name: e.target.value })}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {selectedWf.id}</span>
            </div>

            {/* Trigger Configuration */}
            <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--panel-border)', padding: '16px', borderRadius: '8px' }}>
              <h5 style={{ color: '#fff', fontSize: '0.85rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Settings size={14} style={{ color: 'var(--primary)' }} /> Trigger Activation Rule
              </h5>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>When Event Occurs</label>
                  <select 
                    className="form-select"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    value={selectedWf.trigger?.type || 'on_create'}
                    onChange={(e) => handleUpdateWorkflow(selectedWf.id, {
                      trigger: { ...selectedWf.trigger, type: e.target.value }
                    })}
                  >
                    <option value="on_create">Row Added (on_create)</option>
                    <option value="on_update">Row Updated (on_update)</option>
                    <option value="on_delete">Row Deleted (on_delete)</option>
                  </select>
                </div>
                
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Target Table</label>
                  <select 
                    className="form-select"
                    style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                    value={selectedWf.trigger?.table || ''}
                    onChange={(e) => handleUpdateWorkflow(selectedWf.id, {
                      trigger: { ...selectedWf.trigger, table: e.target.value }
                    })}
                  >
                    {tables.map(t => (
                      <option key={t.name} value={t.name}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions list */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h5 style={{ color: '#fff', fontSize: '0.85rem' }}>Sequential Actions Checklist</h5>
                <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }} onClick={() => handleAddAction(selectedWf.id)}>
                  <Plus size={12} /> Add Action Step
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {selectedWf.actions?.map((action, idx) => (
                  <div 
                    key={idx} 
                    style={{
                      background: 'rgba(255,255,255,0.015)',
                      border: '1px solid var(--panel-border)',
                      padding: '16px',
                      borderRadius: '8px',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 700 }}>STEP #{idx + 1}</span>
                      <button 
                        onClick={() => handleDeleteAction(selectedWf.id, idx)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Action Type</label>
                        <select 
                          className="form-select"
                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                          value={action.type}
                          onChange={(e) => handleActionChange(selectedWf.id, idx, 'type', e.target.value)}
                        >
                          <option value="send_notification">Send Notification</option>
                          <option value="call_webhook">Call External Webhook</option>
                          <option value="delay">Execution Delay</option>
                        </select>
                      </div>

                      <div>
                        {action.type === 'send_notification' && (
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flexGrow: 1 }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Message template (use &#123;&#123;data.field&#125;&#125;)</label>
                              <input 
                                type="text"
                                className="form-input"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                value={action.message || ''}
                                onChange={(e) => handleActionChange(selectedWf.id, idx, 'message', e.target.value)}
                                placeholder="Alert: {{data.name}} updated!"
                              />
                            </div>
                            <div style={{ width: '120px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Alert Type</label>
                              <select
                                className="form-select"
                                style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                value={action.notificationType || 'info'}
                                onChange={(e) => handleActionChange(selectedWf.id, idx, 'notificationType', e.target.value)}
                              >
                                <option value="info">Info (Blue)</option>
                                <option value="success">Success (Green)</option>
                                <option value="warning">Warning (Yellow)</option>
                                <option value="error">Error (Red)</option>
                              </select>
                            </div>
                          </div>
                        )}

                        {action.type === 'call_webhook' && (
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Webhook Destination URL</label>
                            <input 
                              type="text"
                              className="form-input"
                              style={{ padding: '6px 10px', fontSize: '0.8rem', marginBottom: '8px' }}
                              value={action.url || ''}
                              onChange={(e) => handleActionChange(selectedWf.id, idx, 'url', e.target.value)}
                              placeholder="https://yourserver.com/webhook"
                            />
                            <div style={{ padding: '8px', background: 'var(--bg-dark)', borderRadius: '4px', border: '1px solid var(--panel-border)', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              Payload sends: <code>{"{ appId, event, data }"}</code> in request body.
                            </div>
                          </div>
                        )}

                        {action.type === 'delay' && (
                          <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Delay Duration (milliseconds)</label>
                            <input 
                              type="number"
                              className="form-input"
                              style={{ padding: '6px 10px', fontSize: '0.8rem', width: '120px' }}
                              value={action.duration || 1000}
                              onChange={(e) => handleActionChange(selectedWf.id, idx, 'duration', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '10px' }}>
            <AlertCircle size={28} style={{ color: 'var(--text-muted)' }} />
            <span>Select or create a workflow to edit triggers and action pipes.</span>
          </div>
        )}
      </div>
    </div>
  );
}
