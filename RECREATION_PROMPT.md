# Product Landing Page + E-Commerce Recreation Guide

> **Purpose:** This document is a complete prompt/specification for an AI to recreate this exact website architecture for a **different product**. It includes every integration detail (Tilopay payments, Betsy CRM, Resend emails), the full file structure, UI/UX patterns, and backend logic. Replace all product-specific content (name, descriptions, pricing, images, contact info) with your own.

---

## TABLE OF CONTENTS

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [File Structure](#3-file-structure)
4. [Environment Variables](#4-environment-variables)
5. [Frontend — HTML Structure](#5-frontend--html-structure)
6. [Frontend — CSS Design System](#6-frontend--css-design-system)
7. [Frontend — JavaScript Logic](#7-frontend--javascript-logic)
8. [Backend — Vercel Serverless Functions](#8-backend--vercel-serverless-functions)
9. [TILOPAY Payment Integration (CRITICAL)](#9-tilopay-payment-integration-critical)
10. [Betsy CRM Integration](#10-betsy-crm-integration)
11. [Resend Email Integration](#11-resend-email-integration)
12. [Success & Error Pages](#12-success--error-pages)
13. [Vercel Deployment Configuration](#13-vercel-deployment-configuration)
14. [Customization Checklist](#14-customization-checklist)

---

## 1. PROJECT OVERVIEW

This is a **single-product e-commerce landing page** built for the Costa Rica market. It is:

- A **static Vite-built frontend** (vanilla HTML/CSS/JS, no framework)
- Deployed on **Vercel** with serverless API functions in the `/api` directory
- Supports **two payment methods:**
  - **SINPE Móvil** (Costa Rican mobile payment — sends email instructions)
  - **Tilopay** (credit/debit card payment gateway — redirects to hosted payment page)
- After successful payment, the system:
  1. Sends a **customer confirmation email** (via Resend)
  2. Sends an **admin notification email** (via Resend)
  3. Creates an **order in Betsy CRM** (via REST API)
- The site is entirely in **Spanish** (Costa Rican locale)
- Currency: **Costa Rican Colones (CRC, ₡)**
- All prices use tiered/volume pricing with free shipping on 2+ units

---

## 2. TECH STACK & DEPENDENCIES

### Build Tool
- **Vite 5.x** — dev server and production build
- **Terser** — minification

### package.json
```json
{
  "name": "your-product-name",
  "version": "1.0.0",
  "description": "Your product description",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {},
  "devDependencies": {
    "terser": "^5.44.1",
    "vite": "^5.0.0"
  }
}
```

**IMPORTANT:** There are ZERO runtime dependencies. All backend API calls (Tilopay, Resend, Betsy) use the native `fetch()` API available in Vercel's Node.js runtime. No Express, no Axios, no external packages.

### vite.config.js
```js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser'
  }
});
```

---

## 3. FILE STRUCTURE

```
project-root/
├── api/                          # Vercel serverless functions (BACKEND)
│   ├── email/
│   │   └── send-sinpe.js         # SINPE order handler: calculates total, sends emails, syncs CRM
│   ├── tilopay/
│   │   ├── create-payment.js     # Creates Tilopay payment session & redirects user
│   │   ├── confirm.js            # Called from success page to send emails + sync CRM
│   │   └── webhook.js            # Tilopay webhook receiver (backup to confirm.js)
│   └── utils/
│       ├── betsy.js              # Betsy CRM integration utility with retry logic
│       └── email.js              # Resend email utility (customer + admin emails)
├── public/
│   ├── success.html              # Post-payment success page (Tilopay redirects here)
│   ├── error.html                # Post-payment error page
│   ├── favicon.ico
│   └── images/
│       ├── logo.png              # Brand logo
│       └── product.png           # Product image
├── src/
│   ├── js/
│   │   └── main.js               # Frontend logic: pricing, form handling, API calls
│   └── styles/
│       └── main.css               # Complete CSS design system
├── index.html                     # Main landing page
├── vercel.json                    # Vercel deployment config (rewrites + CORS headers)
├── package.json
├── vite.config.js
├── .env                           # Environment variables (DO NOT COMMIT)
└── .env.example                   # Template for environment variables
```

---

## 4. ENVIRONMENT VARIABLES

Create a `.env` file (and a `.env.example` for reference):

```env
# Tilopay Configuration
TILOPAY_WEBHOOK_SECRET=your_webhook_secret_from_tilopay_dashboard
TILOPAY_BASE_URL=https://app.tilopay.com/api/v1
TILOPAY_API_KEY=your-tilopay-api-key
TILOPAY_USER=your_tilopay_api_user
TILOPAY_PASSWORD=your_tilopay_api_password

# Resend Email Configuration
RESEND_API_KEY=re_your_resend_api_key
ORDER_NOTIFICATION_EMAIL=your-admin-email@example.com

# Application URL (your Vercel deployment domain)
APP_URL=https://your-domain.com

# Betsy CRM Integration
BETSY_API_KEY=bts_your_betsy_api_key
BETSY_API_URL=https://www.betsycrm.com/api/integration/orders/create
```

**Where to get these:**
- **Tilopay:** Sign up at https://tilopay.com, get credentials from your merchant dashboard. The API key, user, and password are provided upon merchant activation. The webhook secret is configured in the Tilopay dashboard under webhook settings.
- **Resend:** Sign up at https://resend.com, create an API key. You need a verified sending domain (the `from` address domain must be verified in Resend).
- **Betsy CRM:** Get your API key from the Betsy CRM dashboard at https://www.betsycrm.com. The API URL for order creation is `https://www.betsycrm.com/api/integration/orders/create`.

**In Vercel:** Add all these as Environment Variables in your Vercel project settings (Settings → Environment Variables). They are automatically available to serverless functions via `process.env`.

---

## 5. FRONTEND — HTML STRUCTURE

The `index.html` is a single-page layout with these sections (in order):

### 5.1 Header (sticky)
- Logo image + brand text on the left
- Navigation links on the right: Producto, Cómo Funciona, Cuidados, Ordena, Contacto
- All links are smooth-scroll anchors (`href="#section-id"`)

### 5.2 Hero Section
- Two-column grid: content left, product image right
- Content includes:
  - Badge/pill ("✨ Solución Comprobada" or similar)
  - Large title with `<br>` for line break
  - Subtitle paragraph
  - Feature checklist (3 items with SVG check icons)
  - Price section (box with shadow): price label + large price + shipping badge + urgency text
  - Two CTA buttons: primary "Pedir Ahora" + secondary "Ver Más Detalles"
  - Contact info (WhatsApp + Instagram links)
- Right column: product image with badge overlay

### 5.3 Product Features Section (`#producto`)
- Two-column grid: image left, content right
- Content: title, description, 4 benefit items (emoji icon + title + description)

### 5.4 Testimonials Section
- 3-column grid of testimonial cards
- Each card: stars, quote text (italic), author name + location

### 5.5 How It Works Section (`#como-funciona`)
- 4-step grid with numbered circles
- Each step: number circle, title, description

### 5.6 Care Instructions Section (`#cuidados`)
- Centered list of care items (emoji icon + instruction)
- Bottom note

### 5.7 Shipping Info Section
- 3-column grid of shipping cards
- Middle card highlighted (different background color, scaled up)

### 5.8 Order Form Section (`#pedido`) — **CRITICAL**
Two-column layout: order summary (left) + form (right)

**Order Summary panel:**
- Product image thumbnail
- "Resumen del Pedido" title
- Line items: product name + price, savings (hidden by default), shipping cost
- Total line with accent border

**Order Form fields:**
- Nombre Completo (text, required)
- Teléfono (tel, required)
- Email (email, required)
- Provincia (select dropdown with Costa Rica provinces, required)
- Cantón (text, required)
- Distrito (text, required)
- Dirección (textarea, required)
- Cantidad (select: 1-5 units, required)
- Método de Pago (select: SINPE Móvil / Tarjeta (Tilopay), required)
- Payment info box (dynamic, shown based on payment method selection)
- Comentarios (textarea, optional)
- Submit button
- Note text

### 5.9 Contact Section (`#contacto`)
- WhatsApp button + Instagram button

### 5.10 Footer
- Copyright text + social links

### 5.11 Loading Overlay
- Full-screen overlay with spinner, hidden by default, shown during form submission

**The `<script>` tag at the bottom:**
```html
<script type="module" src="/src/js/main.js"></script>
```

---

## 6. FRONTEND — CSS DESIGN SYSTEM

### Design Tokens (CSS Custom Properties)
```css
:root {
    --color-white: #ffffff;
    --color-light-blue: #e8f4f8;
    --color-blue: #4a90e2;
    --color-light-grey: #f8f9fa;
    --color-grey: #e0e0e0;
    --color-dark-grey: #666666;
    --color-text: #2c3e50;
    --color-primary: #4a90e2;        /* CHANGE THIS for your brand */
    --color-primary-dark: #357abd;   /* Darker variant of primary */
    --color-success: #27ae60;
    --color-warning: #f39c12;
    --color-whatsapp: #25d366;
    --color-instagram: #e4405f;
    --spacing-xs: 0.5rem;
    --spacing-sm: 1rem;
    --spacing-md: 2rem;
    --spacing-lg: 3rem;
    --spacing-xl: 4rem;
    --border-radius: 12px;
    --border-radius-lg: 16px;
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 10px 30px rgba(0, 0, 0, 0.15);
}
```

### Font
- **Google Fonts: Inter** (weights: 300, 400, 500, 600)
- Fallback: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`

### Key Design Patterns
- **Sticky header** with subtle shadow
- **Hero gradient background:** `linear-gradient(135deg, #f0f7ff 0%, white 100%)`
- **Cards** with border-radius-lg (16px), shadow-md, hover lift effect (`translateY(-5px)`)
- **Buttons:** rounded (12px), primary has shadow, hover lift
- **Price box:** white background, large shadow, contains price + shipping badge
- **Step numbers:** circular, primary color background, white text
- **Shipping highlight card:** success-green gradient, scaled to 1.05
- **Form:** light-grey background, rounded, shadow, 2px border inputs
- **Loading overlay:** fixed, dark semi-transparent, white spinner
- **Messages:** green for success, red for error, rounded, centered

### Responsive Breakpoints
- `1024px`: hero grid → single column, image on top; product showcase → single column; testimonials/shipping → single column
- `768px`: header stacks vertically, nav wraps, hero title shrinks to 2rem, CTAs stack, form rows → single column, order container → single column
- `480px`: reduced padding, even smaller titles/prices

---

## 7. FRONTEND — JAVASCRIPT LOGIC (`src/js/main.js`)

### 7.1 CSS Import
```js
import '../styles/main.css';
```
Vite processes this and injects the CSS.

### 7.2 Pricing Configuration
```js
const API_BASE_URL = '/api';

// CUSTOMIZE THESE for your product
const pricing = {
    1: 9900,   // 1 unit price in smallest denomination (colones, not decimal)
    2: 16900,  // 2 units: volume discount
    3: 23900,
    4: 30900,
    5: 37900
};

const SHIPPING_COST = 2500; // Only charged for 1 unit
```

### 7.3 Smooth Scrolling
Attaches click handlers to all `a[href^="#"]` for smooth scroll behavior.

### 7.4 Dynamic Order Summary (`updateTotal()`)
- Listens to quantity dropdown changes
- Looks up tiered price from `pricing` object
- Shipping is free for 2+ units, ₡2,500 for single items
- Updates subtotal display, shipping line (shows "GRATIS" in green for 2+), savings line (hidden for 1 unit), and total
- Called on page load AND on quantity change

### 7.5 Payment Method Handler
- Listens to payment method dropdown changes
- Shows/hides a `#payment-info` div with dynamic content:
  - **SINPE:** Shows SINPE number, recipient name, and instructions
  - **Tarjeta:** Shows message about Tilopay redirect
  - **Empty:** Hides the box

### 7.6 Form Submission Handler
On form submit:
1. Prevents default
2. Collects all form data via `FormData` → `Object.fromEntries()`
3. Validates payment method is selected
4. Shows loading overlay
5. Routes to the appropriate handler:
   - `handleSinpePayment(data)` → POST to `/api/email/send-sinpe`
   - `handleTilopayPayment(data)` → POST to `/api/tilopay/create-payment`

### 7.7 SINPE Payment Flow
```
POST /api/email/send-sinpe → { success, orderId }
```
- On success: hides loading, shows success message with order ID, resets form
- On error: throws to be caught by parent handler

### 7.8 Tilopay Payment Flow
```
POST /api/tilopay/create-payment → { success, orderId, paymentUrl }
```
- On success: redirects browser to `paymentUrl` (Tilopay hosted payment page)
- On error: throws to be caught by parent handler

### 7.9 Utility Functions
- `showMessage(text, type)` — Creates a temporary message div (success/error), inserts before form, auto-removes after 8 seconds
- `showLoading(show)` — Toggles loading overlay visibility

---

## 8. BACKEND — VERCEL SERVERLESS FUNCTIONS

All files in `/api` are **Vercel Serverless Functions**. They use ES Module syntax (`export default`).

**Every handler follows this pattern:**
```js
export default async function handler(req, res) {
  // 1. Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', '...');

  // 2. Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Reject non-POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // 4. Business logic...
}
```

### Pricing Calculation (duplicated in backend for security)
The backend has its own copy of the pricing table — **never trust frontend pricing**:
```js
const pricing = {
  1: 9900,
  2: 16900,
  3: 23900,
  4: 30900,
  5: 37900
};
const quantity = parseInt(cantidad) || 1;
const subtotal = pricing[quantity] || pricing[1];
const shippingCost = quantity === 1 ? 2500 : 0;
const total = subtotal + shippingCost;
```

### Order ID Generation
Simple 6-digit random number:
```js
const orderId = Math.floor(100000 + Math.random() * 900000).toString();
```

---

## 9. TILOPAY PAYMENT INTEGRATION (CRITICAL)

This is the most complex part. Tilopay is a Costa Rican payment gateway. The integration has **3 endpoints** and a specific flow.

### 9.1 Overall Flow

```
1. User fills form, selects "Tarjeta" payment → clicks submit
2. Frontend POSTs to /api/tilopay/create-payment
3. Backend authenticates with Tilopay API (gets Bearer token)
4. Backend creates payment via Tilopay processPayment API
5. Backend returns payment URL to frontend
6. Frontend redirects user to Tilopay's hosted payment page
7. User completes payment on Tilopay
8. Tilopay redirects user back to YOUR success.html with URL parameters
9. success.html reads URL params, checks code, calls /api/tilopay/confirm
10. confirm.js decodes order data, sends emails, syncs to Betsy CRM
11. (Backup) Tilopay also calls /api/tilopay/webhook with payment result
```

### 9.2 Step-by-Step: `/api/tilopay/create-payment.js`

#### A. Authentication with Tilopay
```js
async function authenticateTilopay() {
  const baseUrl = process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1';
  const apiUser = process.env.TILOPAY_USER;
  const apiPassword = process.env.TILOPAY_PASSWORD;

  // POST to /login with apiuser and password
  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiuser: apiUser,       // NOTE: field name is "apiuser" not "user"
      password: apiPassword
    })
  });

  const loginData = await loginResponse.json();
  return loginData.access_token;  // This is a Bearer token
}
```

**CRITICAL NOTES:**
- The login endpoint is `POST {baseUrl}/login`
- The request body field is `apiuser` (not `user` or `username`)
- The response contains `access_token` which is used as a Bearer token
- This token must be obtained fresh for each payment (it expires)

#### B. Creating the Payment

After authentication, create the payment via `POST {baseUrl}/processPayment`:

```js
// Encode order data as base64 to pass through Tilopay redirect
const orderData = {
  orderId, nombre, telefono, email, provincia, canton,
  distrito, direccion, cantidad: quantity, subtotal,
  shippingCost, total, comentarios,
  createdAt: new Date().toISOString()
};
const encodedOrderData = Buffer.from(JSON.stringify(orderData)).toString('base64');

const paymentPayload = {
  key: process.env.TILOPAY_API_KEY,   // Your Tilopay API key
  amount: Math.round(total),           // Amount in CRC (integer, no decimals)
  currency: 'CRC',                     // Costa Rican Colones
  redirect: `${APP_URL}/success.html`, // WHERE Tilopay sends user after payment
  hashVersion: 'V2',                   // Required: use V2
  billToFirstName: firstName,          // Split from full name
  billToLastName: lastName,
  billToAddress: direccion,
  billToAddress2: `${distrito}, ${canton}`,
  billToCity: canton,
  billToState: 'CR-SJ',               // ISO format: CR-XX
  billToZipPostCode: '10101',          // Default CR zip
  billToCountry: 'CR',
  billToTelephone: telefono,
  billToEmail: email,
  orderNumber: orderId,                // Your internal order ID
  capture: '1',                        // 1 = capture immediately
  subscription: '0',                   // 0 = one-time payment
  platform: 'YourBrandName',           // Your platform identifier
  returnData: encodedOrderData         // THIS IS THE KEY TRICK (see below)
};

const captureResponse = await fetch(`${baseUrl}/processPayment`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${accessToken}`  // Token from login step
  },
  body: JSON.stringify(paymentPayload)
});

const paymentData = await captureResponse.json();
const paymentUrl = paymentData.urlPaymentForm || paymentData.url || paymentData.payment_url;
```

**CRITICAL TILOPAY NOTES:**

1. **`returnData` field:** This is the most important trick. Tilopay passes this value back to your redirect URL as a query parameter. Since Vercel serverless functions are stateless (no persistent memory between requests), you CANNOT rely on `global.pendingOrders` surviving between the create-payment call and the success page call. Instead, encode ALL order data as base64 JSON and pass it through `returnData`. Tilopay will append it to the redirect URL as `?returnData=...`.

2. **`key` field:** This is your Tilopay API key (different from the login credentials).

3. **`amount`:** Must be an integer (use `Math.round()`). For CRC, amounts are already in whole colones.

4. **`currency`:** Use `'CRC'` for Costa Rican Colones. Other options: `'USD'`.

5. **`redirect`:** The full URL where Tilopay sends the user after payment. Tilopay appends query parameters including: `code`, `orderId`/`order`, `tilopay-transaction`/`tpt`, `description`/`mensaje`, and your `returnData`.

6. **`hashVersion`:** Must be `'V2'`.

7. **`capture`:** `'1'` means capture immediately (charge the card). `'0'` means authorize only.

8. **`subscription`:** `'0'` for one-time payments.

9. **`billToState`:** Use ISO 3166-2 format: `'CR-SJ'` for San José, etc.

10. **Response:** The payment URL is in `urlPaymentForm` (primary), `url`, or `payment_url` field.

11. **Return to frontend:** Send back `{ success: true, orderId, paymentUrl }`.

### 9.3 Step-by-Step: `/api/tilopay/confirm.js`

This is called from the success page after Tilopay redirects the user back.

**When Tilopay redirects, the URL looks like:**
```
https://your-domain.com/success.html?code=1&orderId=123456&tilopay-transaction=TXN123&returnData=BASE64DATA...
```

The `success.html` page reads these parameters and POSTs to `/api/tilopay/confirm`:

```js
// Request body from success page:
{ orderId, transactionId, code, returnData }
```

**The confirm handler:**
1. Checks `code` — `code === '1'` or `code === 1` means **approved**. Any other value means **declined/failed**.
2. Decodes `returnData` from base64 back to JSON to recover the full order object.
3. If approved: adds payment info to order, sends customer + admin emails, syncs to Betsy CRM.
4. If declined: returns error response.

```js
// Decode order data
const decodedData = Buffer.from(returnData, 'base64').toString('utf-8');
const order = JSON.parse(decodedData);

// Check payment status
const isPaymentApproved = code === '1' || code === 1;

if (isPaymentApproved) {
  order.paymentStatus = 'completed';
  order.paymentId = transactionId;
  order.paymentMethod = 'Tilopay';
  order.paidAt = new Date().toISOString();

  await sendOrderEmail(order);         // Resend emails
  await sendOrderToBetsyWithRetry({    // Betsy CRM
    ...order,
    paymentMethod: 'Tilopay',
    transactionId: transactionId
  });
}
```

### 9.4 Step-by-Step: `/api/tilopay/webhook.js`

This is a **backup mechanism**. Tilopay can also call a webhook URL when payment status changes. Configure this URL in the Tilopay dashboard.

**Webhook Signature Verification:**
```js
function verifyWebhookSignature(req) {
  const expectedSecret = process.env.TILOPAY_WEBHOOK_SECRET;
  const providedSecret = req.headers['x-tilopay-secret'];
  const providedHash = req.headers['hash-tilopay'];

  if (providedSecret && providedSecret === expectedSecret) return true;
  if (providedHash && expectedSecret) return true;
  return false;
}
```

**Webhook headers from Tilopay:**
- `x-tilopay-secret`: The webhook secret you configured
- `hash-tilopay`: A hash for verification

**Webhook payload fields:**
- `order` / `order_id` / `orderNumber` / `referencia` / `reference` → your order ID
- `tilopay-transaction` / `tpt` / `transaction_id` / `transaccion_id` / `id` → Tilopay transaction ID
- `code` → payment result code (1 = approved)
- `estado` / `status` → payment status string

**Payment status codes:**
- `code === 1` or `code === '1'` → **APPROVED**
- Any other code → **DECLINED/FAILED**
- Status strings for approved: `'aprobada'`, `'approved'`, `'success'`, `'paid'`, `'completed'`
- Status strings for declined: `'rechazada'`, `'declined'`, `'failed'`, `'canceled'`, `'cancelled'`, `'rejected'`

**The webhook uses `global.pendingOrders`** (an in-memory store) to find the order. Note: this may not work reliably on Vercel because serverless functions don't share memory across invocations. The `confirm.js` approach with `returnData` is the primary/reliable path.

### 9.5 Tilopay Dashboard Configuration

In your Tilopay merchant dashboard, configure:
1. **Webhook URL:** `https://your-domain.com/api/tilopay/webhook`
2. **Webhook Secret:** Set it and copy to `TILOPAY_WEBHOOK_SECRET` env var
3. **Redirect URL:** `https://your-domain.com/success.html` (also set in code)
4. **Allowed headers:** Ensure `x-tilopay-secret` and `hash-tilopay` are sent

### 9.6 Tilopay Error Codes (for error.html)
```js
const errorMessages = {
    '2': 'Transacción rechazada por el banco',
    '3': 'Tarjeta inválida o bloqueada',
    '4': 'Fondos insuficientes',
    '5': 'Tarjeta expirada',
    '6': 'Error de autenticación 3D Secure',
    '7': 'Transacción cancelada por el usuario',
    '100': 'Error de procesamiento'
};
```

---

## 10. BETSY CRM INTEGRATION

### 10.1 API Details
- **Endpoint:** `POST https://www.betsycrm.com/api/integration/orders/create`
- **Authentication:** Header `x-api-key: YOUR_BETSY_API_KEY`
- **Content-Type:** `application/json`

### 10.2 Payload Structure

```js
const betsyOrder = {
  orderId: 'ORDER_ID',
  customer: {
    name: 'Customer Full Name',
    phone: 'Phone Number',
    email: 'customer@email.com',
  },
  product: {
    name: 'Your Product Name',         // CUSTOMIZE THIS
    quantity: 1,
    unitPrice: '₡9.900',               // CUSTOMIZE THIS
  },
  shipping: {
    cost: '₡2.500' or 'GRATIS',
    courier: 'Correos de Costa Rica',   // CUSTOMIZE if different courier
    address: {
      province: 'San José',
      canton: 'Central',
      district: 'Carmen',
      fullAddress: 'Full street address',
    },
  },
  total: '₡12.400',
  payment: {
    method: 'SINPE' or 'Tilopay',
    transactionId: 'TXN_ID or PENDING',
    status: 'PENDIENTE',                // Always PENDIENTE (order status, not payment)
    date: '01/01/2024, 10:00:00',       // Formatted in Costa Rica timezone
  },
  source: 'Your Brand Website',         // CUSTOMIZE
  salesChannel: 'Website',
  seller: 'Website',
  metadata: {
    campaign: 'organic',
    referrer: 'direct',
    comments: 'Payment info + user comments combined here',
    createdAt: '2024-01-01T00:00:00.000Z',
  },
};
```

### 10.3 Payment Status in Comments
The payment status is embedded in the `metadata.comments` field:
- SINPE: `"Pago: SINPE Móvil - Estado: Pendiente de confirmación"`
- Tilopay paid: `"Pago: Tarjeta (Tilopay) - Estado: PAGADO - ID Transacción: TXN123"`
- Tilopay pending: `"Pago: Tarjeta (Tilopay) - Estado: Pendiente"`

User comments are appended after.

### 10.4 Retry Logic
The `sendOrderToBetsyWithRetry` function retries up to 3 times with exponential backoff (1s, 2s, 3s). It retries on:
- HTTP 5xx errors
- Network timeouts
- Connection errors
It does NOT retry on:
- Missing configuration
- HTTP 4xx errors

**Timeout:** 10 seconds per request using `AbortController`.

### 10.5 Error Handling Philosophy
Betsy CRM sync failures **never** fail the order. They are logged but the order is still confirmed to the user. This is intentional — CRM sync is non-critical.

---

## 11. RESEND EMAIL INTEGRATION

### 11.1 API Details
- **Endpoint:** `POST https://api.resend.com/emails`
- **Authentication:** Header `Authorization: Bearer RESEND_API_KEY`
- **Content-Type:** `application/json`

### 11.2 Email Flow
The `sendOrderEmail(order)` function sends TWO emails:

#### A. Customer Confirmation Email
```js
{
  from: 'YourBrand <ordenes@yourdomain.com>',   // Must be verified domain in Resend
  to: order.email,                                // Customer's email
  subject: `Confirmación de Pedido ${order.orderId} - YourBrand`,
  html: '...'  // Rich HTML email
}
```

**Customer email content:**
- Brand header with gradient background
- Order confirmation with details (order ID, product, quantity, subtotal, shipping, total)
- **If SINPE:** Shows SINPE payment instructions (number, name, amount, step-by-step)
- **If Tilopay:** Shows "payment processed successfully" message
- Shipping address
- Contact information footer

#### B. Admin Notification Email
```js
{
  from: 'YourBrand <ordenes@yourdomain.com>',
  to: process.env.ORDER_NOTIFICATION_EMAIL,       // Admin email from env
  subject: `Nueva Orden: ${order.orderId} - ${order.nombre}`,
  html: '...'  // Rich HTML email
}
```

**Admin email content:**
- New order badge with order ID
- Customer info section (name, phone, email)
- Product details section (product, quantity, price, subtotal, shipping, total)
- Shipping address section
- Customer comments (if any)
- Payment info section (method, transaction ID, status, date)
- Processing instruction

### 11.3 Email Error Handling
- Customer email failure does NOT fail the overall process (just logged)
- Admin email failure DOES throw (it's considered more critical)
- The parent callers (confirm.js, webhook.js, send-sinpe.js) catch email errors and don't fail the order

### 11.4 HTML Email Template Design
Both emails use inline CSS (required for email clients). Key styles:
- Max-width: 600px centered container
- Header: `linear-gradient(135deg, #667eea 0%, #764ba2 100%)` — **customize these colors**
- Content sections: light gray boxes with left border accent
- Labels: bold, blue color
- CTA buttons: gradient background, white text, rounded

---

## 12. SUCCESS & ERROR PAGES

### 12.1 `public/success.html`

**Design:** Centered card on gradient background (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`)

**JavaScript logic (inline):**
1. Reads URL parameters: `orderId`, `tilopay-transaction`/`tpt`, `code`, `returnData`, `description`/`mensaje`
2. Checks `code`:
   - `code === '1'` → Payment approved → show success, call `/api/tilopay/confirm`
   - `code` exists but ≠ 1 → Payment rejected → redirect to `/error.html` with params
   - No code → Show order ID but warn in console
3. On approved payment, POSTs to `/api/tilopay/confirm` with `{ orderId, transactionId, code, returnData }`
4. Displays order number from URL params

### 12.2 `public/error.html`

**Design:** Centered card on red gradient background

**JavaScript logic (inline):**
1. Reads URL parameters: `orderId`, `code`, `description`
2. Shows error code if available
3. Maps Tilopay error codes to user-friendly Spanish messages
4. Shows "try again" and "go home" buttons
5. Shows contact info for support

---

## 13. VERCEL DEPLOYMENT CONFIGURATION

### `vercel.json`
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Credentials", "value": "true" },
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tilopay-secret, hash-tilopay"
        }
      ]
    }
  ]
}
```

**CRITICAL:** The `Access-Control-Allow-Headers` MUST include `x-tilopay-secret` and `hash-tilopay` for the Tilopay webhook to work.

### Deployment Steps
1. Push to GitHub
2. Connect repo to Vercel
3. Vercel auto-detects Vite and builds with `vite build`
4. Add all environment variables in Vercel dashboard
5. Set your custom domain
6. Update `APP_URL` env var to match your domain
7. Configure Tilopay dashboard with your webhook URL and redirect URL

---

## 14. CUSTOMIZATION CHECKLIST

When recreating this for a new product, change:

### Product Content
- [ ] Product name (everywhere: HTML, emails, Betsy payload, page titles)
- [ ] Product description and benefits
- [ ] Product images (`/public/images/product.png`, `/public/images/logo.png`)
- [ ] Testimonials (names, locations, quotes)
- [ ] "How it works" steps
- [ ] Care instructions (or remove if not applicable)
- [ ] Favicon

### Pricing
- [ ] `pricing` object in `src/js/main.js` (frontend)
- [ ] `pricing` object in `api/tilopay/create-payment.js` (backend)
- [ ] `pricing` object in `api/email/send-sinpe.js` (backend)
- [ ] `SHIPPING_COST` in `src/js/main.js`
- [ ] Shipping cost logic in both backend files
- [ ] Display prices in `index.html` (hero, order summary)
- [ ] Unit price in Betsy payload (`api/utils/betsy.js`)

### Contact Info
- [ ] WhatsApp number (everywhere in HTML and emails)
- [ ] Instagram handle (everywhere in HTML and emails)
- [ ] SINPE number and recipient name (in `main.js` and `api/utils/email.js`)
- [ ] Admin notification email (`ORDER_NOTIFICATION_EMAIL` env var)
- [ ] Footer copyright text

### Branding
- [ ] CSS `--color-primary` and `--color-primary-dark` values
- [ ] Email header gradient colors
- [ ] Success/error page gradient colors
- [ ] `from` address in Resend emails (`api/utils/email.js`)
- [ ] `platform` field in Tilopay payload
- [ ] `source` field in Betsy payload
- [ ] Meta description in `<head>`
- [ ] Page title

### Environment
- [ ] All `.env` variables
- [ ] `APP_URL` to your actual domain
- [ ] Tilopay dashboard webhook + redirect URLs

### Costa Rica Specific
- [ ] Province dropdown (7 provinces of Costa Rica) — keep as-is if targeting CR
- [ ] Currency: CRC (₡) — change if different country
- [ ] Tilopay is CR-specific — for other countries use appropriate gateway
- [ ] SINPE Móvil is CR-specific — for other countries use appropriate local payment
- [ ] Shipping courier in Betsy payload ("Correos de Costa Rica")
- [ ] Timezone in date formatting: `'America/Costa_Rica'`

---

## APPENDIX: SINPE PAYMENT FLOW (SIMPLER)

The SINPE flow is simpler than Tilopay:

```
1. User fills form, selects "SINPE Móvil" → clicks submit
2. Frontend POSTs to /api/email/send-sinpe
3. Backend calculates total, generates order ID
4. Backend sends customer email with SINPE instructions (number to pay)
5. Backend sends admin email with order notification
6. Backend syncs order to Betsy CRM
7. Backend returns { success, orderId }
8. Frontend shows success message with order ID
9. Customer manually sends SINPE payment + WhatsApp confirmation
```

No redirect needed. The customer handles payment offline.

---

## APPENDIX: COMMON PITFALLS

1. **Tilopay `apiuser` vs `user`:** The login field is `apiuser`, not `user` or `username`. Getting this wrong returns authentication errors.

2. **Tilopay `returnData` is essential:** Without it, the success page cannot recover order details to send emails/sync CRM, because Vercel serverless functions are stateless.

3. **`global.pendingOrders` doesn't persist:** On Vercel, each serverless function invocation may run in a different container. The `global.pendingOrders` trick only works if the webhook/confirm hits the same warm container. DO NOT rely on it — use `returnData` instead.

4. **CORS headers for webhooks:** Tilopay's webhook calls need the custom headers (`x-tilopay-secret`, `hash-tilopay`) to be allowed. Add them to `vercel.json`.

5. **Amount is integer for CRC:** Don't send decimal amounts to Tilopay for CRC.

6. **Email `from` domain must be verified in Resend:** You cannot send from any arbitrary domain.

7. **Pricing must match frontend and backend:** Always validate/calculate prices server-side. The frontend pricing is only for display.

8. **Betsy sync failures are non-blocking:** Never let a CRM error fail the user's order.

9. **`code` parameter types:** Tilopay may send code as string `'1'` or integer `1`. Always check both: `code === '1' || code === 1`.

10. **Success page immediate redirect on failure:** If `code` indicates rejection, the success page immediately redirects to error page — the user never sees the success UI.
