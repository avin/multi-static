var greeting = 'Hello from Rollup';
function formatTime(date) {
  return date.toLocaleTimeString();
}

// @process
var targetEl = document.getElementById('app');
if (targetEl) {
  var now = new Date();
  targetEl.textContent = ''.concat(greeting, '! Built at ').concat(formatTime(now), '.');
}
//# sourceMappingURL=main.js.map
