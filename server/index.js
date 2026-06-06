import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import apiRoutes from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Track DB initialization state
let dbInitialized = false;

// Enable CORS and body parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend build assets
app.use(express.static(path.join(__dirname, '../dist')));

// Initialize DB before handling requests
app.use(async (req, res, next) => {
  if (!dbInitialized) {
    try {
      await initDb();
      dbInitialized = true;
      console.log('Database initialized successfully.');
    } catch (err) {
      console.error('Failed to initialize database:', err);
      return res.status(500).json({
        error: 'Database initialization failed'
      });
    }
  }
  next();
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Frontend fallback route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }

  res.sendFile(path.join(__dirname, '../dist/index.html'), err => {
    if (err) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>AI App Generator Server</title>
        </head>
        <body style="background:#0b0f19;color:#e2e8f0;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
          <div style="text-align:center;padding:20px;border:1px solid #243049;background:#151c2c;border-radius:8px;">
            <h2>Server Running on Port ${PORT}</h2>
            <p>API endpoints are active. Run the Vite frontend server to load the builder workspace.</p>
          </div>
        </body>
        </html>
      `);
    }
  });
});

// Start server (Railway/local)
async function startServer() {
  if (!process.env.VERCEL) {
    try {
      await initDb();
      dbInitialized = true;

      app.listen(PORT, () => {
        console.log('=========================================');
        console.log(`AI APP GENERATOR SERVER ACTIVE ON PORT ${PORT}`);
        console.log('=========================================');
      });
    } catch (err) {
      console.error('Failed to initialize database and start server:', err);
      process.exit(1);
    }
  }
}

startServer();

export default app;
