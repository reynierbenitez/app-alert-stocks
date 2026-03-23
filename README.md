# Trading Alerts Dashboard

A lightweight, highly maintainable web application for displaying real-time trading price alerts from TradingView via n8n.

## Architecture Overview

```
TradingView → Webhook → n8n → Webhook → Backend (Node.js + SQLite) → Frontend Dashboard
```

## Features

- **Backend/Webhook Receiver**: Node.js Express server with secure POST endpoint
- **Database**: SQLite for simple, file-based storage (no external DB required)
- **Frontend**: Modern, responsive dashboard with real-time updates via WebSocket
- **Real-time Updates**: Optional WebSocket support for instant alert notifications
- **Filtering & Search**: Filter alerts by symbol, pagination support
- **Detailed Views**: Modal with full alert details
- **Health Monitoring**: System status indicators and connection monitoring

## Quick Start with Docker Compose

1. **Clone and navigate to the project directory**
   ```bash
   git clone <repository-url>
   cd app-alert-stocks
   ```

2. **Configure environment variables**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   ```

3. **Start the application**
   ```bash
   docker-compose up -d
   ```

4. **Access the dashboard**
   - Frontend: http://localhost:8080
   - Backend API: http://localhost:3000
   - API Documentation: http://localhost:3000

5. **Configure n8n webhook**
   - URL: `http://your-server:3000/api/webhook`
   - Method: POST
   - Content-Type: application/json
   - Example payload:
     ```json
     {
       "symbol": "AAPL",
       "price": 150.25,
       "condition": "BUY",
       "message": "Price crossed moving average",
       "timestamp": "2024-01-15T10:30:00Z"
     }
     ```

## Manual Installation

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start the server**
   ```bash
   npm start
   # For development with auto-reload:
   npm run dev
   ```

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Serve the application**
   - Using Python:
     ```bash
     python -m http.server 8080
     ```
   - Using Node.js:
     ```bash
     npx serve -p 8080
     ```
   - Using any static file server

3. **Open in browser**
   - http://localhost:8080

## API Endpoints

### Webhook Endpoint
- **POST** `/api/webhook` - Receive trading alerts from n8n
  ```json
  {
    "symbol": "AAPL",
    "price": 150.25,
    "condition": "BUY",
    "message": "Optional message",
    "timestamp": "2024-01-15T10:30:00Z"
  }
  ```

### Alert Retrieval
- **GET** `/api/alerts` - Get latest alerts with pagination
  - Query parameters: `?limit=50&offset=0`
- **GET** `/api/alerts/:symbol` - Get alerts for specific symbol
  - Query parameters: `?limit=20`

### System
- **GET** `/health` - Health check endpoint
- **GET** `/` - API documentation

## Environment Variables

### Backend (.env)
```env
# Server Configuration
PORT=3000
NODE_ENV=production

# CORS Configuration
FRONTEND_URL=http://localhost:8080

# Security (Optional)
WEBHOOK_SECRET=your_webhook_secret_here

# Database
DATABASE_PATH=./alerts.db

# Logging
LOG_LEVEL=info
```

### Docker Compose
- `BACKEND_PORT`: Port for backend API (default: 3000)
- `FRONTEND_PORT`: Port for frontend dashboard (default: 8080)

## Docker Deployment

### Build and Run
```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Easypanel Deployment
1. Create a new project in Easypanel
2. Add a new service using Docker Compose
3. Upload the `docker-compose.yml` file
4. Configure environment variables in Easypanel's environment section
5. Deploy the application

## Project Structure

```
app-alert-stocks/
├── backend/
│   ├── server.js              # Main backend server
│   ├── package.json           # Backend dependencies
│   ├── .env.example           # Environment variables template
│   └── Dockerfile             # Backend Docker configuration
├── frontend/
│   ├── index.html             # Main dashboard HTML
│   ├── styles.css             # Dashboard styles
│   ├── app.js                 # Frontend JavaScript
│   └── nginx.conf             # Nginx configuration for frontend
├── docker-compose.yml         # Multi-container orchestration
├── Dockerfile                 # Root Dockerfile (optional)
└── README.md                  # This file
```

## Security Considerations

1. **Rate Limiting**: Webhook endpoint has rate limiting (100 requests per 15 minutes per IP)
2. **Input Validation**: All webhook inputs are validated
3. **CORS**: Configured to allow requests only from frontend URL
4. **Helmet.js**: Security headers enabled
5. **Optional HMAC**: Add `WEBHOOK_SECRET` for HMAC verification (implement in n8n)

## Monitoring & Maintenance

### Database Maintenance
- SQLite database file: `backend/alerts.db`
- Regular backups recommended
- Can be cleared manually or via future admin interface

### Logs
- Backend logs to console (configurable)
- Docker logs available via `docker-compose logs`

### Health Checks
- Use `/health` endpoint for monitoring
- Frontend shows connection status

## Troubleshooting

### Common Issues

1. **Backend not starting**
   - Check if port 3000 is available
   - Verify Node.js version (>=16)
   - Check `.env` file configuration

2. **Frontend not connecting to backend**
   - Verify CORS settings in `.env`
   - Check backend is running (`http://localhost:3000/health`)
   - Update `CONFIG.BACKEND_URL` in `frontend/app.js` if needed

3. **WebSocket not working**
   - Ensure backend supports WebSocket (included in server.js)
   - Check browser console for WebSocket errors
   - Use auto-refresh as fallback

4. **Alerts not saving**
   - Check database file permissions
   - Verify webhook payload format
   - Check backend logs for errors

### Debug Mode
Start backend with debug logging:
```bash
cd backend
LOG_LEVEL=debug npm start
```

## Development

### Adding Features
1. **New Alert Types**: Extend database schema in `server.js`
2. **Additional Filters**: Add query parameters to `/api/alerts`
3. **Authentication**: Add API key or JWT authentication
4. **Export Functionality**: Add CSV/JSON export endpoints

### Testing Webhooks
Use `curl` to test the webhook endpoint:
```bash
curl -X POST http://localhost:3000/api/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "TEST",
    "price": 100.50,
    "condition": "TEST",
    "message": "Test alert"
  }'
```

## License

MIT License - See LICENSE file for details.

## Support

For issues or feature requests:
1. Check the troubleshooting section
2. Review backend logs
3. Ensure all dependencies are installed
4. Verify environment configuration