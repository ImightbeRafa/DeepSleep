/**
 * Send order notification email using Resend
 */
export async function sendOrderEmail(order) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;

    if (!resendApiKey || !notificationEmail) {
      console.warn('⚠️ Email not configured');
      throw new Error('Email configuration missing');
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
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
          <h2>🎉 Nueva Orden Recibida - ${order.orderId}</h2>
          
          <div class="info-section">
            <h3>📋 Información del Cliente:</h3>
            <div class="info-item"><span class="label">Nombre:</span> ${order.nombre}</div>
            <div class="info-item"><span class="label">Teléfono:</span> ${order.telefono}</div>
            <div class="info-item"><span class="label">Email:</span> ${order.email || 'No proporcionado'}</div>
          </div>

          <div class="info-section">
            <h3>🛍️ Detalles del Producto:</h3>
            <div class="info-item"><span class="label">Producto:</span> DeepSleep Bucal Anti-Ronquidos</div>
            <div class="info-item"><span class="label">Cantidad:</span> ${order.cantidad}</div>
            <div class="info-item"><span class="label">Precio Unitario:</span> ₡9.900</div>
            <div class="info-item"><span class="label">Envío:</span> GRATIS</div>
            <div class="info-item total"><span class="label">Total:</span> ₡${order.total.toLocaleString('es-CR')}</div>
          </div>

          <div class="info-section">
            <h3>📍 Dirección de Envío:</h3>
            <div class="info-item"><span class="label">Provincia:</span> ${order.provincia}</div>
            <div class="info-item"><span class="label">Cantón:</span> ${order.canton}</div>
            <div class="info-item"><span class="label">Distrito:</span> ${order.distrito}</div>
            <div class="info-item"><span class="label">Dirección Completa:</span><br>${order.direccion}</div>
          </div>

          ${order.comentarios ? `
            <div class="info-section">
              <h3>💬 Comentarios del Cliente:</h3>
              <p>${order.comentarios}</p>
            </div>
          ` : ''}

          <div class="info-section">
            <h3>💳 Información de Pago:</h3>
            <div class="info-item"><span class="label">ID de Transacción:</span> ${order.paymentId || 'Pendiente'}</div>
            <div class="info-item"><span class="label">Estado:</span> ${order.paymentStatus === 'completed' ? 'PAGADO ✅' : 'PENDIENTE'}</div>
            <div class="info-item"><span class="label">Fecha:</span> ${new Date(order.paidAt || order.createdAt).toLocaleString('es-CR')}</div>
          </div>

          <div class="footer">
            <p><strong>Por favor, procese esta orden y coordine el envío lo antes posible.</strong></p>
            <p>Este es un correo automático generado por el sistema DeepSleep.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: 'DeepSleep <onboarding@resend.dev>', // Use verified domain in production
        to: notificationEmail,
        subject: `Nueva Orden: ${order.orderId} - ${order.nombre}`,
        html: emailHtml
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Failed to send email:', error);
      throw new Error(`Email sending failed: ${error}`);
    }

    const result = await response.json();
    console.log('✅ Order email sent successfully:', result);
    return result;

  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw error;
  }
}

/**
 * Send Sinpe payment instructions email
 */
export async function sendSinpeEmail(req, res) {
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
      total,
      comentarios,
      paymentMethod: 'SINPE',
      paymentStatus: 'pending',
      createdAt: new Date().toISOString()
    };

    // Send email with SINPE instructions and order details
    await sendOrderEmail(order);

    console.log('✅ SINPE order email sent:', orderId);

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
