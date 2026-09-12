import type { LinkIconValue } from "./icons";

/**
 * Plateformes dont les liens web sont associés à une application mobile.
 *
 * La majorité publient des Universal Links (iOS) / App Links (Android) : une
 * navigation dans l'onglet courant suffit alors à laisser le système ouvrir
 * l'application. Quelques plateformes ont en plus un schéma natif public ;
 * ces schémas sont construits dans `app-link.ts` pour mieux fonctionner dans
 * les navigateurs intégrés d'Instagram, TikTok, etc.
 */
export interface LinkPlatform {
  id: string;
  label: string;
  hosts: readonly string[];
  icon: LinkIconValue;
  hasHandle?: boolean;
}

export const APP_PLATFORMS: readonly LinkPlatform[] = [
  { id: "instagram", label: "Instagram", hosts: ["instagram.com", "instagr.am"], icon: "instagram", hasHandle: true },
  { id: "tiktok", label: "TikTok", hosts: ["tiktok.com"], icon: "tiktok", hasHandle: true },
  { id: "facebook", label: "Facebook", hosts: ["facebook.com", "fb.com", "fb.me"], icon: "facebook", hasHandle: true },
  { id: "youtube", label: "YouTube", hosts: ["youtube.com", "youtu.be"], icon: "youtube", hasHandle: true },
  { id: "whatsapp", label: "WhatsApp", hosts: ["wa.me", "api.whatsapp.com", "chat.whatsapp.com", "whatsapp.com"], icon: "whatsapp" },
  { id: "telegram", label: "Telegram", hosts: ["t.me", "telegram.me", "telegram.org"], icon: "telegram", hasHandle: true },
  { id: "x", label: "X", hosts: ["x.com", "twitter.com"], icon: "website", hasHandle: true },
  { id: "linkedin", label: "LinkedIn", hosts: ["linkedin.com"], icon: "website" },
  { id: "snapchat", label: "Snapchat", hosts: ["snapchat.com"], icon: "website", hasHandle: true },
  { id: "spotify", label: "Spotify", hosts: ["spotify.com"], icon: "website" },
  { id: "pinterest", label: "Pinterest", hosts: ["pinterest.com", "pin.it"], icon: "website", hasHandle: true },
  { id: "threads", label: "Threads", hosts: ["threads.net", "threads.com"], icon: "website", hasHandle: true },
  { id: "messenger", label: "Messenger", hosts: ["messenger.com", "m.me"], icon: "website" },
  { id: "apple-music", label: "Apple Music", hosts: ["music.apple.com"], icon: "website" },
  { id: "deezer", label: "Deezer", hosts: ["deezer.com"], icon: "website" },
  { id: "soundcloud", label: "SoundCloud", hosts: ["soundcloud.com"], icon: "website", hasHandle: true },
  { id: "audiomack", label: "Audiomack", hosts: ["audiomack.com"], icon: "website" },
  { id: "boomplay", label: "Boomplay", hosts: ["boomplay.com"], icon: "website" },
  { id: "tidal", label: "TIDAL", hosts: ["tidal.com"], icon: "website" },
  { id: "amazon-music", label: "Amazon Music", hosts: ["music.amazon.com", "music.amazon.fr", "music.amazon.ca", "music.amazon.co.uk"], icon: "website" },
  { id: "bandcamp", label: "Bandcamp", hosts: ["bandcamp.com"], icon: "website", hasHandle: true },
  { id: "twitch", label: "Twitch", hosts: ["twitch.tv"], icon: "website", hasHandle: true },
  { id: "kick", label: "Kick", hosts: ["kick.com"], icon: "website", hasHandle: true },
  { id: "vimeo", label: "Vimeo", hosts: ["vimeo.com"], icon: "website" },
  { id: "dailymotion", label: "Dailymotion", hosts: ["dailymotion.com", "dai.ly"], icon: "website" },
  { id: "reddit", label: "Reddit", hosts: ["reddit.com", "redd.it"], icon: "website" },
  { id: "discord", label: "Discord", hosts: ["discord.com", "discord.gg"], icon: "website" },
  { id: "slack", label: "Slack", hosts: ["slack.com"], icon: "website" },
  { id: "viber", label: "Viber", hosts: ["viber.com", "invite.viber.com"], icon: "website" },
  { id: "line", label: "LINE", hosts: ["line.me"], icon: "website" },
  { id: "signal", label: "Signal", hosts: ["signal.me"], icon: "website" },
  { id: "wechat", label: "WeChat", hosts: ["weixin.qq.com", "wechat.com"], icon: "website" },
  { id: "patreon", label: "Patreon", hosts: ["patreon.com"], icon: "website", hasHandle: true },
  { id: "kofi", label: "Ko-fi", hosts: ["ko-fi.com"], icon: "website", hasHandle: true },
  { id: "buymeacoffee", label: "Buy Me a Coffee", hosts: ["buymeacoffee.com"], icon: "website", hasHandle: true },
  { id: "gumroad", label: "Gumroad", hosts: ["gumroad.com"], icon: "website", hasHandle: true },
  { id: "etsy", label: "Etsy", hosts: ["etsy.com"], icon: "website" },
  { id: "amazon", label: "Amazon", hosts: ["amazon.com", "amazon.fr", "amazon.ca", "amazon.co.uk", "amzn.to"], icon: "website" },
  { id: "ebay", label: "eBay", hosts: ["ebay.com", "ebay.fr", "ebay.ca"], icon: "website" },
  { id: "shop", label: "Shop", hosts: ["shop.app"], icon: "shop" },
  { id: "behance", label: "Behance", hosts: ["behance.net"], icon: "website", hasHandle: true },
  { id: "dribbble", label: "Dribbble", hosts: ["dribbble.com"], icon: "website", hasHandle: true },
  { id: "github", label: "GitHub", hosts: ["github.com"], icon: "website", hasHandle: true },
  { id: "gitlab", label: "GitLab", hosts: ["gitlab.com"], icon: "website", hasHandle: true },
  { id: "medium", label: "Medium", hosts: ["medium.com"], icon: "website", hasHandle: true },
  { id: "substack", label: "Substack", hosts: ["substack.com"], icon: "website" },
  { id: "calendly", label: "Calendly", hosts: ["calendly.com"], icon: "website", hasHandle: true },
  { id: "eventbrite", label: "Eventbrite", hosts: ["eventbrite.com", "eventbrite.fr"], icon: "website" },
  { id: "airbnb", label: "Airbnb", hosts: ["airbnb.com", "airbnb.fr", "airbnb.ca"], icon: "website" },
  { id: "booking", label: "Booking.com", hosts: ["booking.com"], icon: "website" },
  { id: "google-maps", label: "Google Maps", hosts: ["maps.google.com", "maps.app.goo.gl"], icon: "website" },
  { id: "waze", label: "Waze", hosts: ["waze.com"], icon: "website" },
  { id: "uber", label: "Uber", hosts: ["uber.com", "m.uber.com"], icon: "website" },
  { id: "bolt", label: "Bolt", hosts: ["bolt.eu"], icon: "website" },
  { id: "zoom", label: "Zoom", hosts: ["zoom.us"], icon: "website" },
  { id: "google-meet", label: "Google Meet", hosts: ["meet.google.com"], icon: "website" },
  { id: "teams", label: "Microsoft Teams", hosts: ["teams.microsoft.com", "teams.live.com"], icon: "website" },
  { id: "notion", label: "Notion", hosts: ["notion.so", "notion.site"], icon: "website" },
  { id: "canva", label: "Canva", hosts: ["canva.com"], icon: "website" },
  { id: "figma", label: "Figma", hosts: ["figma.com"], icon: "website" },
  { id: "linktree", label: "Linktree", hosts: ["linktr.ee"], icon: "website", hasHandle: true },
  { id: "bereal", label: "BeReal", hosts: ["bere.al", "bereal.com"], icon: "website" },
  { id: "triller", label: "Triller", hosts: ["triller.co"], icon: "website" },
  { id: "likee", label: "Likee", hosts: ["likee.video"], icon: "website" },
  { id: "vk", label: "VK", hosts: ["vk.com"], icon: "website", hasHandle: true },
  { id: "tumblr", label: "Tumblr", hosts: ["tumblr.com"], icon: "website", hasHandle: true },
  { id: "flickr", label: "Flickr", hosts: ["flickr.com"], icon: "website" },
  { id: "five-hundred-px", label: "500px", hosts: ["500px.com"], icon: "website" },
  { id: "vsco", label: "VSCO", hosts: ["vsco.co"], icon: "website", hasHandle: true },
  { id: "clubhouse", label: "Clubhouse", hosts: ["clubhouse.com"], icon: "website" },
  { id: "quora", label: "Quora", hosts: ["quora.com"], icon: "website" },
  { id: "rumble", label: "Rumble", hosts: ["rumble.com"], icon: "website" },
  { id: "vinted", label: "Vinted", hosts: ["vinted.com", "vinted.fr", "vinted.ca"], icon: "website" },
  { id: "depop", label: "Depop", hosts: ["depop.com"], icon: "website" },
] as const;

export const SUPPORTED_APP_COUNT = APP_PLATFORMS.length;

/** `www.` et les variantes mobiles ne changent pas la plateforme. */
export function normalizeLinkHost(host: string): string {
  const lower = host.toLowerCase();
  const stripped = lower.replace(/^(www|m|mobile)\./, "");
  // « m.me » (Messenger) n'est pas « me » avec un préfixe mobile : on ne
  // retire le préfixe que s'il reste un vrai domaine derrière.
  return stripped.includes(".") ? stripped : lower;
}

/** Hôte exact ou sous-domaine légitime, jamais une simple sous-chaîne. */
export function linkHostMatches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function findLinkPlatform(url: URL): LinkPlatform | null {
  const host = normalizeLinkHost(url.hostname);
  return (
    APP_PLATFORMS.find((platform) =>
      platform.hosts.some((domain) => linkHostMatches(host, domain)),
    ) ?? null
  );
}
