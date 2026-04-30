import test from 'node:test';
import assert from 'node:assert/strict';

import createPaymentHandler from '../api/tilopay/create-payment.js';
import confirmHandler from '../api/tilopay/confirm.js';
import webhookHandler from '../api/tilopay/webhook.js';
import { encodeOrderReturnData } from '../api/utils/orderReturnData.js';
import { normalizeTrustedOrder } from '../api/utils/order.js';
import { sendOrderToBetsy } from '../api/utils/betsy.js';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function resetState() {
  global.pendingOrders = {};
  global.processedPaidOrders = {};
  process.env = {
    ...originalEnv,
    TILOPAY_BASE_URL: 'https://tilopay.test/api/v1',
    TILOPAY_USER: 'user',
    TILOPAY_PASSWORD: 'pass',
    TILOPAY_API_KEY: 'api-key',
    TILOPAY_WEBHOOK_SECRET: 'secret',
    APP_URL: 'https://deepsleep.test',
    RESEND_API_KEY: 'resend-key',
    ORDER_NOTIFICATION_EMAIL: 'orders@example.com',
    BETSY_API_KEY: '',
    BETSY_API_URL: '',
    META_CAPI_ACCESS_TOKEN: ''
  };
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    }
  };
}

function sampleOrder(overrides = {}) {
  return normalizeTrustedOrder({
    orderId: 'ORD-TEST-123',
    nombre: 'Ana Cliente',
    telefono: '88888888',
    email: 'ana@example.com',
    provincia: 'San Jose',
    canton: 'Central',
    distrito: 'Carmen',
    direccion: 'Calle 1',
    cantidad: 1,
    comentarios: 'Casa azul',
    ...overrides
  });
}

test.after(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
});

test('trusted totals enforce 9900 + 3000 = 12900', () => {
  resetState();
  const order = normalizeTrustedOrder({
    orderId: 'ORD-TOTAL',
    nombre: 'Ana',
    telefono: '88888888',
    email: 'ana@example.com',
    provincia: 'San Jose',
    canton: 'Central',
    distrito: 'Carmen',
    direccion: 'Calle 1',
    cantidad: 1,
    subtotal: 1,
    shippingCost: 1,
    total: 1
  });

  assert.equal(order.subtotal, 9900);
  assert.equal(order.shippingCost, 3000);
  assert.equal(order.total, 12900);
});

test('trusted totals charge shipping on multi-unit orders', () => {
  resetState();
  const order = normalizeTrustedOrder({
    orderId: 'ORD-MULTI-SHIPPING',
    nombre: 'Ana',
    telefono: '88888888',
    email: 'ana@example.com',
    provincia: 'San Jose',
    canton: 'Central',
    distrito: 'Carmen',
    direccion: 'Calle 1',
    cantidad: 2
  });

  assert.equal(order.subtotal, 19800);
  assert.equal(order.shippingCost, 3000);
  assert.equal(order.total, 22800);
});

test('create-payment sends trusted Tilopay payload and creates pending email audit only', async () => {
  resetState();
  process.env.BETSY_API_KEY = 'betsy-key';
  process.env.BETSY_API_URL = 'https://betsy.test/orders';
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url).endsWith('/login')) {
      return Response.json({ access_token: 'token' });
    }

    if (String(url).endsWith('/processPayment')) {
      return Response.json({ urlPaymentForm: 'https://tilopay.test/pay/123', id: 'TILO-1' });
    }

    if (String(url) === 'https://api.resend.com/emails') {
      return Response.json({ id: `email-${calls.length}` });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const req = {
    method: 'POST',
    body: {
      nombre: 'Ana Cliente',
      telefono: '88888888',
      email: 'ana@example.com',
      provincia: 'San Jose',
      canton: 'Central',
      distrito: 'Carmen',
      direccion: 'Calle 1',
      cantidad: '1',
      comentarios: 'Casa azul'
    },
    headers: {}
  };
  const res = makeRes();

  await createPaymentHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.auditTrail.success, true);
  assert.equal(res.body.auditTrail.channels.betsy.skipped, true);

  const processPaymentCall = calls.find((call) => call.url.endsWith('/processPayment'));
  const payload = JSON.parse(processPaymentCall.options.body);

  assert.equal(payload.amount, 12900);
  assert.equal(payload.token_version, 'v2');
  assert.equal(payload.notification_url, 'https://deepsleep.test/api/tilopay/webhook');
  assert.equal(payload.shipToEmail, 'ana@example.com');
  assert.ok(payload.returnData);
  assert.equal(calls.filter((call) => call.url === 'https://betsy.test/orders').length, 0);
});

test('approved redirect with valid returnData processes email and CRM independently', async () => {
  resetState();
  process.env.BETSY_API_KEY = 'betsy-key';
  process.env.BETSY_API_URL = 'https://betsy.test/orders';
  const calls = [];
  const order = sampleOrder();
  const returnData = encodeOrderReturnData(order);

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url) === 'https://api.resend.com/emails') {
      return Response.json({ id: `email-${calls.length}` });
    }

    if (String(url) === 'https://betsy.test/orders') {
      return Response.json({ id: 'CRM-1' });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const req = {
    method: 'POST',
    body: {
      orderId: order.orderId,
      transactionId: 'TILO-APPROVED',
      code: '1',
      returnData
    },
    headers: {}
  };
  const res = makeRes();

  await confirmHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.status, 'approved_processed');
  assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 2);
  assert.equal(calls.filter((call) => call.url === 'https://betsy.test/orders').length, 1);
  const betsyCall = calls.find((call) => call.url === 'https://betsy.test/orders');
  assert.equal(betsyCall.options.headers['Idempotency-Key'], `deepsleep/betsy-order/${order.orderId}`);
});

test('approved redirect without transaction ID goes to manual review', async () => {
  resetState();
  const calls = [];
  const order = sampleOrder();
  const returnData = encodeOrderReturnData(order);

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url) === 'https://api.resend.com/emails') {
      return Response.json({ id: 'manual-review-email' });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const req = {
    method: 'POST',
    body: {
      orderId: order.orderId,
      code: '1',
      returnData
    },
    headers: {}
  };
  const res = makeRes();

  await confirmHandler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.success, true);
  assert.equal(res.body.status, 'approved_manual_review');
  assert.equal(calls.length, 1);
  assert.equal(global.pendingOrders[order.orderId], undefined);
});

test('approved webhook without returnData sends manual review alert', async () => {
  resetState();
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url) === 'https://api.resend.com/emails') {
      return Response.json({ id: 'manual-review-email' });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const req = {
    method: 'POST',
    body: {
      orderNumber: 'ORD-MISSING',
      tpt: 'TILO-MISSING',
      code: '1'
    },
    headers: {
      'x-tilopay-secret': 'secret'
    }
  };
  const res = makeRes();

  await webhookHandler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.success, true);
  assert.equal(res.body.status, 'approved_manual_review');
  assert.equal(calls.length, 1);

  const emailPayload = JSON.parse(calls[0].options.body);
  assert.match(emailPayload.subject, /URGENTE/);
  assert.match(emailPayload.html, /ORD-MISSING/);
  assert.match(emailPayload.html, /TILO-MISSING/);
});

test('unsigned approved webhook is rejected by default', async () => {
  resetState();
  let fetchCalled = false;

  global.fetch = async () => {
    fetchCalled = true;
    return Response.json({ id: 'should-not-send' });
  };

  const req = {
    method: 'POST',
    body: {
      orderNumber: 'ORD-UNSIGNED',
      tpt: 'TILO-UNSIGNED',
      code: '1'
    },
    headers: {}
  };
  const res = makeRes();

  await webhookHandler(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body.error, 'Unauthorized');
  assert.equal(fetchCalled, false);
});

test('approved webhook without transaction ID goes to manual review', async () => {
  resetState();
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url) === 'https://api.resend.com/emails') {
      return Response.json({ id: 'manual-review-email' });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };

  const req = {
    method: 'POST',
    body: {
      orderNumber: 'ORD-NO-TXN',
      code: '1'
    },
    headers: {
      'x-tilopay-secret': 'secret'
    }
  };
  const res = makeRes();

  await webhookHandler(req, res);

  assert.equal(res.statusCode, 202);
  assert.equal(res.body.success, true);
  assert.equal(res.body.status, 'approved_manual_review');
  assert.equal(calls.length, 1);
});

test('Betsy 409 duplicate response is treated as already handled', async () => {
  resetState();
  process.env.BETSY_API_KEY = 'betsy-key';
  process.env.BETSY_API_URL = 'https://betsy.test/orders';
  const calls = [];

  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return new Response('Order already exists', { status: 409 });
  };

  const result = await sendOrderToBetsy(sampleOrder({
    paymentStatus: 'completed',
    paymentId: 'TILO-DUPLICATE'
  }));

  assert.equal(result.success, true);
  assert.equal(result.duplicate, true);
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'deepsleep/betsy-order/ORD-TEST-123');
});
