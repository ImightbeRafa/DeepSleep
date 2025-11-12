/**
 * Betsy CRM Integration Utility
 * Sends orders to Betsy CRM for automatic logging
 */

/**
 * Send order to Betsy CRM
 * @param {Object} orderData - Order information
 * @returns {Promise<Object>} - Betsy CRM response
 */
export async function sendOrderToBetsy(orderData) {
  const apiKey = process.env.BETSY_API_KEY;
  const apiUrl = process.env.BETSY_API_URL;

  if (!apiKey || !apiUrl) {
    console.warn('⚠️ [Betsy] API credentials not configured, skipping CRM sync');
    return { success: false, error: 'Not configured' };
  }

  try {
    console.log('📤 [Betsy] Sending order to CRM:', orderData.orderId);

    // Determine payment status for comments
    const paymentMethod = orderData.paymentMethod || 'Tilopay';
    const paymentStatus = orderData.paymentStatus === 'completed' ? 'PAGADO' : 'PENDIENTE';
    const transactionId = orderData.paymentId || orderData.transactionId || 'PENDING';
    
    // Build payment status comment
    let paymentComment = '';
    if (paymentMethod === 'SINPE') {
      paymentComment = `Pago: SINPE Móvil - Estado: Pendiente de confirmación`;
    } else if (paymentMethod === 'Tilopay' || paymentMethod === 'Tarjeta') {
      if (paymentStatus === 'PAGADO') {
        paymentComment = `Pago: Tarjeta (Tilopay) - Estado: PAGADO - ID Transacción: ${transactionId}`;
      } else {
        paymentComment = `Pago: Tarjeta (Tilopay) - Estado: Pendiente`;
      }
    } else {
      paymentComment = `Pago: ${paymentMethod} - Estado: ${paymentStatus}`;
    }
    
    // Combine user comments with payment status
    const userComments = orderData.comentarios || '';
    const fullComments = userComments 
      ? `${paymentComment}\n\nComentarios del cliente: ${userComments}`
      : paymentComment;

    // Map DeepSleep order data to Betsy CRM format
    const betsyOrder = {
      orderId: orderData.orderId,
      customer: {
        name: orderData.nombre,
        phone: orderData.telefono,
        email: orderData.email,
      },
      product: {
        name: 'DeepSleep Bucal Anti-Ronquidos',
        quantity: parseInt(orderData.cantidad) || 1,
        unitPrice: '₡9.900',
      },
      shipping: {
        cost: 'GRATIS',
        address: {
          province: orderData.provincia,
          canton: orderData.canton,
          district: orderData.distrito,
          fullAddress: orderData.direccion,
        },
      },
      total: `₡${orderData.total.toLocaleString('es-CR')}`,
      payment: {
        method: paymentMethod,
        transactionId: transactionId,
        status: 'PENDIENTE', // Always PENDIENTE - order status, not payment status
        date: new Date().toLocaleString('es-CR', {
          timeZone: 'America/Costa_Rica',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }),
      },
      source: 'DeepSleep Website',
      metadata: {
        campaign: orderData.campaign || 'organic',
        referrer: orderData.referrer || 'direct',
        comments: fullComments, // Payment status included in comments
        createdAt: orderData.createdAt || new Date().toISOString(),
      },
    };

    console.log('📦 [Betsy] Order payload:', JSON.stringify(betsyOrder, null, 2));

    // Create timeout controller for compatibility
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(betsyOrder),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [Betsy] CRM sync failed:', response.status, errorText);
      
      // Return error but don't throw - we don't want to fail the order
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        status: response.status,
      };
    }

    const result = await response.json();
    console.log('✅ [Betsy] Order synced to CRM:', result.crmOrderId || result.id);

    return {
      success: true,
      crmOrderId: result.crmOrderId || result.id,
      data: result,
    };

  } catch (error) {
    console.error('❌ [Betsy] CRM sync error:', error.message);
    
    // Log error but don't throw - we don't want to fail the order
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Send order to Betsy with retry logic
 * @param {Object} orderData - Order information
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<Object>} - Betsy CRM response
 */
export async function sendOrderToBetsyWithRetry(orderData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔄 [Betsy] Attempt ${attempt}/${maxRetries} for order ${orderData.orderId}`);
    
    const result = await sendOrderToBetsy(orderData);
    
    if (result.success) {
      return result;
    }
    
    // If not last attempt and error is retryable, wait and retry
    if (attempt < maxRetries && isRetryableError(result)) {
      const waitTime = 1000 * attempt; // Exponential backoff: 1s, 2s, 3s
      console.log(`⏳ [Betsy] Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }
    
    // Last attempt or non-retryable error
    console.error(`❌ [Betsy] Failed after ${attempt} attempts:`, result.error);
    return result;
  }
}

/**
 * Check if error is retryable
 * @param {Object} result - Result from sendOrderToBetsy
 * @returns {boolean}
 */
function isRetryableError(result) {
  // Retry on network errors, timeouts, and 5xx server errors
  if (result.error === 'Not configured') {
    return false; // Don't retry if not configured
  }
  
  if (result.status >= 500) {
    return true; // Server errors are retryable
  }
  
  if (result.error && (
    result.error.includes('timeout') ||
    result.error.includes('network') ||
    result.error.includes('ECONNREFUSED') ||
    result.error.includes('ETIMEDOUT')
  )) {
    return true;
  }
  
  return false;
}
