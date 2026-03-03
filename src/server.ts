import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { request as httpRequest } from 'node:http';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

/**
 * Proxy /api/* to the C# backend.
 * In development the Angular dev-server proxy (proxy.conf.json) handles this;
 * here we cover the built/SSR mode. Set API_URL env var to override.
 */
const apiTarget = new URL(process.env['API_URL'] ?? 'http://localhost:5000');

app.use('/api', (req, res) => {
  const proxy = httpRequest(
    {
      hostname: apiTarget.hostname,
      port: apiTarget.port ? Number(apiTarget.port) : 80,
      path: req.originalUrl,
      method: req.method,
      headers: { ...req.headers, host: apiTarget.host },
    },
    (apiRes) => {
      res.writeHead(apiRes.statusCode ?? 502, apiRes.headers as Record<string, string | string[]>);
      apiRes.pipe(res);
    },
  );
  proxy.on('error', () => res.status(502).json({ error: 'Backend unavailable' }));
  req.pipe(proxy);
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
