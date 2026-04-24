import { sendOrderEmail } from '../utils/email.js';
import { sendOrderToBetsyWithRetry } from '../utils/betsy.js';
import { sendMetaEvent, generateEventId } from '../utils/meta.js';
import { decodeOrderReturnData } from '../utils/orderReturnData.js';

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

function getReturnData(payload) {
  return payload.returnData ||
    payload.return_data ||
    payload.return ||
    payload.ReturnData ||
    payload.RETURNDATA ||
    null;
}

function getStoredOrder(orderId, payload) {
  if (!global.pendingOrders) {
    global.pendingOrders = {};
  }

  if (orderId && global.pendingOrders[orderId]) {
    return global.pendingOrders[orderId];
  }

  const returnData = getReturnData(payload);
  if (!returnData) {
    return null;
  }

  try {
    const order = decodeOrderReturnData(returnData);
    if (orderId && order.orderId && String(order.orderId) !== String(orderId)) {
      console.error(`[Webhook] returnData order mismatch. Webhook: ${orderId}, returnData: ${order.orderId}`);
      return null;
    }

    const resolvedOrderId = order.orderId || orderId;
    if (resolvedOrderId) {
      global.pendingOrders[resolvedOrderId] = order;
    }

    console.log(`[Webhook] Order data recovered from returnData for order ${resolvedOrderId || 'unknown'}`);
    return order;
  } catch (error) {
    console.error('[Webhook] Failed to decode returnData:', error);
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-tilopay-secret, hash-tilopay');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
  console.log(`[Webhook] Received payment notification [${webhookId}]`);

  try {
    const payload = req.body || {};
    console.log('[Webhook] Headers:', JSON.stringify(req.headers, null, 2));
    console.log('[Webhook] Payload:', JSON.stringify(payload, null, 2));

    const isVerified = verifyWebhookSignature(req);
    if (!isVerified) {
      console.warn(`[Webhook] Signature not verified, processing anyway [${webhookId}]`);
    }

    const orderId = payload.order || payload.order_id || payload.orderNumber || payload.referencia || payload.reference;
    const transactionId = payload['tilopay-transaction'] || payload.tpt || payload.transaction_id || payload.transaccion_id || payload.id;
    const code = payload.code;
    const status = String(payload.estado || payload.status || '').toLowerCase();

    console.log(`[Webhook] Payment details - Order: ${orderId}, Code: ${code}, Status: ${status} [${webhookId}]`);

    if (!orderId) {
      console.error(`[Webhook] No order ID in payload [${webhookId}]`);
      return res.status(400).json({ error: 'No order ID' });
    }

    const isCodeApproved = code === '1' || code === 1;
    const isStatusApproved = ['aprobada', 'approved', 'success', 'paid', 'completed'].includes(status);
    const isSuccess = isCodeApproved || (isStatusApproved && code === undefined);
    const isCodeDeclined = code !== undefined && code !== '1' && code !== 1;
    const isStatusDeclined = ['rechazada', 'declined', 'failed', 'canceled', 'cancelled', 'rejected'].includes(status);

    const order = getStoredOrder(orderId, payload);

    if (!order) {
      console.error(`[Webhook] Order data unavailable: ${orderId} [${webhookId}]`);
      if (isSuccess) {
        return res.status(500).json({
          success: false,
          error: 'Order data unavailable for paid order',
          orderId,
          webhookId
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Order data unavailable for non-approved payment',
        orderId,
        webhookId
      });
    }

    if (order.processed) {
      console.log(`[Webhook] Order already processed: ${orderId} [${webhookId}]`);
      return res.json({
        success: true,
        message: 'Order already processed',
        alreadyProcessed: true
      });
    }

    if (isSuccess) {
      order.processed = true;
      order.paymentStatus = 'completed';
      order.paymentId = transactionId;
      order.paidAt = new Date().toISOString();

      console.log(`[Webhook] Order ${orderId} marked as paid [${webhookId}]`);

      try {
        await sendOrderEmail(order);
        console.log(`[Webhook] Email sent for order ${orderId} [${webhookId}]`);
      } catch (emailError) {
        console.error(`[Webhook] Failed to send email for order ${orderId}:`, emailError);
      }

      try {
        await sendOrderToBetsyWithRetry({
          ...order,
          paymentMethod: 'Tilopay',
          transactionId
        });
        console.log(`[Webhook] Order synced to Betsy CRM: ${orderId}`);
      } catch (error) {
        console.error('[Webhook] Failed to sync order to Betsy CRM:', error);
      }

      const appUrl = (process.env.APP_URL || 'https://deepsleep.shopping').replace(/\/+$/, '');
      const metaEventId = generateEventId('purchase', orderId, transactionId);
      const quantity = parseInt(order.cantidad, 10) || 1;
      sendMetaEvent('Purchase', metaEventId, order, req, {
        value: order.total || 0,
        currency: 'CRC',
        content_ids: ['deepsleep-bucal'],
        content_type: 'product',
        num_items: quantity
      }, `${appUrl}/success.html`).catch(() => {});

      return res.json({
        success: true,
        orderId,
        message: 'Payment confirmed and order created',
        webhookId
      });
    }

    if (isCodeDeclined || isStatusDeclined) {
      order.processed = true;
      order.paymentStatus = 'failed';
      order.paymentId = transactionId;

      console.log(`[Webhook] Payment failed for order ${orderId} - Code: ${code}, Status: ${status} [${webhookId}]`);

      return res.json({
        success: true,
        orderId,
        message: 'Payment failed - order cancelled',
        paymentStatus: 'failed',
        code,
        status,
        webhookId
      });
    }

    console.warn(`[Webhook] Unknown payment status for order ${orderId} - Code: ${code}, Status: ${status} [${webhookId}]`);
    return res.json({
      success: true,
      orderId,
      message: 'Webhook received but status unknown - payment not confirmed',
      code,
      status,
      webhookId
    });
  } catch (error) {
    console.error(`[Webhook] Error [${webhookId}]:`, error);
    return res.status(500).json({
      error: 'Webhook processing failed',
      message: error.message,
      webhookId
    });
  }
}
