import { sendOrderEmail } from '../utils/email.js';

/**
 * Authenticate with Tilopay API
 */
async function authenticateTilopay() {
  const baseUrl = process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1';
  const apiUser = process.env.TILOPAY_USER;
  const apiPassword = process.env.TILOPAY_PASSWORD;

  if (!apiUser || !apiPassword) {
    throw new Error('Tilopay credentials not configured');
  }

  const loginResponse = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiuser: apiUser,
      password: apiPassword
    })
  });

  if (!loginResponse.ok) {
    const errorText = await loginResponse.text();
    console.error('Tilopay login error:', errorText);
    throw new Error('Failed to authenticate with Tilopay');
  }

  const loginData = await loginResponse.json();
  return loginData.access_token;
}

/**
 * Vercel Serverless Function
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
    if (!nombre || !telefono || !provincia || !canton || !distrito || !direccion || !cantidad) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    // Calculate total
    const basePrice = 9900;
    const quantity = parseInt(cantidad) || 1;
    const total = basePrice * quantity;

    // Generate unique order ID
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    // Store order data in Vercel KV or use a global object for now
    // For production, use Vercel KV, Redis, or a database
    if (!global.pendingOrders) {
      global.pendingOrders = {};
    }
    
    global.pendingOrders[orderId] = {
      orderId,
      nombre,
      telefono,
      email,
      provincia,
      canton,
      distrito,
      direccion,
      cantidad: quantity,
      total,
      comentarios,
      createdAt: new Date().toISOString()
    };

    // Authenticate with Tilopay
    const accessToken = await authenticateTilopay();

    // Create payment link using /captures endpoint
    const baseUrl = process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1';
    const apiKey = process.env.TILOPAY_API_KEY;
    const appUrl = process.env.APP_URL || 'https://serverservidorescerbero.com';

    const capturePayload = {
      key: apiKey,
      amount: Math.round(total),
      currency: 'CRC',
      description: `Orden ${orderId}: DeepSleep Bucal Anti-Ronquidos (x${quantity})`,
      order_id: orderId,
      redirect_success: `${appUrl}/success.html?orderId=${orderId}`,
      redirect_error: `${appUrl}/error.html?orderId=${orderId}`,
      notification_url: `${appUrl}/api/tilopay/webhook`,
      email: email || '',
      platform: '5'
    };

    const captureResponse = await fetch(`${baseUrl}/captures`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(capturePayload)
    });

    if (!captureResponse.ok) {
      const errorText = await captureResponse.text();
      console.error('Tilopay capture error:', errorText);
      throw new Error('Failed to create payment link');
    }

    const captureData = await captureResponse.json();

    console.log('✅ Payment link created:', {
      orderId,
      paymentUrl: captureData.payment_url || captureData.url
    });

    return res.json({
      success: true,
      orderId,
      paymentUrl: captureData.payment_url || captureData.url,
      transactionId: captureData.transaction_id || captureData.id
    });

  } catch (error) {
    console.error('❌ Create payment error:', error);
    return res.status(500).json({
      error: 'Failed to create payment',
      message: error.message
    });
  }
}
