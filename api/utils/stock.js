const DISABLED_VALUES = new Set(['false', '0', 'no', 'off']);
const ENABLED_VALUES = new Set(['true', '1', 'yes', 'on']);

const DEFAULT_OUT_OF_STOCK_MESSAGE = 'Estamos sin stock por el momento. No estamos recibiendo pedidos nuevos.';

function normalizeFlag(value) {
  return String(value || '').trim().toLowerCase();
}

export function getProductStockStatus() {
  const rawValue = process.env.PRODUCT_IN_STOCK ?? process.env.HAS_STOCK ?? '';
  const normalized = normalizeFlag(rawValue);
  const message = process.env.OUT_OF_STOCK_MESSAGE || DEFAULT_OUT_OF_STOCK_MESSAGE;

  if (DISABLED_VALUES.has(normalized)) {
    return {
      inStock: false,
      message
    };
  }

  if (ENABLED_VALUES.has(normalized)) {
    return {
      inStock: true,
      message: ''
    };
  }

  return {
    inStock: true,
    message: ''
  };
}

