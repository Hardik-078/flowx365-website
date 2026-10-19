export const DEMO_SERVICES = [
  'Full FlowX365 demo',
  'CRM and sales',
  'Purchase and inventory',
  'Invoicing and accounting',
  'Planner and HR',
] as const;

export type DemoService = (typeof DEMO_SERVICES)[number];

export interface DemoRequest {
  fullName: string;
  email: string;
  phone: string;
  company: string;
  service: DemoService;
  requirement: string;
  website: string;
}

export type DemoField = keyof DemoRequest;

export type ValidationResult =
  | { ok: true; data: DemoRequest }
  | { ok: false; fieldErrors: Partial<Record<DemoField, string>> };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d\s().-]+$/;

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateDemoRequest(value: unknown): ValidationResult {
  const input = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const data = {
    fullName: stringValue(input.fullName),
    email: stringValue(input.email).toLowerCase(),
    phone: stringValue(input.phone),
    company: stringValue(input.company),
    service: stringValue(input.service),
    requirement: stringValue(input.requirement),
    website: stringValue(input.website),
  };
  const fieldErrors: Partial<Record<DemoField, string>> = {};

  if (!data.fullName) fieldErrors.fullName = 'Enter your full name.';
  else if (data.fullName.length > 100) fieldErrors.fullName = 'Use 100 characters or fewer.';
  else if (/\r|\n/.test(data.fullName)) fieldErrors.fullName = 'Enter your name on one line.';

  if (!data.email) fieldErrors.email = 'Enter your email address.';
  else if (data.email.length > 254 || !EMAIL_PATTERN.test(data.email) || /\r|\n/.test(data.email)) {
    fieldErrors.email = 'Enter a valid email address.';
  }

  const phoneDigits = data.phone.replace(/\D/g, '');
  if (!data.phone) fieldErrors.phone = 'Enter your phone number.';
  else if (
    data.phone.length > 32 ||
    !PHONE_PATTERN.test(data.phone) ||
    phoneDigits.length < 7 ||
    phoneDigits.length > 15
  ) {
    fieldErrors.phone = 'Enter a valid phone number, including the country code if needed.';
  }

  if (data.company.length > 120) fieldErrors.company = 'Use 120 characters or fewer.';

  if (!data.service) fieldErrors.service = 'Select a service.';
  else if (!DEMO_SERVICES.includes(data.service as DemoService)) {
    fieldErrors.service = 'Select a service from the list.';
  }

  if (data.requirement.length > 2000) {
    fieldErrors.requirement = 'Use 2,000 characters or fewer.';
  }

  if (data.website) fieldErrors.website = 'We could not submit this request.';

  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors };
  return { ok: true, data: data as DemoRequest };
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
  );
}

function safeSubjectName(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 100);
}

export interface ResendEmail {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  html: string;
  text: string;
}

export function buildDemoEmail(
  data: DemoRequest,
  from: string,
  to: string,
  submittedAt = new Date(),
): ResendEmail {
  const timestamp = submittedAt.toISOString();
  const rows: Array<[string, string]> = [
    ['Full name', data.fullName],
    ['Email address', data.email],
    ['Phone number', data.phone],
    ...(data.company ? ([['Company name', data.company]] as Array<[string, string]>) : []),
    ['Service required', data.service],
    ...(data.requirement
      ? ([['Requirement', data.requirement]] as Array<[string, string]>)
      : []),
    ['Submitted at', timestamp],
  ];

  const text = rows.map(([label, content]) => `${label}:\n${content}`).join('\n\n');
  const htmlRows = rows
    .map(
      ([label, content]) => `
        <tr>
          <th style="padding:12px 16px;text-align:left;vertical-align:top;color:#5b6472;font-size:13px;font-weight:600;border-bottom:1px solid #e4e7ec;">${escapeHtml(label)}</th>
          <td style="padding:12px 16px;color:#111827;font-size:15px;line-height:1.5;border-bottom:1px solid #e4e7ec;white-space:pre-wrap;">${escapeHtml(content)}</td>
        </tr>`,
    )
    .join('');

  return {
    from,
    to: [to],
    reply_to: data.email,
    subject: `New Flowx365 Demo Request - ${safeSubjectName(data.fullName)}`,
    text,
    html: `<!doctype html>
      <html lang="en">
        <body style="margin:0;padding:32px;background:#f0f2f8;font-family:Arial,sans-serif;">
          <div style="max-width:680px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
            <div style="padding:24px 28px;background:#0f1520;color:#f7f8fa;">
              <p style="margin:0 0 6px;color:#f5820a;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">FlowX365</p>
              <h1 style="margin:0;font-size:24px;line-height:1.2;">New demo request</h1>
            </div>
            <table role="presentation" style="width:100%;border-collapse:collapse;">${htmlRows}</table>
          </div>
        </body>
      </html>`,
  };
}
