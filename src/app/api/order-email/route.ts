// Called by the database (migration 032) when a customer gets a notification about their order: emails it to them.
// Only the database knows the shared secret, so nobody else can make the site send email.
import nodemailer from 'nodemailer';
import { buildOrderEmail } from '@/lib/orderEmail';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const secret = process.env.ORDER_EMAIL_SECRET;
  if (!secret || request.headers.get('x-email-secret') !== secret) return new Response('Forbidden', { status: 403 });
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return new Response('Email is not set up (GMAIL_USER / GMAIL_APP_PASSWORD)', { status: 503 });

  const body = await request.json().catch(() => null);
  if (!body?.to || !body?.title || !body?.message || !body?.order_id) return new Response('Missing fields', { status: 400 });

  const mail = buildOrderEmail(
    { to: body.to, name: body.name, title: body.title, message: body.message, orderRef: body.order_ref, orderId: body.order_id },
    process.env.SITE_URL || new URL(request.url).origin,
  );
  try {
    await nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } })
      .sendMail({ from: `"MVCA WoodWorks" <${user}>`, to: body.to, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (e) {
    // Gmail's own reason (e.g. "EAUTH 535 ... Username and Password not accepted", "ETIMEDOUT"), never the password,
    // so the database's net._http_response shows why without needing Vercel's short-lived logs
    const err = e as Error & { code?: string; responseCode?: number; response?: string };
    const reason = [err.code, err.responseCode, (err.response || err.message || '').replace(/\s+/g, ' ')].filter(Boolean).join(' ').slice(0, 300);
    console.error('[order-email]', reason);
    return new Response(`Could not send: ${reason}`, { status: 502 });
  }
  return Response.json({ sent: true });
}
