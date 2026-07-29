import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { getSiteUrl } from "@/lib/url";

const ses = new SESv2Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

type EmailTemplate = "verify" | "reset";

function emailTemplate(
  template: EmailTemplate,
  params: { link: string; locale: string },
): { subject: string; html: string } {
  const siteUrl = getSiteUrl();
  const logoSrc = `${siteUrl}/images/sincere-bhakti-logo-200x137-transparent.png`;

  if (template === "verify") {
    const subject =
      params.locale === "cs"
        ? "Ověřte svůj e-mail — Sincere Bhakti"
        : params.locale === "sk"
          ? "Overte svoj e-mail — Sincere Bhakti"
          : "Verify your email — Sincere Bhakti";

    const heading =
      params.locale === "cs"
        ? "Ověřte svůj e-mail"
        : params.locale === "sk"
          ? "Overte svoj e-mail"
          : "Verify your email";

    const body =
      params.locale === "cs"
        ? "Děkujeme za registraci do Sincere Bhakti. Klikněte na tlačítko níže pro ověření vaší e-mailové adresy a dokončení registrace."
        : params.locale === "sk"
          ? "Ďakujeme za registráciu do Sincere Bhakti. Kliknite na tlačidlo nižšie pre overenie vašej e-mailovej adresy a dokončenie registrácie."
          : "Thank you for registering on Sincere Bhakti. Click the button below to verify your email address and complete your registration.";

    const buttonText =
      params.locale === "cs"
        ? "Ověřit e-mail"
        : params.locale === "sk"
          ? "Overiť e-mail"
          : "Verify Email";

    const footer =
      params.locale === "cs"
        ? "Pokud jste si nevytvořili účet na Sincere Bhakti, můžete tento e-mail ignorovat."
        : params.locale === "sk"
          ? "Ak ste si nevytvorili účet na Sincere Bhakti, tento e-mail môžete ignorovať."
          : "If you did not create an account on Sincere Bhakti, you can ignore this email.";

    return {
      subject,
      html: buildHtml({ logoSrc, heading, body, buttonText, link: params.link, footer }),
    };
  }

  // reset
  const subject =
    params.locale === "cs"
      ? "Obnovení hesla — Sincere Bhakti"
      : params.locale === "sk"
        ? "Obnovenie hesla — Sincere Bhakti"
        : "Reset your password — Sincere Bhakti";

  const heading =
    params.locale === "cs"
      ? "Obnovení hesla"
      : params.locale === "sk"
        ? "Obnovenie hesla"
        : "Reset your password";

  const body =
    params.locale === "cs"
      ? "Obdrželi jsme žádost o obnovení hesla pro váš účet Sincere Bhakti. Klikněte na tlačítko níže pro nastavení nového hesla."
      : params.locale === "sk"
        ? "Obdržali sme žiadosť o obnovenie hesla pre váš účet Sincere Bhakti. Kliknite na tlačidlo nižšie pre nastavenie nového hesla."
        : "We received a request to reset the password for your Sincere Bhakti account. Click the button below to set a new password.";

  const buttonText =
    params.locale === "cs"
      ? "Obnovit heslo"
      : params.locale === "sk"
        ? "Obnoviť heslo"
        : "Reset Password";

  const footer =
    params.locale === "cs"
      ? "Pokud jste o obnovení hesla nežádali, můžete tento e-mail ignorovat. Vaše heslo zůstane beze změny."
      : params.locale === "sk"
        ? "Ak ste o obnovenie hesla nežiadali, tento e-mail môžete ignorovať. Vaše heslo zostane nezmenené."
        : "If you did not request a password reset, you can ignore this email. Your password will remain unchanged.";

  return {
    subject,
    html: buildHtml({ logoSrc, heading, body, buttonText, link: params.link, footer }),
  };
}

function buildHtml(opts: {
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

export async function sendVerificationEmail(
  to: string,
  token: string,
  locale: string,
): Promise<void> {
  const siteUrl = getSiteUrl();
  const link = `${siteUrl}/${locale}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmail(to, "verify", { link, locale });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string,
  locale: string,
): Promise<void> {
  const siteUrl = getSiteUrl();
  const link = `${siteUrl}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail(to, "reset", { link, locale });
}

async function sendEmail(
  to: string,
  template: EmailTemplate,
  params: { link: string; locale: string },
): Promise<void> {
  const { subject, html } = emailTemplate(template, params);

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
