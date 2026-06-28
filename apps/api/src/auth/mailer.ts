/**
 * auth/mailer.ts — the email-sending port for magic-link sign-in. Production uses a real
 * provider (Resend, called over its plain HTTP API so we add no SDK dependency); with no
 * provider configured we fall back to logging the link to the server console so local dev
 * and ops still have a way through. The handlers depend only on the `Mailer` interface.
 */

export interface Mailer {
  sendMagicLink(to: string, link: string): Promise<void>;
}

/** Fallback: log the link. A developer (or an admin reading prod logs) can follow it. */
export const consoleMailer: Mailer = {
  async sendMagicLink(to, link) {
    console.info(`[amabo] magic sign-in link for ${to}:\n         ${link}`);
  },
};

const SUBJECT = 'Your Amabo sign-in link';
const text = (link: string) =>
  `Tap to sign in to the Amarium:\n\n${link}\n\nThis link expires in 15 minutes. ` +
  `If you didn't ask to sign in, you can safely ignore this email.`;
const html = (link: string) =>
  `<p>Tap to sign in to the Amarium:</p>` +
  `<p><a href="${link}">Sign in to Amabo</a></p>` +
  `<p style="color:#888;font-size:12px">This link expires in 15 minutes. ` +
  `If you didn't ask to sign in, you can safely ignore this email.</p>`;

/** Resend (https://resend.com) via its HTTP API. `from` must be a verified sender. */
export function resendMailer(apiKey: string, from: string): Mailer {
  return {
    async sendMagicLink(to, link) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ from, to, subject: SUBJECT, text: text(link), html: html(link) }),
      });
      if (!res.ok) {
        throw new Error(`resend ${res.status}: ${await res.text().catch(() => '')}`);
      }
    },
  };
}
