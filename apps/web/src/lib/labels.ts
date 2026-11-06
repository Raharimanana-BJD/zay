// Every French label for codes, statuses and errors lives here. The code lists are
// imported as types only, so the web never loads a value from `@zay-app/api`.

import type {
  AUDIT_ACTIONS,
  BOOKING_EVENT_TYPES,
  CANCELLATION_REASONS,
  DISPUTE_REASONS,
  DRIVER_DOCUMENT_TYPES,
  PAYMENT_RESOLUTION_REASONS,
  PRICE_ADJUSTMENT_REASONS,
  REPORT_TYPES,
  SUSPENSION_REASONS,
  VERIFICATION_REJECTION_REASONS,
} from "@zay-app/api/domain/codes";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur",
  support: "Support",
  client: "Client",
  driver: "Chauffeur",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  SEARCHING: "Recherche",
  OFFERED: "Offres envoyées",
  ACCEPTED: "Acceptée",
  DRIVER_ARRIVING: "Chauffeur en route",
  ARRIVED: "Chauffeur arrivé",
  IN_PROGRESS: "En course",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
  EXPIRED: "Expirée",
  NO_DRIVER_FOUND: "Sans chauffeur",
  DISPUTED: "Litige",
};

export const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Rejeté",
  changes_requested: "Complément demandé",
  suspended: "Suspendu",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  open: "Ouvert",
  in_progress: "En cours",
  resolved: "Résolu",
  closed: "Clos",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  partial: "Partiel",
  paid: "Payé",
  disputed: "Contesté",
};

export const PAYMENT_EVENT_LABELS: Record<string, string> = {
  declared: "Déclaré",
  disputed: "Contesté",
  resolved: "Résolu",
};

export const OFFER_STATUS_LABELS: Record<string, string> = {
  sent: "Envoyée",
  priced: "Prix proposé",
  negotiating: "En négociation",
  accepted: "Acceptée",
  refused: "Refusée",
  expired: "Expirée",
  void: "Annulée",
  withdrawn: "Retirée",
};

export const PROPOSAL_KIND_LABELS: Record<string, string> = {
  accept: "Accepte",
  propose: "Propose",
  counter: "Contre propose",
  refuse: "Refuse",
};

export const DESTINATION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  applied: "Appliqué",
  refused: "Refusé",
  expired: "Expiré",
};

export const ACTOR_KIND_LABELS: Record<string, string> = {
  client: "Client",
  driver: "Chauffeur",
  admin: "Administrateur",
  support: "Support",
  system: "Système",
};

export const CATEGORY_LABELS: Record<string, string> = {
  car: "Voiture",
  tuk_tuk: "Tuk-tuk",
  auto: "Automatique",
};

export const EMPLOYMENT_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  renter: "Locataire",
  employee: "Employé",
};

export const SUBJECT_LABELS: Record<string, string> = {
  driver: "Chauffeur",
  vehicle: "Véhicule",
  document: "Document",
};

export const BOOKING_EVENT_LABELS: Record<
  (typeof BOOKING_EVENT_TYPES)[number],
  string
> = {
  booking_created: "Demande créée",
  status_changed: "Changement de statut",
  driver_assigned: "Chauffeur attribué",
  driver_replaced: "Chauffeur remplacé",
  destination_requested: "Destination demandée",
  destination_applied: "Destination changée",
  destination_refused: "Destination refusée",
  destination_expired: "Destination expirée",
  dispute_opened: "Litige ouvert",
  dispute_closed: "Litige fermé",
};

export const CANCELLATION_REASON_LABELS: Record<
  (typeof CANCELLATION_REASONS)[number],
  string
> = {
  client_changed_mind: "Le client a changé d'avis",
  driver_unavailable: "Chauffeur indisponible",
  client_absent: "Client absent",
  driver_absent: "Chauffeur absent",
  support_intervention: "Intervention du support",
  other: "Autre",
};

export const DISPUTE_REASON_LABELS: Record<
  (typeof DISPUTE_REASONS)[number],
  string
> = {
  payment: "Paiement",
  price: "Prix",
  behavior: "Comportement",
  other: "Autre",
};

export const PAYMENT_RESOLUTION_LABELS: Record<
  (typeof PAYMENT_RESOLUTION_REASONS)[number],
  string
> = {
  driver_confirmed: "Confirmé par le chauffeur",
  client_confirmed: "Confirmé par le client",
  agreement: "Accord entre les deux",
  other: "Autre",
};

export const SUSPENSION_REASON_LABELS: Record<
  (typeof SUSPENSION_REASONS)[number],
  string
> = {
  safety: "Sécurité",
  fraud: "Fraude",
  document_issue: "Problème de document",
  behavior: "Comportement",
  other: "Autre",
};

export const REJECTION_REASON_LABELS: Record<
  (typeof VERIFICATION_REJECTION_REASONS)[number],
  string
> = {
  document_unreadable: "Document illisible",
  document_expired: "Document expiré",
  information_mismatch: "Informations différentes",
  other: "Autre",
};

export const PRICE_ADJUSTMENT_LABELS: Record<
  (typeof PRICE_ADJUSTMENT_REASONS)[number],
  string
> = {
  distance_differs: "Distance différente",
  difficult_road: "Route difficile",
  difficult_destination: "Destination difficile",
  other: "Autre",
};

export const REPORT_TYPE_LABELS: Record<(typeof REPORT_TYPES)[number], string> =
  {
    client_absent: "Client absent",
    driver_absent: "Chauffeur absent",
    payment_issue: "Problème de paiement",
    safety: "Sécurité",
    help: "Aide",
    other: "Autre",
  };

export const DOCUMENT_TYPE_LABELS: Record<
  (typeof DRIVER_DOCUMENT_TYPES)[number],
  string
> = {
  driving_license: "Permis de conduire",
  national_id: "Pièce d'identité",
  vehicle_registration: "Carte grise",
  insurance: "Assurance",
};

export const AUDIT_ACTION_LABELS: Record<
  (typeof AUDIT_ACTIONS)[number],
  string
> = {
  "account.banned": "Compte suspendu",
  "account.unbanned": "Compte réactivé",
  "team.created": "Compte équipe créé",
  "team.role_changed": "Rôle changé",
};

/** Any reason code, for timelines where the list it came from is not known. */
const ALL_REASONS: Record<string, string> = {
  ...PRICE_ADJUSTMENT_LABELS,
  ...REJECTION_REASON_LABELS,
  ...SUSPENSION_REASON_LABELS,
  ...PAYMENT_RESOLUTION_LABELS,
  ...DISPUTE_REASON_LABELS,
  ...CANCELLATION_REASON_LABELS,
};

export const reasonLabel = (code: string | null | undefined) =>
  code ? (ALL_REASONS[code] ?? code) : "Sans motif";

/** A driver's activity, in one phrase. */
export function activityLabel(isOnline: boolean, isAvailable: boolean) {
  if (!isOnline) {
    return "Hors ligne";
  }
  return isAvailable ? "En ligne, disponible" : "En ligne";
}

/** A label from a list, or the raw code rather than nothing for an unknown value. */
export const labelOf = (labels: Record<string, string>, code: string) =>
  labels[code] ?? code;

const ERROR_LABELS: Record<string, string> = {
  ACCOUNT_NOT_BANNED: "Ce compte n'est pas suspendu.",
  AMOUNT_ABOVE_AGREED:
    "Le montant retenu ne peut pas dépasser le prix convenu.",
  BAD_REQUEST: "Cette demande n'est pas valide.",
  BANNED_USER: "Compte suspendu.",
  BOOKING_STATUS_CHANGED:
    "Cette réservation vient de changer. L'écran affiche son état réel.",
  CANNOT_TARGET_SELF:
    "Vous ne pouvez pas faire cette action sur votre propre compte.",
  CONFLICT: "Cet élément vient de changer. Rechargez la page.",
  DOCUMENTS_NOT_APPROVED:
    "Toutes les pièces doivent être approuvées et valides avant cette décision.",
  EMAIL_OR_PHONE_TAKEN: "Cet email ou ce téléphone est déjà utilisé.",
  FORBIDDEN: "Vous n'avez pas accès à cette action.",
  INVALID_EMAIL_OR_PASSWORD: "Email ou mot de passe incorrect.",
  INVALID_PASSWORD: "Le mot de passe actuel est incorrect.",
  NOT_A_TEAM_ACCOUNT: "Ce compte ne fait pas partie de l'équipe.",
  NOT_FOUND: "Cet élément est introuvable.",
  NOTE_REQUIRED: "Une note est obligatoire.",
  PASSWORD_TOO_SHORT: "Le nouveau mot de passe est trop court.",
  PAYMENT_NOT_DISPUTED: "Ce paiement n'est plus contesté.",
  PHONE_INVALID:
    "Le téléphone doit être au format international, par exemple +261340000000.",
  REASON_INVALID: "Ce motif n'est pas valide.",
  REASON_REQUIRED: "Choisissez un motif.",
  REPORT_STATUS_CHANGED:
    "Ce signalement vient de changer. L'écran affiche son état réel.",
  SETTINGS_CHANGED:
    "Un autre admin a enregistré des réglages depuis l'ouverture de ce formulaire.",
  TOO_MANY_REQUESTS: "Trop de tentatives. Réessayez dans un instant.",
  UNAUTHORIZED: "Votre session a expiré. Reconnectez-vous.",
  VERIFICATION_STATUS_CHANGED:
    "Cet élément vient de changer. L'écran affiche son état réel.",
};

const GENERIC_ERROR = "Une erreur est survenue. Réessayez.";

/** Reads a Better Auth error code, or a tRPC error whose message is a code. */
export function errorLabel(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return GENERIC_ERROR;
  }
  const { code, data, message } = error as {
    code?: string;
    data?: { code?: string } | null;
    message?: string;
  };
  for (const key of [code, message, data?.code]) {
    if (key && key in ERROR_LABELS) {
      return ERROR_LABELS[key] ?? GENERIC_ERROR;
    }
  }
  return GENERIC_ERROR;
}
