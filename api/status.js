import dns from 'node:dns';
import { updateSubmissionStatus } from '../server/ghl.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const result = await updateSubmissionStatus(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[Vercel API Error] /api/status:', err);
    return res.status(500).json({ error: err.message || 'Failed to update status' });
  }
}

