// @process

import { greeting, formatTime } from './common';

const targetEl = document.getElementById('app');

if (targetEl) {
  const now = new Date();
  targetEl.textContent = `${greeting}! Built at ${formatTime(now)}.`;
}
