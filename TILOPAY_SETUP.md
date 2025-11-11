# Tilopay Payment Integration - Setup Guide

## Overview

This guide covers the complete setup for the DeepSleep e-commerce site with Tilopay card payments and SINPE integration.

## What's Implemented

### Payment Methods
- **SINPE Móvil**: Customers receive order details via email with instructions
- **Tarjeta (Tilopay)**: Card payments through Tilopay's secure payment gateway

### Features
- ✅ Tilopay API integration for one-time card payments
- ✅ Webhook handler for payment verification
- ✅ Email notifications using Resend API
- ✅ SINPE payment instructions modal
- ✅ Payment success/error pages
- ✅ Real-time payment status updates

---

## Prerequisites

1. **Node.js** (v16 or higher)
2. **Tilopay Account** with API credentials
3. **Resend Account** for email notifications
4. **ngrok** (for local webhook testing)

---

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

This will install:
- `express` - Backend API server
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variables
- `concurrently` - Run multiple commands
- `vite` - Frontend build tool

### 2. Configure Environment Variables

Copy the credentials from `.loca.env` to a new `.env` file:

```bash
# Create .env file
cp .env.example .env
```

Your `.env` should contain:

```bash
# Tilopay Configuration
TILOPAY_WEBHOOK_SECRET=doyLcQpdnZyhfJ_O6_vauDjkEIKp_ZJ4BbthVjZ2qfk
TILOPAY_BASE_URL=https://app.tilopay.com/api/v1
TILOPAY_API_KEY=7067-2615-6995-8721-7143
TILOPAY_USER=0S4T29
TILOPAY_PASSWORD=exojM6

# Resend Email Configuration
RESEND_API_KEY=re_CewSMwuB_GktHGRGFPguZu4rHty6y7zPH
ORDER_NOTIFICATION_EMAIL=deepsleepp.cr@gmail.com

# Application URL
APP_URL=http://localhost:3000
API_PORT=3001
```

### 3. Configure Resend Email Domain

⚠️ **Important**: Update the "from" email in `server/controllers/emailController.js`:

```javascript
// Line 90 - Change this:
from: 'DeepSleep <onboarding@resend.dev>',

// To your verified domain:
from: 'DeepSleep <ordenes@yourdomain.com>',
```

**To verify your domain in Resend:**
1. Go to https://resend.com/domains
2. Add your domain
3. Add the DNS records shown
4. Wait for verification (usually 5-10 minutes)

---

## Running the Application

### Development Mode

Run both frontend and backend simultaneously:

```bash
npm run dev:full
```

This starts:
- Frontend (Vite): http://localhost:3000
- Backend API: http://localhost:3001

### Separate Commands

```bash
# Frontend only
npm run dev

# Backend only
npm run server
```

---

## Testing Locally with Webhooks

Tilopay webhooks need a public URL. Use ngrok for local testing:

### 1. Install ngrok

```bash
# Download from https://ngrok.com/download
# Or install via package manager:
npm install -g ngrok
```

### 2. Start ngrok tunnel

```bash
# Terminal 1: Start your app
npm run dev:full

# Terminal 2: Start ngrok
ngrok http 3001
```

### 3. Update Webhook URL

Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`) and:

1. **In Tilopay Dashboard:**
   - Go to Settings → Webhooks
   - Add: `https://abc123.ngrok-free.app/api/tilopay/webhook`
   - Secret: Use your `TILOPAY_WEBHOOK_SECRET`

2. **In your `.env`:**
   ```bash
   APP_URL=http://localhost:3000  # Keep as localhost for redirects
   ```

---

## Testing the Payment Flow

### Test SINPE Payment

1. Go to http://localhost:3000
2. Scroll to "Pedir tu DeepSleep"
3. Fill in the form
4. Select "SINPE Móvil" as payment method
5. Click "Enviar Pedido"
6. **Expected Result:**
   - Modal appears with SINPE instructions
   - Email sent to `deepsleepp.cr@gmail.com` with order details
   - Order ID displayed in modal

### Test Tilopay Card Payment

1. Go to http://localhost:3000
2. Scroll to "Pedir tu DeepSleep"
3. Fill in the form
4. Select "Tarjeta (Tilopay)" as payment method
5. Click "Enviar Pedido"
6. **Expected Result:**
   - Redirected to Tilopay payment page
   - After payment: Redirected to success.html
   - Webhook receives notification
   - Email sent to admin

### Check Webhook Reception

Monitor your terminal for webhook logs:

```
📨 [Webhook] Received payment notification [wh_xxxxx]
📦 [Webhook] Payload: {...}
✅ [Webhook] Order ORD-xxxxx marked as paid
📧 [Webhook] Email sent for order ORD-xxxxx
```

---

## File Structure

```
DeepSleep/
├── server/
│   ├── index.js                          # Express server
│   ├── routes/
│   │   ├── tilopay.js                    # Tilopay routes
│   │   └── email.js                      # Email routes
│   └── controllers/
│       ├── tilopayController.js          # Payment & webhook logic
│       └── emailController.js            # Email sending logic
├── src/
│   ├── js/
│   │   └── main.js                       # Frontend payment handling
│   └── styles/
│       └── main.css                      # Styles + modal CSS
├── index.html                            # Main page
├── success.html                          # Payment success page
├── error.html                            # Payment error page
├── .env                                  # Environment variables (DO NOT COMMIT)
├── .env.example                          # Example env file
└── package.json                          # Dependencies
```

---

## API Endpoints

### Create Tilopay Payment
```
POST http://localhost:3001/api/tilopay/create-payment

Body (JSON):
{
  "nombre": "Juan Perez",
  "telefono": "88887777",
  "email": "juan@example.com",
  "provincia": "San José",
  "canton": "Central",
  "distrito": "Carmen",
  "direccion": "100m norte de...",
  "cantidad": "1",
  "comentarios": "Opcional"
}

Response:
{
  "success": true,
  "orderId": "ORD-1234567890-ABC123",
  "paymentUrl": "https://app.tilopay.com/...",
  "transactionId": "txn_xxxxx"
}
```

### Tilopay Webhook
```
POST http://localhost:3001/api/tilopay/webhook

Headers:
  x-tilopay-secret: your_webhook_secret

Body (from Tilopay):
{
  "order_id": "ORD-1234567890-ABC123",
  "transaction_id": "txn_xxxxx",
  "estado": "aprobada",
  ...
}
```

### Send SINPE Email
```
POST http://localhost:3001/api/email/send-sinpe

Body (JSON):
{
  "nombre": "Juan Perez",
  "telefono": "88887777",
  "email": "juan@example.com",
  "provincia": "San José",
  "canton": "Central",
  "distrito": "Carmen",
  "direccion": "100m norte de...",
  "cantidad": "1",
  "comentarios": "Opcional"
}

Response:
{
  "success": true,
  "orderId": "ORD-1234567890-ABC123",
  "message": "Order received..."
}
```

---

## Production Deployment

### Before Deploying

1. **Update APP_URL in `.env`:**
   ```bash
   APP_URL=https://yourdomain.com
   API_PORT=3001
   ```

2. **Update Tilopay Webhook URL:**
   - Dashboard → Webhooks
   - Change to: `https://yourdomain.com/api/tilopay/webhook`

3. **Verify Resend Domain:**
   - Ensure your domain is verified in Resend
   - Update "from" email in `emailController.js`

4. **Build Frontend:**
   ```bash
   npm run build
   ```

### Deploy Backend

Deploy the `server/` folder to your Node.js hosting (Heroku, Railway, Render, etc.)

**Example for Railway:**
```bash
railway login
railway init
railway up
```

### Deploy Frontend

Upload `dist/` folder to your static hosting (Netlify, Vercel, etc.)

**Example for Netlify:**
```bash
netlify deploy --prod --dir=dist
```

---

## Troubleshooting

### Webhook Not Receiving Events
- ✅ Check ngrok is running
- ✅ Verify webhook URL in Tilopay dashboard
- ✅ Check `TILOPAY_WEBHOOK_SECRET` matches
- ✅ Look for firewall/CORS issues
- ✅ Check server logs for errors

### Email Not Sending
- ✅ Verify `RESEND_API_KEY` is correct
- ✅ Check domain is verified in Resend dashboard
- ✅ Ensure "from" email uses verified domain
- ✅ Check Resend dashboard for delivery logs

### Payment Link Not Generated
- ✅ Verify Tilopay login succeeds (check logs)
- ✅ Check API credentials are correct
- ✅ Ensure amount is in correct format (integer for CRC)
- ✅ Look for error logs in terminal

### CORS Errors
- ✅ Ensure backend is running on port 3001
- ✅ Check `cors()` is enabled in `server/index.js`
- ✅ Verify API_BASE_URL in `main.js` points to correct port

---

## Security Notes

⚠️ **Important Security Practices:**

1. **Never commit `.env` file** - It's in `.gitignore`
2. **Use HTTPS in production** - Required for Tilopay webhooks
3. **Verify webhook signatures** - Already implemented
4. **Validate all inputs** - Server-side validation included
5. **Keep credentials secret** - Use environment variables only

---

## Support

**Questions or Issues?**
- WhatsApp: 6201-9914
- Instagram: @deepsleep.cr
- Email: deepsleepp.cr@gmail.com

---

## What Happens After a Customer Pays?

### SINPE Flow:
1. Customer fills form and selects SINPE
2. Modal shows with order ID and instructions
3. Email sent to `deepsleepp.cr@gmail.com` with order details
4. Customer makes SINPE transfer using order ID as reference
5. You verify payment manually and process order

### Tilopay Flow:
1. Customer fills form and selects Tarjeta (Tilopay)
2. Redirected to Tilopay payment gateway
3. Customer enters card details and pays
4. Tilopay sends webhook to your server
5. Server verifies payment and sends email
6. You receive email with confirmed order details
7. Customer sees success page

---

**✅ Implementation Complete!**

You now have a fully functional payment system with:
- Card payments via Tilopay
- SINPE payment instructions
- Automated email notifications
- Webhook verification
- Success/error pages
