const delay = require('mocker-api/utils/delay');

const proxy = {
  _proxy: {
    proxy: {
      '/api': 'https://api.server.com/',
    },
    changeHost: true,
    httpProxy: {
      options: {
        ignorePath: false,
      },
    },
  },
  'POST /api/hello.do': {
    status: 'SUCCESS',
    data: 'Hello world!',
  },
};

module.exports = delay(proxy, 300);
