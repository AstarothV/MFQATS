// The email a customer gets when the system notifies them about their order (same look as the sign-in emails).

export interface OrderEmail { to: string; name?: string | null; title: string; message: string; orderRef?: string | null; orderId: string }

const VIOLET = '#7C3AED', VIOLET_DARK = '#6D28D9', PAGE = '#F3F0F8', INK = '#1C1830', MUTED = '#6B6680', LINE = '#E9E4F5';
const FONT = "'DM Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildOrderEmail(e: OrderEmail, site: string) {
  const link = `${site}/customer-dashboard/order-view?order=${encodeURIComponent(e.orderId)}`;
  const subject = e.orderRef ? `${e.title} · ${e.orderRef}` : e.title;
  const hello = e.name?.trim() ? `Hi ${esc(e.name.trim())},` : 'Hi there,';
  const text = `${hello}\n\n${e.message}\n\nView your order: ${link}\n\nMVCA WoodWorks`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0; padding:0; background:${PAGE};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${esc(e.message)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${PAGE}" style="background:${PAGE};"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 18px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="${site}/assets/images/email_logo.png" width="40" height="40" alt="MVCA WoodWorks" style="display:block; border:0;"></td>
        <td style="vertical-align:middle; padding-left:10px; font-family:${FONT};"><span style="font-size:17px; font-weight:700; color:${INK};">MVCA WoodWorks</span><br><span style="font-size:12px; color:${MUTED};">Quality Assurance &amp; Tracking</span></td>
      </tr></table></td></tr>
      <tr><td bgcolor="#FFFFFF" style="background:#FFFFFF; border:1px solid ${LINE}; border-radius:20px; overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="height:5px; line-height:5px; font-size:0; background:${VIOLET}; background-image:linear-gradient(90deg,${VIOLET},#A78BFA); border-radius:20px 20px 0 0;">&nbsp;</td></tr>
          <tr><td style="padding:32px 32px 28px;">
            <h1 style="margin:0 0 16px; font-family:${FONT}; font-size:22px; line-height:30px; font-weight:700; color:${INK};">${esc(e.title)}</h1>
            <p style="margin:0 0 12px; font-family:${FONT}; font-size:15px; line-height:24px; color:${INK};">${hello}</p>
            <p style="margin:0 0 12px; font-family:${FONT}; font-size:15px; line-height:24px; color:${INK};">${esc(e.message)}</p>
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0 8px;"><tr><td align="center" bgcolor="${VIOLET}" style="border-radius:12px; background:${VIOLET};">
              <a href="${link}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:${FONT}; font-size:16px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:12px;">View your order</a>
            </td></tr></table>
            <p style="margin:16px 0 0; font-family:${FONT}; font-size:12px; line-height:18px; color:${MUTED};">Button not working? Copy this link into your browser:<br><a href="${link}" target="_blank" style="color:${VIOLET_DARK}; word-break:break-all;">${link}</a></p>
          </td></tr>
          <tr><td style="padding:16px 32px 24px; border-top:1px solid ${LINE};"><p style="margin:0; font-family:${FONT}; font-size:13px; line-height:20px; color:${MUTED};">You get this email because you have an order with MVCA WoodWorks. The same update is in the bell icon when you sign in.</p></td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:20px 8px 0; font-family:${FONT}; font-size:12px; line-height:18px; color:${MUTED};">MVCA WoodWorks &middot; Handcrafted furniture, inspected before delivery<br>This email was sent to ${esc(e.to)}.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, html, text, link };
}

/** The two-step sign-in code by email (migration 037): same look, the code large, no link to click. */
export function buildCodeEmail(e: { to: string; name?: string | null; code: string }, site: string) {
  const subject = `${e.code} is your MVCA WoodWorks sign-in code`;
  const hello = e.name?.trim() ? `Hi ${esc(e.name.trim())},` : 'Hi there,';
  const text = `${hello}\n\nYour sign-in code is ${e.code}. It works for 10 minutes.\n\nIf you did not try to sign in, change your password: someone may know it.\n\nMVCA WoodWorks`;
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0; padding:0; background:${PAGE};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${PAGE}" style="background:${PAGE};"><tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
      <tr><td style="padding:0 4px 18px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
        <td style="vertical-align:middle;"><img src="${site}/assets/images/email_logo.png" width="40" height="40" alt="MVCA WoodWorks" style="display:block; border:0;"></td>
        <td style="vertical-align:middle; padding-left:10px; font-family:${FONT};"><span style="font-size:17px; font-weight:700; color:${INK};">MVCA WoodWorks</span><br><span style="font-size:12px; color:${MUTED};">Quality Assurance &amp; Tracking</span></td>
      </tr></table></td></tr>
      <tr><td bgcolor="#FFFFFF" style="background:#FFFFFF; border:1px solid ${LINE}; border-radius:20px; overflow:hidden;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
          <tr><td style="height:5px; line-height:5px; font-size:0; background:${VIOLET}; background-image:linear-gradient(90deg,${VIOLET},#A78BFA); border-radius:20px 20px 0 0;">&nbsp;</td></tr>
          <tr><td style="padding:32px 32px 28px;">
            <h1 style="margin:0 0 16px; font-family:${FONT}; font-size:22px; line-height:30px; font-weight:700; color:${INK};">Your sign-in code</h1>
            <p style="margin:0 0 12px; font-family:${FONT}; font-size:15px; line-height:24px; color:${INK};">${hello}</p>
            <p style="margin:0 0 20px; font-family:${FONT}; font-size:15px; line-height:24px; color:${INK};">Enter this code to finish signing in. It works for 10 minutes.</p>
            <p style="margin:0 0 20px; font-family:${FONT}; font-size:34px; line-height:40px; font-weight:700; letter-spacing:8px; color:${VIOLET_DARK};">${esc(e.code)}</p>
            <p style="margin:0; font-family:${FONT}; font-size:13px; line-height:20px; color:${MUTED};">If you did not try to sign in, change your password: someone may know it. Never share this code.</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td align="center" style="padding:20px 8px 0; font-family:${FONT}; font-size:12px; line-height:18px; color:${MUTED};">MVCA WoodWorks &middot; This email was sent to ${esc(e.to)}.</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { subject, html, text };
}
