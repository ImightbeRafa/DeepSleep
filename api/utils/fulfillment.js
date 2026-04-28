import { sendOrderEmail, sendPendingOrderEmail, sendManualReviewAlert } from './email.js';
import { sendOrderToBetsyWithRetry } from './betsy.js';
import { sendMetaEvent, generateEventId } from './meta.js';
import { normalizePaidOrder, normalizeTrustedOrder } from './order.js';

function ensureOrderStores() {
  if (!global.pendingOrders) {
    global.pendingOrders = {};
  }

  if (!global.processedPaidOrders) {
    global.processedPaidOrders = {};
  }
}

function channelSucceeded(result) {
  return result?.status === 'fulfilled' && (
    result.value?.success === true ||
    result.value?.duplicate === true ||
    result.value?.id
  );
}

function summarizeResult(result) {
  if (result.status === 'fulfilled') {
    return result.value;
  }

  return {
    success: false,
    error: result.reason?.message || String(result.reason)
  };
}

export async function createPendingAuditTrail(orderInput, options = {}) {
  ensureOrderStores();

  const order = normalizeTrustedOrder({
    ...orderInput,
    paymentStatus: 'pending',
    paymentMethod: orderInput.paymentMethod || 'Tilopay'
  });

  global.pendingOrders[order.orderId] = {
    ...order,
    processed: false,
    pendingAuditCreatedAt: new Date().toISOString()
  };

  const [emailResult, betsyResult] = await Promise.allSettled([
    sendPendingOrderEmail(order),
    sendOrderToBetsyWithRetry(order, 2)
  ]);

  const emailOk = Boolean(channelSucceeded(emailResult));
  const betsyOk = Boolean(channelSucceeded(betsyResult));
  const success = emailOk || betsyOk;

  const auditTrail = {
    success,
    status: success ? 'pending' : 'pending_audit_failed',
    source: options.source || 'create-payment',
    channels: {
      adminEmail: summarizeResult(emailResult),
      betsy: summarizeResult(betsyResult)
    }
  };

  global.pendingOrders[order.orderId].pendingAuditTrail = auditTrail;

  return auditTrail;
}

export async function sendApprovedManualReviewAlert({ orderId, transactionId, source, reason, rawPayload, order }) {
  const result = await sendManualReviewAlert({
    orderId,
    transactionId,
    source,
    reason,
    rawPayload,
    order
  });

  return {
    success: true,
    status: 'approved_manual_review',
    manualReview: true,
    channelResults: {
      manualReviewEmail: result
    }
  };
}

export async function processPaidOrder(orderInput, options = {}) {
  ensureOrderStores();

  const order = normalizePaidOrder(orderInput, {
    transactionId: options.transactionId,
    paymentMethod: options.paymentMethod || 'Tilopay'
  });

  const transactionId = order.paymentId || options.transactionId || 'unknown-transaction';
  const fulfillmentKey = `${order.orderId}:${transactionId}`;
  const processedOrder = global.pendingOrders[order.orderId];

  if (processedOrder?.processed && String(processedOrder.fulfillmentStatus || '').startsWith('approved')) {
    return {
      success: true,
      status: processedOrder.fulfillmentStatus,
      manualReview: processedOrder.fulfillmentStatus === 'approved_manual_review',
      orderId: order.orderId,
      transactionId,
      alreadyProcessed: true,
      channelResults: processedOrder.channelResults || {}
    };
  }

  const existing = global.processedPaidOrders[fulfillmentKey];

  if (existing?.processed) {
    return {
      ...existing.result,
      alreadyProcessed: true
    };
  }

  global.pendingOrders[order.orderId] = {
    ...(global.pendingOrders[order.orderId] || {}),
    ...order,
    processed: false
  };

  const [emailResult, betsyResult] = await Promise.allSettled([
    sendOrderEmail(order),
    sendOrderToBetsyWithRetry({
      ...order,
      paymentMethod: 'Tilopay',
      transactionId
    })
  ]);

  const emailOk = Boolean(channelSucceeded(emailResult));
  const betsyOk = Boolean(channelSucceeded(betsyResult));
  const channelResults = {
    email: summarizeResult(emailResult),
    betsy: summarizeResult(betsyResult)
  };

  let status = 'approved_processed';
  let manualReview = false;

  if (!emailOk && !betsyOk) {
    const manualReviewResult = await sendApprovedManualReviewAlert({
      orderId: order.orderId,
      transactionId,
      source: options.source || 'unknown',
      reason: 'Approved payment had no successful email or CRM fulfillment channel',
      rawPayload: options.rawPayload,
      order
    });

    status = manualReviewResult.status;
    manualReview = true;
    channelResults.manualReviewEmail = manualReviewResult.channelResults.manualReviewEmail;
  }

  const appUrl = (process.env.APP_URL || 'https://deepsleep.shopping').replace(/\/+$/, '');
  const metaEventId = generateEventId('purchase', order.orderId, transactionId);
  const metaResult = await sendMetaEvent('Purchase', metaEventId, order, options.req, {
    value: order.total || 0,
    currency: 'CRC',
    content_ids: ['deepsleep-bucal'],
    content_type: 'product',
    num_items: order.cantidad
  }, `${appUrl}/success.html`).catch((error) => ({
    success: false,
    error: error.message
  }));

  channelResults.meta = metaResult;

  const result = {
    success: true,
    status,
    manualReview,
    orderId: order.orderId,
    transactionId,
    channelResults
  };

  global.pendingOrders[order.orderId] = {
    ...global.pendingOrders[order.orderId],
    ...order,
    processed: true,
    fulfillmentStatus: status,
    fulfillmentKey,
    channelResults
  };

  global.processedPaidOrders[fulfillmentKey] = {
    processed: true,
    result
  };

  return result;
}
