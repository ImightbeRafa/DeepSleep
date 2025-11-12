# ✅ Betsy CRM Integration Setup Checklist

## Quick Setup Guide for DeepSleep Website

### 🎯 What You Need

- ✅ Betsy API Key: `bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT`
- ⚠️ Betsy API URL: **You need to replace this with your actual Betsy domain**

---

## 📋 Setup Steps

### Step 1: Update Local Environment File

Open your `.env` file (create it if it doesn't exist) and add:

```bash
# Betsy CRM Integration
BETSY_API_KEY=bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT
BETSY_API_URL=https://your-betsy-domain.com/api/integration/orders/create
```

**⚠️ CRITICAL:** Replace `https://your-betsy-domain.com` with your actual Betsy CRM URL!

Example:
- If your Betsy CRM is at `https://mycompany.betsy.com`, use:
  ```
  BETSY_API_URL=https://mycompany.betsy.com/api/integration/orders/create
  ```

---

### Step 2: Update Vercel Environment Variables (Production)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your DeepSleep project
3. Go to **Settings** → **Environment Variables**
4. Add these two variables:

| Variable Name | Value |
|--------------|-------|
| `BETSY_API_KEY` | `bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT` |
| `BETSY_API_URL` | `https://your-betsy-domain.com/api/integration/orders/create` |

5. Click **Save**
6. **Redeploy** your application

---

### Step 3: Test the Integration

#### Option A: Place a Real Test Order

1. Go to your DeepSleep website
2. Fill out the order form with test data
3. Complete the order (use SINPE or Tilopay)
4. Check Betsy CRM at `/produccion` to verify the order appears

#### Option B: Check Logs

If running locally:
```bash
npm run dev
# Place an order and watch the console for [Betsy] messages
```

If on Vercel:
1. Go to your Vercel project
2. Click on **Deployments**
3. Click on the latest deployment
4. Click **View Function Logs**
5. Look for `[Betsy]` messages

---

## 🔍 What to Look For

### Success Messages ✅
```
📤 [Betsy] Sending order to CRM: 123456
✅ [Betsy] Order synced to CRM: CRM-789
```

### Warning Messages ⚠️
```
⚠️ [Betsy] API credentials not configured, skipping CRM sync
```
→ **Solution:** Add environment variables

### Error Messages ❌
```
❌ [Betsy] CRM sync failed: HTTP 401: Unauthorized
```
→ **Solution:** Check API key is correct

```
❌ [Betsy] CRM sync failed: HTTP 404: Not Found
```
→ **Solution:** Check API URL is correct

---

## 🧪 Quick Test Script

Create a file `test-betsy.js` and run it to test the API:

```javascript
const BETSY_API_KEY = 'bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT';
const BETSY_API_URL = 'https://your-betsy-domain.com/api/integration/orders/create';

fetch(BETSY_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': BETSY_API_KEY
  },
  body: JSON.stringify({
    orderId: 'TEST-' + Date.now(),
    customer: {
      name: 'Test Customer',
      phone: '88887777',
      email: 'test@example.com'
    },
    product: {
      name: 'DeepSleep Bucal Anti-Ronquidos',
      quantity: 1,
      unitPrice: '₡9.900'
    },
    shipping: {
      cost: 'GRATIS',
      address: {
        province: 'San José',
        canton: 'Escazú',
        district: 'San Rafael',
        fullAddress: 'Test Address 123'
      }
    },
    total: '₡9.900',
    payment: {
      method: 'Test',
      transactionId: 'TEST-123',
      status: 'PAGADO',
      date: new Date().toLocaleString('es-CR')
    },
    source: 'DeepSleep Website',
    metadata: {
      campaign: 'test'
    }
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ SUCCESS! Order created in Betsy CRM:', data);
})
.catch(err => {
  console.error('❌ ERROR:', err.message);
});
```

Run: `node test-betsy.js`

---

## 📊 Verify in Betsy CRM

1. Log into your Betsy CRM account
2. Go to **Producción** (Production)
3. Look for orders with source: **"DeepSleep Website"**
4. Verify all order details are correct

You can also check:
- **Config** → **Integraciones** → View integration logs
- Check total orders received
- View recent activity

---

## 🚨 Troubleshooting

### Problem: Orders not appearing in Betsy CRM

**Check 1:** Environment variables set?
```bash
# Local
cat .env | grep BETSY

# Vercel
# Go to Settings → Environment Variables
```

**Check 2:** Correct API URL?
- Make sure you replaced `your-betsy-domain.com` with actual domain
- URL should end with `/api/integration/orders/create`

**Check 3:** API key active?
- Log into Betsy CRM
- Go to Config → Integraciones
- Verify API key is listed and active

**Check 4:** Test the endpoint directly
- Use the test script above
- Or use curl:
```bash
curl -X POST https://your-betsy-domain.com/api/integration/orders/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT" \
  -d '{"orderId":"TEST-123","customer":{"name":"Test"}}'
```

---

## ✅ Final Checklist

Before going live, verify:

- [ ] `.env` file has `BETSY_API_KEY` and `BETSY_API_URL`
- [ ] `BETSY_API_URL` uses your actual Betsy domain (not `your-betsy-domain.com`)
- [ ] Vercel environment variables are set (if deployed)
- [ ] Test order successfully appears in Betsy CRM
- [ ] Both SINPE and Tilopay orders are syncing
- [ ] Integration logs show success messages

---

## 🎉 You're Done!

Once all checkboxes are complete, your DeepSleep website will automatically send every order to Betsy CRM in real-time!

**Questions?** Check `BETSY_INTEGRATION.md` for detailed documentation.
