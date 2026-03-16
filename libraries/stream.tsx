import type { Request, Response } from 'express';
import { renderToPipeableStream } from 'react-dom/server';
import App from '../app/App.js';
import { createResource } from '../app/lib/resource.js';

const ABORT_DELAY_MS = 10_000;

export function streamPage(req: Request, res: Response) {
  let didError = false;

  const resource = createResource(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 1200);
    });

    return `Streamed async payload for ${req.path} at ${new Date().toISOString()}`;
  });

  const { pipe, abort } = renderToPipeableStream(
    <App pathname={req.path} resource={resource} />,
    {
      onShellReady() {
        res.statusCode = didError ? 500 : 200;
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.write('<!doctype html>');
        pipe(res);
      },
      onShellError() {
        res.status(500).send('<!doctype html><html><body><h1>SSR shell error</h1></body></html>');
      },
      onError(error) {
        didError = true;
        console.error(error);
      },
    },
  );

  req.on('close', () => {
    abort();
  });

  setTimeout(() => {
    abort();
  }, ABORT_DELAY_MS);
}
