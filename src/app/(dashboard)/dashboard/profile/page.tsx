import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./profile-client";

export const metadata = {
  title: "Mon profil",
};

export default async function ProfilePage() {
  const user = await requireUser();

  const [profileRow, subRow] = await Promise.all([
    prisma.profile.findUnique({
      where: { id: user.id },
      select: { id: true, username: true, fullName: true, avatarUrl: true, bio: true },
    }),
    prisma.creatorSubscription.findUnique({
      where: { userId: user.id },
      select: {
        plan: true,
        status: true,
        provider: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
  ]);

  // Le composant client lit la forme Supabase (snake_case).
  const profile = profileRow
    ? {
        id: profileRow.id,
        username: profileRow.username,
        full_name: profileRow.fullName,
        avatar_url: profileRow.avatarUrl,
        bio: profileRow.bio,
      }
    : null;
  const subscription = subRow
    ? {
        plan: subRow.plan,
        status: subRow.status,
        provider: subRow.provider,
        current_period_end: subRow.currentPeriodEnd?.toISOString() ?? null,
        cancel_at_period_end: subRow.cancelAtPeriodEnd,
      }
    : null;

  return (
    <ProfileClient
      email={user.email ?? ""}
      profile={profile}
      subscription={subscription}
    />
  );
}
