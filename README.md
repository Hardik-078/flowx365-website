# FlowX365 website

Marketing site for FlowX365, a business management app for small and mid-sized
businesses in India. It follows one order from lead to quotation, sales order,
delivery note and GST invoice.

The page is built around a triplicate bill book. The first screen is a navy
cover, and each section after it is a sheet in one of the copy colours (white,
pink, canary) with a perforated edge and a serial stub. The product screens are
rebuilt in HTML and CSS rather than screenshotted, and all the data in them is
made up.

v1 (my version): [flowx365.hardik-078.workers.dev](https://flowx365.hardik-078.workers.dev)

Production site: [flowx365.com](https://flowx365.com)

## Stack

- Astro, static output, no client-side framework
- Plain TypeScript for the scroll scenes (`src/scripts/`)
- Cloudflare Workers with static assets. The Worker only runs for `/api/*`
- Resend for the "Request a demo" emails

## Running locally

Node 22.12 or newer (`.node-version` pins 24).

```bash
npm install
npm run dev        # http://localhost:4321
npm test           # API validation and endpoint tests
npm run build      # static site in dist/
npm run og         # regenerate public/og.png (needs ImageMagick)
```
