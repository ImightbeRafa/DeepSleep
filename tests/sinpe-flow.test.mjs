import test from 'node:test';
import assert from 'node:assert/strict';

import sinpeCreateOrderHandler from '../api/sinpe/create-order.js';
import stockStatusHandler from '../api/stock-status.js';
import { generateSinpeOrderId, getSinpeConfig } from '../api/utils/sinpe.js';

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function resetState(overrides = {}) {
  global.pendingOrders = {};
  global.processedPaidOrders = {};
  process.env = {
    ...originalEnv,
    APP_URL: 'https://deepsleep.test',
    RESEND_API_KEY: 'resend-key',
    ORDER_NOTIFICATION_EMAIL: 'orders@example.com',
    BETSY_API_KEY: 'betsy-key',
    BETSY_API_URL: 'https://betsy.test/orders',
    META_CAPI_ACCESS_TOKEN: '',
    PRODUCT_IN_STOCK: 'TRUE',
    OUT_OF_STOCK_MESSAGE: 'No hay stock disponible',
    SINPE_NUMBER: '8888 7777',
    SINPE_NAME: 'Nombre Prueba',
    SINPE_WHATSAPP: '',
    SINPE_ENABLED: '',
    ...overrides
  };
}

function makeRes() {
  return {
    statusCode: 200,
    body: undefined,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    }
  };
}

function orderBody(overrides = {}) {
  return {
    nombre: 'Ana Cliente',
    telefono: '8888-8888',
    email: 'ana@example.com',
    provincia: 'San José',
    canton: 'Central',
    distrito: 'Carmen',
    direccion: 'Calle 1',
    cantidad: '2',
    comentarios: 'Casa azul',
    checkoutToken: 'tok_abcdefghijklmnop1234',
    ...overrides
  };
}

function mockFetch({ resendOk = true, betsyOk = true } = {}) {
  const calls = [];
  global.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });

    if (String(url) === 'https://api.resend.com/emails') {
      return resendOk
        ? Response.json({ id: `email-${calls.length}` })
        : new Response('boom', { status: 500 });
    }

    if (String(url) === 'https://betsy.test/orders') {
      return betsyOk
        ? Response.json({ id: 'CRM-1' })
        : new Response('bad request', { status: 400 });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  };
  return calls;
}

test.after(() => {
  global.fetch = originalFetch;
  process.env = originalEnv;
});

test('SINPE config reads number/name from env and formats the number', () => {
  resetState();
  const config = getSinpeConfig();
  assert.equal(config.enabled, true);
  assert.equal(config.number, '8888-7777');
  assert.equal(config.name, 'Nombre Prueba');
  assert.equal(config.whatsapp, '50662019914');
});

test('SINPE config accepts alternative env names', () => {
  resetState({ SINPE_NUMBER: '', SINPE_NAME: '', SINPE_NUMERO: '+506 7000 1111', SINPE_NOMBRE: 'Otro' });
  const config = getSinpeConfig();
  assert.equal(config.number, '7000-1111');
  assert.equal(config.name, 'Otro');
});

test('SINPE order ids are short, concept-safe and stable per checkout token', () => {
  const first = generateSinpeOrderId('tok_abcdefghijklmnop1234');
  const retry = generateSinpeOrderId('tok_abcdefghijklmnop1234');
  const other = generateSinpeOrderId('tok_zzzzzzzzzzzzzzzz9999');
  const random = generateSinpeOrderId();

  assert.match(first, /^DS-[2-9A-HJKMNP-Z]{6}$/);
  assert.match(random, /^DS-[2-9A-HJKMNP-Z]{6}$/);
  assert.equal(first, retry);
  assert.notEqual(first, other);
});

test('stock-status exposes SINPE details only when configured', () => {
  resetState();
  let res = makeRes();
  stockStatusHandler({ method: 'GET' }, res);
  assert.equal(res.body.inStock, true);
  assert.equal(res.body.paymentMethods.sinpe, true);
  assert.equal(res.body.sinpe.number, '8888-7777');

  resetState({ SINPE_NUMBER: '' });
  res = makeRes();
  stockStatusHandler({ method: 'GET' }, res);
  assert.equal(res.body.paymentMethods.sinpe, false);
  assert.deepEqual(res.body.sinpe, { enabled: false });
});

test('SINPE order emails customer + admin and creates a pending Betsy order', async () => {
  resetState();
  const calls = mockFetch();
  const res = makeRes();

  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody(), headers: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.match(res.body.orderId, /^DS-/);
  assert.equal(res.body.total, 9900 * 2 + 3000);
  assert.equal(res.body.sinpe.number, '8888-7777');
  assert.match(res.body.whatsappUrl, /^https:\/\/wa\.me\/50662019914\?text=/);

  const emails = calls.filter((call) => call.url === 'https://api.resend.com/emails');
  assert.equal(emails.length, 2);
  const [customer, admin] = emails.map((call) => JSON.parse(call.options.body));
  assert.equal(customer.to, 'ana@example.com');
  assert.match(customer.subject, /SINPE/);
  assert.match(customer.html, /8888-7777/);
  assert.match(customer.html, new RegExp(res.body.orderId));
  assert.match(admin.subject, /SINPE pendiente/);
  assert.equal(emails[0].options.headers['Idempotency-Key'], `deepsleep/order-confirmation/sinpe-customer/${res.body.orderId}`);

  const betsyCall = calls.find((call) => call.url === 'https://betsy.test/orders');
  const betsyPayload = JSON.parse(betsyCall.options.body);
  assert.equal(betsyPayload.payment.method, 'SINPE');
  assert.equal(betsyPayload.payment.status, 'PENDIENTE');
  assert.equal(betsyPayload.total, `₡${(22800).toLocaleString('es-CR')}`);
  assert.match(betsyPayload.metadata.comments, /SINPE Móvil - Estado: PENDIENTE/);
  assert.match(betsyPayload.metadata.comments, /Comentarios del cliente: Casa azul/);
});

test('SINPE order ignores client-sent prices and quantities outside the allowed range', async () => {
  resetState();
  mockFetch();

  let res = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody({ cantidad: '1', total: 1, subtotal: 1 }), headers: {} }, res);
  assert.equal(res.body.total, 12900);

  res = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody({ cantidad: '9' }), headers: {} }, res);
  assert.equal(res.statusCode, 400);
});

test('SINPE order succeeds if Betsy fails but the admin email is sent', async () => {
  resetState();
  mockFetch({ betsyOk: false });
  const res = makeRes();

  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody(), headers: {} }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
});

test('SINPE order fails loudly when neither email nor Betsy recorded it', async () => {
  resetState();
  mockFetch({ resendOk: false, betsyOk: false });
  const res = makeRes();

  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody(), headers: {} }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.match(res.body.message, /WhatsApp/);
});

test('SINPE double-submit with the same checkout token does not duplicate the order', async () => {
  resetState();
  const calls = mockFetch();

  const first = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody(), headers: {} }, first);
  const second = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody(), headers: {} }, second);

  assert.equal(first.body.orderId, second.body.orderId);
  assert.equal(calls.filter((call) => call.url === 'https://betsy.test/orders').length, 1);
  assert.equal(calls.filter((call) => call.url === 'https://api.resend.com/emails').length, 2);
});

test('SINPE checkout is blocked when out of stock or SINPE is not configured', async () => {
  resetState({ PRODUCT_IN_STOCK: 'FALSE' });
  mockFetch();
  let res = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody(), headers: {} }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.error, 'OUT_OF_STOCK');

  resetState({ SINPE_NUMBER: '' });
  res = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody(), headers: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'SINPE_DISABLED');
});

test('SINPE order rejects invalid email and phone', async () => {
  resetState();
  mockFetch();

  let res = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody({ email: 'not-an-email' }), headers: {} }, res);
  assert.equal(res.statusCode, 400);

  res = makeRes();
  await sinpeCreateOrderHandler({ method: 'POST', body: orderBody({ telefono: '123' }), headers: {} }, res);
  assert.equal(res.statusCode, 400);
});
