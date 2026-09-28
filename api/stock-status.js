import { getProductStockStatus } from './utils/stock.js';
import { getPublicSinpeConfig } from './utils/sinpe.js';

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sinpe = getPublicSinpeConfig();

  return res.json({
    ...getProductStockStatus(),
    paymentMethods: {
      card: true,
      sinpe: sinpe.enabled
    },
    sinpe
  });
}
