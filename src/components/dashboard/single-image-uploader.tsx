"use client";

import React, { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Trash2, UploadCloud, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface SingleImageUploaderProps {
  shopId: string;
  value: string | null;
  onChange: (url: string | null) => void;
  storageKey?: string;
  aspectClass?: string;
  label?: string;
  hint?: string;
  maxSizeMB?: number;
  className?: string;
}

export function SingleImageUploader({
  shopId,
  value,
  onChange,
  storageKey = "image",
  aspectClass = "aspect-square",
  label,
  hint,
  maxSizeMB = 5,
  className,
}: SingleImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        toast.error("Fichier non supporté. Utilisez PNG, JPG ou WebP.");
        return;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`Taille max : ${maxSizeMB} Mo.`);
        return;
      }

      setUploading(true);

      try {
        const form = new FormData();
        form.append("file", file);
        form.append("bucket", "shop-assets");
        form.append("folder", shopId);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: form,
        });
        const json = await res.json();

        if (!res.ok) {
          toast.error(json.error ?? "Échec de l'upload. Réessayez.");
          return;
        }

        onChange(json.url);
      } catch (err) {
        console.error(err);
        toast.error("Échec de l'upload. Réessayez.");
      } finally {
        setUploading(false);
      }
    },
    [shopId, maxSizeMB, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload]
  );

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      )}

      <div
        className={cn(
          "group relative overflow-hidden rounded-2xl border-2 transition-all duration-200 cursor-pointer",
          aspectClass,
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : value
            ? "border-border hover:border-primary/50"
            : "border-dashed border-border hover:border-primary/60 hover:bg-muted/40"
        )}
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value}
              alt={label ?? "Image"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-all duration-200 group-hover:bg-black/30">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center gap-2 text-white">
                <UploadCloud className="size-6 drop-shadow" />
                <span className="text-xs font-semibold drop-shadow">Modifier</span>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted transition-colors group-hover:bg-primary/10">
              <ImageIcon className="size-5 text-muted-foreground transition-colors group-hover:text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Cliquez ou glissez une image
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                PNG, JPG, WebP · Max {maxSizeMB} Mo
              </p>
            </div>
          </div>
        )}

        {uploading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Envoi en cours…</span>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
            e.target.value = "";
          }}
        />
      </div>

      {value && !uploading && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onChange(null)}
        >
          <Trash2 className="size-3" />
          Supprimer
        </Button>
      )}
    </div>
  );
}
