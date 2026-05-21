import { waitUntil } from '@vercel/functions';
import { extractAndLog } from '../utils/extractFields.js';
import { runWithRetry } from '../utils/retry.js';

export const config = { runtime: 'nodejs' };

async function processCall(payload) {
  await Promise.allSettled([
    runWithRetry(() => extractAndLog(payload), payload, 'extract'),
  ]);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Bolna/Raya send the call envelope at top level; downstream code expects { body: <inner> }.
  const inner = body.body ?? body;
  if (!inner.uuid || !inner.call_transcript) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  res.status(200).json({ status: 'received', call_id: inner.uuid });

  const payload = { body: inner };
  waitUntil(processCall(payload));
}
