import { env } from './lib/env.js';
import { createApp } from './app.js';

const port = env.port;

createApp().listen(port, () => {
  console.log(`nav-vue server listening on :${port}`);
});
