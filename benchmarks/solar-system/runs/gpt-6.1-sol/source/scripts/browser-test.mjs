import path from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH=path.resolve('.cache/browsers');
await import('../tests/browser.mjs');
