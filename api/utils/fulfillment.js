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

function getPositiveIntegerEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function getFulfillmentChannelTimeoutMs() {
  return getPositiveIntegerEnv('FULFILLMENT_CHANNEL_TIMEOUT_MS', 6000);
}

function getPendingAuditTimeoutMs() {
  return getPositiveIntegerEnv('PENDING_AUDIT_TIMEOUT_MS', 1500);
}

function getPaidBetsyRetryCount() {
  return getPositiveIntegerEnv('BETSY_FULFILLMENT_RETRIES', 1);
}

function skippedChannel(reason) {
  return {
    success: false,
    skipped: true,
    reason
  };
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
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

  const shouldSendPendingEmail = process.env.SEND_PENDING_ADMIN_EMAILS === 'true';
  const shouldSendPendingBetsy = process.env.SEND_PENDING_BETSY_ORDERS === 'true';
  const pendingTasks = [];

  if (shouldSendPendingEmail) {
    pendingTasks.push(['adminEmail', sendPendingOrderEmail(order)]);
  }

  if (shouldSendPendingBetsy) {
    pendingTasks.push(['betsy', sendOrderToBetsyWithRetry(order, 2)]);
  }

  const channels = {
    adminEmail: skippedChannel('Pending admin emails are disabled until SEND_PENDING_ADMIN_EMAILS=true'),
    betsy: skippedChannel('Pending Betsy orders are disabled until SEND_PENDING_BETSY_ORDERS=true')
  };

  if (pendingTasks.length > 0) {
    const timeoutMs = getPendingAuditTimeoutMs();
    const results = await Promise.allSettled(
      pendingTasks.map(([name, task]) => withTimeout(task, timeoutMs, `Pending ${name} audit`))
    );

    pendingTasks.forEach(([name], index) => {
      channels[name] = summarizeResult(results[index]);
    });
  }

  const auditTrail = {
    success: true,
    status: 'pending',
    source: options.source || 'create-payment',
    channels
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
    if (processedOrder.fulfillmentKey && processedOrder.fulfillmentKey !== fulfillmentKey) {
      const manualReviewResult = await sendApprovedManualReviewAlert({
        orderId: order.orderId,
        transactionId,
        source: options.source || 'unknown',
        reason: `Approved payment arrived for an order already fulfilled with ${processedOrder.fulfillmentKey}`,
        rawPayload: options.rawPayload,
        order
      });

      return {
        success: true,
        status: manualReviewResult.status,
        manualReview: true,
        orderId: order.orderId,
        transactionId,
        duplicateApprovedPayment: true,
        channelResults: {
          manualReviewEmail: manualReviewResult.channelResults.manualReviewEmail
        }
      };
    }

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

  const fulfillmentTimeoutMs = getFulfillmentChannelTimeoutMs();
  const [emailResult, betsyResult] = await Promise.allSettled([
    withTimeout(sendOrderEmail(order), fulfillmentTimeoutMs, 'Paid email fulfillment'),
    withTimeout(
      sendOrderToBetsyWithRetry({
        ...order,
        paymentMethod: 'Tilopay',
        transactionId
      }, getPaidBetsyRetryCount()),
      fulfillmentTimeoutMs,
      'Paid Betsy fulfillment'
    )
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
