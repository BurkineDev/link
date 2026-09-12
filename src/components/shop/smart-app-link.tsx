"use client";

import { useMemo, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import {
  getAppLinkDestination,
  isAndroid,
  isMobileBrowser,
  openNativeApp,
} from "@/lib/links/app-link";

type SmartAppLinkProps = ComponentPropsWithoutRef<"a"> & {
  /**
   * Route serveur `/go/<id>` à mettre dans l'ancre à la place de l'URL web :
   * sans JavaScript (ou avant qu'il ne soit chargé), c'est le serveur qui
   * décide app ou web et qui compte le clic. `href` reste la vraie
   * destination, utilisée pour reconnaître l'app et pour le tap intercepté.
   */
  goHref?: string;
  /** Appelé quand le tap est intercepté côté client (l'ancre n'est pas suivie). */
  onNativeOpen?: () => void;
};

/**
 * Lien sortant qui laisse iOS/Android ouvrir l'application associée.
 *
 * L'ancre garde toujours une URL valide pour fonctionner sans JavaScript :
 * l'URL web, ou la route serveur `/go/<id>` quand elle est fournie. Sur
 * mobile, les destinations disposant d'un schéma natif sont tentées lors du
 * tap ; sur Android, une app sans schéma mais au paquet connu (TikTok,
 * Facebook, Messenger…) est forcée par intent HTTPS ; les autres utilisent
 * leur Universal Link / App Link HTTPS.
 */
export function SmartAppLink({
  href,
  goHref,
  onNativeOpen,
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
    const canDeepLink =
      destination.nativeUrl !== null ||
      (destination.androidPackage !== null && isAndroid(navigator.userAgent));
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !canDeepLink ||
      !isMobileBrowser(navigator.userAgent, navigator.maxTouchPoints)
    ) {
      return;
    }

    event.preventDefault();
    onNativeOpen?.();
    openNativeApp(destination.nativeUrl, destination.webUrl, {
      androidPackage: destination.androidPackage,
      userAgent: navigator.userAgent,
    });
  };

  return (
    <a
      {...props}
      href={rawHref ? (goHref ?? destination.webUrl) : undefined}
      // target=_blank is precisely what traps visitors in many in-app
      // browsers. Known app links stay in the current browsing context.
      target={destination.opensInApp ? undefined : target}
      rel={destination.opensInApp ? undefined : rel}
      data-app-link={destination.opensInApp ? destination.appName : undefined}
      onClick={handleClick}
    />
  );
}
