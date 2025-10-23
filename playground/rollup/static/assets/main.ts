// @process

import { greeting, formatTime } from './common';

const targetEl = document.getElementById('app');

if (targetEl) {
  const now: Date = new Date();
  targetEl.textContent = `${greeting}! Built at ${formatTime(now)}.`;
}
