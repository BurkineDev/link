/**
 * Brouillon de l'onboarding : enregistré au fil de la saisie, repris au
 * retour, propre au compte, jamais au-delà de sept jours.
 */
import {
  DRAFT_TTL_MS,
  DRAFT_VERSION,
  clearDraft,
  draftKey,
  isDraftMeaningful,
  loadDraft,
  resumeStep,
  saveDraft,
  type OnboardingDraft,
} from "@/lib/onboarding/draft";

function storage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const NOW = 1_800_000_000_000;
const EMPTY = { step: 1, step1: null, step2: null, intentions: [], handles: {}, announcement: "", bioTheme: "classic" };
const FILLED = {
  step: 3,
  step1: { fullName: "Amara Diallo", username: "amara" },
  step2: { shopName: "Wax & Co", shopSlug: "wax-and-co", description: "", currency: "XOF", checkoutMode: "whatsapp" as const, whatsappNumber: "+22670123456" },
  intentions: ["sell"],
  handles: { instagram: "wax.co" },
  announcement: "",
  bioTheme: "classic",
};

test("enregistre puis relit, par compte", () => {
  const s = storage();
  saveDraft(s, "u1", FILLED, NOW);
  expect(loadDraft(s, "u1", NOW)).toEqual({ ...FILLED, version: DRAFT_VERSION, savedAt: NOW });
  expect(loadDraft(s, "u2", NOW)).toBeNull();
  expect(s.map.has(draftKey("u1"))).toBe(true);
  clearDraft(s, "u1");
  expect(loadDraft(s, "u1", NOW)).toBeNull();
});

test("un brouillon vide n'est pas écrit (et efface l'ancien)", () => {
  const s = storage();
  saveDraft(s, "u1", FILLED, NOW);
  saveDraft(s, "u1", EMPTY, NOW);
  expect(s.map.size).toBe(0);
  expect(isDraftMeaningful(EMPTY)).toBe(false);
  expect(isDraftMeaningful({ ...EMPTY, step2: { ...FILLED.step2, shopName: "X", shopSlug: "" } })).toBe(true);
});

test("périmé après sept jours, illisible ou d'une autre version → null, sans lever", () => {
  const s = storage();
  saveDraft(s, "u1", FILLED, NOW);
  expect(loadDraft(s, "u1", NOW + DRAFT_TTL_MS + 1)).toBeNull();
  s.setItem(draftKey("u1"), "{not json");
  expect(loadDraft(s, "u1", NOW)).toBeNull();
  s.setItem(draftKey("u1"), JSON.stringify({ ...FILLED, version: 99, savedAt: NOW }));
  expect(loadDraft(s, "u1", NOW)).toBeNull();
  expect(loadDraft(null, "u1", NOW)).toBeNull();
  const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => {} };
  expect(loadDraft(throwing, "u1", NOW)).toBeNull();
  expect(() => saveDraft(throwing, "u1", FILLED, NOW)).not.toThrow();
});

test("écran de reprise : jamais au-delà de ce que la saisie permet", () => {
  const draft = (over: Partial<OnboardingDraft>): OnboardingDraft => ({ ...FILLED, version: DRAFT_VERSION, savedAt: NOW, ...over });
  expect(resumeStep(draft({}), false)).toBe(3);
  expect(resumeStep(draft({ step: 4 }), false)).toBe(4);
  // Sans boutique, pas d'objectifs.
  expect(resumeStep(draft({ step: 4, step2: null }), false)).toBe(2);
  // Sans profil ni compte connu : écran 1.
  expect(resumeStep(draft({ step: 2, step1: null }), false)).toBe(1);
  // Le compte fournit le profil : la boutique suffit.
  expect(resumeStep(draft({ step: 2, step1: null }), true)).toBe(2);
});
