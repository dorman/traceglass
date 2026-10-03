// @polsia:user-owned — local captured-mail and submission fixture for browser journeys.
import { createServer, type Server } from 'node:http';

export interface CapturedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface CapturedEmailAttempt extends CapturedEmail {
  status: number;
}

export interface CapturedSubmission {
  source: string;
  email: string;
  idempotencyKey?: string;
  recorded: boolean;
  status: number;
}

export type CapturedProxyEvent =
  | { kind: 'submission'; email: string; status: number }
  | { kind: 'email'; to: string; body: string; status: number };

type SubmissionOutcome = 'recorded' | 'not-recorded' | 'error';

interface ProxyRequest {
  to?: unknown;
  subject?: unknown;
  html?: unknown;
  body?: unknown;
  source?: unknown;
  email?: unknown;
  idempotency_key?: unknown;
}

const port = Number(process.env.POLSIA_TEST_EMAIL_PROXY_PORT ?? '43987');
const capturedEmails: CapturedEmail[] = [];
const emailAttempts: CapturedEmailAttempt[] = [];
const submissions: CapturedSubmission[] = [];
const proxyEvents: CapturedProxyEvent[] = [];
let server: Server | undefined;
let failNextDelivery = false;
let nextSubmissionOutcome: SubmissionOutcome = 'recorded';

function isProxyRequest(value: unknown): value is ProxyRequest {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRequest(chunks: Buffer[]): ProxyRequest | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    return isProxyRequest(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function emailFrom(value: unknown) {
  return typeof value === 'string' ? value : '';
}

export async function startCapturedEmailProxy() {
  if (server?.listening) return;
  server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    if (request.method !== 'POST' || !['/send', '/submissions'].includes(requestUrl.pathname)) {
      response.writeHead(404).end();
      return;
    }

    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    request.on('end', () => {
      const body = parseRequest(chunks);
      if (!body) {
        response.writeHead(400).end();
        return;
      }

      if (requestUrl.pathname === '/submissions') {
        const email = emailFrom(body.email);
        const outcome = nextSubmissionOutcome;
        nextSubmissionOutcome = 'recorded';
        const status = outcome === 'error' ? 503 : 200;
        const recorded = outcome === 'recorded';
        submissions.push({
          source: emailFrom(body.source),
          email,
          ...(typeof body.idempotency_key === 'string'
            ? { idempotencyKey: body.idempotency_key }
            : {}),
          recorded,
          status,
        });
        proxyEvents.push({ kind: 'submission', email, status });

        if (outcome === 'error') {
          response.writeHead(503, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: 'Synthetic submission intake failure' }));
          return;
        }
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ success: true, recorded }));
        return;
      }

      if (
        typeof body.to !== 'string' ||
        typeof body.subject !== 'string' ||
        typeof body.html !== 'string'
      ) {
        response.writeHead(400).end();
        return;
      }

      const email = emailFrom(body.to);
      const attempt: CapturedEmailAttempt = {
        to: email,
        subject: body.subject,
        html: body.html,
        text: typeof body.body === 'string' ? body.body : '',
        status: failNextDelivery ? 503 : 200,
      };
      failNextDelivery = false;
      emailAttempts.push(attempt);
      proxyEvents.push({ kind: 'email', to: email, body: attempt.text, status: attempt.status });

      if (attempt.status === 503) {
        response.writeHead(503, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: 'Synthetic mail delivery failure' }));
        return;
      }

      capturedEmails.push({
        to: attempt.to,
        subject: attempt.subject,
        html: attempt.html,
        text: attempt.text,
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ success: true, email_id: `captured-${capturedEmails.length}` }));
    });
  });

  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(port, '127.0.0.1', resolve);
  });
}

export async function stopCapturedEmailProxy() {
  if (!server?.listening) return;
  await new Promise<void>((resolve, reject) => {
    server?.close((error) => (error ? reject(error) : resolve()));
  });
  server = undefined;
}

export function clearCapturedEmails() {
  capturedEmails.length = 0;
}

export function clearCapturedProxyEvents() {
  capturedEmails.length = 0;
  emailAttempts.length = 0;
  submissions.length = 0;
  proxyEvents.length = 0;
  failNextDelivery = false;
  nextSubmissionOutcome = 'recorded';
}

export function capturedEmail(subject: string) {
  return [...capturedEmails].reverse().find((email) => email.subject.includes(subject));
}

export function capturedEmailCount() {
  return capturedEmails.length;
}

export function capturedEmailAttempts() {
  return [...emailAttempts];
}

export function capturedSubmissions() {
  return [...submissions];
}

export function capturedProxyEvents() {
  return [...proxyEvents];
}

export function failNextCapturedDelivery() {
  failNextDelivery = true;
}

export function setNextSubmissionOutcome(outcome: SubmissionOutcome) {
  nextSubmissionOutcome = outcome;
}

export function emailLink(email: CapturedEmail) {
  const match = /href="([^"]+)"/.exec(email.html);
  if (!match?.[1]) throw new Error(`No link was captured in the ${email.subject} email`);
  return new URL(match[1].replaceAll('&amp;', '&').replaceAll('&quot;', '"'));
}

export async function waitForCapturedEmail(subject: string, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const email = capturedEmail(subject);
    if (email) return email;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for the ${subject} email`);
}
