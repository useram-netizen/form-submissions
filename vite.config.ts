import dns from 'node:dns';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fetchSubmissionsDashboard, updateSubmissionStatus } from './server/ghl.js';

try {
  dns.setDefaultResultOrder('ipv4first');
} catch {}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'ghl-api-server',
      configureServer(server) {
        server.middlewares.use('/api/submissions', async (req, res) => {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }
          try {
            console.log(`[API] GET /api/submissions received`);
            const data = await fetchSubmissionsDashboard();
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 200;
            res.end(JSON.stringify(data));
          } catch (err) {
            console.error('[API Error] /api/submissions failed:', err);
            res.setHeader('Content-Type', 'application/json');
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message || 'Internal server error' }));
          }
        });

        server.middlewares.use('/api/status', async (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body);
              console.log(`[API] POST /api/status payload:`, payload);
              const result = await updateSubmissionStatus(payload);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify(result));
            } catch (err) {
              console.error('[API Error] /api/status failed:', err);
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message || 'Failed to update status' }));
            }
          });
        });
      },
    },
  ],
  server: {
    port: 3000,
    open: false,
  },
});

