import { adminEmails, isAdminEmail } from "@/lib/admin-emails";

describe("équipe Bio-Lien (ADMIN_EMAILS)", () => {
  test("liste normalisée : espaces, casse, vides", () => {
    expect(adminEmails({ ADMIN_EMAILS: " Aristide@Example.com ,, ops@example.com " })).toEqual([
      "aristide@example.com",
      "ops@example.com",
    ]);
    expect(adminEmails({})).toEqual([]);
  });

  test("isAdminEmail : insensible à la casse, faux sans configuration ou sans e-mail", () => {
    const env = { ADMIN_EMAILS: "aristide@example.com" };
    expect(isAdminEmail("ARISTIDE@example.com", env)).toBe(true);
    expect(isAdminEmail("vendeur@example.com", env)).toBe(false);
    expect(isAdminEmail(null, env)).toBe(false);
    expect(isAdminEmail("aristide@example.com", {})).toBe(false);
  });
});
