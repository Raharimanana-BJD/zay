import type { LandingCopy } from "./fr";

/**
 * Malagasy copy of the public landing page. Drafted, not yet reviewed by a
 * speaker: have it read before showing it (spec 0007, follow up).
 */
export const mg = {
  meta: {
    title: "Zay · Taxi sy tuk-tuk eto Toliara",
    description:
      "Mamandriha taxi na tuk-tuk eto Toliara. Fantatra mialoha ny vidiny, azo ampitahaina ny tolotry ny mpamily, arahina mivantana ny dia, ary vola an-tanana no aloa.",
  },
  skipLink: "Hankany amin'ny votoatiny",
  nav: {
    label: "Fizarana ao amin'ny pejy",
    how: "Ahoana no fiasany",
    vehicles: "Taxi sy tuk-tuk",
    drivers: "Mpamily",
  },
  language: {
    label: "Fiteny ampiasain'ny pejy",
    fr: "Frantsay",
    mg: "Malagasy",
  },
  logoAlt: "Zay, fandraisana",
  download: {
    label: "Alaivo ny app",
    soon: "Ho avy tsy ho ela",
    note: "Ho an'ny Android",
  },
  hero: {
    eyebrow: "Toliara, Madagasikara",
    title: "Taxi na tuk\u2011tuk eto Toliara, ao anatin'ny segondra vitsy",
    lead: "Lazao izay halehanao, ampitahao ny tolotry ny mpamily akaiky, dia araho amin'ny sarintany ny dianao. Vola an-tanana no aloanao rehefa tonga.",
    highlights: ["Taxi sy tuk-tuk", "Vola an-tanana", "Frantsay sy malagasy"],
    illustrationAlt: "Sary lehilahy mamandrika dia amin'ny findainy",
    screenAlt:
      "Efijery fandraisana ao amin'ny app Zay: ny sarintanin'i Toliara, ny toerana iaingana, ny toerana halehana ary ny safidy fiara na tuk-tuk",
  },
  how: {
    title: "Dia mazava, hatramin'ny fiandohana ka hatramin'ny farany",
    lead: "Dingana efatra, ary fantatrao foana izay misy ny dianao.",
    steps: [
      {
        step: "Safidio ny toerana halehanao",
        title: "Fantatra mialoha ny vidiny",
        body: "Miseho alohan'ny hiaingananao ny vidiny tombanana. Tsy misy tsy ampoizina rehefa tonga.",
      },
      {
        step: "Ampitahao ny tolotra",
        title: "Mpamily maromaro azo ampitahaina",
        body: "Manolotra vidiny aminao ny mpamily akaiky. Ianao no misafidy izay mety aminao.",
      },
      {
        step: "Araho ny mpamilinao",
        title: "Arahina mivantana amin'ny sarintany",
        body: "Jereo mivantana ny fahatongavan'ny mpamilinao, dia araho ny lalana hatrany amin'ny toerana halehana.",
      },
      {
        step: "Mandoava rehefa tonga",
        title: "Vola an-tanana",
        body: "Aloanao amin'ny mpamily rehefa tonga ny vidiny nifanarahana. Tsy mila karatra banky.",
      },
    ],
  },
  vehicles: {
    title: "Fiara mety amin'ny dia tsirairay",
    lead: "Ao amin'ny app, mifidiana fiara na tuk-tuk, na avelao i Zay hitady ny mpamily afaka voalohany.",
    taxi: {
      title: "Taxi",
      body: "Fiara mahazo aina, ho an'ny entanao, ny dia miaraka amin'ny fianakaviana na ny lalana lavitra ao an-tanàna.",
    },
    tukTuk: {
      title: "Tuk-tuk",
      body: "Maivana sy malaky, tsara ho an'ny dia fohy eny amin'ny araben'i Toliara.",
    },
    auto: {
      title: "Mandeha ho azy",
      body: "Tsy manana safidy manokana? Mangataka amin'ny mpamily afaka i Zay, na fiara na tuk-tuk.",
    },
  },
  drivers: {
    title: "Lasa mpamily Zay",
    lead: "Mitondra taxi na tuk-tuk eto Toliara ianao? Mahazoa fangatahana dia akaiky anao, amin'ny findainao.",
    steps: [
      {
        title: "Apetraho ilay app iray ihany",
        body: "App iray ihany ho an'ny mpanjifa sy ny mpamily.",
      },
      {
        title: "Midira amin'ny maody mpamily",
        body: "Safidio « Mpamily » rehefa mamorona ny kaontinao.",
      },
      {
        title: "Alefaso ny antontan-taratasinao",
        body: "Fahazoan-dalana mitondra fiara, karatra fiara ary fiantohana, alefa sary avy ao amin'ny app. Ny ekipa Zay no manamarina azy.",
      },
      {
        title: "Mahazoa dia",
        body: "Rehefa voamarina, midira an-tserasera dia valio ny fangatahana akaiky anao.",
      },
    ],
    illustrationAlt:
      "Sary mpamily manampy mpandeha hametraka ny entany ao anaty vatan'ny fiara",
  },
  final: {
    title: "Vonona handeha ve ianao?",
    lead: "Apetraho ao amin'ny findainao Android i Zay ary mamandriha ny dianao voalohany eto Toliara.",
  },
  footer: {
    tagline: "Taxi sy tuk-tuk eto Toliara.",
    contactTitle: "Fifandraisana",
    cityLabel: "Adiresy",
    city: "Toliara, Madagasikara",
    emailLabel: "Mailaka",
    phoneLabel: "Telefaonina",
    admin: "Sehatry ny mpitantana",
  },
} satisfies LandingCopy;
