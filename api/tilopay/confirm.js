import { sendOrderEmail } from '../utils/email.js';
import { sendOrderToBetsyWithRetry } from '../utils/betsy.js';
import { sendMetaEvent, generateEventId } from '../utils/meta.js';
import { decodeOrderReturnData } from '../utils/orderReturnData.js';

/**
 * Confirm payment and send emails, then sync order to Betsy CRM.
 * Called from success page after Tilopay redirects the customer back.
 */
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

  console.log('[Confirm] Payment confirmation request');

  try {
    const { orderId: requestedOrderId, transactionId, code, returnData } = req.body;

    console.log(`[Confirm] Order: ${requestedOrderId || 'unknown'}, Transaction: ${transactionId}, Code: ${code}`);

    let order;
    if (returnData) {
      try {
        order = decodeOrderReturnData(returnData);
        console.log('[Confirm] Order data decoded from returnData');
      } catch (decodeError) {
        console.error('[Confirm] Failed to decode returnData:', decodeError);
        return res.status(400).json({
          error: 'Invalid order data',
          message: 'Could not decode order information'
        });
      }
    } else if (requestedOrderId && global.pendingOrders && global.pendingOrders[requestedOrderId]) {
      order = global.pendingOrders[requestedOrderId];
      console.log('[Confirm] Order data recovered from pendingOrders');
    } else {
      console.error('[Confirm] No returnData provided');
      return res.status(400).json({
        error: 'Missing order data',
        message: 'Order information not found in request'
      });
    }

    const orderId = order?.orderId || requestedOrderId;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID required' });
    }

    if (requestedOrderId && order.orderId && String(order.orderId) !== String(requestedOrderId)) {
      console.error(`[Confirm] returnData order mismatch. Request: ${requestedOrderId}, returnData: ${order.orderId}`);
      return res.status(400).json({
        error: 'Order mismatch',
        message: 'Order information did not match the payment response'
      });
    }

    if (global.pendingOrders?.[orderId]?.processed) {
      console.log(`[Confirm] Order already processed: ${orderId}`);
      return res.json({
        success: true,
        alreadyProcessed: true,
        message: 'Order already processed',
        orderId
      });
    }

    const isPaymentApproved = code === '1' || code === 1;

    if (!isPaymentApproved) {
      console.log(`[Confirm] Payment declined for order ${orderId}, code: ${code}`);
      return res.status(400).json({
        success: false,
        error: 'Payment declined',
        message: 'Payment was not approved',
        code
      });
    }

    order.paymentStatus = 'completed';
    order.paymentId = transactionId;
    order.paymentMethod = 'Tilopay';
    order.paidAt = new Date().toISOString();

    if (!global.pendingOrders) {
      global.pendingOrders = {};
    }
    global.pendingOrders[orderId] = {
      ...order,
      processed: true
    };

    console.log(`[Confirm] Order ${orderId} confirmed as paid`);

    try {
      await sendOrderEmail(order);
      console.log(`[Confirm] Emails sent for order ${orderId}`);
    } catch (emailError) {
      console.error(`[Confirm] Failed to send emails for order ${orderId}:`, emailError);
    }

    try {
      await sendOrderToBetsyWithRetry({
        ...order,
        paymentMethod: 'Tilopay',
        transactionId
      });
      console.log(`[Confirm] Order synced to Betsy CRM: ${orderId}`);
    } catch (betsyError) {
      console.error(`[Confirm] Failed to sync order ${orderId} to Betsy CRM:`, betsyError);
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
      message: 'Payment confirmed, emails sent, and order synced to CRM',
      orderId
    });
  } catch (error) {
    console.error('[Confirm] Error:', error);
    return res.status(500).json({
      error: 'Confirmation failed',
      message: error.message
    });
  }
}
