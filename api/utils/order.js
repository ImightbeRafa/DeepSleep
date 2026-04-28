export const PRODUCT = {
  id: 'deepsleep-bucal',
  name: 'DeepSleep Bucal Anti-Ronquidos',
  unitPrice: 9900
};

export const SHIPPING_COST = 3000;
export const MAX_QUANTITY = 5;

export function generateOrderId() {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${random}`;
}

export function normalizeQuantity(value) {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new Error(`Quantity must be between 1 and ${MAX_QUANTITY}`);
  }

  return quantity;
}

export function calculateTrustedTotals(value) {
  const cantidad = normalizeQuantity(value);
  const subtotal = PRODUCT.unitPrice * cantidad;
  const shippingCost = cantidad >= 2 ? 0 : SHIPPING_COST;
  const total = subtotal + shippingCost;

  return {
    cantidad,
    subtotal,
    shippingCost,
    total
  };
}

export function normalizeTrustedOrder(order, options = {}) {
  if (!order || typeof order !== 'object') {
    throw new Error('Order data is required');
  }

  const totals = calculateTrustedTotals(order.cantidad);
  const orderId = options.orderId || order.orderId || generateOrderId();

  return {
    ...order,
    orderId,
    cantidad: totals.cantidad,
    subtotal: totals.subtotal,
    shippingCost: totals.shippingCost,
    total: totals.total,
    productId: PRODUCT.id,
    productName: PRODUCT.name,
    unitPrice: PRODUCT.unitPrice,
    createdAt: order.createdAt || options.createdAt || new Date().toISOString()
  };
}

export function normalizePaidOrder(order, options = {}) {
  const normalized = normalizeTrustedOrder(order);

  return {
    ...normalized,
    paymentStatus: 'completed',
    paymentMethod: options.paymentMethod || order.paymentMethod || 'Tilopay',
    paymentId: options.transactionId || order.paymentId || order.transactionId || null,
    transactionId: options.transactionId || order.transactionId || order.paymentId || null,
    paidAt: options.paidAt || order.paidAt || new Date().toISOString()
  };
}
