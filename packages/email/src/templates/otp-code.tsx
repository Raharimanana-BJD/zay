/** @jsxImportSource react */
import { Section, Text } from "@react-email/components";

import { COPY, type MailLocale, type OtpPurpose } from "../copy";
import { BRAND, bodyStyle, headingStyle, Layout, noteStyle } from "./layout";

export interface OtpCodeProps {
  code: string;
  expiresInMinutes: number;
  locale: MailLocale;
  purpose: OtpPurpose;
}

export function OtpCodeEmail({
  code,
  purpose,
  locale,
  expiresInMinutes,
}: OtpCodeProps) {
  const copy = COPY[locale];
  const text = copy.otp[purpose];
  return (
    <Layout footer={copy.footer} lang={locale} preview={text.preview}>
      <Text style={headingStyle}>{text.heading}</Text>
      <Text style={bodyStyle}>{text.intro}</Text>
      <Section
        style={{
          backgroundColor: BRAND.surface,
          borderRadius: 14,
          margin: "8px 0 20px",
          padding: "18px 0",
          textAlign: "center",
        }}
      >
        <Text
          style={{
            color: BRAND.ink,
            fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: 10,
            margin: 0,
          }}
        >
          {code}
        </Text>
      </Section>
      <Text style={{ ...noteStyle, marginBottom: 8 }}>
        {text.expiry(expiresInMinutes)}
      </Text>
      <Text style={noteStyle}>{text.ignore}</Text>
    </Layout>
  );
}

OtpCodeEmail.PreviewProps = {
  code: "482913",
  purpose: "email-verification",
  locale: "fr",
  expiresInMinutes: 10,
} satisfies OtpCodeProps;

// biome-ignore lint/complexity/noRedundantDefaultExport: the React Email preview server reads the default export.
export default OtpCodeEmail;
