import { sendOrderEmail } from '../utils/email.js';
import { sendOrderToBetsyWithRetry } from '../utils/betsy.js';

/**
 * Vercel Serverless Function - Send SINPE Email
 */
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const {
      nombre,
      telefono,
      email,
      provincia,
      canton,
      distrito,
      direccion,
      cantidad,
      comentarios
    } = req.body;

    // Validation
    if (!nombre || !telefono || !email || !provincia || !canton || !distrito || !direccion || !cantidad) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Calculate total - flat pricing, no volume discount
    const UNIT_PRICE = 9900; // ₡9,900 per unit
    const quantity = parseInt(cantidad) || 1;
    const subtotal = UNIT_PRICE * quantity;
    
    // Shipping: ₡3,000 for 1 unit, FREE for 2+
    const shippingCost = quantity >= 2 ? 0 : 3000;
    const total = subtotal + shippingCost;

    // Generate simple order ID (6-digit number)
    const orderId = Math.floor(100000 + Math.random() * 900000).toString();

    // Prepare order data
    const order = {
      orderId,
      nombre,
      telefono,
      email,
      provincia,
      canton,
      distrito,
      direccion,
      cantidad: quantity,
      subtotal,
      shippingCost,
      total,
      comentarios,
      paymentMethod: 'SINPE',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    // Send email with SINPE instructions and order details
    await sendOrderEmail(order);

    console.log('✅ SINPE order email sent:', orderId);

    // Send order to Betsy CRM (wait for it to complete)
    try {
      await sendOrderToBetsyWithRetry(order);
      console.log('✅ SINPE order synced to Betsy CRM');
    } catch (error) {
      console.error('❌ Failed to sync SINPE order to Betsy CRM:', error);
      // Don't fail the order if Betsy sync fails - just log it
    }

    return res.json({
      success: true,
      orderId,
      message: 'Order received. Please check your email for SINPE payment instructions.'
    });

  } catch (error) {
    console.error('❌ Send SINPE email error:', error);
    return res.status(500).json({
      error: 'Failed to send email',
      message: error.message
    });
  }
}
