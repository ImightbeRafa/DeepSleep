import { sendMetaEvent, generateEventId } from '../utils/meta.js';
import { encodeOrderReturnData } from '../utils/orderReturnData.js';
import { generateOrderId, normalizeTrustedOrder } from '../utils/order.js';
import { createPendingAuditTrail } from '../utils/fulfillment.js';

async function authenticateTilopay() {
  const baseUrl = process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1';
  const apiUser = process.env.TILOPAY_USER;
  const apiPassword = process.env.TILOPAY_PASSWORD;

  console.log('[Tilopay Auth] Checking credentials...', {
    hasUser: !!apiUser,
    hasPassword: !!apiPassword,
    baseUrl
  });

  if (!apiUser || !apiPassword) {
    throw new Error('Tilopay credentials not configured in environment variables');
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
    console.error('[Tilopay Auth] Login failed:', errorText);
    throw new Error(`Failed to authenticate with Tilopay: ${loginResponse.status} ${errorText}`);
  }

  const loginData = await loginResponse.json();

  if (!loginData.access_token) {
    throw new Error('No access token in Tilopay response');
  }

  return loginData.access_token;
}

function provinceCode(provincia) {
  return provincia === 'San Jose' || provincia === 'San Jos\u00e9' ? 'SJ' : 'OT';
}

export default async function handler(req, res) {
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

  console.log('[Tilopay] Creating payment link...');

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
    } = req.body || {};

    if (!nombre || !telefono || !email || !provincia || !canton || !distrito || !direccion || !cantidad) {
      return res.status(400).json({
        error: 'Missing required fields'
      });
    }

    const orderData = normalizeTrustedOrder({
      orderId: generateOrderId(),
      nombre,
      telefono,
      email,
      provincia,
      canton,
      distrito,
      direccion,
      cantidad,
      comentarios,
      paymentStatus: 'pending',
      paymentMethod: 'Tilopay',
      createdAt: new Date().toISOString()
    });

    const accessToken = await authenticateTilopay();
    const baseUrl = process.env.TILOPAY_BASE_URL || 'https://app.tilopay.com/api/v1';
    const apiKey = process.env.TILOPAY_API_KEY;
    const appUrl = (process.env.APP_URL || 'https://deepsleep.shopping').replace(/\/+$/, '');

    if (!apiKey) {
      throw new Error('Tilopay API key not configured in environment variables');
    }

    const nameParts = String(nombre).trim().split(/\s+/);
    const firstName = nameParts[0] || nombre;
    const lastName = nameParts.slice(1).join(' ') || nombre;
    const encodedOrderData = encodeOrderReturnData(orderData);
    const redirectUrl = `${appUrl}/success.html?orderId=${encodeURIComponent(orderData.orderId)}`;
    const webhookUrl = `${appUrl}/api/tilopay/webhook`;
    const address2 = `${distrito}, ${canton}`;
    const state = `CR-${provinceCode(provincia)}`;

    const paymentPayload = {
      key: apiKey,
      amount: Math.round(orderData.total),
      currency: 'CRC',
      redirect: redirectUrl,
      notification_url: webhookUrl,
      hashVersion: 'V2',
      token_version: 'v2',
      billToFirstName: firstName,
      billToLastName: lastName,
      billToAddress: direccion,
      billToAddress2: address2,
      billToCity: canton,
      billToState: state,
      billToZipPostCode: '10101',
      billToCountry: 'CR',
      billToTelephone: telefono,
      billToEmail: email,
      shipToFirstName: firstName,
      shipToLastName: lastName,
      shipToAddress: direccion,
      shipToAddress2: address2,
      shipToCity: canton,
      shipToState: state,
      shipToZipPostCode: '10101',
      shipToCountry: 'CR',
      shipToTelephone: telefono,
      shipToEmail: email,
      orderNumber: orderData.orderId,
      capture: '1',
      subscription: '0',
      platform: 'DeepSleep',
      returnData: encodedOrderData
    };

    console.log('[Tilopay] Payload summary:', JSON.stringify({
      orderNumber: paymentPayload.orderNumber,
      amount: paymentPayload.amount,
      currency: paymentPayload.currency,
      redirect: paymentPayload.redirect,
      notification_url: paymentPayload.notification_url,
      redirectLength: paymentPayload.redirect.length,
      hasReturnData: !!paymentPayload.returnData,
      returnDataLength: paymentPayload.returnData.length
    }, null, 2));

    const captureResponse = await fetch(`${baseUrl}/processPayment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(paymentPayload)
    });

    if (!captureResponse.ok) {
      const errorText = await captureResponse.text();
      console.error('[Tilopay] Payment error:', errorText);
      throw new Error(`Failed to create payment link: ${captureResponse.status} - ${errorText}`);
    }

    const paymentData = await captureResponse.json();
    const paymentUrl = paymentData.urlPaymentForm || paymentData.url || paymentData.payment_url;

    if (!paymentUrl) {
      console.error('[Tilopay] No payment URL in response:', paymentData);
      throw new Error('No payment URL received from Tilopay');
    }

    const pendingAuditTrail = await createPendingAuditTrail(orderData, {
      source: 'create-payment',
      rawPayload: {
        tilopayResponse: paymentData
      }
    });

    if (!pendingAuditTrail.success && process.env.ALLOW_UNAUDITED_CHECKOUT !== 'true') {
      console.error('[Tilopay] Pending audit trail failed. Payment URL will not be released.', pendingAuditTrail);
      throw new Error('Unable to create order audit trail before payment');
    }

    const metaEventId = generateEventId('ic', orderData.orderId);
    sendMetaEvent('InitiateCheckout', metaEventId, orderData, req, {
      value: orderData.total,
      currency: 'CRC',
      content_ids: ['deepsleep-bucal'],
      content_type: 'product',
      num_items: orderData.cantidad
    }, `${appUrl}/#pedido`).catch(() => {});

    return res.json({
      success: true,
      orderId: orderData.orderId,
      metaEventId,
      returnData: encodedOrderData,
      paymentUrl,
      auditTrail: pendingAuditTrail,
      transactionId: paymentData.id || paymentData.transaction_id
    });
  } catch (error) {
    console.error('[Tilopay] Create payment error:', error);
    return res.status(500).json({
      error: 'Failed to create payment',
      message: error.message,
      details: error.toString()
    });
  }
}
