/**
 * French copy of the public landing page. It is the reference shape:
 * `mg.ts` must provide exactly the same keys (spec 0007).
 * No amount of money ever appears here.
 */
export const fr = {
  meta: {
    title: "Zay · Taxi et tuk-tuk à Toliara",
    description:
      "Réservez un taxi ou un tuk-tuk à Toliara. Prix connu avant de partir, offres de chauffeurs à comparer, suivi en direct et paiement en espèces.",
  },
  skipLink: "Aller au contenu",
  nav: {
    label: "Sections de la page",
    how: "Comment ça marche",
    vehicles: "Taxi et tuk-tuk",
    drivers: "Chauffeurs",
  },
  language: {
    label: "Langue de la page",
    fr: "Français",
    mg: "Malagasy",
  },
  logoAlt: "Zay, accueil",
  download: {
    label: "Télécharger l'app",
    soon: "Bientôt disponible",
    note: "Pour Android",
  },
  hero: {
    eyebrow: "Toliara, Madagascar",
    title: "Votre taxi ou tuk\u2011tuk à Toliara, en quelques secondes",
    lead: "Indiquez où vous allez, comparez les offres des chauffeurs proches, puis suivez votre course sur la carte. Vous payez en espèces, à l'arrivée.",
    highlights: [
      "Taxi et tuk-tuk",
      "Paiement en espèces",
      "Français et malagasy",
    ],
    illustrationAlt:
      "Illustration d'un homme qui réserve une course sur son téléphone",
    screenAlt:
      "Écran d'accueil de l'app Zay : la carte de Toliara, le départ, la destination et le choix entre voiture et tuk-tuk",
  },
  how: {
    title: "Une course claire, du début à la fin",
    lead: "Quatre étapes, et vous savez toujours où en est votre course.",
    steps: [
      {
        step: "Choisissez votre destination",
        title: "Prix connu avant de partir",
        body: "Le prix indicatif s'affiche avant que vous partiez. Pas de surprise à l'arrivée.",
      },
      {
        step: "Comparez les offres",
        title: "Plusieurs chauffeurs à comparer",
        body: "Les chauffeurs proches vous font une offre. Vous choisissez celle qui vous convient.",
      },
      {
        step: "Suivez votre chauffeur",
        title: "Suivi en direct sur la carte",
        body: "Voyez votre chauffeur arriver en direct, puis suivez le trajet jusqu'à destination.",
      },
      {
        step: "Payez à l'arrivée",
        title: "Paiement en espèces",
        body: "Vous réglez le chauffeur à l'arrivée, au prix convenu. Pas besoin de carte bancaire.",
      },
    ],
  },
  vehicles: {
    title: "Le bon véhicule pour chaque trajet",
    lead: "Dans l'app, choisissez une voiture ou un tuk-tuk, ou laissez Zay chercher le premier chauffeur disponible.",
    taxi: {
      title: "Taxi",
      body: "Le confort d'une voiture, pour vos bagages, vos trajets en famille ou les longues distances en ville.",
    },
    tukTuk: {
      title: "Tuk-tuk",
      body: "Léger et agile, idéal pour les petits trajets dans les rues de Toliara.",
    },
    auto: {
      title: "Automatique",
      body: "Pas de préférence ? Zay sollicite les chauffeurs disponibles, en voiture ou en tuk-tuk.",
    },
  },
  drivers: {
    title: "Devenez chauffeur Zay",
    lead: "Vous conduisez un taxi ou un tuk-tuk à Toliara ? Recevez des demandes de course près de vous, sur votre téléphone.",
    steps: [
      {
        title: "Installez la même app",
        body: "Une seule application pour les clients et les chauffeurs.",
      },
      {
        title: "Passez en mode chauffeur",
        body: "Choisissez « Chauffeur » quand vous créez votre compte.",
      },
      {
        title: "Envoyez votre dossier",
        body: "Permis de conduire, carte grise et assurance, en photo depuis l'app. L'équipe Zay le vérifie.",
      },
      {
        title: "Recevez des courses",
        body: "Une fois validé, passez en ligne et répondez aux demandes proches de vous.",
      },
    ],
    illustrationAlt:
      "Illustration d'un chauffeur qui aide une passagère à ranger ses bagages dans le coffre",
  },
  final: {
    title: "Prêt à partir ?",
    lead: "Installez Zay sur votre téléphone Android et réservez votre première course à Toliara.",
  },
  footer: {
    tagline: "Taxi et tuk-tuk à Toliara.",
    contactTitle: "Contact",
    cityLabel: "Adresse",
    city: "Toliara, Madagascar",
    emailLabel: "Email",
    phoneLabel: "Téléphone",
    admin: "Espace admin",
  },
};

export type LandingCopy = typeof fr;
