/**
 * Validation schemas for the auth flows (sign in, sign up, forgot/reset
 * password). These run before anything touches Supabase, so a regression
 * here means a malformed payload reaches the auth API.
 */

import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/validations/auth";

// ---------------------------------------------------------------------------
// Connexion (POST /token grant_type=password)
// ---------------------------------------------------------------------------

describe("loginSchema", () => {
  const valid = { email: "jane@example.com", password: "anything" };

  it("accepts a well-formed email + non-empty password", () => {
    expect(loginSchema.parse(valid)).toEqual(valid);
  });

  it("lowercases the email so duplicates can't slip in via casing", () => {
    const result = loginSchema.parse({ ...valid, email: "Jane@Example.COM" });
    expect(result.email).toBe("jane@example.com");
  });

  it("rejects a missing email", () => {
    const result = loginSchema.safeParse({ ...valid, email: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a syntactically invalid email", () => {
    const result = loginSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty password (we don't pre-check complexity on login — Supabase decides)", () => {
    const result = loginSchema.safeParse({ ...valid, password: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const passwordIssue = result.error.issues.find((i) =>
        i.path.includes("password"),
      );
      expect(passwordIssue?.message).toBe("Password is required");
    }
  });
});

// ---------------------------------------------------------------------------
// Inscription (POST /signup) — strictest rules: name, email, strong
// password, terms checkbox.
// ---------------------------------------------------------------------------

describe("registerSchema", () => {
  const valid = {
    full_name: "Aïssata Diallo",
    email: "aissata@example.com",
    password: "Strong1Pass",
    confirm_password: "Strong1Pass",
    agreed_to_terms: true as const,
  };

  it("accepts a valid registration", () => {
    const result = registerSchema.parse(valid);
    expect(result.email).toBe("aissata@example.com");
    expect(result.full_name).toBe("Aïssata Diallo");
  });

  it("trims surrounding whitespace on the full name", () => {
    const result = registerSchema.parse({ ...valid, full_name: "  Bob Smith  " });
    expect(result.full_name).toBe("Bob Smith");
  });

  it("rejects a 1-char full name", () => {
    expect(registerSchema.safeParse({ ...valid, full_name: "A" }).success).toBe(
      false,
    );
  });

  it("rejects a full name over 100 chars", () => {
    expect(
      registerSchema.safeParse({ ...valid, full_name: "A".repeat(101) })
        .success,
    ).toBe(false);
  });

  it("requires the terms checkbox to be ticked", () => {
    const result = registerSchema.safeParse({
      ...valid,
      agreed_to_terms: false as unknown as true,
    });
    expect(result.success).toBe(false);
  });

  describe("password complexity", () => {
    it("rejects shorter than 8 chars", () => {
      expect(
        registerSchema.safeParse({
          ...valid,
          password: "Ab1",
          confirm_password: "Ab1",
        }).success,
      ).toBe(false);
    });

    it("rejects longer than 72 chars (bcrypt limit)", () => {
      const long = "A1" + "a".repeat(71);
      expect(
        registerSchema.safeParse({
          ...valid,
          password: long,
          confirm_password: long,
        }).success,
      ).toBe(false);
    });

    it("rejects no uppercase", () => {
      expect(
        registerSchema.safeParse({
          ...valid,
          password: "lower1pass",
          confirm_password: "lower1pass",
        }).success,
      ).toBe(false);
    });

    it("rejects no digit", () => {
      expect(
        registerSchema.safeParse({
          ...valid,
          password: "NoDigitPass",
          confirm_password: "NoDigitPass",
        }).success,
      ).toBe(false);
    });

    it("accepts exactly 8 chars at the boundary", () => {
      expect(
        registerSchema.safeParse({
          ...valid,
          password: "Aaaaaaa1",
          confirm_password: "Aaaaaaa1",
        }).success,
      ).toBe(true);
    });
  });

  describe("confirm_password matching", () => {
    it("rejects when the two passwords differ", () => {
      const result = registerSchema.safeParse({
        ...valid,
        confirm_password: "Different1Pass",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const mismatch = result.error.issues.find((i) =>
          i.path.includes("confirm_password"),
        );
        expect(mismatch?.message).toBe("Passwords do not match");
      }
    });

    it("rejects when confirm is empty", () => {
      expect(
        registerSchema.safeParse({ ...valid, confirm_password: "" }).success,
      ).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Mot de passe oublié — single field, but it's the entry point of the
// recovery flow.
// ---------------------------------------------------------------------------

describe("forgotPasswordSchema", () => {
  it("accepts a valid email", () => {
    const result = forgotPasswordSchema.parse({ email: "user@example.com" });
    expect(result.email).toBe("user@example.com");
  });

  it("lowercases the email (so the recovery email matches the stored account)", () => {
    const result = forgotPasswordSchema.parse({ email: "USER@Example.COM" });
    expect(result.email).toBe("user@example.com");
  });

  it("rejects an empty email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "missing-at" }).success).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// Réinitialisation du mot de passe (après le clic sur l'email recovery).
// ---------------------------------------------------------------------------

describe("resetPasswordSchema", () => {
  const valid = { password: "NewStrong1", confirm_password: "NewStrong1" };

  it("accepts matching strong passwords", () => {
    expect(resetPasswordSchema.parse(valid)).toEqual(valid);
  });

  it("applies the same complexity rules as register", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "weak",
        confirm_password: "weak",
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        password: "nouppercase1",
        confirm_password: "nouppercase1",
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        password: "NoDigitHere",
        confirm_password: "NoDigitHere",
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      password: "NewStrong1",
      confirm_password: "OtherStrong1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mismatch = result.error.issues.find((i) =>
        i.path.includes("confirm_password"),
      );
      expect(mismatch?.message).toBe("Passwords do not match");
    }
  });

  it("rejects an empty confirmation field", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "NewStrong1",
        confirm_password: "",
      }).success,
    ).toBe(false);
  });
});
