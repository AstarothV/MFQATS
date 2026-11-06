# Branded sign-in emails

The emails Supabase sends (confirm sign-up, reset password, and the rest), styled like MVCA WoodWorks: logo, violet
button, greeting by name, a backup link, and a clear note for when you did not ask for the email.

## Put them in Supabase

1. Merge this to `main` first, so the logo (`public/assets/images/email_logo.png`) is live on the website. The emails
   load it from `https://mfqats-tau.vercel.app/assets/images/email_logo.png`.
2. In Supabase: **Authentication → Emails**.
3. For each template below: open it, set the **Subject**, replace the **Message body** with everything in the `.html`
   file, and **Save**.

| Supabase template | File | Subject |
|---|---|---|
| Confirm sign up | `confirm-signup.html` | Confirm your MVCA WoodWorks account |
| Invite user | `invite.html` | You are invited to MVCA WoodWorks |
| Magic link | `magic-link.html` | Your MVCA WoodWorks sign-in link |
| Change email address | `change-email.html` | Confirm your new email for MVCA WoodWorks |
| Reset password | `reset-password.html` | Reset your MVCA WoodWorks password |
| Reauthentication | `reauthentication.html` | Your MVCA WoodWorks confirmation code |

Words in `{{ }}` (like `{{ .ConfirmationURL }}`) are filled in by Supabase: leave them as they are.

## Sender name and the "powered by Supabase" line

Supabase's built-in mailer always sends as "Supabase Auth", adds its own footer, sends only a few emails an hour, and
may only deliver to your Supabase team. To send as "MVCA WoodWorks" to anyone, add your own sender in
**Authentication → Emails → SMTP Settings** (for example Gmail with an app password, or Brevo).

## Changing them

Edit `build.py` (the shared layout and the wording of each email), then run:

```
python supabase/email-templates/build.py
```

and paste the updated files into Supabase again.
