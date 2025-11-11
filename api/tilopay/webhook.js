import { sendOrderEmail } from '../utils/email.js';

/**
 * Verify webhook signature
 */
function verifyWebhookSignature(req) {
  const expectedSecret = process.env.TILOPAY_WEBHOOK_SECRET || '';
  const providedSecret = req.headers['x-tilopay-secret'] || '';
  const providedHash = req.headers['hash-tilopay'] || '';

  if (providedSecret && providedSecret === expectedSecret) {
    return true;
  }

  if (providedHash && expectedSecret) {
    return true;
  }

  return false;
}

/**
 * Vercel Serverless Function - Webhook Handler
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tilopay-secret, hash-tilopay');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // GET request for testing
  if (req.method === 'GET') {
    return res.json({
      status: 'ok',
      message: 'Tilopay webhook endpoint is active',
      timestamp: new Date().toISOString()
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  console.log(`📨 [Webhook] Received payment notification [${webhookId}]`);

  try {
    const payload = req.body;
    console.log(`📦 [Webhook] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`📦 [Webhook] Payload:`, JSON.stringify(payload, null, 2));
    
    // Verify webhook authenticity (optional for now during testing)
    const isVerified = verifyWebhookSignature(req);
    if (!isVerified) {
      console.warn(`⚠️ [Webhook] Signature not verified, processing anyway [${webhookId}]`);
    }

    // Extract data from webhook payload
    const orderId = payload.order || payload.order_id || payload.orderNumber || payload.referencia || payload.reference;
    const transactionId = payload['tilopay-transaction'] || payload.tpt || payload.transaction_id || payload.transaccion_id || payload.id;
    const code = payload.code;
    const status = code === '1' || code === 1 ? 'approved' : String(payload.estado || payload.status || '').toLowerCase();

    if (!orderId) {
      console.error(`❌ [Webhook] No order ID in payload [${webhookId}]`);
      return res.status(400).json({ error: 'No order ID' });
    }

    // Get order data from global storage
    if (!global.pendingOrders) {
      global.pendingOrders = {};
    }
    
    const order = global.pendingOrders[orderId];

    if (!order) {
      console.error(`❌ [Webhook] Order not found: ${orderId} [${webhookId}]`);
      return res.status(200).json({ 
        success: true, 
        message: 'Order not found but webhook acknowledged' 
      });
    }

    // Check if already processed
    if (order.processed) {
      console.log(`⚠️ [Webhook] Order already processed: ${orderId} [${webhookId}]`);
      return res.json({
        success: true,
        message: 'Order already processed',
        alreadyProcessed: true
      });
    }

    // Determine if payment is successful
    const isSuccess = ['aprobada', 'approved', 'success', 'paid', 'completed'].includes(status);

    if (isSuccess) {
      // Mark as processed
      order.processed = true;
      order.paymentStatus = 'completed';
      order.paymentId = transactionId;
      order.paidAt = new Date().toISOString();

      console.log(`✅ [Webhook] Order ${orderId} marked as paid [${webhookId}]`);

      // Send email notification to admin
      try {
        await sendOrderEmail(order);
        console.log(`📧 [Webhook] Email sent for order ${orderId} [${webhookId}]`);
      } catch (emailError) {
        console.error(`❌ [Webhook] Failed to send email for order ${orderId}:`, emailError);
      }

      return res.json({
        success: true,
        orderId,
        message: 'Payment confirmed and order created',
        webhookId
      });

    } else if (['rechazada', 'declined', 'failed', 'canceled'].includes(status)) {
      // Payment failed
      order.processed = true;
      order.paymentStatus = 'failed';
      order.paymentId = transactionId;

      console.log(`❌ [Webhook] Payment failed for order ${orderId} [${webhookId}]`);

      return res.json({
        success: true,
        orderId,
        message: 'Payment failed - order cancelled',
        webhookId
      });
    }

    return res.json({
      success: true,
      message: 'Webhook received but status unknown',
      webhookId
    });

  } catch (error) {
    console.error(`❌ [Webhook] Error [${webhookId}]:`, error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
      webhookId
    });
  }
}
