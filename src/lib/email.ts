import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getSiteUrl } from "@/lib/url";
import { locales, routing } from "@/i18n/routing";

const ses = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

type EmailTemplateParts = {
  subject: string;
  heading: string;
  body: string;
  buttonText: string;
  footer: string;
};

// Only ever build links/import message files for a known locale. Any other
// value (e.g. an unvalidated request field) falls back to the default so it
// can't inject into the email HTML or the message-file import path.
function normalizeLocale(locale: string): string {
  return (locales as readonly string[]).includes(locale) ? locale : routing.defaultLocale;
}

// All five fields must be present — the template renders every one, so a
// partial translation must fall back rather than interpolate `undefined`.
function isCompleteTemplate(parts: unknown): parts is EmailTemplateParts {
  const p = parts as Partial<EmailTemplateParts> | undefined;
  return !!(p?.subject && p?.heading && p?.body && p?.buttonText && p?.footer);
}

async function loadEmailTranslations(
  locale: string,
  template: "verify" | "reset",
): Promise<EmailTemplateParts> {
  try {
    const messages = (await import(`../../messages/${locale}.json`)).default;
    const parts = messages.Emails?.[template];
    if (isCompleteTemplate(parts)) return parts;
  } catch {
    // fall through to en
  }
  const fallback = (await import(`../../messages/en.json`)).default;
  const parts = fallback.Emails?.[template];
  if (isCompleteTemplate(parts)) return parts;
  // en is expected to always be complete; fail loudly rather than send an
  // email with `undefined` fields (callers catch + log, so no mail is sent).
  throw new Error(`Missing or incomplete "${template}" email translations`);
}

export function buildHtml(opts: {
  logoSrc: string;
  heading: string;
  body: string;
  buttonText: string;
  link: string;
  footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${opts.heading}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ef;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <img src="${opts.logoSrc}" alt="Sincere Bhakti" width="160" style="display:block;width:160px;height:auto;border:0;" />
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#1a1a1a;text-align:center;">
                ${opts.heading}
              </h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#555555;text-align:center;">
                ${opts.body}
              </p>
              <!-- Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="${opts.link}" style="display:inline-block;background-color:#b8860b;color:#ffffff;font-size:15px;font-weight:500;text-decoration:none;padding:12px 32px;border-radius:8px;">
                      ${opts.buttonText}
                    </a>
                  </td>
                </tr>
              </table>
              <!-- Fallback link -->
              <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#999999;text-align:center;word-break:break-all;">
                <span style="display:block;margin-bottom:4px;">${opts.link}</span>
              </p>
              <hr style="border:none;border-top:1px solid #eeeeee;margin:24px 0;" />
              <p style="margin:0;font-size:13px;line-height:1.5;color:#999999;text-align:center;">
                ${opts.footer}
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding-top:24px;">
              <p style="margin:0;font-size:12px;color:#aaaaaa;">
                Sincere Bhakti &mdash; Dedicated to the teachings of Śrīla Prabhupāda
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
): Promise<void> {
  await ses.send(
    new SendEmailCommand({
      FromEmailAddress: process.env.MAIL_FROM,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: subject },
          Body: { Html: { Data: html } },
        },
      },
    }),
  );
}

export async function sendVerificationEmail(
  to: string,
  token: string,
  locale: string,
): Promise<void> {
  const safeLocale = normalizeLocale(locale);
  const t = await loadEmailTranslations(safeLocale, "verify");
  const siteUrl = getSiteUrl();
  const logoSrc = `${siteUrl}/images/sincere-bhakti-logo-200x137-transparent.png`;
  const link = `${siteUrl}/${safeLocale}/verify-email?token=${encodeURIComponent(token)}`;
  const html = buildHtml({ logoSrc, heading: t.heading, body: t.body, buttonText: t.buttonText, link, footer: t.footer });
  await sendEmail(to, t.subject, html);
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  locale: string,
): Promise<void> {
  const safeLocale = normalizeLocale(locale);
  const t = await loadEmailTranslations(safeLocale, "reset");
  const siteUrl = getSiteUrl();
  const logoSrc = `${siteUrl}/images/sincere-bhakti-logo-200x137-transparent.png`;
  const link = `${siteUrl}/${safeLocale}/reset-password?token=${encodeURIComponent(token)}`;
  const html = buildHtml({ logoSrc, heading: t.heading, body: t.body, buttonText: t.buttonText, link, footer: t.footer });
  await sendEmail(to, t.subject, html);
}
