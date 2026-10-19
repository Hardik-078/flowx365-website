// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://flowx365.com',
  trailingSlash: 'ignore',
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
    assets: '_assets',
  },
  devToolbar: { enabled: false },
});
