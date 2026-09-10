import "server-only";

import { compare, hash } from "bcryptjs";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { escapeEmailHtml, sendTransactionalEmail } from "@/lib/email";

// Sur une prévisualisation Vercel, l'application vit sur l'URL de branche :
// les cookies et les retours OAuth doivent y être rattachés, pas au domaine
// de production déclaré dans NEXT_PUBLIC_APP_URL.
const vercelPreviewUrl =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL
    ? `https://${process.env.VERCEL_BRANCH_URL}`
    : undefined;
const appUrl =
  vercelPreviewUrl ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3000";
const trustedOrigins = [
  appUrl,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
].filter((origin): origin is string => Boolean(origin));
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

function authEmail({
  title,
  message,
  action,
  url,
}: {
  title: string;
  message: string;
  action: string;
  url: string;
}) {
  const safeUrl = escapeEmailHtml(url);
  return {
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#171717"><h1>${escapeEmailHtml(title)}</h1><p>${escapeEmailHtml(message)}</p><p><a href="${safeUrl}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#171717;color:#fff;text-decoration:none">${escapeEmailHtml(action)}</a></p><p style="font-size:12px;color:#666">Si le bouton ne fonctionne pas : ${safeUrl}</p></div>`,
    text: `${title}\n\n${message}\n\n${action}: ${url}`,
  };
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: appUrl,
  trustedOrigins,
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: true },
      referredBy: { type: "string", required: false, input: true },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: true,
    autoSignIn: false,
    revokeSessionsOnPasswordReset: true,
    // Supabase stores bcrypt hashes. Keeping bcrypt here means imported users
    // retain their passwords instead of being forced through a mass reset.
    password: {
      hash: (password) => hash(password, 12),
      verify: ({ password, hash: passwordHash }) =>
        compare(password, passwordHash),
    },
    sendResetPassword: async ({ user, url, token }) => {
      const body = authEmail({
        title: "Réinitialise ton mot de passe",
        message: "Ce lien est valable pendant une heure.",
        action: "Choisir un nouveau mot de passe",
        url,
      });
      after(() =>
        sendTransactionalEmail({
          to: user.email,
          subject: "Réinitialisation de ton mot de passe Bio-Lien",
          ...body,
          idempotencyKey: `password-reset/${token}`,
        }),
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url, token }) => {
      const body = authEmail({
        title: "Confirme ton adresse e-mail",
        message: "Une dernière étape et ta page Bio-Lien sera prête.",
        action: "Confirmer mon adresse",
        url,
      });
      after(() =>
        sendTransactionalEmail({
          to: user.email,
          subject: "Confirme ton compte Bio-Lien",
          ...body,
          idempotencyKey: `email-verification/${token}`,
        }),
      );
    },
  },
  socialProviders:
    googleClientId && googleClientSecret
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            prompt: "select_account",
          },
        }
      : undefined,
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await prisma.profile.upsert({
            where: { id: user.id },
            create: {
              id: user.id,
              fullName: user.name,
              avatarUrl: user.image,
              username:
                typeof user.username === "string" ? user.username : null,
            },
            update: {},
          });
        },
      },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  rateLimit: { enabled: true, window: 60, max: 20, storage: "database" },
  advanced: {
    database: { generateId: "uuid" },
    cookiePrefix: "biolien",
    defaultCookieAttributes: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },
  plugins: [nextCookies()],
});

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function getCurrentUser() {
  return (await getSession())?.user ?? null;
}

export async function requireUser(destination = "/login") {
  const user = await getCurrentUser();
  if (!user) redirect(destination);
  return user;
}

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
