"use client";

import { useState } from "react";
import { Check, Copy, Link2, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FacebookIcon, XIcon } from "@/components/shop/brand-icons";
import { QrCode } from "@/components/shared/qr-code";
import { cn } from "@/lib/utils";

/**
 * Share sheet for a bio page or a single link.
 *
 * Deliberately rendered in the app's own neutral surface rather than the
 * seller's theme: it is a system dialog, and buyers recognise it faster when
 * it looks the same on every page.
 */

interface ShareTarget {
  /** Absolute URL being shared. */
  url: string;
  /** Human title used by the native share sheet and the social intents. */
  title: string;
}

interface BioShareSheetProps extends ShareTarget {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shown under the title — e.g. the link label being shared. */
  subtitle?: string;
}

const CHANNELS: Array<{
  key: string;
  label: string;
  color: string;
  icon: React.ElementType;
  href: (t: ShareTarget) => string;
}> = [
  {
    key: "whatsapp",
    label: "WhatsApp",
    color: "#25D366",
    icon: MessageCircle,
    href: ({ url, title }) =>
      `https://wa.me/?text=${encodeURIComponent(`${title} — ${url}`)}`,
  },
  {
    key: "facebook",
    label: "Facebook",
    color: "#1877F2",
    icon: FacebookIcon,
    href: ({ url }) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    key: "telegram",
    label: "Telegram",
    color: "#229ED9",
    icon: Send,
    href: ({ url, title }) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    key: "x",
    label: "X",
    color: "#0F172A",
    icon: XIcon,
    href: ({ url, title }) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
  },
  {
    key: "email",
    label: "E-mail",
    color: "#64748B",
    icon: Mail,
    href: ({ url, title }) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
];

export function BioShareSheet({
  open,
  onOpenChange,
  url,
  title,
  subtitle,
}: BioShareSheetProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié !");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien.");
    }
  };

  const nativeShare = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      await copy();
      return;
    }
    try {
      await navigator.share({ title, url });
    } catch {
      // The user dismissed the sheet — nothing to report.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Partager</DialogTitle>
          <DialogDescription>
            {subtitle ?? "Envoie ce lien à tes clients, ou fais scanner le QR."}
          </DialogDescription>
        </DialogHeader>

        {/* QR — the offline channel: a poster, a shop window, a phone screen. */}
        <div className="flex justify-center">
          <div className="rounded-2xl border border-border bg-white p-3 shadow-sm">
            <QrCode value={url} size={168} alt={`QR code — ${title}`} />
          </div>
        </div>

        {/* URL + copy */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 p-2">
          <Link2 className="ml-1 size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">
            {url.replace(/^https?:\/\//, "")}
          </span>
          <button
            type="button"
            onClick={copy}
            aria-label="Copier le lien"
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
              "bg-foreground text-background transition-transform active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copié" : "Copier"}
          </button>
        </div>

        {/* Social intents */}
        <div className="grid grid-cols-5 gap-2">
          {CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
            <a
              key={channel.key}
              href={channel.href({ url, title })}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl p-2 text-[10px] font-medium",
                "text-muted-foreground transition-colors hover:bg-muted",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span
                className="flex size-9 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: channel.color }}
                aria-hidden
              >
                <Icon className="size-4" />
              </span>
              {channel.label}
            </a>
            );
          })}
        </div>

        <button
          type="button"
          onClick={nativeShare}
          className={cn(
            "flex h-11 w-full items-center justify-center gap-2 rounded-xl",
            "bg-primary text-sm font-semibold text-primary-foreground",
            "transition-transform active:scale-[0.99]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <Share2 className="size-4" />
          Autres options de partage
        </button>
      </DialogContent>
    </Dialog>
  );
}
