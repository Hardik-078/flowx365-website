import { buildDemoEmail, validateDemoRequest } from './server/demo-request.ts';

interface RateLimitBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  RESEND_API_KEY?: string;
  DEMO_FROM_EMAIL?: string;
  DEMO_TO_EMAIL?: string;
  DEMO_RATE_LIMITER?: RateLimitBinding;
}

const API_PATH = '/api/demo-request';
const MAX_BODY_BYTES = 16_384;

function jsonResponse(body: object, status = 200, headers: HeadersInit = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export async function handleDemoRequest(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(
      { ok: false, message: 'Method not allowed.' },
      405,
      { Allow: 'POST' },
    );
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  if ((origin && origin !== requestUrl.origin) || fetchSite === 'cross-site') {
    return jsonResponse({ ok: false, message: 'Request origin is not allowed.' }, 403);
  }

  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return jsonResponse({ ok: false, message: 'Send the request as JSON.' }, 415);
  }

  const contentLength = Number(request.headers.get('Content-Length') ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ ok: false, message: 'Request is too large.' }, 413);
  }

  if (env.DEMO_RATE_LIMITER) {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const result = await env.DEMO_RATE_LIMITER.limit({ key: ip });
    if (!result.success) {
      return jsonResponse(
        { ok: false, message: 'Too many requests. Please wait a minute and try again.' },
        429,
        { 'Retry-After': '60' },
      );
    }
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return jsonResponse({ ok: false, message: 'Request is too large.' }, 413);
    }
    body = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ ok: false, message: 'The request body is not valid JSON.' }, 400);
  }

  const validation = validateDemoRequest(body);
  if (!validation.ok) {
    return jsonResponse(
      {
        ok: false,
        message: 'Check the highlighted fields and try again.',
        fieldErrors: validation.fieldErrors,
      },
      400,
    );
  }

  if (!env.RESEND_API_KEY || !env.DEMO_FROM_EMAIL || !env.DEMO_TO_EMAIL) {
    console.error('Demo request email configuration is missing.');
    return jsonResponse(
      { ok: false, message: 'Email delivery is not configured. Please try again later.' },
      502,
    );
  }

  try {
    const email = buildDemoEmail(validation.data, env.DEMO_FROM_EMAIL, env.DEMO_TO_EMAIL);
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email),
    });

    if (!resendResponse.ok) {
      console.error(`Demo request email provider returned status ${resendResponse.status}.`);
      return jsonResponse(
        { ok: false, message: 'We could not send your request. Please try again.' },
        502,
      );
    }
  } catch {
    console.error('Demo request email provider could not be reached.');
    return jsonResponse(
      { ok: false, message: 'We could not send your request. Please try again.' },
      502,
    );
  }

  return jsonResponse({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (new URL(request.url).pathname === API_PATH) return handleDemoRequest(request, env);
    return env.ASSETS.fetch(request);
  },
};
