// @process

import { hello } from './common';

const targetEl = document.getElementById('app');

if (targetEl) {
  const now: Date = new Date();
  targetEl.textContent = `Second.ts Bundle served by Vite at ${now.toLocaleTimeString()}. ${hello()}`;
}
