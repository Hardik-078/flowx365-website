import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import {
  buildDemoEmail,
  DEMO_SERVICES,
  escapeHtml,
  validateDemoRequest,
} from '../src/server/demo-request.ts';
import { handleDemoRequest } from '../src/worker.ts';

const validInput = {
  fullName: '  Asha Rao  ',
  email: ' ASHA@example.com ',
  phone: ' +91 (98765) 43210 ',
  company: ' Siddiona Technologies ',
  service: DEMO_SERVICES[0],
  requirement: ' Show us the sales-to-invoice flow. ',
  website: '',
};

const nativeFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = nativeFetch;
});

describe('demo request validation', () => {
  test('normalizes valid values', () => {
    const result = validateDemoRequest(validInput);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.fullName, 'Asha Rao');
    assert.equal(result.data.email, 'asha@example.com');
    assert.equal(result.data.company, 'Siddiona Technologies');
  });

  test('requires core fields and a listed service', () => {
    const result = validateDemoRequest({
      fullName: '',
      email: 'not-an-email',
      phone: '123',
      service: 'Unreleased integration',
      website: '',
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.deepEqual(Object.keys(result.fieldErrors).sort(), ['email', 'fullName', 'phone', 'service']);
  });

  test('accepts optional fields when omitted', () => {
    const result = validateDemoRequest({ ...validInput, company: undefined, requirement: undefined });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.company, '');
    assert.equal(result.data.requirement, '');
  });

  test('rejects the honeypot and header injection attempts', () => {
    const bot = validateDemoRequest({ ...validInput, website: 'https://spam.example' });
    assert.equal(bot.ok, false);
    if (!bot.ok) assert.equal(typeof bot.fieldErrors.website, 'string');

    const injected = validateDemoRequest({ ...validInput, fullName: 'Asha\r\nBcc: target@example.com' });
    assert.equal(injected.ok, false);
    if (!injected.ok) assert.equal(typeof injected.fieldErrors.fullName, 'string');
  });
});

describe('email construction', () => {
  test('escapes user content and creates the Resend payload', () => {
    const validation = validateDemoRequest({
      ...validInput,
      fullName: 'Asha <Rao>',
      requirement: '<script>alert("x")</script>',
    });
    assert.equal(validation.ok, true);
    if (!validation.ok) return;

    const email = buildDemoEmail(
      validation.data,
      'FlowX365 <onboarding@resend.dev>',
      'inbox@example.com',
      new Date('2026-10-10T10:00:00.000Z'),
    );
    assert.deepEqual(email.to, ['inbox@example.com']);
    assert.equal(email.reply_to, 'asha@example.com');
    assert.equal(email.subject, 'New Flowx365 Demo Request - Asha <Rao>');
    assert.match(email.html, /&lt;script&gt;/);
    assert.doesNotMatch(email.html, /<script>/);
    assert.match(email.text, /2026-10-10T10:00:00.000Z/);
  });

  test('escapes all HTML-sensitive characters', () => {
    assert.equal(escapeHtml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
  });
});

function apiRequest(body: unknown, init: RequestInit = {}): Request {
  return new Request('https://flowx365.com/api/demo-request', {
    method: 'POST',
    headers: {
      Origin: 'https://flowx365.com',
      'Content-Type': 'application/json',
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    },
    body: JSON.stringify(body),
    ...init,
  });
}

const configuredEnv = {
  RESEND_API_KEY: 'test-key',
  DEMO_FROM_EMAIL: 'FlowX365 <onboarding@resend.dev>',
  DEMO_TO_EMAIL: 'inbox@example.com',
};

describe('demo request endpoint', () => {
  test('rejects unsupported methods', async () => {
    const response = await handleDemoRequest(
      new Request('https://flowx365.com/api/demo-request', { method: 'GET' }),
      configuredEnv as never,
    );
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('Allow'), 'POST');
  });

  test('returns server field errors for invalid input', async () => {
    const response = await handleDemoRequest(apiRequest({ ...validInput, email: 'invalid' }), configuredEnv as never);
    assert.equal(response.status, 400);
    const body = (await response.json()) as { fieldErrors: Record<string, string> };
    assert.equal(typeof body.fieldErrors.email, 'string');
  });

  test('enforces the rate limit before delivery', async () => {
    const env = {
      ...configuredEnv,
      DEMO_RATE_LIMITER: { limit: async () => ({ success: false }) },
    };
    const response = await handleDemoRequest(apiRequest(validInput), env as never);
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
  });

  test('refuses to send when no recipient is configured', async () => {
    const env = { ...configuredEnv, DEMO_TO_EMAIL: undefined };
    const response = await handleDemoRequest(apiRequest(validInput), env as never);
    assert.equal(response.status, 502);
  });

  test('returns failure when Resend rejects delivery', async () => {
    globalThis.fetch = async () => new Response('provider failure', { status: 500 });
    const response = await handleDemoRequest(apiRequest(validInput), configuredEnv as never);
    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      ok: false,
      message: 'We could not send your request. Please try again.',
    });
  });

  test('returns success only after Resend accepts the email', async () => {
    let providerPayload: Record<string, unknown> | undefined;
    globalThis.fetch = async (_input, init) => {
      providerPayload = JSON.parse(String(init?.body));
      return Response.json({ id: 'email-test-id' });
    };
    const response = await handleDemoRequest(apiRequest(validInput), configuredEnv as never);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.deepEqual(providerPayload?.to, ['inbox@example.com']);
    assert.equal(providerPayload?.reply_to, 'asha@example.com');
  });
});
