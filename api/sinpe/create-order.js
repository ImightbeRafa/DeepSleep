import { sendMetaEvent, generateEventId } from '../utils/meta.js';
import { validateOrderInput } from '../utils/order.js';
import { processSinpeOrder } from '../utils/fulfillment.js';
import { getProductStockStatus } from '../utils/stock.js';
import { getSinpeConfig, generateSinpeOrderId, buildSinpeWhatsAppUrl } from '../utils/sinpe.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const stockStatus = getProductStockStatus();

  if (!stockStatus.inStock) {
    return res.status(409).json({
      success: false,
      error: 'OUT_OF_STOCK',
      message: stockStatus.message
    });
  }

  const sinpe = getSinpeConfig();

  if (!sinpe.enabled) {
    console.error('[SINPE] Checkout attempted but SINPE number is not configured.');
    return res.status(503).json({
      success: false,
      error: 'SINPE_DISABLED',
      message: 'El pago por SINPE no está disponible en este momento. Puede pagar con tarjeta o escribirnos por WhatsApp.'
    });
  }

  const body = req.body || {};
  const validationError = validateOrderInput(body);

  if (validationError) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_ORDER',
      message: validationError
    });
  }

  try {
    const orderId = generateSinpeOrderId(body.checkoutToken);
    const result = await processSinpeOrder({
      orderId,
      nombre: String(body.nombre).trim(),
      telefono: String(body.telefono).trim(),
      email: String(body.email).trim(),
      provincia: body.provincia,
      canton: String(body.canton).trim(),
      distrito: String(body.distrito).trim(),
      direccion: String(body.direccion).trim(),
      cantidad: body.cantidad,
      comentarios: String(body.comentarios || '').trim(),
      createdAt: new Date().toISOString()
    }, { req });

    if (!result.success) {
      return res.status(502).json({
        success: false,
        error: 'ORDER_NOT_RECORDED',
        message: `No pudimos registrar su pedido. Intente de nuevo o escríbanos por WhatsApp al ${sinpe.whatsappDisplay}.`
      });
    }

    const order = result.order;
    const appUrl = (process.env.APP_URL || 'https://deepsleep.shopping').replace(/\/+$/, '');
    const metaEventIds = {
      initiateCheckout: generateEventId('ic', order.orderId),
      lead: generateEventId('lead', order.orderId)
    };
    const metaCustomData = {
      value: order.total,
      currency: 'CRC',
      content_ids: ['deepsleep-bucal'],
      content_type: 'product',
      num_items: order.cantidad
    };

    if (!result.alreadyProcessed) {
      await Promise.allSettled([
        sendMetaEvent('InitiateCheckout', metaEventIds.initiateCheckout, order, req, metaCustomData, `${appUrl}/#pedido`),
        sendMetaEvent('Lead', metaEventIds.lead, order, req, metaCustomData, `${appUrl}/#pedido`)
      ]);
    }

    return res.json({
      success: true,
      orderId: order.orderId,
      total: order.total,
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      cantidad: order.cantidad,
      sinpe: {
        number: sinpe.number,
        name: sinpe.name
      },
      whatsappUrl: buildSinpeWhatsAppUrl(order, sinpe),
      metaEventIds
    });
  } catch (error) {
    console.error('[SINPE] Create order error:', error);
    return res.status(500).json({
      success: false,
      error: 'SINPE_ORDER_FAILED',
      message: `No pudimos registrar su pedido. Intente de nuevo o escríbanos por WhatsApp al ${sinpe.whatsappDisplay}.`
    });
  }
}
