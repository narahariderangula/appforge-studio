import { dbRun } from './db.js';

// Interpolates dynamic values from row data (e.g. {{data.title}})
function interpolate(template, data) {
  if (typeof template !== 'string') return template;
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const parts = path.trim().split('.');
    let current = data;
    // Remove leading 'data' if present
    const startIdx = parts[0] === 'data' ? 1 : 0;
    for (let i = startIdx; i < parts.length; i++) {
      if (current === null || current === undefined) return '';
      current = current[parts[i]];
    }
    return current !== undefined ? current : '';
  });
}

// Executes an array of actions sequentially
async function executeActions(appId, workflowName, actions, triggerType, data) {
  const logs = [];
  try {
    for (const action of actions) {
      if (action.type === 'send_notification') {
        const message = interpolate(action.message || 'Notification triggered', data);
        const notificationType = action.notificationType || 'info';
        
        await dbRun(
          'INSERT INTO notifications (app_id, message, type) VALUES (?, ?, ?)',
          [appId, message, notificationType]
        );
        logs.push(`Sent notification: "${message}"`);
      } 
      
      else if (action.type === 'call_webhook') {
        const url = interpolate(action.url, data);
        if (!url) {
          logs.push('Skipped Webhook: URL is undefined');
          continue;
        }

        // Interpolate entire payload if it is an object
        let payload = action.payload || {};
        if (typeof payload === 'object') {
          payload = JSON.parse(interpolate(JSON.stringify(payload), data));
        }

        logs.push(`Calling webhook: ${url}`);
        
        // Simulating the webhook call dynamically to make it safe and fast
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              appId,
              event: triggerType,
              data,
              payload
            }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          logs.push(`Webhook responded with status ${response.status}`);
        } catch (webhookErr) {
          logs.push(`Webhook failed: ${webhookErr.message}`);
        }
      } 
      
      else if (action.type === 'delay') {
        const duration = parseInt(action.duration) || 1000;
        logs.push(`Waiting for ${duration}ms...`);
        await new Promise((resolve) => setTimeout(resolve, duration));
      } 
      
      else if (action.type === 'update_field') {
        // Simple action to update a column in the current data payload
        const field = action.field;
        const value = interpolate(action.value, data);
        if (field) {
          data[field] = value;
          logs.push(`Updated field "${field}" to "${value}"`);
        }
      }
      
      else {
        logs.push(`Unknown action type: ${action.type}`);
      }
    }

    // Save success to workflows log
    await dbRun(
      'INSERT INTO workflows_log (app_id, workflow_name, trigger_type, status, log_message) VALUES (?, ?, ?, ?, ?)',
      [appId, workflowName, triggerType, 'success', logs.join('\n')]
    );
  } catch (error) {
    logs.push(`Error executing workflow: ${error.message}`);
    // Save failure to workflows log
    await dbRun(
      'INSERT INTO workflows_log (app_id, workflow_name, trigger_type, status, log_message) VALUES (?, ?, ?, ?, ?)',
      [appId, workflowName, triggerType, 'failed', logs.join('\n')]
    );
  }
}

// Main function to trigger workflows
export async function triggerWorkflows(appId, appConfig, triggerType, tableName, rowData) {
  if (!appConfig || !Array.isArray(appConfig.workflows)) {
    return;
  }

  // Find all workflows matching the trigger criteria
  const matchingWorkflows = appConfig.workflows.filter((wf) => {
    return (
      wf.trigger &&
      wf.trigger.type === triggerType &&
      wf.trigger.table === tableName
    );
  });

  for (const wf of matchingWorkflows) {
    console.log(`Triggering workflow "${wf.name}" for table "${tableName}" on action "${triggerType}"`);
    // Run asynchronously
    executeActions(appId, wf.name || 'Unnamed Workflow', wf.actions || [], triggerType, rowData);
  }
}
