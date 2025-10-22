# Vite example

This playground shows how to pair `multi-static` with Vite for bundling JavaScript.

## What is included

- static assets live in `static/`;
- runtime configuration sits in `configs/`; the Vite transformer lives in `configs/transformers/vite-bundle/` alongside its dedicated `vite.config.ts`;
- `static/index.html` loads `assets/main.js`, while the source entry stays at `assets/main.ts`;
- any `*.ts`/`*.js` file that starts with `// @process` is passed through Vite automatically.

## How to use

1. Install the dependencies listed in the local `package.json`.
2. Run `yarn dev` (or `npm run dev`) to start the `multi-static` dev server; scripts are wired to `configs/multi-static.config.ts`, HTML is served by multi-static, requests for `assets/main.js` are handled by Vite.
3. Run `yarn build` to produce the static build inside `build/`.

Note: in dev mode Vite works in `middlewareMode`. Stopping the multi-static process also shuts Vite down cleanly. Remember to keep the `// @process` marker on files that must go through Vite (see `static/assets/main.ts`).
