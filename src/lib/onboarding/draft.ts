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

const draftSchema = z.object({
  version: z.literal(DRAFT_VERSION),
  step: z.number().int().min(1).max(4),
  step1: z
    .object({ fullName: z.string().max(100), username: z.string().max(30) })
    .nullable(),
  step2: z
    .object({
      shopName: z.string().max(100),
      shopSlug: z.string().max(50),
      description: z.string().max(500).optional(),
      currency: z.string().max(3),
      checkoutMode: z.enum(["whatsapp", "online"]),
      whatsappNumber: z.string().max(20).optional(),
    })
    .nullable(),
  intentions: z.array(z.string().max(50)).max(20),
  handles: z.record(z.string().max(50), z.string().max(200)),
  announcement: z.string().max(2000),
  bioTheme: z.string().max(50),
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
