/**
 * Compte de reversement : validation et normalisation (account-schema.ts).
 */

import { payoutAccountSchema } from "@/lib/payouts/account-schema";

describe("payoutAccountSchema", () => {
  test("Mobile Money : numéro local + pays → E.164 sans « + », pays déduit de l'indicatif", () => {
    const r = payoutAccountSchema.safeParse({
      provider: "orange_money",
      account_name: "Awa Traoré",
      account_identifier: "70 12 34 56",
      country: "bf",
    });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      provider: "orange_money",
      accountName: "Awa Traoré",
      accountIdentifier: "22670123456",
      country: "BF",
    });
  });

  test("Mobile Money : un numéro international prime sur le pays indiqué", () => {
    const r = payoutAccountSchema.safeParse({
      provider: "wave",
      account_name: "Kofi",
      account_identifier: "+221771234567",
      country: "CI",
    });
    expect(r.success).toBe(true);
    expect(r.data?.accountIdentifier).toBe("221771234567");
    expect(r.data?.country).toBe("SN");
  });

  test("Mobile Money : numéro sans indicatif ni pays refusé, avec le champ en cause", () => {
    const r = payoutAccountSchema.safeParse({
      provider: "wave",
      account_name: "Kofi",
      account_identifier: "0701020304",
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["account_identifier"]);
  });

  test("virement : IBAN normalisé (espaces retirés, majuscules), mauvais format refusé", () => {
    const ok = payoutAccountSchema.safeParse({
      provider: "bank",
      account_name: "SARL Wax & Co",
      account_identifier: "ci93 ci00 1234 5678 9012",
      country: "CI",
    });
    expect(ok.success).toBe(true);
    expect(ok.data?.accountIdentifier).toBe("CI93CI00123456789012");
    expect(ok.data?.country).toBe("CI");

    const bad = payoutAccountSchema.safeParse({
      provider: "bank",
      account_name: "SARL",
      account_identifier: "12-34",
    });
    expect(bad.success).toBe(false);
  });

  test("fournisseur inconnu et nom trop court refusés", () => {
    expect(
      payoutAccountSchema.safeParse({ provider: "paypal", account_name: "A", account_identifier: "+22670123456" })
        .success,
    ).toBe(false);
  });
});
