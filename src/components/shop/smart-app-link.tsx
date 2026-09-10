"use client";

import { useMemo, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import {
  getAppLinkDestination,
  isMobileBrowser,
  openNativeApp,
} from "@/lib/links/app-link";

type SmartAppLinkProps = ComponentPropsWithoutRef<"a">;

/**
 * Lien sortant qui laisse iOS/Android ouvrir l'application associée.
 *
 * L'ancre garde toujours une URL web valide pour fonctionner sans JavaScript.
 * Sur mobile, les destinations disposant d'un schéma natif sont tentées lors
 * du tap ; les autres apps utilisent leur Universal Link / App Link HTTPS.
 */
export function SmartAppLink({
  href,
  target,
  rel,
  onClick,
  ...props
}: SmartAppLinkProps) {
  const rawHref = typeof href === "string" ? href : "";
  const destination = useMemo(
    () => getAppLinkDestination(rawHref),
    [rawHref],
  );

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !destination.nativeUrl ||
      !isMobileBrowser(navigator.userAgent, navigator.maxTouchPoints)
    ) {
      return;
    }

    event.preventDefault();
    openNativeApp(destination.nativeUrl, destination.webUrl);
  };

  return (
    <a
      {...props}
      href={rawHref ? destination.webUrl : undefined}
      // target=_blank is precisely what traps visitors in many in-app
      // browsers. Known app links stay in the current browsing context.
      target={destination.opensInApp ? undefined : target}
      rel={destination.opensInApp ? undefined : rel}
      data-app-link={destination.opensInApp ? destination.appName : undefined}
      onClick={handleClick}
    />
  );
}
