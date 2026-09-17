/**
 * Le sous-titre d'une carte de lien : ce que la page de liens affiche sous
 * le titre pour dire « où ça mène » sans que le vendeur ait rien à saisir.
 *
 * Un réseau social donne son identifiant (@la_philosophia), un site donne
 * son domaine (maboutique.com). Rien si ça n'apporte rien : un titre qui
 * répète déjà l'identifiant, une URL illisible, un lien mailto:/tel:.
 */

const HANDLE_HOSTS: Array<[RegExp, (path: string) => string | null]> = [
  [/(^|\.)youtube\.com$/, (p) => handleAt(p) ?? afterSegment(p, ["c", "channel", "user"])],
  [/(^|\.)instagram\.com$/, (p) => firstSegment(p)],
  [/(^|\.)tiktok\.com$/, (p) => handleAt(p)],
  [/(^|\.)(twitter|x)\.com$/, (p) => firstSegment(p)],
  [/(^|\.)facebook\.com$/, (p) => firstSegment(p, ["profile.php", "pages", "groups"])],
  [/(^|\.)snapchat\.com$/, (p) => afterSegment(p, ["add"]) ?? firstSegment(p)],
  [/(^|\.)threads\.net$/, (p) => handleAt(p)],
  [/(^|\.)twitch\.tv$/, (p) => firstSegment(p)],
  [/(^|\.)pinterest\.[a-z.]+$/, (p) => firstSegment(p)],
];

const HANDLE_RE = /^[A-Za-z0-9._-]{1,60}$/;

function segments(path: string): string[] {
  return path.split("/").filter(Boolean).map((s) => decodeURIComponent(s));
}

/** « /@nom » ou « /@nom/videos » → « @nom ». */
function handleAt(path: string): string | null {
  const first = segments(path)[0];
  if (!first || !first.startsWith("@")) return null;
  const name = first.slice(1);
  return HANDLE_RE.test(name) ? `@${name}` : null;
}

/** Premier segment comme identifiant, sauf s'il fait partie des pages génériques. */
function firstSegment(path: string, skip: string[] = []): string | null {
  const first = segments(path)[0];
  if (!first || skip.includes(first)) return null;
  const name = first.startsWith("@") ? first.slice(1) : first;
  return HANDLE_RE.test(name) ? `@${name}` : null;
}

/** « /c/nom », « /user/nom » → « @nom ». */
function afterSegment(path: string, keys: string[]): string | null {
  const parts = segments(path);
  if (parts.length < 2 || !keys.includes(parts[0])) return null;
  return HANDLE_RE.test(parts[1]) ? `@${parts[1]}` : null;
}

export function linkSubtitle(url: string, label: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return null;

  let subtitle: string | null = null;
  for (const [pattern, extract] of HANDLE_HOSTS) {
    if (pattern.test(host)) {
      subtitle = extract(parsed.pathname);
      break;
    }
  }
  if (subtitle === null) subtitle = host;

  // Un sous-titre qui répète le titre n'apporte rien.
  const norm = (s: string) => s.toLowerCase().replace(/^@/, "").replace(/[\s._-]/g, "");
  if (norm(subtitle) === norm(label)) return null;
  return subtitle;
}
