import createPaymentHandler from '../../api/tilopay/create-payment.js';
import confirmHandler from '../../api/tilopay/confirm.js';
import webhookHandler from '../../api/tilopay/webhook.js';

export async function createPaymentLink(req, res) {
  return createPaymentHandler(req, res);
}

export async function handleWebhook(req, res) {
  return webhookHandler(req, res);
}

export async function confirmPayment(req, res) {
  return confirmHandler(req, res);
}
