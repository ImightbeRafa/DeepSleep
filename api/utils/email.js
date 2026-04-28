/**
 * Resend idempotency keys are kept for 24 hours and prevent duplicate sends
 * when the success page and payment webhook process the same order.
 */
function getEmailIdempotencyKey(order, emailType) {
  const orderRef = order?.orderId || order?.paymentId || order?.transactionId;

  if (!orderRef) {
    return null;
  }

  const safeOrderRef = String(orderRef).replace(/[^a-zA-Z0-9._:-]/g, '-');
  return `deepsleep/order-confirmation/${emailType}/${safeOrderRef}`.slice(0, 256);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCurrency(value) {
  const amount = Number(value) || 0;
  return `CRC ${amount.toLocaleString('es-CR')}`;
}

function getNotificationConfig() {
  const resendApiKey = process.env.RESEND_API_KEY;
  const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;

  if (!resendApiKey || !notificationEmail) {
    console.warn('[Email] Email configuration missing');
    throw new Error('Email configuration missing');
  }

  return {
    resendApiKey,
    notificationEmail
  };
}

async function parseResendError(response) {
  const body = await response.text();

  try {
    return {
      body,
      data: JSON.parse(body)
    };
  } catch {
    return {
      body,
      data: null
    };
  }
}

function isIdempotencyConflict(response, errorBody, errorData) {
  if (response.status !== 409) {
    return false;
  }

  const errorType = String(
    errorData?.type || errorData?.name || errorData?.error || ''
  ).toLowerCase();
  const message = String(errorData?.message || errorBody || '').toLowerCase();

  return errorType.includes('idempotent') ||
    errorType.includes('idempotency') ||
    message.includes('idempotent') ||
    message.includes('idempotency');
}

async function sendResendEmail({ resendApiKey, idempotencyKey, payload }) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${resendApiKey}`
  };

  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const { body, data } = await parseResendError(response);

    if (isIdempotencyConflict(response, body, data)) {
      console.warn('Duplicate email suppressed by Resend idempotency key:', idempotencyKey);
      return {
        duplicate: true,
        idempotencyKey,
        resendError: data || body
      };
    }

    throw new Error(`Failed to send email: ${body || response.statusText}`);
  }

  return await response.json();
}

async function sendCustomerEmail(order) {
  const { resendApiKey } = getNotificationConfig();

  const customerEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background: #f9fafb; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 28px; }
        .content { padding: 30px; }
        h2 { color: #1e40af; margin-top: 0; }
        .order-box { background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
        .label { font-weight: bold; color: #1e40af; display: inline-block; min-width: 120px; }
        .footer { margin-top: 30px; padding: 20px 30px; background: #f9fafb; text-align: center; font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>DeepSleep</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Bucal Anti-Ronquidos</p>
        </div>
        <div class="content">
          <h2>Confirmacion de Pedido</h2>
          <p>Hola <strong>${escapeHtml(order.nombre)}</strong>,</p>
          <p>Gracias por tu pedido. Aqui estan los detalles:</p>
          <div class="order-box">
            <p><span class="label">Orden:</span> ${escapeHtml(order.orderId)}</p>
            <p><span class="label">Producto:</span> ${escapeHtml(order.productName || 'DeepSleep Bucal Anti-Ronquidos')}</p>
            <p><span class="label">Cantidad:</span> ${escapeHtml(order.cantidad)}</p>
            <p><span class="label">Subtotal:</span> ${formatCurrency(order.subtotal)}</p>
            <p><span class="label">Envio:</span> ${formatCurrency(order.shippingCost)}</p>
            <p><span class="label">Total:</span> ${formatCurrency(order.total)}</p>
          </div>
          <p>Su pago con tarjeta ha sido procesado exitosamente.</p>
          <div class="order-box">
            <p><strong>Direccion de Envio:</strong></p>
            <p>${escapeHtml(order.direccion)}<br>${escapeHtml(order.distrito)}, ${escapeHtml(order.canton)}, ${escapeHtml(order.provincia)}</p>
          </div>
          <p style="text-align: center; margin: 30px 0;">
            <strong>Te contactaremos pronto para coordinar la entrega.</strong>
          </p>
        </div>
        <div class="footer">
          <p><strong>Tienes preguntas?</strong></p>
          <p>
            WhatsApp: <a href="https://wa.me/50662019914" style="color: #667eea;">6201-9914</a><br>
            Instagram: <a href="https://www.instagram.com/deepsleep.cr/" style="color: #667eea;">@deepsleep.cr</a><br>
            Email: deepsleepp.cr@gmail.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendResendEmail({
    resendApiKey,
    idempotencyKey: getEmailIdempotencyKey(order, 'customer'),
    payload: {
      from: 'DeepSleep <ordenes@betsycrm.com>',
      to: order.email,
      subject: `Confirmacion de Pedido ${order.orderId} - DeepSleep`,
      html: customerEmailHtml
    }
  });
}

export async function sendAdminEmail(order, options = {}) {
  const { resendApiKey, notificationEmail } = getNotificationConfig();
  const heading = options.heading || `Nueva Orden Recibida - ${order.orderId}`;
  const intro = options.intro ? `<p>${escapeHtml(options.intro)}</p>` : '';
  const emailType = options.emailType || 'admin';
  const subject = options.subject || `Nueva Orden: ${order.orderId} - ${order.nombre}`;

  const adminEmailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 650px; margin: 0 auto; padding: 20px; }
        h2 { color: #1e40af; border-bottom: 3px solid #3b82f6; padding-bottom: 10px; }
        h3 { color: #1e40af; margin-top: 25px; }
        .info-section { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0; }
        .info-item { margin: 8px 0; }
        .label { font-weight: bold; color: #1e40af; }
        .total { font-size: 20px; font-weight: bold; color: #059669; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 14px; color: #6b7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>${escapeHtml(heading)}</h2>
        ${intro}

        <div class="info-section">
          <h3>Informacion del Cliente:</h3>
          <div class="info-item"><span class="label">Nombre:</span> ${escapeHtml(order.nombre)}</div>
          <div class="info-item"><span class="label">Telefono:</span> ${escapeHtml(order.telefono)}</div>
          <div class="info-item"><span class="label">Email:</span> ${escapeHtml(order.email)}</div>
        </div>

        <div class="info-section">
          <h3>Detalles del Producto:</h3>
          <div class="info-item"><span class="label">Producto:</span> ${escapeHtml(order.productName || 'DeepSleep Bucal Anti-Ronquidos')}</div>
          <div class="info-item"><span class="label">Cantidad:</span> ${escapeHtml(order.cantidad)}</div>
          <div class="info-item"><span class="label">Precio Unitario:</span> ${formatCurrency(order.unitPrice || 9900)}</div>
          <div class="info-item"><span class="label">Subtotal:</span> ${formatCurrency(order.subtotal)}</div>
          <div class="info-item"><span class="label">Envio:</span> ${formatCurrency(order.shippingCost)}</div>
          <div class="info-item total"><span class="label">Total:</span> ${formatCurrency(order.total)}</div>
        </div>

        <div class="info-section">
          <h3>Direccion de Envio:</h3>
          <div class="info-item"><span class="label">Provincia:</span> ${escapeHtml(order.provincia)}</div>
          <div class="info-item"><span class="label">Canton:</span> ${escapeHtml(order.canton)}</div>
          <div class="info-item"><span class="label">Distrito:</span> ${escapeHtml(order.distrito)}</div>
          <div class="info-item"><span class="label">Direccion Completa:</span><br>${escapeHtml(order.direccion)}</div>
        </div>

        ${order.comentarios ? `
          <div class="info-section">
            <h3>Comentarios del Cliente:</h3>
            <p>${escapeHtml(order.comentarios)}</p>
          </div>
        ` : ''}

        <div class="info-section">
          <h3>Informacion de Pago:</h3>
          <div class="info-item"><span class="label">Metodo:</span> ${escapeHtml(order.paymentMethod || 'Tilopay')}</div>
          <div class="info-item"><span class="label">ID de Transaccion:</span> ${escapeHtml(order.paymentId || order.transactionId || 'Pendiente')}</div>
          <div class="info-item"><span class="label">Estado:</span> ${order.paymentStatus === 'completed' ? 'PAGADO' : 'PENDIENTE'}</div>
          <div class="info-item"><span class="label">Fecha:</span> ${escapeHtml(new Date(order.paidAt || order.createdAt || Date.now()).toLocaleString('es-CR'))}</div>
        </div>

        <div class="footer">
          <p><strong>Por favor, procese esta orden y coordine el envio lo antes posible.</strong></p>
          <p>Este es un correo automatico generado por el sistema DeepSleep.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendResendEmail({
    resendApiKey,
    idempotencyKey: getEmailIdempotencyKey(order, emailType),
    payload: {
      from: 'DeepSleep <ordenes@betsycrm.com>',
      to: notificationEmail,
      subject,
      html: adminEmailHtml
    }
  });
}

export async function sendPendingOrderEmail(order) {
  return sendAdminEmail(order, {
    emailType: 'pending-admin',
    heading: `Orden pendiente de pago Tilopay - ${order.orderId}`,
    subject: `Orden pendiente Tilopay: ${order.orderId} - ${order.nombre}`,
    intro: 'Se genero un enlace de pago Tilopay. Si el cliente paga y el redirect/webhook falla, esta informacion permite recuperar la venta.'
  });
}

export async function sendManualReviewAlert({ orderId, transactionId, source, reason, rawPayload, order }) {
  const { resendApiKey, notificationEmail } = getNotificationConfig();
  const safeOrderId = orderId || order?.orderId || 'sin-order-id';
  const safeTransactionId = transactionId || order?.transactionId || order?.paymentId || 'sin-transaction-id';
  const rawPayloadText = JSON.stringify(rawPayload || {}, null, 2);

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #111827; }
        .container { max-width: 700px; margin: 0 auto; padding: 20px; }
        h2 { color: #b91c1c; border-bottom: 3px solid #ef4444; padding-bottom: 10px; }
        .box { background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0; }
        pre { white-space: pre-wrap; word-break: break-word; background: #f3f4f6; padding: 12px; border-radius: 8px; }
        .label { font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Revision manual requerida - pago Tilopay aprobado</h2>
        <div class="box">
          <p><span class="label">Orden:</span> ${escapeHtml(safeOrderId)}</p>
          <p><span class="label">Transaccion:</span> ${escapeHtml(safeTransactionId)}</p>
          <p><span class="label">Fuente:</span> ${escapeHtml(source || 'unknown')}</p>
          <p><span class="label">Motivo:</span> ${escapeHtml(reason || 'Pago aprobado requiere revision manual')}</p>
        </div>
        ${order ? `
          <div class="box">
            <p><span class="label">Cliente:</span> ${escapeHtml(order.nombre)}</p>
            <p><span class="label">Telefono:</span> ${escapeHtml(order.telefono)}</p>
            <p><span class="label">Email:</span> ${escapeHtml(order.email)}</p>
            <p><span class="label">Total confiable:</span> ${formatCurrency(order.total)}</p>
          </div>
        ` : ''}
        <h3>Payload recibido</h3>
        <pre>${escapeHtml(rawPayloadText)}</pre>
      </div>
    </body>
    </html>
  `;

  return sendResendEmail({
    resendApiKey,
    idempotencyKey: `deepsleep/manual-review/${String(source || 'unknown').replace(/[^a-zA-Z0-9._:-]/g, '-')}/${String(safeOrderId).replace(/[^a-zA-Z0-9._:-]/g, '-')}/${String(safeTransactionId).replace(/[^a-zA-Z0-9._:-]/g, '-')}`.slice(0, 256),
    payload: {
      from: 'DeepSleep <ordenes@betsycrm.com>',
      to: notificationEmail,
      subject: `URGENTE: revisar pago Tilopay ${safeOrderId}`,
      html
    }
  });
}

export async function sendOrderEmail(order) {
  getNotificationConfig();

  const results = {
    customer: null,
    admin: null
  };

  if (order.email) {
    try {
      results.customer = await sendCustomerEmail(order);
      console.log('Customer email sent to:', order.email);
    } catch (error) {
      results.customer = { success: false, error: error.message };
      console.error('Failed to send customer email:', error);
    }
  }

  results.admin = await sendAdminEmail(order);
  console.log('Admin email sent');

  return {
    success: true,
    results
  };
}
