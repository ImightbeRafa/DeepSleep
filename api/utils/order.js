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

const REQUIRED_FIELDS = ['nombre', 'telefono', 'email', 'provincia', 'canton', 'distrito', 'direccion', 'cantidad'];
const FIELD_MAX_LENGTHS = {
  nombre: 120,
  telefono: 30,
  email: 160,
  provincia: 40,
  canton: 80,
  distrito: 80,
  direccion: 500,
  comentarios: 1000
};

/**
 * Returns a customer-facing (Spanish) error message, or null when the input is valid.
 */
export function validateOrderInput(input) {
  const body = input || {};

  for (const field of REQUIRED_FIELDS) {
    if (!String(body[field] ?? '').trim()) {
      return 'Por favor complete todos los campos requeridos.';
    }
  }

  for (const [field, maxLength] of Object.entries(FIELD_MAX_LENGTHS)) {
    if (String(body[field] ?? '').length > maxLength) {
      return 'Uno de los campos es demasiado largo.';
    }
  }

  if (String(body.telefono).replace(/\D/g, '').length < 8) {
    return 'Ingrese un número de teléfono válido (8 dígitos).';
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email).trim())) {
    return 'Ingrese un correo electrónico válido.';
  }

  try {
    normalizeQuantity(body.cantidad);
  } catch {
    return `La cantidad debe estar entre 1 y ${MAX_QUANTITY}.`;
  }

  return null;
}

export function calculateTrustedTotals(value) {
  const cantidad = normalizeQuantity(value);
  const subtotal = PRODUCT.unitPrice * cantidad;
  const shippingCost = SHIPPING_COST;
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
