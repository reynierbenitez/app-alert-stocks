require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  optionsSuccessStatus: 200
}));

// Rate limiting for webhook endpoint
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again later.' }
});

// Parse JSON bodies
app.use(express.json({ limit: '10kb' }));

// Initialize SQLite database
const db = new sqlite3.Database('./alerts.db', (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Create alerts table if it doesn't exist
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      price REAL NOT NULL,
      condition TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      message TEXT,
      source TEXT DEFAULT 'TradingView',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creating alerts table:', err.message);
    } else {
      console.log('Alerts table ready.');
    }
  });
}

// Webhook endpoint to receive alerts from n8n
app.post('/api/webhook', webhookLimiter, (req, res) => {
  try {
    const { symbol, price, condition, message, timestamp } = req.body;
    
    // Validate required fields
    if (!symbol || !price || !condition) {
      return res.status(400).json({
        error: 'Missing required fields: symbol, price, and condition are required'
      });
    }

    // Validate price is a number
    const priceNum = parseFloat(price);
    if (isNaN(priceNum)) {
      return res.status(400).json({ error: 'Price must be a valid number' });
    }

    const alertTimestamp = timestamp || new Date().toISOString();
    
    // Insert alert into database
    const stmt = db.prepare(`
      INSERT INTO alerts (symbol, price, condition, timestamp, message)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(symbol, priceNum, condition, alertTimestamp, message || '', function(err) {
      if (err) {
        console.error('Error saving alert to database:', err.message);
        return res.status(500).json({ error: 'Failed to save alert' });
      }
      
      console.log(`Alert saved: ${symbol} @ ${priceNum} (${condition})`);
      
      // Broadcast to connected WebSocket clients if enabled
      if (req.app.get('wsClients')) {
        broadcastNewAlert({
          id: this.lastID,
          symbol,
          price: priceNum,
          condition,
          timestamp: alertTimestamp,
          message: message || ''
        });
      }
      
      res.status(201).json({
        success: true,
        message: 'Alert received and stored',
        alertId: this.lastID
      });
    });
    
    stmt.finalize();
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API endpoint to get latest alerts
app.get('/api/alerts', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  
  db.all(
    `SELECT * FROM alerts ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset],
    (err, rows) => {
      if (err) {
        console.error('Error fetching alerts:', err.message);
        return res.status(500).json({ error: 'Failed to fetch alerts' });
      }
      
      // Get total count for pagination
      db.get(`SELECT COUNT(*) as count FROM alerts`, (err, countResult) => {
        if (err) {
          console.error('Error counting alerts:', err.message);
          return res.status(500).json({ error: 'Failed to count alerts' });
        }
        
        res.json({
          alerts: rows,
          total: countResult.count,
          limit,
          offset
        });
      });
    }
  );
});

// API endpoint to get alerts for a specific symbol
app.get('/api/alerts/:symbol', (req, res) => {
  const { symbol } = req.params;
  const limit = parseInt(req.query.limit) || 20;
  
  db.all(
    `SELECT * FROM alerts WHERE symbol = ? ORDER BY created_at DESC LIMIT ?`,
    [symbol.toUpperCase(), limit],
    (err, rows) => {
      if (err) {
        console.error('Error fetching alerts for symbol:', err.message);
        return res.status(500).json({ error: 'Failed to fetch alerts' });
      }
      
      res.json({ symbol: symbol.toUpperCase(), alerts: rows });
    }
  );
});

// Health check endpoint
app.get('/health', (req, res) => {
  db.get('SELECT 1 as ok', (err) => {
    if (err) {
      return res.status(500).json({ status: 'unhealthy', error: err.message });
    }
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    service: 'Trading Alerts Backend',
    version: '1.0.0',
    endpoints: {
      webhook: 'POST /api/webhook',
      alerts: 'GET /api/alerts',
      symbolAlerts: 'GET /api/alerts/:symbol',
      health: 'GET /health'
    }
  });
});

// WebSocket support for real-time updates (optional)
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });
const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('New WebSocket client connected');
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log('WebSocket client disconnected');
  });
});

function broadcastNewAlert(alert) {
  const message = JSON.stringify({ type: 'NEW_ALERT', data: alert });
  clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

app.set('wsClients', clients);

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Webhook endpoint: http://localhost:${PORT}/api/webhook`);
  console.log(`Frontend API: http://localhost:${PORT}/api/alerts`);
});

// Attach WebSocket server to HTTP server
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
      process.exit(0);
    });
  });
});

module.exports = { app, db };