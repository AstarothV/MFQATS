"""
Builds the six Supabase auth emails from one layout, so they all look like MVCA WoodWorks.

    python supabase/email-templates/build.py

Then paste each .html into Supabase: Authentication -> Emails -> (template) -> Message body, with the subject from
SUBJECTS below (also listed in README.md). Placeholders like {{ .ConfirmationURL }} are filled in by Supabase.

Email apps ignore normal website styling, so everything is tables and inline styles, with system fonts as fallback.
"""
import os

LOGO = 'https://mfqats-tau.vercel.app/assets/images/email_logo.png'
VIOLET, VIOLET_DARK = '#7C3AED', '#6D28D9'
PAGE, CARD, INK, MUTED, LINE = '#F3F0F8', '#FFFFFF', '#1C1830', '#6B6680', '#E9E4F5'
FONT = "'DM Sans', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"

# greeting: the name given at sign-up, else a plain hello (older accounts have no name saved)
HELLO = '{{ if .Data.full_name }}Hi {{ .Data.full_name }},{{ else }}Hi there,{{ end }}'


def button(label, url='{{ .ConfirmationURL }}'):
    return f'''
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
            <tr>
              <td align="center" bgcolor="{VIOLET}" style="border-radius:12px; background:{VIOLET}; background-image:linear-gradient(180deg,#8B5CF6,{VIOLET});">
                <a href="{url}" target="_blank" style="display:inline-block; padding:14px 28px; font-family:{FONT}; font-size:16px; font-weight:700; color:#FFFFFF; text-decoration:none; border-radius:12px;">{label}</a>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0; font-family:{FONT}; font-size:12px; line-height:18px; color:{MUTED};">
            Button not working? Copy this link into your browser:<br>
            <a href="{url}" target="_blank" style="color:{VIOLET_DARK}; word-break:break-all;">{url}</a>
          </p>'''


def code_box(label='Your code'):
    return f'''
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin:24px 0 8px;">
            <tr>
              <td align="center" style="border:1px solid {LINE}; border-radius:14px; background:#F8F5FF; padding:18px;">
                <p style="margin:0 0 6px; font-family:{FONT}; font-size:12px; font-weight:600; letter-spacing:1.5px; text-transform:uppercase; color:{MUTED};">{label}</p>
                <p style="margin:0; font-family:'Courier New', monospace; font-size:32px; font-weight:700; letter-spacing:8px; color:{INK};">{{{{ .Token }}}}</p>
              </td>
            </tr>
          </table>'''


def page(title, preheader, heading, body_html, note):
    return f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  <title>{title}</title>
</head>
<body style="margin:0; padding:0; background:{PAGE};">
  <!-- preview text shown next to the subject in the inbox -->
  <div style="display:none; max-height:0; overflow:hidden; opacity:0;">{preheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="{PAGE}" style="background:{PAGE};">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <!-- brand -->
          <tr>
            <td style="padding:0 4px 18px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;"><img src="{LOGO}" width="40" height="40" alt="MVCA WoodWorks" style="display:block; border:0;"></td>
                  <td style="vertical-align:middle; padding-left:10px; font-family:{FONT};">
                    <span style="font-size:17px; font-weight:700; color:{INK};">MVCA WoodWorks</span><br>
                    <span style="font-size:12px; color:{MUTED};">Quality Assurance &amp; Tracking</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- card -->
          <tr>
            <td bgcolor="{CARD}" style="background:{CARD}; border:1px solid {LINE}; border-radius:20px; overflow:hidden;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr><td style="height:5px; line-height:5px; font-size:0; background:{VIOLET}; background-image:linear-gradient(90deg,{VIOLET},#A78BFA); border-radius:20px 20px 0 0;">&nbsp;</td></tr>
                <tr>
                  <td style="padding:32px 32px 28px;">
                    <h1 style="margin:0 0 16px; font-family:{FONT}; font-size:24px; line-height:30px; font-weight:700; color:{INK};">{heading}</h1>
                    <p style="margin:0 0 12px; font-family:{FONT}; font-size:15px; line-height:24px; color:{INK};">{HELLO}</p>
{body_html}
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 32px 24px; border-top:1px solid {LINE};">
                    <p style="margin:0; font-family:{FONT}; font-size:13px; line-height:20px; color:{MUTED};">{note}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- footer -->
          <tr>
            <td align="center" style="padding:20px 8px 0; font-family:{FONT}; font-size:12px; line-height:18px; color:{MUTED};">
              MVCA WoodWorks &middot; Handcrafted furniture, inspected before delivery<br>
              This email was sent to {{{{ .Email }}}}.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
'''


def p(text):
    return f'          <p style="margin:0 0 12px; font-family:{FONT}; font-size:15px; line-height:24px; color:{INK};">{text}</p>'


TEMPLATES = {
    'confirm-signup': ('Confirm your MVCA WoodWorks account', page(
        'Confirm your email', 'One click to finish setting up your MVCA WoodWorks account.',
        'Confirm your email',
        p('Thanks for creating an account with MVCA WoodWorks. Confirm your email so you can sign in, order furniture and follow every stage of its inspection.')
        + button('Confirm my email'),
        "Didn't create an account? You can ignore this email; nothing happens without your click.")),
    'invite': ('You are invited to MVCA WoodWorks', page(
        'You are invited', 'An admin added you to MVCA WoodWorks.',
        'You are invited to MVCA WoodWorks',
        p('An admin added you to the MVCA WoodWorks system. Accept the invite to set up your account and sign in.')
        + button('Accept the invite'),
        "Not expecting this? You can ignore this email and no account is set up.")),
    'magic-link': ('Your MVCA WoodWorks sign-in link', page(
        'Your sign-in link', 'Sign in to MVCA WoodWorks with one click or a code.',
        'Sign in to MVCA WoodWorks',
        p('Use the button to sign in, or type the code on the sign-in page.')
        + button('Sign in') + code_box('Or enter this code'),
        "Didn't ask to sign in? You can ignore this email. The link and code only work once and expire soon.")),
    'change-email': ('Confirm your new email for MVCA WoodWorks', page(
        'Confirm your new email', 'Confirm the change to your sign-in email.',
        'Confirm your new email',
        p('You asked to change the email you sign in with, from <strong>{{ .Email }}</strong> to <strong>{{ .NewEmail }}</strong>. Confirm it to finish the change.')
        + button('Confirm new email'),
        "Didn't ask for this? Don't click the button, and reset your password with Forgot password? on the sign-in page to keep your account safe.")),
    'reset-password': ('Reset your MVCA WoodWorks password', page(
        'Reset your password', 'A link to choose a new password for MVCA WoodWorks.',
        'Reset your password',
        p('We got a request to reset the password for <strong>{{ .Email }}</strong>. Choose a new one with the button below.')
        # works in any browser or phone (see src/app/auth/reset/route.ts); RedirectTo is that site's /auth/reset
        + button('Reset my password', '{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery')
        + f'\n          <p style="margin:16px 0 0; font-family:{FONT}; font-size:13px; line-height:20px; color:{INK}; background:#F8F5FF; border:1px solid {LINE}; border-radius:12px; padding:12px 14px;">The link works once, for 1 hour, on any phone or computer.</p>',
        "Didn't ask for a reset? You can ignore this email; your password stays the same.")),
    'reauthentication': ('Your MVCA WoodWorks confirmation code', page(
        'Confirm it is you', 'Your code to confirm this change.',
        'Confirm it is you',
        p('Enter this code to confirm the change you are making to your account.')
        + code_box('Confirmation code'),
        "Didn't ask for a code? Someone may know your password: reset it with Forgot password? on the sign-in page.")),
}

if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    for name, (subject, html) in TEMPLATES.items():
        open(os.path.join(here, f'{name}.html'), 'w', encoding='utf-8', newline='\n').write(html)
        print(f'{name}.html  ({len(html):,} bytes)  subject: {subject}')
