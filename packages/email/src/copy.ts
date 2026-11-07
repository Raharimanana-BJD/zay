export type MailLocale = "fr" | "mg";
export type OtpPurpose = "email-verification" | "forget-password";

interface OtpCopy {
  expiry: (minutes: number) => string;
  heading: string;
  ignore: string;
  intro: string;
  preview: string;
  subject: string;
}

interface Copy {
  footer: string;
  otp: Record<OtpPurpose, OtpCopy>;
  welcome: {
    subject: string;
    preview: string;
    heading: (name: string) => string;
    body: string;
    tip: string;
  };
}

export const COPY: Record<MailLocale, Copy> = {
  fr: {
    footer: "Zay · Taxis et tuk-tuks à Toliara, Madagascar",
    otp: {
      "email-verification": {
        subject: "Votre code de vérification Zay",
        preview: "Votre code pour confirmer votre adresse email",
        heading: "Confirmez votre adresse email",
        intro:
          "Saisissez ce code dans l'application Zay pour activer votre compte.",
        expiry: (minutes) => `Ce code reste valable ${minutes} minutes.`,
        ignore:
          "Vous n'avez pas créé de compte Zay ? Ignorez simplement cet email.",
      },
      "forget-password": {
        subject: "Réinitialisation de votre mot de passe Zay",
        preview: "Votre code pour choisir un nouveau mot de passe",
        heading: "Choisissez un nouveau mot de passe",
        intro:
          "Saisissez ce code pour choisir un nouveau mot de passe. Vos sessions ouvertes seront fermées.",
        expiry: (minutes) => `Ce code reste valable ${minutes} minutes.`,
        ignore:
          "Vous n'avez rien demandé ? Ignorez cet email, votre mot de passe ne change pas.",
      },
    },
    welcome: {
      subject: "Bienvenue sur Zay",
      preview: "Votre compte est prêt",
      heading: (name) => `Bienvenue, ${name} !`,
      body: "Votre adresse est confirmée et votre compte est prêt. Réservez un taxi ou un tuk-tuk dans Toliara en quelques secondes.",
      tip: "Les courses se paient en espèces, directement au chauffeur.",
    },
  },
  mg: {
    footer: "Zay · Taxi sy tuk-tuk eto Toliara, Madagasikara",
    otp: {
      "email-verification": {
        subject: "Ny kaody fanamarinana Zay anao",
        preview: "Ny kaody hanamarinana ny adiresy mailakao",
        heading: "Hamarino ny adiresy mailakao",
        intro:
          "Ampidiro ao amin'ny fampiharana Zay ity kaody ity mba hampandehanana ny kaontinao.",
        expiry: (minutes) =>
          `Mbola mandeha mandritra ny ${minutes} minitra ity kaody ity.`,
        ignore:
          "Tsy nanokatra kaonty Zay ianao? Aza raharahiana ity mailaka ity.",
      },
      "forget-password": {
        subject: "Fanovana ny tenimiafinao Zay",
        preview: "Ny kaody hisafidianana tenimiafina vaovao",
        heading: "Misafidiana tenimiafina vaovao",
        intro:
          "Ampidiro ity kaody ity mba hisafidianana tenimiafina vaovao. Hikatona ireo fidirana misokatra.",
        expiry: (minutes) =>
          `Mbola mandeha mandritra ny ${minutes} minitra ity kaody ity.`,
        ignore:
          "Tsy nangataka na inona na inona ianao? Aza raharahiana, tsy miova ny tenimiafinao.",
      },
    },
    welcome: {
      subject: "Tongasoa eto amin'ny Zay",
      preview: "Vonona ny kaontinao",
      heading: (name) => `Tongasoa, ${name}!`,
      body: "Voamarina ny adiresinao ary vonona ny kaontinao. Mandehana taxi na tuk-tuk eto Toliara ao anatin'ny segondra vitsy.",
      tip: "Vola an-tanana no handoavana ny dia, mivantana amin'ny mpamily.",
    },
  },
};

export const toMailLocale = (value: unknown): MailLocale =>
  value === "mg" ? "mg" : "fr";
