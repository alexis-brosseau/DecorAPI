import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const controllerRouter = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// When compiled, this file ends up in dist/middlewares.
// Controllers are compiled to dist/controllers.
const controllersDir = path.join(__dirname, '..', 'controllers');

for (const file of fs.readdirSync(controllersDir)) {
  if (!file.endsWith('.js')) continue;

  const name = file.slice(0, -3);
  if (!name) continue;

  const mountPath = name === 'root' ? '' : `/${name}`;
  const moduleUrl = pathToFileURL(path.join(controllersDir, file)).toString();

  const { default: Controller } = await import(moduleUrl);
  const controller = new Controller();
  controllerRouter.use(mountPath, controller.router);
}

export default controllerRouter;