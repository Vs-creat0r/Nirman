"use client";

import * as React from "react";
import Image from "next/image";
import { Camera, Eye, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface PhotoGridProps {
  photos: Array<{ id: string; url: string; label?: string }>;
}

export function PhotoGrid({ photos }: PhotoGridProps) {
  const [selectedPhoto, setSelectedPhoto] = React.useState<string | null>(null);

  if (!photos || photos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        <Camera className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1.5" />
        <p>No site delivery photos uploaded.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {photos.map((photo, idx) => (
          <div
            key={photo.id || idx}
            onClick={() => setSelectedPhoto(photo.url)}
            className="group relative aspect-4/3 rounded-lg overflow-hidden border border-border bg-muted/40 cursor-pointer hover:border-primary/50 transition-all shadow-xs"
          >
            {photo.url ? (
              <img
                src={photo.url}
                alt={photo.label || `Site photo #${idx + 1}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-muted-foreground">
                <Camera className="h-6 w-6" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
              <Eye className="h-4 w-4" />
              <span>View</span>
            </div>
            {photo.label && (
              <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-2 py-0.5 truncate">
                {photo.label}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Dialog */}
      <Dialog open={Boolean(selectedPhoto)} onOpenChange={(open) => !open && setSelectedPhoto(null)}>
        <DialogContent className="max-w-3xl p-2 bg-background/95 border-border">
          {selectedPhoto && (
            <div className="relative aspect-16/10 w-full overflow-hidden rounded-md">
              <img
                src={selectedPhoto}
                alt="Delivery proof full preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
