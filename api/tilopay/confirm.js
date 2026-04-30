import { decodeOrderReturnData } from '../utils/orderReturnData.js';
import { normalizeTrustedOrder } from '../utils/order.js';
import { processPaidOrder, sendApprovedManualReviewAlert } from '../utils/fulfillment.js';

function getStoredOrder(orderId) {
  if (!orderId || !global.pendingOrders) {
    return null;
  }

  return global.pendingOrders[orderId] || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { orderId: requestedOrderId, transactionId, code, returnData } = req.body || {};
    const isPaymentApproved = code === '1' || code === 1;
    const hasTransactionId = Boolean(String(transactionId || '').trim());

    console.log(`[Confirm] Order: ${requestedOrderId || 'unknown'}, Transaction: ${transactionId || 'unknown'}, Code: ${code}`);

    if (!isPaymentApproved) {
      return res.status(400).json({
        success: false,
        status: 'declined',
        error: 'Payment declined',
        message: 'Payment was not approved',
        code
      });
    }

    if (!hasTransactionId) {
      const manualReview = await sendApprovedManualReviewAlert({
        orderId: requestedOrderId,
        transactionId,
        source: 'redirect',
        reason: 'Approved redirect did not include a Tilopay transaction ID',
        rawPayload: req.body
      });

      return res.status(202).json({
        success: true,
        status: manualReview.status,
        manualReview: true,
        orderId: requestedOrderId,
        message: 'Payment approval needs manual review because the Tilopay transaction ID was missing'
      });
    }

    let order = null;

    if (returnData) {
      try {
        order = decodeOrderReturnData(returnData);
      } catch (decodeError) {
        console.error('[Confirm] Failed to decode returnData:', decodeError);
        return res.status(400).json({
          error: 'Invalid order data',
          message: 'Could not decode order information'
        });
      }
    }

    if (!order && requestedOrderId) {
      order = getStoredOrder(requestedOrderId);
    }

    if (!order) {
      const manualReview = await sendApprovedManualReviewAlert({
        orderId: requestedOrderId,
        transactionId,
        source: 'redirect',
        reason: 'Approved redirect did not include usable returnData or pending order data',
        rawPayload: req.body
      });

      return res.status(202).json({
        success: true,
        status: manualReview.status,
        manualReview: true,
        orderId: requestedOrderId,
        message: 'Payment approved, but the order needs manual review'
      });
    }

    const normalizedOrder = normalizeTrustedOrder(order);
    const orderId = normalizedOrder.orderId || requestedOrderId;

    if (requestedOrderId && orderId && String(orderId) !== String(requestedOrderId)) {
      console.error(`[Confirm] returnData order mismatch. Request: ${requestedOrderId}, returnData: ${orderId}`);
      return res.status(400).json({
        error: 'Order mismatch',
        message: 'Order information did not match the payment response'
      });
    }

    const fulfillment = await processPaidOrder(normalizedOrder, {
      req,
      source: 'redirect',
      transactionId,
      rawPayload: req.body
    });

    return res.json({
      success: true,
      message: fulfillment.manualReview
        ? 'Payment approved and sent to manual review'
        : 'Payment confirmed and order processed',
      orderId,
      status: fulfillment.status,
      manualReview: fulfillment.manualReview,
      alreadyProcessed: fulfillment.alreadyProcessed,
      channelResults: fulfillment.channelResults
    });
  } catch (error) {
    console.error('[Confirm] Error:', error);
    return res.status(500).json({
      error: 'Confirmation failed',
      message: error.message
    });
  }
}
