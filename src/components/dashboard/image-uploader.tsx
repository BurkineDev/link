"use client";

import React, { useCallback, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ImageIcon, Loader2, X, UploadCloud } from "lucide-react";
import { compressImage } from "@/lib/utils/compress-image";

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
      onChange(
        ready.map((s, i) => ({
          url: s.url,
          position: i,
        }))
      );
    },
    [onChange]
  );

  const uploadFile = useCallback(
    async (file: File) => {
      const supabase = createClient();
      const path = `${shopId}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

      const { data, error } = await supabase.storage
        .from("shop-assets")
        .upload(path, file, { upsert: false });

      if (error || !data) {
        return { url: "", error: error?.message ?? "Échec de l'upload" };
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("shop-assets").getPublicUrl(data.path);

      return { url: publicUrl, error: undefined };
    },
    [shopId]
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      const current = slots.filter((s) => s.url && !s.loading).length;
      const remaining = maxImages - current;
      const toProcess = files.slice(0, remaining);

      if (toProcess.length === 0) return;

      const accepted: File[] = [];
      for (const file of toProcess) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > maxSizeMB * 1024 * 1024) continue;
        accepted.push(file);
      }

      const newSlots: ImageSlot[] = accepted.map((_, i) => ({
        id: `uploading-${Date.now()}-${i}`,
        url: "",
        loading: true,
      }));

      setSlots((prev) => {
        const next = [...prev, ...newSlots];
        return next;
      });

      // Compress in parallel before upload — faster on slow networks and
      // friendlier to mobile data plans. compressImage() is a no-op for
      // already-small / GIF / SVG files.
      const compressed = await Promise.all(
        accepted.map((file) => compressImage(file).catch(() => file)),
      );

      const results = await Promise.all(
        compressed.map((file) => uploadFile(file))
      );

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
      const files = Array.from(e.dataTransfer.files);
      processFiles(files);
    },
    [processFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    processFiles(files);
    e.target.value = "";
  };

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
      {/* Drop zone */}
      {canAdd && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/50"
          )}
        >
          <UploadCloud className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            <span className="font-medium text-foreground">
              Cliquez pour choisir
            </span>{" "}
            ou glissez vos images ici
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WebP · Max {maxSizeMB} Mo par image ·{" "}
            {activeSlots.length}/{maxImages} images
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleInputChange}
          />
        </div>
      )}

      {/* Thumbnails */}
      {activeSlots.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {activeSlots.map((slot) => (
            <div
              key={slot.id}
              className="relative aspect-square rounded-lg overflow-hidden bg-muted ring-1 ring-foreground/10"
            >
              {slot.loading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : slot.url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slot.url}
                    alt="Aperçu"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(slot.id)}
                    className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80 transition-colors"
                    aria-label="Supprimer l'image"
                  >
                    <X className="size-3" />
                  </button>
                </>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <ImageIcon className="size-5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!canAdd && (
        <p className="text-xs text-muted-foreground text-center">
          Limite de {maxImages} images atteinte.{" "}
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto p-0"
            onClick={() => {
              const first = activeSlots[0];
              if (first) removeSlot(first.id);
            }}
          >
            Supprimer une image pour en ajouter une autre.
          </Button>
        </p>
      )}
    </div>
  );
}
