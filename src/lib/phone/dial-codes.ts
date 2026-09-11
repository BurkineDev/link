/**
 * Numérotation téléphonique des pays où Bio-Lien vend.
 *
 * Deux bugs de production sont partis de la même cause : un indicatif absent
 * ou faux. Au checkout, tout pays hors d'une table de dix entrées retombait
 * sur +225 : le numéro d'un acheteur béninois partait en « +225… » et la
 * demande Mobile Money n'arrivait jamais sur son téléphone. Côté vendeur, un
 * numéro WhatsApp saisi sans indicatif (« 70 12 34 56 ») passait la
 * validation et produisait un lien wa.me mort sur chaque bouton d'achat.
 *
 * Ce module est la seule source de vérité : indicatif ET longueur du numéro
 * national pour chaque pays proposé (AFRICAN_COUNTRIES dans constants.ts),
 * plus les quelques pays hors Afrique acceptés par les formulaires.
 *
 * `nsn` = longueur(s) du numéro national significatif, sans indicatif ni zéro
 * initial (source : plans de numérotation UIT-T E.164, 2024-2026). Quand un
 * pays admet plusieurs longueurs (fixe/mobile, ancien/nouveau plan), on les
 * liste toutes plutôt que de refuser un numéro valide.
 */

export interface DialCodeEntry {
  /** Code ISO 3166-1 alpha-2. */
  iso2: string;
  /** Indicatif international, avec le « + ». */
  dialCode: string;
  /** Longueurs admises du numéro national (sans indicatif ni 0 initial). */
  nsn: number[];
  /** Drapeau, pour les sélecteurs. */
  flag: string;
}

export const DIAL_CODES: readonly DialCodeEntry[] = [
  // --- Afrique de l'Ouest (UEMOA + voisins) ---
  { iso2: "BJ", dialCode: "+229", nsn: [10], flag: "🇧🇯" }, // 10 chiffres depuis nov. 2024 (préfixe 01)
  { iso2: "BF", dialCode: "+226", nsn: [8], flag: "🇧🇫" },
  { iso2: "CI", dialCode: "+225", nsn: [10], flag: "🇨🇮" }, // 10 chiffres depuis 2021
  { iso2: "CV", dialCode: "+238", nsn: [7], flag: "🇨🇻" },
  { iso2: "GM", dialCode: "+220", nsn: [7], flag: "🇬🇲" },
  { iso2: "GH", dialCode: "+233", nsn: [9], flag: "🇬🇭" },
  { iso2: "GN", dialCode: "+224", nsn: [9], flag: "🇬🇳" },
  { iso2: "GW", dialCode: "+245", nsn: [7, 9], flag: "🇬🇼" },
  { iso2: "LR", dialCode: "+231", nsn: [7, 8, 9], flag: "🇱🇷" },
  { iso2: "ML", dialCode: "+223", nsn: [8], flag: "🇲🇱" },
  { iso2: "MR", dialCode: "+222", nsn: [8], flag: "🇲🇷" },
  { iso2: "NE", dialCode: "+227", nsn: [8], flag: "🇳🇪" },
  { iso2: "NG", dialCode: "+234", nsn: [10], flag: "🇳🇬" },
  { iso2: "SN", dialCode: "+221", nsn: [9], flag: "🇸🇳" },
  { iso2: "SL", dialCode: "+232", nsn: [8], flag: "🇸🇱" },
  { iso2: "TG", dialCode: "+228", nsn: [8], flag: "🇹🇬" },
  // --- Afrique centrale ---
  { iso2: "CM", dialCode: "+237", nsn: [9], flag: "🇨🇲" },
  { iso2: "CF", dialCode: "+236", nsn: [8], flag: "🇨🇫" },
  { iso2: "TD", dialCode: "+235", nsn: [8], flag: "🇹🇩" },
  { iso2: "CG", dialCode: "+242", nsn: [9], flag: "🇨🇬" },
  { iso2: "CD", dialCode: "+243", nsn: [9], flag: "🇨🇩" },
  { iso2: "GQ", dialCode: "+240", nsn: [9], flag: "🇬🇶" },
  { iso2: "GA", dialCode: "+241", nsn: [7, 8], flag: "🇬🇦" },
  { iso2: "ST", dialCode: "+239", nsn: [7], flag: "🇸🇹" },
  // --- Afrique de l'Est ---
  { iso2: "BI", dialCode: "+257", nsn: [8], flag: "🇧🇮" },
  { iso2: "KM", dialCode: "+269", nsn: [7], flag: "🇰🇲" },
  { iso2: "DJ", dialCode: "+253", nsn: [8], flag: "🇩🇯" },
  { iso2: "ER", dialCode: "+291", nsn: [7], flag: "🇪🇷" },
  { iso2: "ET", dialCode: "+251", nsn: [9], flag: "🇪🇹" },
  { iso2: "KE", dialCode: "+254", nsn: [9], flag: "🇰🇪" },
  { iso2: "MG", dialCode: "+261", nsn: [9], flag: "🇲🇬" },
  { iso2: "MW", dialCode: "+265", nsn: [7, 9], flag: "🇲🇼" },
  { iso2: "MU", dialCode: "+230", nsn: [7, 8], flag: "🇲🇺" },
  { iso2: "MZ", dialCode: "+258", nsn: [8, 9], flag: "🇲🇿" },
  { iso2: "RW", dialCode: "+250", nsn: [9], flag: "🇷🇼" },
  { iso2: "SC", dialCode: "+248", nsn: [7], flag: "🇸🇨" },
  { iso2: "SO", dialCode: "+252", nsn: [7, 8, 9], flag: "🇸🇴" },
  { iso2: "SS", dialCode: "+211", nsn: [9], flag: "🇸🇸" },
  { iso2: "SD", dialCode: "+249", nsn: [9], flag: "🇸🇩" },
  { iso2: "TZ", dialCode: "+255", nsn: [9], flag: "🇹🇿" },
  { iso2: "UG", dialCode: "+256", nsn: [9], flag: "🇺🇬" },
  // --- Afrique australe ---
  { iso2: "AO", dialCode: "+244", nsn: [9], flag: "🇦🇴" },
  { iso2: "BW", dialCode: "+267", nsn: [7, 8], flag: "🇧🇼" },
  { iso2: "SZ", dialCode: "+268", nsn: [8], flag: "🇸🇿" },
  { iso2: "LS", dialCode: "+266", nsn: [8], flag: "🇱🇸" },
  { iso2: "NA", dialCode: "+264", nsn: [8, 9], flag: "🇳🇦" },
  { iso2: "ZA", dialCode: "+27", nsn: [9], flag: "🇿🇦" },
  { iso2: "ZM", dialCode: "+260", nsn: [9], flag: "🇿🇲" },
  { iso2: "ZW", dialCode: "+263", nsn: [9], flag: "🇿🇼" },
  // --- Afrique du Nord ---
  { iso2: "DZ", dialCode: "+213", nsn: [8, 9], flag: "🇩🇿" },
  { iso2: "EG", dialCode: "+20", nsn: [9, 10], flag: "🇪🇬" },
  { iso2: "LY", dialCode: "+218", nsn: [9], flag: "🇱🇾" },
  { iso2: "MA", dialCode: "+212", nsn: [9], flag: "🇲🇦" },
  { iso2: "TN", dialCode: "+216", nsn: [8], flag: "🇹🇳" },
  // --- Diaspora : les pays déjà acceptés par les formulaires ---
  { iso2: "FR", dialCode: "+33", nsn: [9], flag: "🇫🇷" },
  { iso2: "BE", dialCode: "+32", nsn: [8, 9], flag: "🇧🇪" },
  { iso2: "CA", dialCode: "+1", nsn: [10], flag: "🇨🇦" },
  { iso2: "US", dialCode: "+1", nsn: [10], flag: "🇺🇸" },
];

const BY_ISO2 = new Map(DIAL_CODES.map((entry) => [entry.iso2, entry]));

/** Indicatifs triés du plus long au plus court, pour reconnaître un numéro international. */
const DIAL_CODES_LONGEST_FIRST = [...DIAL_CODES].sort(
  (a, b) => b.dialCode.length - a.dialCode.length,
);

export function dialCodeFor(iso2: string | null | undefined): string | null {
  if (!iso2) return null;
  return BY_ISO2.get(iso2.toUpperCase())?.dialCode ?? null;
}

export function dialCodeEntry(iso2: string | null | undefined): DialCodeEntry | null {
  if (!iso2) return null;
  return BY_ISO2.get(iso2.toUpperCase()) ?? null;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Compose un numéro international (E.164, avec « + ») à partir d'un pays et
 * d'une saisie locale. Tolère les espaces, points et tirets, le zéro initial
 * (« 07 08 09 10 11 » → « +2250708091011 »), et une saisie déjà internationale
 * (« +226 70 12 34 56 » ou « 00226… ») qui l'emporte sur le pays.
 *
 * Retourne null si le numéro n'a pas une longueur admise pour son pays :
 * mieux vaut refuser à la saisie qu'envoyer un numéro que Genius Pay
 * acceptera sans jamais joindre personne.
 */
export function toE164(input: string, iso2: string | null | undefined): string | null {
  const raw = input.trim();
  if (!raw) return null;

  // 1. Saisie déjà internationale : « +226… » ou « 00226… ».
  const intl = raw.startsWith("+") ? digitsOnly(raw) : raw.startsWith("00") ? digitsOnly(raw).slice(2) : null;
  if (intl) {
    const entry = DIAL_CODES_LONGEST_FIRST.find((e) => intl.startsWith(e.dialCode.slice(1)));
    if (!entry) return null;
    const nsn = intl.slice(entry.dialCode.length - 1);
    return entry.nsn.includes(nsn.length) ? `+${intl}` : null;
  }

  // 2. Saisie locale : on a besoin du pays.
  const entry = dialCodeEntry(iso2);
  if (!entry) return null;
  let nsn = digitsOnly(raw);
  // Zéro initial du plan national (CI, SN, CM, GH, NG, KE, MA, FR…), jamais
  // composé depuis l'étranger : on le retire quand la longueur restante est
  // admise. Limite assumée : une validation par longueur ne peut pas
  // détecter un numéro d'un autre pays qui, une fois le 0 ôté, a la bonne
  // longueur (un « 07… » ivoirien sous « Sénégal »). Le formulaire affiche
  // l'indicatif et le numéro composé pour que l'acheteur le voie.
  if (nsn.startsWith("0") && !entry.nsn.includes(nsn.length) && entry.nsn.includes(nsn.length - 1)) {
    nsn = nsn.slice(1);
  }
  if (!entry.nsn.includes(nsn.length)) return null;
  return `${entry.dialCode}${nsn}`;
}

/**
 * Un numéro international est-il plausible pour un pays connu ? Utilisé côté
 * serveur pour refuser ce que les formulaires auraient dû bloquer.
 */
export function isValidE164(value: string | null | undefined): boolean {
  if (!value) return false;
  return toE164(value.startsWith("+") ? value : `+${digitsOnly(value)}`, null) !== null;
}

/** Message d'aide : « 8 chiffres » ou « 9 ou 10 chiffres ». */
export function nsnHint(iso2: string | null | undefined): string | null {
  const entry = dialCodeEntry(iso2);
  if (!entry) return null;
  const lengths = [...entry.nsn].sort((a, b) => a - b);
  return lengths.length === 1 ? `${lengths[0]} chiffres` : `${lengths.slice(0, -1).join(", ")} ou ${lengths.at(-1)} chiffres`;
}
