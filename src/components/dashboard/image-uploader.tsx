"use client";

import React, { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { ImageIcon, Loader2, X, UploadCloud, Star } from "lucide-react";
import { toast } from "sonner";

export interface UploadedImage {
  url: string;
  alt?: string;
  position: number;
}

interface ImageUploaderProps {
  shopId: string;
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
  className?: string;
}

interface ImageSlot {
  id: string;
  url: string;
  loading: boolean;
  error?: string;
}

const MAX_SIZE_DEFAULT = 5;
const MAX_IMAGES_DEFAULT = 6;

export function ImageUploader({
  shopId,
  value,
  onChange,
  maxImages = MAX_IMAGES_DEFAULT,
  maxSizeMB = MAX_SIZE_DEFAULT,
  className,
}: ImageUploaderProps) {
  const [slots, setSlots] = useState<ImageSlot[]>(
    value.map((img, i) => ({
      id: `existing-${i}`,
      url: img.url,
      loading: false,
    }))
  );
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const syncToParent = useCallback(
    (updated: ImageSlot[]) => {
      const ready = updated.filter((s) => s.url && !s.loading);
      onChange(ready.map((s, i) => ({ url: s.url, position: i })));
    },
    [onChange]
  );

  const uploadFile = useCallback(
    async (file: File) => {
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
          return { url: "", error: json.error ?? "Échec de l'upload" };
        }

        return { url: json.url, error: undefined };
      } catch (err) {
        console.error(err);
        return { url: "", error: (err as Error).message || "Échec de l'upload" };
      }
    },
    [shopId]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      const accepted: File[] = [];

      for (const file of files) {
        if (!file) continue;
        if (file.size > maxSizeMB * 1024 * 1024) {
          toast.error(`${file.name} dépasse ${maxSizeMB} Mo.`);
          continue;
        }
        accepted.push(file);
      }

      const activeCount = slots.filter((s) => s.url || s.loading).length;
      const available = Math.max(0, maxImages - activeCount);
      if (accepted.length === 0) return;
      if (accepted.length > available) {
        toast.error(`Vous ne pouvez téléverser que ${available} image(s) supplémentaires.`);
      }

      const toUpload = accepted.slice(0, available);
      if (toUpload.length === 0) return;

      const newSlots: ImageSlot[] = toUpload.map((_, i) => ({
        id: `uploading-${Date.now()}-${i}`,
        url: "",
        loading: true,
      }));

      setSlots((prev) => [...prev, ...newSlots]);

      const results = await Promise.all(toUpload.map((file) => uploadFile(file)));

      setSlots((prev) => {
        const next = [...prev];
        newSlots.forEach((slot, i) => {
          const idx = next.findIndex((s) => s.id === slot.id);
          if (idx === -1) return;
          if (results[i].url) {
            next[idx] = { ...next[idx], url: results[i].url, loading: false };
          } else {
            next.splice(idx, 1);
          }
        });
        syncToParent(next);
        return next;
      });
    },
    [slots, maxImages, maxSizeMB, uploadFile, syncToParent]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      processFiles(Array.from(e.dataTransfer.files));
    },
    [processFiles]
  );

  const removeSlot = (id: string) => {
    setSlots((prev) => {
      const next = prev.filter((s) => s.id !== id);
      syncToParent(next);
      return next;
    });
  };

  const activeSlots = slots.filter((s) => s.url || s.loading);
  const canAdd = activeSlots.length < maxImages;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Thumbnails grid */}
      {activeSlots.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {activeSlots.map((slot, index) => (
            <div
              key={slot.id}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl bg-muted ring-1 transition-all",
                index === 0
                  ? "ring-primary/60 col-span-1 row-span-1"
                  : "ring-foreground/8"
              )}
            >
              {slot.loading ? (
                <div className="flex h-full items-center justify-center bg-muted">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : slot.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slot.url}
                    alt={`Image ${index + 1}`}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Primary badge */}
                  {index === 0 && (
                    <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                      <Star className="size-2 fill-white" />
                      Principale
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition-all hover:bg-black/90 group-hover:opacity-100"
                    aria-label="Supprimer"
                  >
                    <X className="size-3" />
                  </button>
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="size-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {canAdd && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-muted/40"
          )}
        >
          <div className={cn(
            "flex size-12 items-center justify-center rounded-2xl transition-colors",
            isDragging ? "bg-primary/15" : "bg-muted"
          )}>
            <UploadCloud className={cn(
              "size-5 transition-colors",
              isDragging ? "text-primary" : "text-muted-foreground"
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              <span className="text-primary">Cliquez pour choisir</span> ou glissez ici
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              PNG, JPG, WebP · Max {maxSizeMB} Mo · {activeSlots.length}/{maxImages} images
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              processFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
      )}

      {!canAdd && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Limite de {maxImages} images atteinte.{" "}
          <button
            type="button"
            className="text-primary underline underline-offset-2 hover:no-underline"
            onClick={() => {
              const first = activeSlots[0];
              if (first) removeSlot(first.id);
            }}
          >
            Supprimer une image pour libérer de l'espace.
          </button>
        </p>
      )}
    </div>
  );
}
