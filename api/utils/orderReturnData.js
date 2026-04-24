import crypto from 'crypto';

function getSigningSecret() {
  return process.env.TILOPAY_WEBHOOK_SECRET ||
    process.env.TILOPAY_API_KEY ||
    process.env.RESEND_API_KEY ||
    'deepsleep-dev-return-data-secret';
}

function encodeBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function encodeBufferBase64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function decodeBase64(value) {
  let normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) {
    normalized += '=';
  }

  return Buffer.from(normalized, 'base64').toString('utf8');
}

function decodeBase64Buffer(value) {
  let normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  while (normalized.length % 4) {
    normalized += '=';
  }

  return Buffer.from(normalized, 'base64');
}

function getEncryptionKey() {
  return crypto.createHash('sha256').update(getSigningSecret()).digest();
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(payload)
    .digest('hex');
}

export function encodeOrderReturnData(order) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(order), 'utf8'),
    cipher.final()
  ]);

  const envelope = {
    v: 2,
    alg: 'A256GCM',
    iv: encodeBufferBase64Url(iv),
    ciphertext: encodeBufferBase64Url(ciphertext),
    tag: encodeBufferBase64Url(cipher.getAuthTag()),
    summary: {
      orderId: order.orderId,
      total: order.total,
      cantidad: order.cantidad
    }
  };

  return encodeBase64Url(JSON.stringify(envelope));
}

export function decodeOrderReturnData(returnData) {
  if (!returnData) {
    throw new Error('Missing returnData');
  }

  const decoded = decodeBase64(returnData);
  const parsed = JSON.parse(decoded);

  if (parsed?.v === 2 && parsed.alg === 'A256GCM') {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      decodeBase64Buffer(parsed.iv)
    );
    decipher.setAuthTag(decodeBase64Buffer(parsed.tag));

    const plaintext = Buffer.concat([
      decipher.update(decodeBase64Buffer(parsed.ciphertext)),
      decipher.final()
    ]);

    return JSON.parse(plaintext.toString('utf8'));
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.payload || !parsed.signature) {
    return parsed;
  }

  const expectedSignature = signPayload(parsed.payload);
  const providedSignature = String(parsed.signature);
  const signaturesMatch =
    expectedSignature.length === providedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(providedSignature));

  if (!signaturesMatch) {
    throw new Error('Invalid returnData signature');
  }

  return JSON.parse(decodeBase64(parsed.payload));
}
