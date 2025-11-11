/**
 * Send customer confirmation email
 */
async function sendCustomerEmail(order) {
  const resendApiKey = process.env.RESEND_API_KEY;
  
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
        .btn { display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        .highlight { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>😴 DeepSleep</h1>
          <p style="color: white; margin: 10px 0 0 0; opacity: 0.9;">Bucal Anti-Ronquidos</p>
        </div>
        <div class="content">
        <h2>✅ ¡Confirmación de Pedido!</h2>
        
        <p>Hola <strong>${order.nombre}</strong>,</p>
        <p>Gracias por tu pedido. Aquí están los detalles:</p>
        
        <div class="order-box">
          <p><span class="label">Número de Orden:</span> ${order.orderId}</p>
          <p><span class="label">Producto:</span> DeepSleep Bucal Anti-Ronquidos</p>
          <p><span class="label">Cantidad:</span> ${order.cantidad}</p>
          <p><span class="label">Total:</span> ₡${order.total.toLocaleString('es-CR')}</p>
          <p><span class="label">Envío:</span> GRATIS</p>
        </div>
        
        ${order.paymentMethod === 'SINPE' ? `
          <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3>📱 Instrucciones de Pago SINPE</h3>
            <ol>
              <li>Abra la aplicación SINPE Móvil de su banco</li>
              <li>Realice una transferencia por <strong>₡${order.total.toLocaleString('es-CR')}</strong></li>
              <li><strong>Importante:</strong> En el concepto escriba: <strong>${order.orderId}</strong></li>
              <li>Complete la transferencia</li>
            </ol>
            <p><strong>⚠️ Recuerde usar el número de orden en el concepto del SINPE para verificar su pago.</strong></p>
          </div>
        ` : `
          <p>Su pago con tarjeta ha sido procesado exitosamente.</p>
        `}
        
        <div class="order-box">
          <p><strong>📍 Dirección de Envío:</strong></p>
          <p>${order.direccion}<br>
          ${order.distrito}, ${order.canton}, ${order.provincia}</p>
        </div>
        
        <p style="text-align: center; margin: 30px 0;">
          <strong>Te contactaremos pronto para coordinar la entrega</strong>
        </p>
        </div>
        
        <div class="footer">
          <p><strong>¿Tienes preguntas?</strong></p>
          <p>
            WhatsApp: <a href="https://wa.me/50662019914" style="color: #667eea;">6201-9914</a><br>
            Instagram: <a href="https://www.instagram.com/deepsleep.cr/" style="color: #667eea;">@deepsleep.cr</a><br>
            Email: deepsleepp.cr@gmail.com
          </p>
          <p style="margin-top: 20px; color: #9ca3af;">
            © 2024 DeepSleep. Todos los derechos reservados.
          </p>
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
      from: 'DeepSleep <ordenes@betsycrm.com>',
      to: order.email,
      subject: `Confirmación de Pedido ${order.orderId} - DeepSleep`,
      html: customerEmailHtml
    })
  });

  if (!response.ok) {
    throw new Error('Failed to send customer email');
  }

  return await response.json();
}

/**
 * Send admin notification email
 */
async function sendAdminEmail(order) {
  const resendApiKey = process.env.RESEND_API_KEY;
  const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;

    const adminEmailHtml = `
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
            <div class="info-item"><span class="label">Email:</span> ${order.email}</div>
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
            <div class="info-item"><span class="label">Método:</span> ${order.paymentMethod || 'Tilopay'}</div>
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
        from: 'DeepSleep <ordenes@betsycrm.com>',
        to: notificationEmail,
        subject: `Nueva Orden: ${order.orderId} - ${order.nombre}`,
        html: adminEmailHtml
      })
    });

    if (!response.ok) {
      throw new Error('Failed to send admin email');
    }

    return await response.json();
}

/**
 * Send both customer and admin emails
 */
export async function sendOrderEmail(order) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const notificationEmail = process.env.ORDER_NOTIFICATION_EMAIL;

    if (!resendApiKey || !notificationEmail) {
      console.warn('⚠️ Email not configured');
      throw new Error('Email configuration missing');
    }

    // Send customer confirmation email
    if (order.email) {
      try {
        await sendCustomerEmail(order);
        console.log('✅ Customer email sent to:', order.email);
      } catch (error) {
        console.error('❌ Failed to send customer email:', error);
        // Don't fail the whole process if customer email fails
      }
    }

    // Send admin notification email
    await sendAdminEmail(order);
    console.log('✅ Admin email sent to:', notificationEmail);

    return { success: true };

  } catch (error) {
    console.error('❌ Email sending error:', error);
    throw error;
  }
}
