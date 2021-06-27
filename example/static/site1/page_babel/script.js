// @process

import './_src/index.jsx';

import 'promise-polyfill/src/polyfill';

const doJob = (a, b) => a + b;

const obj = { a: 99 };

console.log(doJob(1, 2), obj);


(async() => {
  const a = await Promise.resolve(123);
  console.log(a);
})()