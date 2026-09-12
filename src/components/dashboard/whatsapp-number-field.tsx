"use client";

import { useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AFRICAN_COUNTRIES } from "@/lib/constants";
import { DIAL_CODES, dialCodeEntry, dialCodeFor, nsnHint, toE164 } from "@/lib/phone/dial-codes";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Saisie du numéro WhatsApp du vendeur : indicatif choisi dans une liste,
 * numéro local à côté, et le numéro international composé affiché dessous
 * avec un lien « Tester » qui ouvre wa.me.
 *
 * Avant, un seul champ libre acceptait « 70 12 34 56 » sans indicatif : le
 * lien wa.me de chaque bouton d'achat était mort et le vendeur ne le voyait
 * pas. Ici, `value` est TOUJOURS le numéro composé (E.164 sans « + », le
 * format attendu par wa.me et stocké en base), ou "" tant qu'il n'est pas
 * valide.
 */

const OPTIONS = AFRICAN_COUNTRIES.map((c) => ({
  iso2: c.code,
  name: c.name,
  dialCode: dialCodeFor(c.code) ?? "",
  flag: dialCodeEntry(c.code)?.flag ?? "",
})).filter((c) => c.dialCode);

/** Devine le pays d'un numéro déjà stocké (« 22670123456 » → BF). */
function guessIso2(stored: string, fallback: string): string {
  const digits = stored.replace(/\D/g, "");
  if (!digits) return fallback;
  const match = [...DIAL_CODES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((e) => digits.startsWith(e.dialCode.slice(1)));
  return match?.iso2 ?? fallback;
}

/** Partie locale d'un numéro déjà stocké (« 22670123456 », BF → « 70123456 »). */
function localPart(stored: string, iso2: string): string {
  const digits = stored.replace(/\D/g, "");
  const code = (dialCodeFor(iso2) ?? "").slice(1);
  return code && digits.startsWith(code) ? digits.slice(code.length) : digits;
}

/** Pays par défaut selon la devise choisie par le vendeur. */
export function defaultIso2ForCurrency(currency: string | null | undefined): string {
  switch ((currency ?? "").toUpperCase()) {
    case "XAF":
      return "CM";
    case "GHS":
      return "GH";
    case "NGN":
      return "NG";
    case "KES":
      return "KE";
    case "MAD":
      return "MA";
    default:
      return "CI";
  }
}

export function WhatsAppNumberField({
  id = "whatsapp-number",
  value,
  onChange,
  currency,
  label = "Ton numéro WhatsApp",
  help = "C'est ici que les commandes arrivent.",
  className,
  inputClassName,
  testLink = true,
}: {
  id?: string;
  /** Numéro composé stocké (chiffres seuls, ex. « 22670123456 »), ou "". */
  value: string;
  /** Reçoit le numéro composé (chiffres seuls) ou "" si invalide. */
  onChange: (composedDigits: string) => void;
  /** Devise de la boutique : pré-sélectionne l'indicatif. */
  currency?: string | null;
  label?: string;
  help?: string;
  className?: string;
  inputClassName?: string;
  /** Lien « Tester sur WhatsApp » : à désactiver quand le numéro sert à autre chose (Mobile Money). */
  testLink?: boolean;
}) {
  const fallback = defaultIso2ForCurrency(currency);
  const [iso2, setIso2] = useState(() => guessIso2(value, fallback));
  const [local, setLocal] = useState(() => localPart(value, guessIso2(value, fallback)));

  const dialCode = dialCodeFor(iso2) ?? "";
  const hint = nsnHint(iso2);
  const composed = useMemo(() => toE164(local, iso2), [local, iso2]);
  const touched = local.trim().length > 0;

  const emit = (nextLocal: string, nextIso2: string) => {
    const e164 = toE164(nextLocal, nextIso2);
    onChange(e164 ? e164.slice(1) : "");
  };

  return (
    <div className={className ?? "space-y-1.5"}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Select
          value={iso2}
          onValueChange={(v) => {
            if (!v) return;
            setIso2(v);
            emit(local, v);
          }}
        >
          <SelectTrigger className={`w-[7.5rem] shrink-0 ${inputClassName ?? ""}`} aria-label="Indicatif du pays">
            <SelectValue>
              {dialCodeEntry(iso2)?.flag} {dialCode}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((c) => (
              <SelectItem key={c.iso2} value={c.iso2}>
                {c.flag} {c.dialCode} · {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder={hint ? `${hint}, ex. 70 12 34 56` : "Numéro"}
          value={local}
          onChange={(e) => {
            setLocal(e.target.value);
            emit(e.target.value, iso2);
          }}
          aria-invalid={touched && !composed}
          aria-describedby={`${id}-help`}
          className={`flex-1 ${inputClassName ?? ""}`}
        />
      </div>
      <p id={`${id}-help`} className={`text-xs ${touched && !composed ? "text-destructive" : "text-muted-foreground"}`}>
        {composed ? (
          <>
            Numéro utilisé : <span className="font-medium text-foreground">{composed}</span>
            {testLink ? (
              <>
                {" · "}
                <a
                  href={`https://wa.me/${composed.slice(1)}?text=${encodeURIComponent("Test Bio-Lien : ce numéro reçoit bien les commandes.")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline underline-offset-2"
                >
                  Tester sur WhatsApp <ExternalLink className="size-3" aria-hidden />
                </a>
              </>
            ) : null}
          </>
        ) : touched ? (
          `Numéro invalide pour ${dialCode} : ${hint ?? "vérifie le nombre de chiffres"}.`
        ) : (
          `${help} Sans l'indicatif ${dialCode}${hint ? `, ${hint}` : ""}.`
        )}
      </p>
    </div>
  );
}
