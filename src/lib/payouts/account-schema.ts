import { z } from "zod";
import { iso2FromE164, isValidE164, toE164 } from "@/lib/phone/dial-codes";
import { PAYOUT_PROVIDERS, isPhonePayoutProvider } from "./config";

/**
 * Compte de reversement saisi par le vendeur. Pour Mobile Money,
 * l'identifiant est un numéro composé (E.164 sans « + », comme le numéro
 * WhatsApp) ; pour un virement, un IBAN ou un RIB.
 */
export const payoutAccountSchema = z
  .object({
    provider: z.enum(PAYOUT_PROVIDERS),
    account_name: z.string().trim().min(2).max(100),
    account_identifier: z.string().trim().min(4).max(60),
    /** Pays du compte (ISO 3166-1 alpha-2) : sert à composer le numéro. */
    country: z.string().trim().length(2).toUpperCase().optional(),
  })
  .superRefine((value, ctx) => {
    if (isPhonePayoutProvider(value.provider)) {
      const composed = toE164(value.account_identifier, value.country ?? null);
      if (!composed || !isValidE164(composed)) {
        ctx.addIssue({
          code: "custom",
          path: ["account_identifier"],
          message: "Numéro Mobile Money invalide : indique l'indicatif du pays.",
        });
      }
      return;
    }
    if (!/^[A-Z0-9 ]{8,40}$/i.test(value.account_identifier)) {
      ctx.addIssue({
        code: "custom",
        path: ["account_identifier"],
        message: "IBAN ou RIB invalide (8 à 40 lettres ou chiffres).",
      });
    }
  })
  .transform((value) => {
    if (isPhonePayoutProvider(value.provider)) {
      const composed = toE164(value.account_identifier, value.country ?? null)!;
      return {
        provider: value.provider,
        accountName: value.account_name,
        accountIdentifier: composed.replace(/^\+/, ""),
        // Le pays réel est celui de l'indicatif, pas celui de la devise.
        country: iso2FromE164(composed) ?? value.country ?? null,
      };
    }
    const identifier = value.account_identifier.replace(/\s+/g, "").toUpperCase();
    // Un IBAN commence par le code pays ; un RIB national n'en dit rien.
    const ibanCountry = /^[A-Z]{2}[0-9]{2}/.test(identifier) ? identifier.slice(0, 2) : null;
    return {
      provider: value.provider,
      accountName: value.account_name,
      accountIdentifier: identifier,
      country: ibanCountry ?? value.country ?? null,
    };
  });

export type PayoutAccountInput = z.output<typeof payoutAccountSchema>;
