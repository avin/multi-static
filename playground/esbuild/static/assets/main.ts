// @process

import { greeting, fancyTime } from './common';

const targetEl = document.getElementById('app');

if (targetEl) {
  const now = new Date();
  targetEl.textContent = `${greeting}! Built at ${fancyTime(now)}.`;
}
