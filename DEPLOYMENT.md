# Email Automation System Deployment Guide

## Overview
The IOC Fiocruz email automation feature is **fully implemented and ready for deployment**. This system automatically processes reservation emails, classifies them using AI, and either creates bookings directly or generates appropriate responses.

## Current Status: ✅ READY FOR DEPLOYMENT

### What's Working
- ✅ Database initialized with default rooms (Sala 101, Auditório Principal, Sala de Conferência A)
- ✅ Email classification AI (identifies booking vs information requests)
- ✅ Automatic booking creation for complete requests
- ✅ AI-generated responses for incomplete/information requests
- ✅ Email processing management API endpoints
- ✅ All database operations and validation
- ✅ Production environment configuration

## Required Setup Steps

### 1. Configure Email Account
**File:** `.env` (already created)

Replace `your_app_password` with actual Gmail App Password:

1. Enable 2-factor authentication on `reservas.ioc@fiocruz.br`
2. Go to Google Account → Security → App Passwords
3. Generate new app password (16 characters)
4. Update the following lines in `.env`:
   ```
   IMAP_PASSWORD=your_actual_app_password
   SMTP_PASSWORD=your_actual_app_password
   IOC_EMAIL_PASSWORD=your_actual_app_password
   ```

### 2. Deploy to Production

#### Option A: Direct Deployment
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start the server
npm start
```

#### Option B: Using PM2 (Recommended)
```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start dist/server/node-build.mjs --name "agendamento-ia"

# Setup auto-restart
pm2 startup
pm2 save
```

### 3. Test the System

#### Test Email Processing API
```bash
# Check processor status
curl http://localhost:3001/api/email-processor/status

# Start email processor (after configuring email password)
curl -X POST http://localhost:3001/api/email-processor/start
```

#### Test Email Classification
```bash
curl -X POST http://localhost:3001/api/ai/email/classify \
  -H "Content-Type: application/json" \
  -d '{
    "emailContent": "Olá, sou João Silva, email joao@universidade.edu.br. Gostaria de reservar a Sala 101 para dia 15/12/2024, das 14h às 16h.",
    "subject": "Reserva Sala 101",
    "senderEmail": "joao@universidade.edu.br"
  }'
```

## How It Works

### Email Processing Flow
1. **Email Fetching**: System checks IOC email every 5 minutes via IMAP
2. **AI Classification**: Analyzes email content to determine intent:
   - `BOOKING_REQUEST`: User wants to make a reservation
   - `INFORMATION_REQUEST`: User asking for information
   - `UNCLEAR`: Email needs clarification
3. **Data Extraction**: Pulls booking details (name, email, room, date, time)
4. **Action Processing**:
   - **Complete booking**: Creates database entry + sends confirmation
   - **Incomplete booking**: Requests missing information via email
   - **Information request**: Sends helpful response email

### Supported Features
- ✅ Portuguese date format recognition
- ✅ Institutional email validation (.edu.br domain)
- ✅ Room availability checking
- ✅ Automatic booking confirmation emails
- ✅ Email processing logs and statistics
- ✅ Error handling and recovery

### Default Rooms Available
1. **Sala 101** - 30 people capacity
2. **Auditório Principal** - 100 people capacity
3. **Sala de Conferência A** - 20 people capacity

## API Endpoints

### Email Processing Management
- `GET /api/email-processor/status` - Check if processor is running
- `POST /api/email-processor/start` - Start automatic email processing
- `POST /api/email-processor/stop` - Stop email processing
- `GET /api/email-processor/stats` - Processing statistics
- `GET /api/email-processor/logs` - Recent email processing logs

### AI Operations
- `POST /api/ai/email/classify` - Classify email content
- `GET /api/ai/rooms` - List available rooms
- `GET /api/ai/bookings` - List/filter bookings
- `POST /api/ai/bookings` - Create new booking

### Standard Booking API
- `GET /api/bookings` - List all bookings
- `POST /api/bookings` - Create booking
- `GET /api/rooms` - List rooms
- `POST /api/bookings/check-availability` - Check room availability

## Monitoring and Maintenance

### Health Checks
- Server running on port 3001 (configurable via PORT env var)
- Database connection automatically established on startup
- Email processor logs all activities to `email_logs` table

### Email Processing Statistics
```bash
curl http://localhost:3001/api/email-processor/stats
```

### Common Issues
1. **IMAP Connection Failed**: Check email password and 2FA setup
2. **No Processing**: Ensure email processor is started via API
3. **Database Errors**: Verify DATABASE_URL and database permissions

## Production Considerations

### Security
- ✅ Environment variables configured for production
- ✅ Database credentials provided
- ✅ AI service API key configured
- ⚠️ **Action Required**: Set actual email app password

### Performance
- Email processing interval: 5 minutes (configurable)
- Database connection pooling: 10 connections max
- AI model: Claude-3-Haiku (cost-effective for email processing)

### Scalability
- Automatic database table creation on first run
- Email logs tracked for audit and debugging
- Graceful error handling and recovery

## Success Verification

The system is working correctly when:
- ✅ Emails are fetched from IOC account every 5 minutes
- ✅ Complete booking requests create database entries automatically
- ✅ Information requests receive AI-generated helpful responses
- ✅ Incomplete requests prompt users for missing information
- ✅ All responses are sent via email to original sender
- ✅ Email logs track all processing activities

**System Status: READY FOR PRODUCTION DEPLOYMENT**