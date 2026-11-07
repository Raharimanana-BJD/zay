/** @jsxImportSource react */
import { Section, Text } from "@react-email/components";

import { COPY, type MailLocale } from "../copy";
import { BRAND, bodyStyle, headingStyle, Layout, noteStyle } from "./layout";

export interface WelcomeProps {
  locale: MailLocale;
  name: string;
}

export function WelcomeEmail({ name, locale }: WelcomeProps) {
  const copy = COPY[locale];
  return (
    <Layout footer={copy.footer} lang={locale} preview={copy.welcome.preview}>
      <Text style={headingStyle}>{copy.welcome.heading(name)}</Text>
      <Text style={bodyStyle}>{copy.welcome.body}</Text>
      <Section
        style={{
          backgroundColor: BRAND.surface,
          borderLeft: `4px solid ${BRAND.accent}`,
          borderRadius: 12,
          padding: "12px 16px",
        }}
      >
        <Text style={noteStyle}>{copy.welcome.tip}</Text>
      </Section>
    </Layout>
  );
}

WelcomeEmail.PreviewProps = {
  name: "Rakotovao",
  locale: "fr",
} satisfies WelcomeProps;

// biome-ignore lint/complexity/noRedundantDefaultExport: the React Email preview server reads the default export.
export default WelcomeEmail;
