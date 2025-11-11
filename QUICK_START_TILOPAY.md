# Quick Start - Tilopay Integration

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Up Environment Variables
```bash
# Copy .env.example to .env (already has your credentials)
cp .env.example .env
```

**Important:** Update the email "from" address in `server/controllers/emailController.js` (line 90) to use your verified Resend domain.

### Step 3: Run the Application
```bash
npm run dev:full
```

This starts:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

---

## 🧪 Quick Test

1. Open http://localhost:3000
2. Scroll to the order form
3. Fill in the details
4. Select **"SINPE Móvil"** or **"Tarjeta (Tilopay)"**
5. Submit!

### Expected Results:

**SINPE:**
- Modal with instructions appears
- Email sent to deepsleepp.cr@gmail.com

**Tilopay:**
- Redirects to Tilopay payment page
- (Need ngrok for full testing - see below)

---

## 🌐 Testing Tilopay Webhooks (with ngrok)

Tilopay needs a public URL to send webhook notifications.

### 1. Install ngrok
```bash
npm install -g ngrok
```

### 2. Start ngrok (in a new terminal)
```bash
ngrok http 3001
```

### 3. Configure Tilopay Webhook
1. Copy the ngrok URL (e.g., `https://abc123.ngrok-free.app`)
2. Go to Tilopay Dashboard → Settings → Webhooks
3. Add webhook URL: `https://abc123.ngrok-free.app/api/tilopay/webhook`
4. Set secret: `doyLcQpdnZyhfJ_O6_vauDjkEIKp_ZJ4BbthVjZ2qfk`

### 4. Test Full Flow
1. Create an order with "Tarjeta (Tilopay)"
2. Complete payment on Tilopay
3. Check terminal for webhook logs:
   ```
   📨 [Webhook] Received payment notification
   ✅ [Webhook] Order marked as paid
   📧 [Webhook] Email sent
   ```

---

## 📧 Email Configuration

### Verify Your Domain in Resend

1. Go to https://resend.com/domains
2. Add your domain
3. Add DNS records
4. Wait for verification

### Update the "From" Email

Edit `server/controllers/emailController.js` line 90:

```javascript
// Before:
from: 'DeepSleep <onboarding@resend.dev>',

// After (use YOUR verified domain):
from: 'DeepSleep <ordenes@yourdomain.com>',
```

---

## 📱 Payment Methods

### SINPE Móvil
- Customer selects SINPE
- Receives order ID and instructions
- Makes transfer using order ID as reference
- You verify payment manually

### Tarjeta (Tilopay)
- Customer selects Tarjeta
- Redirects to Tilopay
- Automatic payment verification
- Email sent on success

---

## 🔍 What Changed?

### Frontend (index.html)
- ✅ Payment methods now show only "SINPE Móvil" and "Tarjeta (Tilopay)"
- ✅ Payment instructions appear when method is selected
- ✅ Added modal for SINPE instructions
- ✅ Added loading overlay

### Backend (New Files)
- ✅ `server/index.js` - Express API server
- ✅ `server/controllers/tilopayController.js` - Tilopay integration
- ✅ `server/controllers/emailController.js` - Email notifications
- ✅ `server/routes/` - API routes

### New Pages
- ✅ `success.html` - Payment success page
- ✅ `error.html` - Payment error page

---

## 🆘 Common Issues

### "Cannot connect to API"
- ✅ Make sure backend is running: `npm run server`
- ✅ Check port 3001 is available
- ✅ Look for CORS errors in browser console

### "Email not sending"
- ✅ Check RESEND_API_KEY in .env
- ✅ Verify domain in Resend dashboard
- ✅ Update "from" email to verified domain

### "Webhook not working"
- ✅ Make sure ngrok is running
- ✅ Update webhook URL in Tilopay dashboard
- ✅ Check webhook secret matches

---

## 📚 Full Documentation

For detailed information, see:
- **TILOPAY_SETUP.md** - Complete setup guide
- **TILOPAY_ECOMMERCE_GUIDE_PART1.md** - Implementation details
- **TILOPAY_ECOMMERCE_GUIDE_PART2.md** - Webhook & email guide

---

## ✅ Checklist

Before going live:
- [ ] Install dependencies (`npm install`)
- [ ] Create `.env` file with credentials
- [ ] Update email "from" address
- [ ] Verify Resend domain
- [ ] Test SINPE flow
- [ ] Test Tilopay flow with ngrok
- [ ] Configure production webhook URL
- [ ] Deploy to production

---

**Need Help?**
- WhatsApp: 6201-9914
- Instagram: @deepsleep.cr
- Email: deepsleepp.cr@gmail.com
