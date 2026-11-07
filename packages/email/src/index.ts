import { render } from "@react-email/render";
import { createTransport } from "nodemailer";
import type { ReactElement } from "react";
import { createElement } from "react";

import { COPY, type MailLocale, type OtpPurpose } from "./copy";
import { OtpCodeEmail } from "./templates/otp-code";
import { WelcomeEmail } from "./templates/welcome";

export interface MailerConfig {
  /** For example `Zay <no-reply@zay.mg>`. */
  MAIL_FROM: string;
  /** For example `smtp://user:pass@smtp.example.com:587`, or `smtps://…` for port 465. */
  SMTP_URL: string;
}

export type Mailer = ReturnType<typeof createMailer>;

export function createMailer(config: MailerConfig) {
  const transport = createTransport(config.SMTP_URL);

  const send = async (to: string, subject: string, element: ReactElement) => {
    const [html, text] = await Promise.all([
      render(element),
      render(element, { plainText: true }),
    ]);
    await transport.sendMail({
      from: config.MAIL_FROM,
      to,
      subject,
      html,
      text,
    });
  };

  return {
    sendOtp: (input: {
      to: string;
      code: string;
      purpose: OtpPurpose;
      locale: MailLocale;
      expiresInMinutes: number;
    }) =>
      send(
        input.to,
        COPY[input.locale].otp[input.purpose].subject,
        createElement(OtpCodeEmail, {
          code: input.code,
          purpose: input.purpose,
          locale: input.locale,
          expiresInMinutes: input.expiresInMinutes,
        })
      ),
    sendWelcome: (input: { to: string; name: string; locale: MailLocale }) =>
      send(
        input.to,
        COPY[input.locale].welcome.subject,
        createElement(WelcomeEmail, { name: input.name, locale: input.locale })
      ),
  };
}
