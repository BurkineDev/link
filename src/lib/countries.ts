import { AFRICAN_COUNTRIES } from "@/lib/constants";

/**
 * Noms de pays en français.
 *
 * `AFRICAN_COUNTRIES` porte des noms anglais (« Chad », « Egypt »,
 * « Senegal ») dans une interface entièrement en français : une vendeuse
 * à Dakar cherchait « Sénégal » dans une liste triée en anglais. Table
 * statique plutôt qu'`Intl.DisplayNames` : identique au serveur et dans
 * les vieux navigateurs Android, et donc sans écart d'hydratation.
 */
const FRENCH_NAMES: Record<string, string> = {
  DZ: "Algérie",
  AO: "Angola",
  BJ: "Bénin",
  BW: "Botswana",
  BF: "Burkina Faso",
  BI: "Burundi",
  CV: "Cabo Verde",
  CM: "Cameroun",
  CF: "Centrafrique",
  TD: "Tchad",
  KM: "Comores",
  CG: "Congo",
  CD: "Congo (RDC)",
  CI: "Côte d'Ivoire",
  DJ: "Djibouti",
  EG: "Égypte",
  GQ: "Guinée équatoriale",
  ER: "Érythrée",
  SZ: "Eswatini",
  ET: "Éthiopie",
  GA: "Gabon",
  GM: "Gambie",
  GH: "Ghana",
  GN: "Guinée",
  GW: "Guinée-Bissau",
  KE: "Kenya",
  LS: "Lesotho",
  LR: "Liberia",
  LY: "Libye",
  MG: "Madagascar",
  MW: "Malawi",
  ML: "Mali",
  MR: "Mauritanie",
  MU: "Maurice",
  MA: "Maroc",
  MZ: "Mozambique",
  NA: "Namibie",
  NE: "Niger",
  NG: "Nigeria",
  RW: "Rwanda",
  ST: "São Tomé-et-Príncipe",
  SN: "Sénégal",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SO: "Somalie",
  ZA: "Afrique du Sud",
  SS: "Soudan du Sud",
  SD: "Soudan",
  TZ: "Tanzanie",
  TG: "Togo",
  TN: "Tunisie",
  UG: "Ouganda",
  ZM: "Zambie",
  ZW: "Zimbabwe",
  // Diaspora (indicatifs acceptés par les formulaires) : nommés plutôt
  // qu'affichés en code brut sur la page Tarifs.
  FR: "France",
  BE: "Belgique",
  CA: "Canada",
  US: "États-Unis",
};

/** « Sénégal » pour « SN » ; le nom anglais de la liste, puis le code, en repli. */
export function countryLabel(code: string): string {
  const upper = code.toUpperCase();
  return FRENCH_NAMES[upper] ?? AFRICAN_COUNTRIES.find((c) => c.code === upper)?.name ?? upper;
}

/** Sans accents ni casse, pour un filtre au clavier : « senegal » trouve « Sénégal ». */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export interface CountryOption {
  code: string;
  label: string;
}

/** Les pays de la liste, libellés en français et triés en français. */
export const COUNTRY_OPTIONS_FR: readonly CountryOption[] = AFRICAN_COUNTRIES.map((c) => ({
  code: c.code,
  label: countryLabel(c.code),
})).sort((a, b) => a.label.localeCompare(b.label, "fr"));
