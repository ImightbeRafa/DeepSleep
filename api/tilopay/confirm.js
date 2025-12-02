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
    const { orderId, transactionId, code, returnData } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'Order ID required' });
    }

    console.log(`📋 [Confirm] Order: ${orderId}, Transaction: ${transactionId}, Code: ${code}`);

    // Decode order data from returnData parameter
    let order;
    if (returnData) {
      try {
        const decodedData = Buffer.from(returnData, 'base64').toString('utf-8');
        order = JSON.parse(decodedData);
        console.log(`✅ [Confirm] Order data decoded from returnData`);
      } catch (decodeError) {
        console.error(`❌ [Confirm] Failed to decode returnData:`, decodeError);
        return res.status(400).json({ 
          error: 'Invalid order data',
          message: 'Could not decode order information'
        });
      }
    } else {
      console.error(`❌ [Confirm] No returnData provided`);
      return res.status(400).json({ 
        error: 'Missing order data',
        message: 'Order information not found in request'
      });
    }

    // code=1 means approved, anything else means declined/failed
    const isPaymentApproved = code === '1' || code === 1;
    
    if (!isPaymentApproved) {
      console.log(`❌ [Confirm] Payment declined for order ${orderId}, code: ${code}`);
      return res.status(400).json({
        success: false,
        error: 'Payment declined',
        message: 'Payment was not approved',
        code: code
      });
    }

    // Payment is approved - process it
    // Add payment info to order
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

  } catch (error) {
    console.error(`❌ [Confirm] Error:`, error);
    return res.status(500).json({
      error: 'Confirmation failed',
      message: error.message
    });
  }
}
