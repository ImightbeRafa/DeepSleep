import { decodeOrderReturnData } from '../utils/orderReturnData.js';
import { normalizeTrustedOrder } from '../utils/order.js';
import { processPaidOrder, sendApprovedManualReviewAlert } from '../utils/fulfillment.js';

function verifyWebhookSignature(req) {
  const expectedSecret = process.env.TILOPAY_WEBHOOK_SECRET || '';
  const providedSecret = req.headers['x-tilopay-secret'] || '';
  const providedHash = req.headers['hash-tilopay'] || '';

  if (expectedSecret && providedSecret && providedSecret === expectedSecret) {
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

function getOrderId(payload) {
  return payload.order ||
    payload.order_id ||
    payload.orderNumber ||
    payload.order_number ||
    payload.referencia ||
    payload.reference ||
    null;
}

function getTransactionId(payload) {
  return payload['tilopay-transaction'] ||
    payload.tpt ||
    payload.transaction_id ||
    payload.transaccion_id ||
    payload.id ||
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

    const normalized = normalizeTrustedOrder(order);
    global.pendingOrders[normalized.orderId] = normalized;
    return normalized;
  } catch (error) {
    console.error('[Webhook] Failed to decode returnData:', error);
    return null;
  }
}

function classifyPayment(payload) {
  const code = payload.code;
  const status = String(payload.estado || payload.status || '').toLowerCase();
  const isCodeApproved = code === '1' || code === 1;
  const isStatusApproved = ['aprobada', 'approved', 'success', 'paid', 'completed'].includes(status);
  const isSuccess = isCodeApproved || (isStatusApproved && code === undefined);
  const isCodeDeclined = code !== undefined && code !== '1' && code !== 1;
  const isStatusDeclined = ['rechazada', 'declined', 'failed', 'canceled', 'cancelled', 'rejected'].includes(status);

  if (isSuccess) {
    return 'approved';
  }

  if (isCodeDeclined || isStatusDeclined) {
    return 'declined';
  }

  return 'unknown';
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

  const webhookId = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  console.log(`[Webhook] Received payment notification [${webhookId}]`);

  try {
    const payload = req.body || {};
    const isVerified = verifyWebhookSignature(req);

    if (!isVerified) {
      if (process.env.ALLOW_UNSIGNED_TILOPAY_WEBHOOKS !== 'true') {
        console.error(`[Webhook] Signature not verified [${webhookId}]`);
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Tilopay webhook signature was not verified',
          webhookId
        });
      }

      console.warn(`[Webhook] Signature not verified, processing because ALLOW_UNSIGNED_TILOPAY_WEBHOOKS=true [${webhookId}]`);
    }

    const orderId = getOrderId(payload);
    const transactionId = getTransactionId(payload);
    const status = classifyPayment(payload);
    const hasTransactionId = Boolean(String(transactionId || '').trim());

    console.log(`[Webhook] Payment details - Order: ${orderId || 'unknown'}, Transaction: ${transactionId || 'unknown'}, Status: ${status} [${webhookId}]`);

    if (status === 'unknown') {
      return res.json({
        success: true,
        orderId,
        status: 'unknown',
        message: 'Webhook received but payment status was not confirmable',
        webhookId
      });
    }

    if (status === 'declined') {
      if (orderId && global.pendingOrders?.[orderId]) {
        global.pendingOrders[orderId] = {
          ...global.pendingOrders[orderId],
          processed: true,
          paymentStatus: 'failed',
          paymentId: transactionId
        };
      }

      return res.json({
        success: true,
        orderId,
        status: 'declined',
        paymentStatus: 'failed',
        message: 'Payment declined',
        webhookId
      });
    }

    if (!hasTransactionId) {
      const manualReview = await sendApprovedManualReviewAlert({
        orderId,
        transactionId,
        source: 'webhook',
        reason: 'Approved webhook did not include a Tilopay transaction ID',
        rawPayload: {
          webhookId,
          payload
        }
      });

      return res.status(202).json({
        success: true,
        orderId,
        status: manualReview.status,
        manualReview: true,
        message: 'Approved payment sent to manual review because the transaction ID was missing',
        webhookId
      });
    }

    const order = getStoredOrder(orderId, payload);

    if (!order) {
      const manualReview = await sendApprovedManualReviewAlert({
        orderId,
        transactionId,
        source: 'webhook',
        reason: 'Approved webhook did not include usable returnData or pending order data',
        rawPayload: {
          webhookId,
          payload
        }
      });

      return res.status(202).json({
        success: true,
        orderId,
        status: manualReview.status,
        manualReview: true,
        message: 'Approved payment sent to manual review',
        webhookId
      });
    }

    const fulfillment = await processPaidOrder(order, {
      req,
      source: 'webhook',
      transactionId,
      rawPayload: {
        webhookId,
        payload
      }
    });

    return res.json({
      success: true,
      orderId: fulfillment.orderId,
      status: fulfillment.status,
      manualReview: fulfillment.manualReview,
      alreadyProcessed: fulfillment.alreadyProcessed,
      message: fulfillment.manualReview
        ? 'Approved payment sent to manual review'
        : 'Payment confirmed and order processed',
      webhookId,
      channelResults: fulfillment.channelResults
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
