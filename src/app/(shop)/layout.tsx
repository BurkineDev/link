/**
 * Layout wrapper for public shop pages.
 *
 * Intentionally minimal — no dashboard chrome, no sidebar.
 * Individual shop pages inject their own theme color via an inline CSS variable.
 */

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
