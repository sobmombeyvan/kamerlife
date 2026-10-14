import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Stamp the production service worker so each deploy gets its own shell cache. */
function kamerlifeSw(): Plugin {
  const token = '__KAMERLIFE_CACHE__';
  return {
    name: 'kamerlife-sw-version',
    apply: 'build',
    closeBundle() {
      const file = resolve('dist/sw.js');
      if (!existsSync(file)) return;
      const version = `${process.env.npm_package_version ?? '0'}-${Date.now().toString(36)}`;
      const src = readFileSync(file, 'utf8');
      if (!src.includes(token)) return;
      writeFileSync(file, src.replaceAll(token, version));
    },
  };
}

export default defineConfig({
  plugins: [kamerlifeSw()],
});
