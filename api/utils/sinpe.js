import crypto from 'crypto';

// Accept a few common spellings so the production env names don't have to change.
const NUMBER_ENV_NAMES = ['SINPE_MOVIL', 'SINPE_NUMBER', 'SINPE_NUMERO', 'SINPE_PHONE', 'SINPE_MOVIL_NUMBER', 'SINPE_TELEFONO'];
const NAME_ENV_NAMES = ['SINPE_HOLDER', 'SINPE_NAME', 'SINPE_NOMBRE', 'SINPE_OWNER', 'SINPE_OWNER_NAME', 'SINPE_HOLDER_NAME', 'SINPE_MOVIL_NAME'];
const DEFAULT_WHATSAPP = '50662019914';

// No 0/O/1/I/L so the code is easy to type in the SINPE "concepto" field.
const ORDER_CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ORDER_CODE_LENGTH = 6;

function readFirstEnv(names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }

  return '';
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function formatCrPhone(value) {
  let digits = digitsOnly(value);

  if (digits.length === 11 && digits.startsWith('506')) {
    digits = digits.slice(3);
  }

  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4)}` : String(value || '').trim();
}

function toWhatsAppNumber(value) {
  const digits = digitsOnly(value);
  if (digits.length === 8) {
    return `506${digits}`;
  }

  return digits || DEFAULT_WHATSAPP;
}

export function getSinpeConfig() {
  const rawNumber = readFirstEnv(NUMBER_ENV_NAMES);
  const name = readFirstEnv(NAME_ENV_NAMES);
  const disabled = ['false', '0', 'no', 'off'].includes(String(process.env.SINPE_ENABLED || '').trim().toLowerCase());
  const whatsapp = toWhatsAppNumber(process.env.SINPE_WHATSAPP || process.env.WHATSAPP_NUMBER || DEFAULT_WHATSAPP);

  return {
    enabled: !disabled && digitsOnly(rawNumber).length >= 8,
    number: formatCrPhone(rawNumber),
    name,
    whatsapp,
    whatsappDisplay: formatCrPhone(whatsapp)
  };
}

export function getPublicSinpeConfig() {
  const config = getSinpeConfig();

  if (!config.enabled) {
    return { enabled: false };
  }

  return config;
}

function encodeOrderCode(bytes) {
  let code = '';
  for (let index = 0; index < ORDER_CODE_LENGTH; index++) {
    code += ORDER_CODE_ALPHABET[bytes[index] % ORDER_CODE_ALPHABET.length];
  }

  return `DS-${code}`;
}

/**
 * Short order code that fits in the SINPE "concepto" field.
 * When the browser sends a checkout token, the code is derived from it so a
 * double-click or network retry maps to the same order (and the same Resend /
 * Betsy idempotency keys) instead of creating a duplicate.
 */
export function generateSinpeOrderId(checkoutToken) {
  const token = String(checkoutToken || '').trim();

  if (/^[a-zA-Z0-9_-]{16,80}$/.test(token)) {
    return encodeOrderCode(crypto.createHash('sha256').update(`sinpe:${token}`).digest());
  }

  return encodeOrderCode(crypto.randomBytes(ORDER_CODE_LENGTH));
}

export function formatColones(value) {
  return `₡${Math.round(Number(value) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function buildSinpeWhatsAppUrl(order, config = getSinpeConfig()) {
  const text = [
    `Hola DeepSleep, adjunto el comprobante del SINPE de mi pedido ${order.orderId}.`,
    `Monto: ${formatColones(order.total)}`,
    order.nombre ? `Nombre: ${order.nombre}` : ''
  ].filter(Boolean).join('\n');

  return `https://wa.me/${config.whatsapp}?text=${encodeURIComponent(text)}`;
}
