import { z } from "zod";

/**
 * Brouillon de l'onboarding vendeur.
 *
 * L'onboarding tient en cinq écrans, et tout vivait dans l'état React :
 * sur un téléphone d'entrée de gamme, basculer vers WhatsApp pour copier
 * son numéro suffit à faire purger l'onglet — le vendeur revenait à
 * l'écran 1 et retapait tout. Chaque écran est désormais enregistré dans le
 * navigateur au fil de la saisie, et repris au retour.
 *
 * Le brouillon est propre au compte (clé suffixée par l'identifiant) : un
 * autre vendeur sur le même téléphone n'hérite pas du précédent. Il est
 * effacé quand la boutique est créée.
 *
 * Aucune dépendance serveur ni React : importable et testable partout.
 */

export const DRAFT_VERSION = 1;

/**
 * Chaque feuille tolère une valeur hors borne (elle est simplement vidée) :
 * un champ trop long ne doit jamais faire perdre tout le brouillon — c'est
 * précisément le scénario que le brouillon existe pour couvrir. Seule la
 * version est stricte : un ancien format repart de zéro.
 */
const text = (max: number) => z.string().max(max).catch("");

const draftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  step: z.number().int().min(1).max(4).catch(1),
  step1: z
    .object({ fullName: text(100), username: text(30) })
    .nullable()
    .catch(null),
  step2: z
    .object({
      shopName: text(100),
      shopSlug: text(50),
      description: z.string().max(500).optional().catch(undefined),
      currency: z.string().max(3).catch("XOF"),
      checkoutMode: z.enum(["whatsapp", "online"]).catch("whatsapp"),
      whatsappNumber: z.string().max(20).optional().catch(undefined),
    })
    .nullable()
    .catch(null),
  intentions: z.array(z.string().max(50)).max(20).catch([]),
  handles: z.record(z.string().max(50), text(200)).catch({}),
  announcement: text(2000),
  bioTheme: text(50),
  savedAt: z.number(),
});

export type OnboardingDraft = z.infer<typeof draftSchema>;

/** Un brouillon vaut sept jours : au-delà, on repart proprement. */
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function draftKey(userId: string): string {
  return `bl_onboarding_draft:${userId}`;
}

/** Brouillon lisible et récent, sinon null. Ne lève jamais. */
export function loadDraft(
  storage: DraftStorage | null | undefined,
  userId: string,
  now: number = Date.now(),
): OnboardingDraft | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(draftKey(userId));
    if (!raw) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    if (now - parsed.data.savedAt > DRAFT_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

/**
 * Un brouillon n'a d'intérêt que s'il contient une saisie : on n'écrit pas
 * un écran vide (et on n'affiche pas « brouillon repris » pour rien).
 */
export function isDraftMeaningful(draft: Omit<OnboardingDraft, "version" | "savedAt">): boolean {
  return Boolean(
    draft.step1?.fullName ||
      draft.step1?.username ||
      draft.step2?.shopName ||
      draft.step2?.shopSlug ||
      draft.step2?.description ||
      draft.step2?.whatsappNumber ||
      draft.intentions.length > 0 ||
      draft.announcement ||
      Object.values(draft.handles).some(Boolean),
  );
}

export function saveDraft(
  storage: DraftStorage | null | undefined,
  userId: string,
  draft: Omit<OnboardingDraft, "version" | "savedAt">,
  now: number = Date.now(),
): void {
  if (!storage) return;
  try {
    if (!isDraftMeaningful(draft)) {
      storage.removeItem(draftKey(userId));
      return;
    }
    storage.setItem(
      draftKey(userId),
      JSON.stringify({ ...draft, version: DRAFT_VERSION, savedAt: now } satisfies OnboardingDraft),
    );
  } catch {
    // Stockage plein ou bloqué : l'onboarding continue sans filet.
  }
}

export function clearDraft(storage: DraftStorage | null | undefined, userId: string): void {
  try {
    storage?.removeItem(draftKey(userId));
  } catch {
    // Rien à faire.
  }
}

const DRAFT_PREFIX = "bl_onboarding_draft:";

/**
 * À la déconnexion : nom, numéro WhatsApp et pseudos n'ont rien à faire
 * dans le navigateur d'un téléphone partagé une fois le vendeur parti.
 */
export function clearAllDrafts(storage: (DraftStorage & { length?: number; key?: (i: number) => string | null }) | null | undefined): void {
  if (!storage) return;
  try {
    const keys: string[] = [];
    if (typeof storage.key === "function" && typeof storage.length === "number") {
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
      }
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Rien à faire.
  }
}

/** `window.localStorage` si le navigateur l'autorise, sinon null. */
export function browserDraftStorage(): DraftStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Écran de reprise : jamais au-delà de ce que le brouillon permet. Sans
 * boutique saisie, on ne peut pas être aux objectifs ; sans profil, on
 * ne peut pas être à la boutique — sauf si le compte fournit déjà le profil.
 */
export function resumeStep(draft: OnboardingDraft, profileKnown: boolean): number {
  const hasProfile = profileKnown || Boolean(draft.step1?.fullName && draft.step1?.username);
  const hasShop = Boolean(draft.step2?.shopName && draft.step2?.shopSlug);
  if (!hasProfile) return 1;
  if (!hasShop) return Math.min(draft.step, 2);
  return Math.min(draft.step, 4);
}
