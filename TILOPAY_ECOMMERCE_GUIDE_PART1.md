# Tilopay E-commerce Implementation Guide - Part 1
## One-Time Payment for Product Orders with Email Notifications

---

## Table of Contents
1. [Overview](#overview)
2. [Key Differences from Betsy](#key-differences-from-betsy)
3. [Environment Setup](#environment-setup)
4. [Database Schema](#database-schema)
5. [Backend API Implementation](#backend-api-implementation)

---

## Overview

This guide adapts Betsy's Tilopay implementation from **recurring subscriptions** to **one-time e-commerce payments**. The flow:

1. Customer selects product and enters details
2. System creates Tilopay payment link
3. Customer completes payment on Tilopay's hosted page
4. Tilopay sends webhook to verify payment
5. System creates order in database
6. Email notification sent to admin with order details for shipping

---

## Key Differences from Betsy

| Feature | Betsy (Subscription) | Your E-commerce Site |
|---------|---------------------|---------------------|
| **Payment Type** | Recurring monthly | One-time purchase |
| **Tilopay API** | `/createPlanRepeat` | `/captures` (one-time) |
| **Webhook Events** | subscription.created, payment_success, cancelled | payment.approved, payment.declined |
| **Database** | Updates `Tenant` subscription status | Creates `Order` record |
| **Post-Payment** | Activate subscription features | Send order email to admin |

---

## Environment Setup

### Required Environment Variables

Create a `.env.local` file in your project root:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:5432/dbname

# Next.js Authentication (if needed)
NEXTAUTH_SECRET=your-random-secret-key-here
NEXTAUTH_URL=https://your-domain.com

# Tilopay Configuration
TILOPAY_BASE_URL=https://app.tilopay.com/api/v1
TILOPAY_API_KEY=your-tilopay-api-key
TILOPAY_USER=your-tilopay-user
TILOPAY_PASSWORD=your-tilopay-password
TILOPAY_WEBHOOK_SECRET=your-webhook-secret-key

# Email Service (Resend)
RESEND_API_KEY=re_your_resend_api_key_here
ORDER_NOTIFICATION_EMAIL=admin@yourbusiness.com

# Optional: Test Mode
TILOPAY_TEST_MODE=true
```

### Tilopay Credentials Setup

1. **Sign up for Tilopay**: https://tilopay.com/
2. **Get API Credentials**:
   - Login to Tilopay Dashboard
   - Navigate to: Settings → API Keys
   - Copy: API Key, API User, API Password
3. **Generate Webhook Secret**:
   ```bash
   openssl rand -base64 32
   ```
4. **Configure Webhook in Tilopay**:
   - Go to: Settings → Webhooks
   - Add URL: `https://your-domain.com/api/payments/tilopay/webhook`
   - Set Secret: Your generated webhook secret

---

## Database Schema

### Prisma Schema for Orders

```prisma
// prisma/schema.prisma

model Order {
  id            String   @id @default(cuid())
  orderId       String   @unique  // Public-facing order number
  
  // Payment Info
  paymentStatus   String   @default("pending") // pending, completed, failed
  paymentId       String?  // Tilopay transaction ID
  paymentMethod   String?  @default("tilopay")
  amount          Float
  currency        String   @default("CRC")
  
  // Customer Info
  customerName    String
  customerEmail   String
  customerPhone   String?
  
  // Product Info
  productName     String
  productSku      String?
  quantity        Int      @default(1)
  productPrice    Float
  
  // Shipping Info
  shippingAddress String
  shippingCity    String?
  shippingState   String?
  shippingZip     String?
  shippingCountry String   @default("Costa Rica")
  shippingCost    Float    @default(0)
  
  // Order Details
  orderNotes      String?
  status          String   @default("pending") // pending, processing, shipped, delivered, cancelled
  
  // Timestamps
  createdAt       DateTime @default(now())
  paidAt          DateTime?
  shippedAt       DateTime?
  deliveredAt     DateTime?
  
  // Tracking
  trackingNumber  String?
  
  @@index([orderId])
  @@index([customerEmail])
  @@index([paymentStatus])
  @@index([createdAt])
}
```

Run migration:
```bash
npx prisma migrate dev --name add_orders
npx prisma generate
```

---

## Backend API Implementation

### 1. Create Payment Link API

**File:** `src/app/api/payments/tilopay/create-payment/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const {
      productName,
      productPrice,
      quantity = 1,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      shippingCity,
      shippingState,
      shippingZip,
      shippingCost = 0,
      orderNotes
    } = body;

    // Validation
    if (!productName || !productPrice || !customerName || !customerEmail || !shippingAddress) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    // Calculate total
    const subtotal = productPrice * quantity;
    const total = subtotal + shippingCost;

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Create order in database (status: pending)
    const order = await prisma.order.create({
      data: {
        orderId,
        paymentStatus: 'pending',
        amount: total,
        currency: 'CRC',
        customerName,
        customerEmail,
        customerPhone,
        productName,
        quantity,
        productPrice,
        shippingAddress,
        shippingCity,
        shippingState,
        shippingZip,
        shippingCost,
        orderNotes,
        status: 'pending'
      }
    });

    // Authenticate with Tilopay
    const apiUser = process.env.TILOPAY_USER!;
    const apiPassword = process.env.TILOPAY_PASSWORD!;
    const apiKey = process.env.TILOPAY_API_KEY!;
    const baseUrl = process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1';

    const loginResponse = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiuser: apiUser,
        password: apiPassword
      })
    });

    if (!loginResponse.ok) {
      throw new Error('Failed to authenticate with Tilopay');
    }

    const loginData = await loginResponse.json();
    const accessToken = loginData.access_token;

    // Create payment link using /captures endpoint (one-time payment)
    const appUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    
    const capturePayload = {
      key: apiKey,
      amount: Math.round(total), // Amount in colones (no decimals)
      currency: 'CRC',
      description: `Orden ${orderId}: ${productName} (x${quantity})`,
      order_id: orderId,
      redirect_success: `${appUrl}/order/success?orderId=${orderId}`,
      redirect_error: `${appUrl}/order/error?orderId=${orderId}`,
      notification_url: `${appUrl}/api/payments/tilopay/webhook`,
      email: customerEmail,
      platform: '5' // E-commerce platform code
    };

    const captureResponse = await fetch(`${baseUrl}/captures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(capturePayload)
    });

    if (!captureResponse.ok) {
      const errorText = await captureResponse.text();
      console.error('Tilopay capture error:', errorText);
      throw new Error('Failed to create payment link');
    }

    const captureData = await captureResponse.json();
    
    console.log('✅ Payment link created:', {
      orderId,
      paymentUrl: captureData.payment_url || captureData.url
    });

    return NextResponse.json({
      success: true,
      orderId,
      paymentUrl: captureData.payment_url || captureData.url,
      transactionId: captureData.transaction_id || captureData.id
    });

  } catch (error: any) {
    console.error('❌ Create payment error:', error);
    return NextResponse.json({
      error: 'Failed to create payment',
      message: error.message
    }, { status: 500 });
  }
}
```

**Continue to Part 2 for Webhook Handler, Email System, and Frontend Implementation**
