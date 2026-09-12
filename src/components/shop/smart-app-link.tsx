"use client";

import { useEffect, useMemo, type ComponentPropsWithoutRef, type MouseEvent } from "react";
import {
  getAppLinkDestination,
  isAndroid,
  isMobileBrowser,
  openNativeApp,
} from "@/lib/links/app-link";

type SmartAppLinkProps = ComponentPropsWithoutRef<"a"> & {
  /**
   * Route serveur `/go/<id>`, posée en `data-go` sur l'ancre. L'ancre garde
   * la vraie URL (les Universal Links iOS et App Links Android ne se
   * déclenchent que sur l'URL tapée) ; le script inline de la BioPage
   * (`AndroidGoScript`) envoie vers `/go` les taps Android tant que la page
   * n'est pas hydratée, pour que le serveur décide app ou web.
   */
  goHref?: string;
  /** Appelé quand le tap est intercepté côté client (l'ancre n'est pas suivie). */
  onNativeOpen?: () => void;
};

/**
 * Lien sortant qui laisse iOS/Android ouvrir l'application associée.
 *
 * L'ancre garde toujours l'URL web pour fonctionner sans JavaScript. Sur
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

  // Signale au script inline que React a pris la main : à partir de là,
  // c'est ce composant qui intercepte les taps, plus la route /go.
  useEffect(() => {
    document.documentElement.setAttribute("data-hydrated", "");
  }, []);

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
      href={rawHref ? destination.webUrl : undefined}
      data-go={goHref}
      // target=_blank is precisely what traps visitors in many in-app
      // browsers. Known app links stay in the current browsing context.
      target={destination.opensInApp ? undefined : target}
      rel={destination.opensInApp ? undefined : rel}
      data-app-link={destination.opensInApp ? destination.appName : undefined}
      onClick={handleClick}
    />
  );
}
