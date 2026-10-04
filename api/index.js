/**
 * Vercel serverless entry point.
 *
 * Vercel imports this module for every API request and invokes the default
 * export as the Express request handler, so all the real work lives in
 * ../server/index.js and stays shared with the local `npm run dev` server.
 */
import app from '../server/index.js';

export default app;
