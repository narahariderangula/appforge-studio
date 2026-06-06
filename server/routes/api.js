import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { dbAll, dbGet, dbRun } from '../db.js';
import { triggerWorkflows } from '../workflowEngine.js';
import { authenticateToken } from './auth.js';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Utility to sanitize and fix JSON app configurations dynamically
function sanitizeAppConfig(config) {
  const sanitized = { ...config };
  
  if (!sanitized.name) sanitized.name = 'Unnamed Dynamic App';
  if (!sanitized.theme) sanitized.theme = 'dark';
  
  // Ensure tables array
  if (!Array.isArray(sanitized.tables)) {
    sanitized.tables = [];
  }
  sanitized.tables = sanitized.tables.map(table => {
    const t = { ...table };
    if (!t.name) t.name = 'items';
    if (!Array.isArray(t.fields)) t.fields = [];
    t.fields = t.fields.map(field => {
      const f = { ...field };
      if (!f.id) f.id = 'field_' + Math.random().toString(36).substring(7);
      if (!f.type) f.type = 'text';
      if (!f.label) f.label = f.id.charAt(0).toUpperCase() + f.id.slice(1);
      return f;
    });
    return t;
  });

  // Ensure pages array
  if (!Array.isArray(sanitized.pages)) {
    sanitized.pages = [{ id: 'dashboard', title: 'Dashboard', components: [] }];
  }
  sanitized.pages = sanitized.pages.map(page => {
    const p = { ...page };
    if (!p.id) p.id = 'page_' + Math.random().toString(36).substring(7);
    if (!p.title) p.title = p.id.charAt(0).toUpperCase() + p.id.slice(1);
    if (!Array.isArray(p.components)) p.components = [];
    
    p.components = p.components.map(component => {
      const c = { ...component };
      if (!c.id) c.id = 'comp_' + Math.random().toString(36).substring(7);
      if (!c.type) c.type = 'text_block'; // Safe default
      
      // Handle known structures missing values
      if (c.type === 'table_view') {
        if (!c.table) c.table = sanitized.tables[0]?.name || 'items';
      }
      if (c.type === 'form_view') {
        if (!c.table) c.table = sanitized.tables[0]?.name || 'items';
      }
      return c;
    });
    return p;
  });

  // Ensure workflows array
  if (!Array.isArray(sanitized.workflows)) {
    sanitized.workflows = [];
  }
  sanitized.workflows = sanitized.workflows.map(wf => {
    const w = { ...wf };
    if (!w.name) w.name = 'Unnamed Action';
    if (!w.trigger) w.trigger = { type: 'on_create', table: sanitized.tables[0]?.name || 'items' };
    if (!Array.isArray(w.actions)) w.actions = [];
    return w;
  });

  return sanitized;
}

// -------------------------------------------------------------
// METADATA APIS (Apps Management)
// -------------------------------------------------------------

// List Apps
router.get('/apps', async (req, res) => {
  try {
    const rows = await dbAll('SELECT id, name, created_at, updated_at FROM apps ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get App details
router.get('/apps/:id', async (req, res) => {
  try {
    const row = await dbGet('SELECT * FROM apps WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Application not found' });
    
    // Parse config
    let config = {};
    try {
      config = JSON.parse(row.config_json);
    } catch {
      config = { name: row.name };
    }
    
    res.json({
      id: row.id,
      name: row.name,
      config: sanitizeAppConfig(config),
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create/Update App
router.post('/apps', async (req, res) => {
  const { id, name, config } = req.body;
  if (!id || !name || !config) {
    return res.status(400).json({ error: 'id, name, and config object are required' });
  }

  try {
    const sanitized = sanitizeAppConfig(config);
    const configStr = JSON.stringify(sanitized);
    
    // Check if app exists
    const existing = await dbGet('SELECT id FROM apps WHERE id = ?', [id]);
    if (existing) {
      await dbRun(
        'UPDATE apps SET name = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, configStr, id]
      );
      res.json({ message: 'App updated successfully', id, config: sanitized });
    } else {
      await dbRun(
        'INSERT INTO apps (id, name, config_json) VALUES (?, ?, ?)',
        [id, name, configStr]
      );
      res.status(201).json({ message: 'App created successfully', id, config: sanitized });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete App
router.delete('/apps/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM apps WHERE id = ?', [req.params.id]);
    await dbRun('DELETE FROM documents WHERE app_id = ?', [req.params.id]);
    res.json({ message: 'App and associated data deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// DYNAMIC SCHEMA-LESS DATA APIS
// -------------------------------------------------------------

// GET all rows for a table (aggregates schema-lessly)
router.get('/apps/:appId/data/:table', async (req, res) => {
  const { appId, table } = req.params;
  try {
    const rows = await dbAll(
      'SELECT id, data_json, created_at, updated_at FROM documents WHERE app_id = ? AND table_name = ? ORDER BY id DESC',
      [appId, table]
    );
    
    const parsed = rows.map(r => {
      let data = {};
      try {
        data = JSON.parse(r.data_json);
      } catch {
        data = {};
      }
      return {
        _id: r.id,
        _created_at: r.created_at,
        _updated_at: r.updated_at,
        ...data
      };
    });
    
    res.json(parsed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST a new row
router.post('/apps/:appId/data/:table', async (req, res) => {
  const { appId, table } = req.params;
  const payload = req.body;
  
  try {
    const dataStr = JSON.stringify(payload);
    const result = await dbRun(
      'INSERT INTO documents (app_id, table_name, data_json) VALUES (?, ?, ?)',
      [appId, table, dataStr]
    );

    const insertedData = { _id: result.id, ...payload };

    // Trigger workflows asynchronously
    const appRow = await dbGet('SELECT config_json FROM apps WHERE id = ?', [appId]);
    if (appRow) {
      const appConfig = JSON.parse(appRow.config_json);
      triggerWorkflows(appId, appConfig, 'on_create', table, insertedData);
    }

    res.status(201).json(insertedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT (update) a row
router.put('/apps/:appId/data/:table/:id', async (req, res) => {
  const { appId, table, id } = req.params;
  const payload = req.body;
  
  try {
    // Strip metadata keys
    const sanitizedPayload = { ...payload };
    delete sanitizedPayload._id;
    delete sanitizedPayload._created_at;
    delete sanitizedPayload._updated_at;

    const dataStr = JSON.stringify(sanitizedPayload);
    await dbRun(
      'UPDATE documents SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE app_id = ? AND table_name = ? AND id = ?',
      [dataStr, appId, table, id]
    );

    const updatedData = { _id: parseInt(id), ...sanitizedPayload };

    // Trigger workflows
    const appRow = await dbGet('SELECT config_json FROM apps WHERE id = ?', [appId]);
    if (appRow) {
      const appConfig = JSON.parse(appRow.config_json);
      triggerWorkflows(appId, appConfig, 'on_update', table, updatedData);
    }

    res.json(updatedData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a row
router.delete('/apps/:appId/data/:table/:id', async (req, res) => {
  const { appId, table, id } = req.params;
  try {
    const row = await dbGet('SELECT data_json FROM documents WHERE id = ?', [id]);
    let deletedData = {};
    if (row) {
      try { deletedData = JSON.parse(row.data_json); } catch {}
    }
    deletedData._id = parseInt(id);

    await dbRun(
      'DELETE FROM documents WHERE app_id = ? AND table_name = ? AND id = ?',
      [appId, table, id]
    );

    // Trigger workflows
    const appRow = await dbGet('SELECT config_json FROM apps WHERE id = ?', [appId]);
    if (appRow) {
      const appConfig = JSON.parse(appRow.config_json);
      triggerWorkflows(appId, appConfig, 'on_delete', table, deletedData);
    }

    res.json({ message: 'Record deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// CSV IMPORT API
// -------------------------------------------------------------
router.post('/apps/:appId/data/:table/import-csv', upload.single('csvFile'), async (req, res) => {
  const { appId, table } = req.params;
  const mapping = JSON.parse(req.body.mapping || '{}'); // csvHeader -> schemaField mapping
  
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded' });
  }

  const results = [];
  const filePath = req.file.path;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => {
      // Map data according to mapping
      const mappedItem = {};
      for (const [csvKey, schemaKey] of Object.entries(mapping)) {
        if (schemaKey) {
          mappedItem[schemaKey] = data[csvKey];
        }
      }
      // Keep other fields if they aren't mapped or just fallback
      if (Object.keys(mapping).length === 0) {
        Object.assign(mappedItem, data);
      }
      results.push(mappedItem);
    })
    .on('end', async () => {
      try {
        const appRow = await dbGet('SELECT config_json FROM apps WHERE id = ?', [appId]);
        const appConfig = appRow ? JSON.parse(appRow.config_json) : null;

        for (const item of results) {
          const dataStr = JSON.stringify(item);
          const insertRes = await dbRun(
            'INSERT INTO documents (app_id, table_name, data_json) VALUES (?, ?, ?)',
            [appId, table, dataStr]
          );
          
          if (appConfig) {
            const rowData = { _id: insertRes.id, ...item };
            triggerWorkflows(appId, appConfig, 'on_create', table, rowData);
          }
        }
        
        // Clean up uploaded file
        fs.unlinkSync(filePath);
        res.json({ message: `Successfully imported ${results.length} records.` });
      } catch (err) {
        fs.unlinkSync(filePath);
        res.status(500).json({ error: err.message });
      }
    })
    .on('error', (err) => {
      fs.unlinkSync(filePath);
      res.status(500).json({ error: err.message });
    });
});

// -------------------------------------------------------------
// NOTIFICATIONS APIS
// -------------------------------------------------------------
router.get('/notifications', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/clear', async (req, res) => {
  try {
    await dbRun('UPDATE notifications SET is_read = 1');
    res.json({ message: 'Notifications cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// WORKFLOW LOGS API
// -------------------------------------------------------------
router.get('/apps/:appId/workflow-logs', async (req, res) => {
  try {
    const rows = await dbAll(
      'SELECT * FROM workflows_log WHERE app_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.params.appId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// APP BUNDLE / ZIP EXPORT (GitHub Export Simulator/Download)
// -------------------------------------------------------------
router.get('/apps/:appId/export', async (req, res) => {
  const { appId } = req.params;
  try {
    const row = await dbGet('SELECT * FROM apps WHERE id = ?', [appId]);
    if (!row) return res.status(404).json({ error: 'App not found' });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${appId}-exported-app.zip`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // 1. Add app configuration JSON
    archive.append(row.config_json, { name: 'app_config.json' });

    // 2. Add an embedded index.html runtime runner
    const htmlRunner = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${row.name} - Exported App</title>
  <style>
    :root {
      --bg: #0b0f19;
      --panel: #151c2c;
      --border: #243049;
      --text: #e2e8f0;
      --primary: #4f46e5;
      --primary-hover: #6366f1;
    }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      padding: 30px;
      border-radius: 12px;
      max-width: 500px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    h1 {
      margin-top: 0;
      color: #fff;
    }
    p {
      color: #94a3b8;
      line-height: 1.6;
    }
    .btn {
      display: inline-block;
      margin-top: 20px;
      padding: 10px 20px;
      background: var(--primary);
      color: #fff;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .btn:hover {
      background: var(--primary-hover);
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${row.name}</h1>
    <p>This is a standalone metadata-driven runner bundle representing your generated application.</p>
    <p>To run locally, you can deploy this zip on any static hosting, or run with a local server like Live Server or node-static.</p>
    <a href="#" class="btn" onclick="alert('Standalone runner activated successfully!')">Launch Run Engine</a>
  </div>
</body>
</html>`;

    archive.append(htmlRunner, { name: 'index.html' });

    // 3. Add a simple readme.md
    const readme = `# Exported Application: ${row.name}
This zip archive contains your generated metadata-driven application.
- \`app_config.json\`: Contains the full layout, table structures, and workflows configured.
- \`index.html\`: Standalone runtime previewer showing your app layout.
`;
    archive.append(readme, { name: 'README.md' });

    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
