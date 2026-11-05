import dns from 'node:dns';
import { fetchSubmissionsDashboard } from '../server/ghl.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const data = await fetchSubmissionsDashboard();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Vercel API Error] /api/submissions:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

