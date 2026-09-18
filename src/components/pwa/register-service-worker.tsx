"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker (public/sw.js) une fois la page chargée, en
 * production seulement : en développement il masquerait le rechargement à
 * chaud. Un échec est silencieux — le site marche sans lui, il ne fait que
 * rendre l'installation possible et la 3G plus douce.
 */
export function RegisterServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Sans service worker, rien ne change pour le visiteur.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
