/** @jsxImportSource react */
import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

/** Colors of the Zay redesign: black, warm off white, taxi yellow. */
export const BRAND = {
  ink: "#0a0a0a",
  muted: "#6b6760",
  surface: "#f5f3ee",
  card: "#ffffff",
  accent: "#f5c518",
} as const;

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export function Layout({
  lang,
  preview,
  footer,
  children,
}: {
  lang: string;
  preview: string;
  footer: string;
  children: ReactNode;
}) {
  return (
    <Html lang={lang}>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{
          backgroundColor: BRAND.surface,
          fontFamily: FONT,
          margin: 0,
          padding: "32px 16px",
        }}
      >
        <Container style={{ maxWidth: 480, margin: "0 auto" }}>
          <Text
            style={{
              color: BRAND.ink,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: -0.5,
              margin: "0 0 24px",
            }}
          >
            Zay<span style={{ color: BRAND.accent }}>.</span>
          </Text>
          <Section
            style={{
              backgroundColor: BRAND.card,
              borderRadius: 20,
              padding: "32px 28px",
            }}
          >
            {children}
          </Section>
          <Hr style={{ borderColor: "#e4e0d8", margin: "28px 0 16px" }} />
          <Text style={{ color: BRAND.muted, fontSize: 12, margin: 0 }}>
            {footer}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const headingStyle = {
  color: BRAND.ink,
  fontSize: 22,
  fontWeight: 800,
  lineHeight: "28px",
  margin: "0 0 12px",
} as const;

export const bodyStyle = {
  color: "#3a3833",
  fontSize: 15,
  lineHeight: "22px",
  margin: "0 0 16px",
} as const;

export const noteStyle = {
  color: BRAND.muted,
  fontSize: 13,
  lineHeight: "20px",
  margin: "0",
} as const;
