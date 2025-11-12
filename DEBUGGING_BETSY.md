# Debugging Betsy CRM Integration

## Current Issue
Requests are **not reaching** the Betsy CRM server at all. The Betsy logs show no POST requests to `/api/integration/orders/create`.

## What We Know
✅ **Payload structure is correct** - All required fields present
✅ **API endpoint tested successfully** - Test script created order successfully
✅ **Logs show request is being initiated** - We see the payload being logged
❌ **Request never reaches Betsy** - No logs on Betsy side

## Possible Causes

### 1. Environment Variables Not Set in Vercel ⚠️ MOST LIKELY
**Symptom:** Logs stop after showing URL and API key
**Check:** Look for these logs in Vercel:
```
🔍 [Betsy] Environment check - API Key exists: true
🔍 [Betsy] Environment check - API URL exists: true
🔍 [Betsy] Environment check - API URL value: https://www.betsycrm.com/...
```

**Fix:** Add to Vercel Environment Variables:
- `BETSY_API_KEY=bts_DThU5Ggsn16wV56kWGGmq9HlqdvLKmW6uZx9LcX3sf9u06AxycTNN76osyFT`
- `BETSY_API_URL=https://www.betsycrm.com/api/integration/orders/create`

### 2. Network/Firewall Issue
**Symptom:** Fetch fails silently
**Check:** Look for these error logs:
```
❌ [Betsy] Fetch failed: [error message]
❌ [Betsy] Fetch error name: [error type]
```

### 3. Timeout (10 seconds)
**Symptom:** Request times out
**Check:** Look for:
```
❌ [Betsy] Request timed out after 10 seconds
```

### 4. CORS Issue (unlikely for server-to-server)
**Symptom:** CORS error in logs
**Note:** This shouldn't happen in serverless functions

## Enhanced Logging Added

The code now logs:
1. ✅ Environment variable validation
2. ✅ Full API URL being called
3. ✅ API key confirmation (first 20 chars)
4. ✅ Fetch initiation
5. ✅ Fetch completion
6. ✅ Response status and headers
7. ✅ Full response body
8. ✅ Detailed error information

## Next Steps

1. **Commit and push changes:**
   ```bash
   git add api/utils/betsy.js
   git commit -m "Add comprehensive Betsy API debugging"
   git push origin main
   ```

2. **Verify Vercel Environment Variables:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Ensure `BETSY_API_KEY` and `BETSY_API_URL` are set
   - If missing, add them and redeploy

3. **Redeploy:**
   - Vercel will auto-deploy from GitHub push
   - Or manually redeploy from Vercel dashboard

4. **Place test order and check logs for:**
   ```
   🔍 [Betsy] Environment check - API Key exists: [should be true]
   🔍 [Betsy] Environment check - API URL exists: [should be true]
   🚀 [Betsy] Making fetch request...
   ✅ [Betsy] Fetch completed
   📥 [Betsy] Response status: [status code]
   ```

5. **If environment variables are missing:**
   - That's the issue! Add them in Vercel
   
6. **If fetch fails:**
   - Check the error message
   - May need to whitelist Vercel IPs in Betsy firewall

## Expected Successful Flow

```
🔍 [Betsy] Environment check - API Key exists: true
🔍 [Betsy] Environment check - API URL exists: true
🔍 [Betsy] Environment check - API URL value: https://www.betsycrm.com/api/integration/orders/create
📤 [Betsy] Sending order to CRM: 600561
📦 [Betsy] Order payload: {...}
🌐 [Betsy] Sending to URL: https://www.betsycrm.com/api/integration/orders/create
🔑 [Betsy] Using API key: bts_DThU5Ggsn16wV56k...
🚀 [Betsy] Making fetch request...
✅ [Betsy] Fetch completed
📥 [Betsy] Response status: 200 OK
📥 [Betsy] Response content-type: application/json
✅ [Betsy] Order synced to CRM: [crmOrderId]
✅ [Betsy] Full response: {...}
```

## Contact Points

- **DeepSleep Vercel:** Check logs at vercel.com
- **Betsy CRM Logs:** Check at www.betsycrm.com (your screenshots)
- **Test Endpoint:** Run `node test-betsy-endpoint.js` locally to verify API works
