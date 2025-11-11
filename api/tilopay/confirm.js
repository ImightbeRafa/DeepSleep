import { sendOrderEmail } from '../utils/email.js';

/**
 * Confirm payment and send emails
 * Called from success page after Tilopay redirect
 */
export default async function handler(req, res) {
  // Enable CORS
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

  console.log('📨 [Confirm] Payment confirmation request');

  try {
    const { orderId, transactionId, code } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID required' });
    }

    console.log(`📋 [Confirm] Order: ${orderId}, Transaction: ${transactionId}, Code: ${code}`);

    // Get order data from global storage
    if (!global.pendingOrders) {
      global.pendingOrders = {};
    }
    
    const order = global.pendingOrders[orderId];

    if (!order) {
      console.error(`❌ [Confirm] Order not found: ${orderId}`);
      return res.status(404).json({ 
        error: 'Order not found',
        message: 'Order may have expired or does not exist'
      });
    }

    // Check if already processed
    if (order.processed) {
      console.log(`⚠️ [Confirm] Order already processed: ${orderId}`);
      return res.json({
        success: true,
        message: 'Order already confirmed',
        alreadyProcessed: true
      });
    }

    // code=1 means approved
    if (code === '1' || code === 1) {
      // Mark as processed
      order.processed = true;
      order.paymentStatus = 'completed';
      order.paymentId = transactionId;
      order.paymentMethod = 'Tilopay';
      order.paidAt = new Date().toISOString();

      console.log(`✅ [Confirm] Order ${orderId} confirmed as paid`);

      // Send emails
      try {
        await sendOrderEmail(order);
        console.log(`📧 [Confirm] Emails sent for order ${orderId}`);
        
        return res.json({
          success: true,
          message: 'Payment confirmed and emails sent',
          orderId
        });
      } catch (emailError) {
        console.error(`❌ [Confirm] Failed to send emails:`, emailError);
        return res.status(500).json({
          error: 'Failed to send confirmation emails',
          message: emailError.message
        });
      }
    } else {
      console.log(`❌ [Confirm] Payment failed for order ${orderId}, code: ${code}`);
      return res.json({
        success: false,
        message: 'Payment was not approved'
      });
    }

  } catch (error) {
    console.error(`❌ [Confirm] Error:`, error);
    return res.status(500).json({
      error: 'Confirmation failed',
      message: error.message
    });
  }
}
