# Tilopay E-commerce Implementation - Executive Summary

## Quick Start Guide

This document summarizes the Betsy Tilopay implementation and how to adapt it for one-time e-commerce payments.

---

## 📋 What This Guide Covers

Based on the Betsy codebase analysis, this guide shows how to:
1. Accept one-time payments (instead of subscriptions)
2. Verify payments via webhooks
3. Create orders in database
4. Send order details to admin via email for shipping

---

## 🔑 Key Files from Betsy Codebase

### Tilopay Core Implementation
- **`/src/lib/tilopay.ts`** - Main Tilopay integration helper
- **`/src/lib/tilopay-v1.ts`** - Alternative v1 API implementation

### Subscription API (Reference for Authentication)
- **`/src/app/api/tilopay/create-plan-repeat/route.ts`** - Shows Tilopay login flow
- **`/src/app/api/tilopay/create-subscription-token/route.ts`** - Token generation example

### Webhook Handlers (Critical for Payment Verification)
- **`/src/app/api/tilopay/webhook/route.ts`** - Main webhook handler
- **`/src/app/api/tilopay/webhook-repeat/route.ts`** - Repeat subscription webhooks

### Frontend Component
- **`/src/app/config/components/TilopaySubscriptionCheckout.tsx`** - Checkout UI reference

---

## 🔄 Architecture Comparison

### Betsy (Subscription Model)
```
User → Creates Plan → Tilopay Hosted Page → Monthly Billing
          ↓
    Stores Subscription ID → Webhook Updates Subscription Status
```

### Your E-commerce (One-Time Payment)
```
User → Creates Order → Tilopay Payment Page → One-Time Charge
          ↓                    ↓
    Stores Order (pending)   Payment Complete
          ↓                    ↓
    Webhook Confirms → Update Order → Email Admin
```

---

## 🚀 Implementation Steps

### Step 1: Environment Setup

Create `.env.local` with these variables (from Betsy's `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...

# App
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key

# Tilopay Credentials (get from Tilopay dashboard)
TILOPAY_BASE_URL=https://app.tilopay.com/api/v1
TILOPAY_API_KEY=your-api-key
TILOPAY_USER=your-user
TILOPAY_PASSWORD=your-password
TILOPAY_WEBHOOK_SECRET=your-webhook-secret

# Email (Resend)
RESEND_API_KEY=re_your_key
ORDER_NOTIFICATION_EMAIL=admin@yourbusiness.com
```

### Step 2: Database Schema

Add Order model to `prisma/schema.prisma`:

```prisma
model Order {
  id              String   @id @default(cuid())
  orderId         String   @unique
  paymentStatus   String   @default("pending")
  paymentId       String?
  amount          Float
  currency        String   @default("CRC")
  
  customerName    String
  customerEmail   String
  customerPhone   String?
  
  productName     String
  quantity        Int
  productPrice    Float
  
  shippingAddress String
  shippingCity    String?
  shippingState   String?
  
  orderNotes      String?
  status          String   @default("pending")
  
  createdAt       DateTime @default(now())
  paidAt          DateTime?
  
  @@index([orderId])
  @@index([paymentStatus])
}
```

Run: `npx prisma migrate dev --name add_orders`

### Step 3: Create Payment API

**File:** `src/app/api/payments/tilopay/create-payment/route.ts`

Key points from Betsy implementation:
- Login to Tilopay to get `access_token` (see `create-plan-repeat/route.ts` lines 75-95)
- Use `/captures` endpoint for one-time payments (instead of `/createPlanRepeat`)
- Pass `notification_url` for webhook callbacks

```typescript
// Authenticate (borrowed from Betsy)
const loginResponse = await fetch(`${baseUrl}/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    apiuser: process.env.TILOPAY_USER,
    password: process.env.TILOPAY_PASSWORD
  })
});

const { access_token } = await loginResponse.json();

// Create payment link
const captureResponse = await fetch(`${baseUrl}/captures`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${access_token}`
  },
  body: JSON.stringify({
    key: process.env.TILOPAY_API_KEY,
    amount: total,
    currency: 'CRC',
    description: `Order ${orderId}`,
    order_id: orderId,
    notification_url: `${appUrl}/api/payments/tilopay/webhook`,
    redirect_success: `${appUrl}/order/success?orderId=${orderId}`,
    email: customerEmail
  })
});
```

### Step 4: Webhook Handler

**File:** `src/app/api/payments/tilopay/webhook/route.ts`

Key points from Betsy's webhook handlers:
- Verify webhook signature (see `tilopay.ts` lines 115-170)
- Check for duplicate processing (see `webhook-repeat/route.ts` lines 309-351)
- Update order status and send email

```typescript
// Verify webhook (from Betsy's implementation)
function verifyWebhookSignature(request: NextRequest): boolean {
  const expectedSecret = process.env.TILOPAY_WEBHOOK_SECRET || '';
  const providedSecret = request.headers.get('x-tilopay-secret') || '';
  return providedSecret === expectedSecret;
}

// Handle webhook
const payload = await request.json();
const orderId = payload.order_id;
const status = String(payload.estado || payload.status).toLowerCase();
const isSuccess = ['aprobada', 'approved', 'success', 'paid'].includes(status);

if (isSuccess) {
  // Update order
  await prisma.order.update({
    where: { orderId },
    data: {
      paymentStatus: 'completed',
      paidAt: new Date(),
      status: 'processing'
    }
  });
  
  // Send email notification
  await sendOrderEmail(order);
}
```

### Step 5: Email Notification

Use Resend API (Betsy has `RESEND_API_KEY` in `.env.example`):

```typescript
await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
  },
  body: JSON.stringify({
    from: 'ordenes@yourdomain.com',
    to: process.env.ORDER_NOTIFICATION_EMAIL,
    subject: `New Order: ${order.orderId}`,
    html: `<!-- Order details HTML -->`
  })
});
```

---

## 🔍 Key Differences from Betsy

| Aspect | Betsy Implementation | Your Implementation |
|--------|---------------------|---------------------|
| **Endpoint** | `/api/tilopay/create-plan-repeat` | `/api/payments/tilopay/create-payment` |
| **Tilopay API** | `/createPlanRepeat` (subscriptions) | `/captures` (one-time) |
| **Database** | Updates `Tenant` model | Creates `Order` model |
| **Webhook Events** | `subscription.created`, `payment_success` | `payment.approved`, `payment.declined` |
| **Post-Payment** | Activate subscription access | Send order email to admin |
| **Recurring** | Monthly automatic charges | One-time charge only |

---

## 🧪 Testing Workflow

### 1. Local Testing with ngrok

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start ngrok
ngrok http 3000

# Update .env.local
NEXTAUTH_URL=https://your-ngrok-url.ngrok-free.app
```

### 2. Configure Tilopay Webhook

1. Login to Tilopay dashboard
2. Go to Settings → Webhooks
3. Add: `https://your-ngrok-url.ngrok-free.app/api/payments/tilopay/webhook`
4. Set secret: Copy from your `TILOPAY_WEBHOOK_SECRET`

### 3. Test Flow

1. Access checkout page
2. Fill in order details
3. Click "Continue to Payment"
4. Redirects to Tilopay
5. Complete payment (use test card if in test mode)
6. Check:
   - Order status updated in database
   - Email received at `ORDER_NOTIFICATION_EMAIL`
   - Success page displays

---

## 📚 Study These Betsy Files

For deeper understanding, review these files in order:

1. **Authentication Flow**
   - `/src/app/api/tilopay/create-plan-repeat/route.ts` (lines 59-104)
   - Shows how to login and get bearer token

2. **Webhook Verification**
   - `/src/lib/tilopay.ts` (lines 115-170)
   - Signature verification logic

3. **Webhook Processing**
   - `/src/app/api/tilopay/webhook-repeat/route.ts` (lines 31-513)
   - Complete webhook handling example

4. **Database Operations**
   - `/src/app/api/tilopay/webhook-repeat/route.ts` (lines 359-402)
   - Shows database updates and duplicate prevention

5. **Frontend Integration**
   - `/src/app/config/components/TilopaySubscriptionCheckout.tsx`
   - Checkout UI and API calls

---

## 🛡️ Security Checklist

Based on Betsy's implementation:

- [x] Webhook signature verification (line 126 in `tilopay.ts`)
- [x] Duplicate transaction prevention (lines 309-351 in `webhook-repeat/route.ts`)
- [x] Environment variables for secrets
- [x] HTTPS-only in production
- [x] Input validation before database operations
- [x] Proper error logging (console.error throughout webhook handlers)

---

## 🎯 Critical Implementation Points

### From Betsy's Codebase:

1. **Authentication is Required**
   - Must call `/login` endpoint first
   - Get bearer token
   - Use token in Authorization header
   - See: `create-plan-repeat/route.ts` lines 75-95

2. **Webhook Verification is Essential**
   - Always verify `x-tilopay-secret` header
   - Or check `hash-tilopay` for HMAC
   - See: `tilopay.ts` lines 126-170

3. **Duplicate Prevention**
   - Check if order already processed
   - Use unique identifiers (orderId, transactionId)
   - See: `webhook-repeat/route.ts` lines 309-351

4. **Error Handling**
   - Log all errors with context
   - Return proper HTTP status codes
   - Handle both Tilopay errors and internal errors

---

## 📦 Complete File Structure

```
your-project/
├── prisma/
│   └── schema.prisma (add Order model)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── payments/
│   │   │       └── tilopay/
│   │   │           ├── create-payment/
│   │   │           │   └── route.ts
│   │   │           └── webhook/
│   │   │               └── route.ts
│   │   └── order/
│   │       ├── success/
│   │       │   └── page.tsx
│   │       └── error/
│   │           └── page.tsx
│   ├── components/
│   │   └── checkout/
│   │       └── TilopayCheckout.tsx
│   └── lib/
│       └── db.ts (Prisma client)
└── .env.local (environment variables)
```

---

## 🔗 Additional Resources

### Tilopay Documentation
- Dashboard: https://app.tilopay.com/
- API Docs: Contact Tilopay support for detailed API documentation

### Email Service (Resend)
- Website: https://resend.com/
- Docs: https://resend.com/docs

### Testing Tools
- ngrok: https://ngrok.com/ (for local webhook testing)
- Tilopay Test Cards: Contact Tilopay for test card numbers

---

## ✅ Final Checklist

Before going live:

- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] Tilopay credentials verified (test login)
- [ ] Webhook URL configured in Tilopay dashboard
- [ ] Webhook secret matches in both places
- [ ] Email service configured and tested
- [ ] Order creation flow tested
- [ ] Payment success flow tested
- [ ] Payment failure flow tested
- [ ] Email notifications working
- [ ] HTTPS enabled in production
- [ ] Error logging configured
- [ ] Admin has access to order management

---

## 🆘 Troubleshooting

### Webhook Not Receiving Events
- Check ngrok/tunnel is running
- Verify webhook URL in Tilopay dashboard
- Check webhook secret matches
- Look for firewall/CORS issues

### Email Not Sending
- Verify `RESEND_API_KEY` is correct
- Check domain is verified in Resend
- Ensure "from" email uses verified domain
- Check Resend dashboard for delivery logs

### Payment Link Not Generated
- Verify Tilopay login succeeds
- Check API credentials are correct
- Ensure amount is in correct format (integer for CRC)
- Look for error logs in console

---

**For detailed implementation code, see:**
- Part 1: Environment, Database, API Implementation
- Part 2: Webhook Handler, Email System, Frontend

**End of Summary**
