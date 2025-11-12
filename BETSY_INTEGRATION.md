# 🚀 Betsy CRM Integration - DeepSleep

## Overview

The DeepSleep website is now fully integrated with Betsy CRM for automatic order logging. Every order placed through the website (both SINPE and Tilopay payments) will be automatically sent to your Betsy CRM account.

## ✅ What's Been Implemented

### 1. **Betsy CRM Utility Module** (`api/utils/betsy.js`)
- Handles all communication with Betsy CRM API
- Automatic retry logic with exponential backoff (3 attempts)
- Error handling that doesn't fail orders if CRM sync fails
- Proper data mapping from DeepSleep format to Betsy CRM format

### 2. **SINPE Payment Integration** (`api/email/send-sinpe.js`)
- Orders placed with SINPE payment are automatically sent to Betsy CRM
- Status: `PENDIENTE` (pending payment confirmation)
- Includes all customer and order details

### 3. **Tilopay Payment Integration** (`api/tilopay/webhook.js`)
- Orders paid via Tilopay are automatically sent to Betsy CRM after successful payment
- Status: `PAGADO` (paid)
- Includes transaction ID from Tilopay

## 🔧 Configuration Required

### Step 1: Update Your `.env` File

You need to add the Betsy CRM credentials to your actual `.env` file (not `.env.example`):

```bash
# Betsy CRM Integration
BETSY_API_KEY=bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT
BETSY_API_URL=https://your-betsy-domain.com/api/integration/orders/create
```

**⚠️ IMPORTANT:** Replace `https://your-betsy-domain.com` with your actual Betsy CRM domain URL.

### Step 2: Update Vercel Environment Variables (if deployed)

If your site is deployed on Vercel, you need to add these environment variables:

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - `BETSY_API_KEY`: `bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT`
   - `BETSY_API_URL`: `https://your-betsy-domain.com/api/integration/orders/create`
4. Redeploy your application

## 📦 Order Data Format

Orders are sent to Betsy CRM in the following format:

```json
{
  "orderId": "123456",
  "customer": {
    "name": "Juan Pérez",
    "phone": "88887777",
    "email": "juan@example.com"
  },
  "product": {
    "name": "DeepSleep Bucal Anti-Ronquidos",
    "quantity": 1,
    "unitPrice": "₡9.900"
  },
  "shipping": {
    "cost": "GRATIS",
    "address": {
      "province": "San José",
      "canton": "Escazú",
      "district": "San Rafael",
      "fullAddress": "Casa 123, Calle Principal"
    }
  },
  "total": "₡9.900",
  "payment": {
    "method": "Tilopay",
    "transactionId": "TXN-123456",
    "status": "PENDIENTE",
    "date": "12/11/2024, 15:30:00"
  },
  "source": "DeepSleep Website",
  "metadata": {
    "campaign": "organic",
    "referrer": "direct",
    "comments": "Pago: Tarjeta (Tilopay) - Estado: PAGADO - ID Transacción: TXN-123456",
    "createdAt": "2024-11-12T21:30:00.000Z"
  }
}
```

## 📌 Important: Status vs Payment Information

### Order Status
- **`payment.status`** is always set to **`PENDIENTE`**
- This represents the **order fulfillment status**, not payment status
- All orders start as `PENDIENTE` and should be updated in Betsy CRM when shipped/completed

### Payment Information
- **Payment status is included in the `metadata.comments` field**
- This allows you to see payment status while keeping order status separate
- Format examples:
  - SINPE: `"Pago: SINPE Móvil - Estado: Pendiente de confirmación"`
  - Tilopay (paid): `"Pago: Tarjeta (Tilopay) - Estado: PAGADO - ID Transacción: TXN-123456"`
  - Tilopay (pending): `"Pago: Tarjeta (Tilopay) - Estado: Pendiente"`

### Why This Structure?
- **Order status** tracks fulfillment (pending → processing → shipped → delivered)
- **Payment status** (in comments) tracks payment confirmation
- This separation allows proper workflow management in Betsy CRM

---

## 🔄 How It Works

### SINPE Payment Flow:
1. Customer fills out order form and selects SINPE payment
2. Order is created with status `PENDIENTE`
3. Email is sent to customer with SINPE payment instructions
4. **Order is automatically sent to Betsy CRM** (async, doesn't block)
   - Order status: `PENDIENTE`
   - Comments: "Pago: SINPE Móvil - Estado: Pendiente de confirmación"
5. Customer receives confirmation

### Tilopay Payment Flow:
1. Customer fills out order form and selects card payment
2. Customer is redirected to Tilopay payment page
3. Customer completes payment
4. Tilopay webhook notifies DeepSleep website
5. Email is sent to admin
6. **Order is automatically sent to Betsy CRM** (async, doesn't block)
   - Order status: `PENDIENTE` (order needs to be fulfilled)
   - Comments: "Pago: Tarjeta (Tilopay) - Estado: PAGADO - ID Transacción: XXX"

## 🛡️ Error Handling

The integration is designed to be **non-blocking**:
- If Betsy CRM is down or unreachable, orders will still be processed
- Automatic retry logic (3 attempts with exponential backoff)
- All errors are logged but don't affect the customer experience
- Failed syncs are logged in the console for manual review

## 📊 Monitoring

### Check Integration Status

You can monitor the Betsy CRM integration by checking:

1. **Server Logs** (Vercel or local console):
   - Look for `[Betsy]` prefixed messages
   - `✅ [Betsy] Order synced to CRM:` = Success
   - `❌ [Betsy] CRM sync failed:` = Error

2. **Betsy CRM Dashboard**:
   - Go to **Config** → **Integraciones**
   - View activity logs and statistics
   - Check for incoming orders

### Common Log Messages

```
📤 [Betsy] Sending order to CRM: 123456
📦 [Betsy] Order payload: {...}
✅ [Betsy] Order synced to CRM: CRM-789
```

Or if there's an error:
```
⚠️ [Betsy] API credentials not configured, skipping CRM sync
❌ [Betsy] CRM sync failed: HTTP 401: Unauthorized
🔄 [Betsy] Attempt 2/3 for order 123456
```

## 🧪 Testing

### Test the Integration

1. **Place a test order** on your DeepSleep website
2. **Check the logs** for Betsy sync messages
3. **Verify in Betsy CRM** that the order appears at `/produccion`

### Test Script (Optional)

You can create a test script to verify the Betsy API endpoint:

```javascript
// test-betsy-integration.js
const testOrder = {
  orderId: "TEST-" + Date.now(),
  nombre: "Test Customer",
  telefono: "88887777",
  email: "test@example.com",
  provincia: "San José",
  canton: "Escazú",
  distrito: "San Rafael",
  direccion: "Test Address 123",
  cantidad: 1,
  total: 9900,
  comentarios: "Test order",
  paymentMethod: "Test",
  paymentStatus: "completed",
  createdAt: new Date().toISOString()
};

fetch('https://your-betsy-domain.com/api/integration/orders/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT'
  },
  body: JSON.stringify({
    orderId: testOrder.orderId,
    customer: {
      name: testOrder.nombre,
      phone: testOrder.telefono,
      email: testOrder.email
    },
    product: {
      name: "DeepSleep Bucal Anti-Ronquidos",
      quantity: 1,
      unitPrice: "₡9.900"
    },
    shipping: {
      cost: "GRATIS",
      address: {
        province: testOrder.provincia,
        canton: testOrder.canton,
        district: testOrder.distrito,
        fullAddress: testOrder.direccion
      }
    },
    total: "₡9.900",
    payment: {
      method: "Test",
      transactionId: "TEST-123",
      status: "PAGADO",
      date: new Date().toLocaleString('es-CR')
    },
    source: "DeepSleep Website",
    metadata: {
      campaign: "test",
      referrer: "manual-test"
    }
  })
})
.then(res => res.json())
.then(data => console.log('✅ Success:', data))
.catch(err => console.error('❌ Error:', err));
```

Run with: `node test-betsy-integration.js`

## 🔐 Security Notes

- **Never commit** your actual `.env` file to Git (it's already in `.gitignore`)
- The API key is stored securely in environment variables
- API key is only used in server-side code (Vercel serverless functions)
- Never expose the API key in client-side JavaScript

## 🚨 Troubleshooting

### Orders not appearing in Betsy CRM?

1. **Check environment variables are set**:
   - Verify `BETSY_API_KEY` and `BETSY_API_URL` are configured
   - Make sure the URL is correct (replace `your-betsy-domain.com`)

2. **Check server logs**:
   - Look for `[Betsy]` messages
   - Check for error messages

3. **Verify API key is active**:
   - Log into Betsy CRM
   - Go to **Config** → **Integraciones**
   - Verify the API key is active and not revoked

4. **Test the API endpoint directly**:
   - Use the test script above
   - Or use Postman/curl to test the endpoint

### Common Errors

| Error | Solution |
|-------|----------|
| `API credentials not configured` | Add `BETSY_API_KEY` and `BETSY_API_URL` to `.env` |
| `HTTP 401: Unauthorized` | Check API key is correct and active |
| `HTTP 404: Not Found` | Verify `BETSY_API_URL` is correct |
| `timeout` | Check Betsy CRM server is reachable |

## 📝 Next Steps

1. ✅ Add Betsy credentials to your `.env` file
2. ✅ Update the `BETSY_API_URL` with your actual Betsy domain
3. ✅ Deploy to Vercel (or restart local server)
4. ✅ Place a test order
5. ✅ Verify order appears in Betsy CRM
6. ✅ Monitor logs for any errors

## 🎉 That's It!

Your DeepSleep website is now fully integrated with Betsy CRM. Every order will automatically appear in your CRM system in real-time!

---

**Need Help?** Check the Betsy CRM integration logs or contact support.
