"use client";

import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";

// ─── Canvas helper: crop + compress ────────────────────────────────────────

async function getCroppedBlob(
  imageSrc: string,
  croppedAreaPixels: Area,
  outputSize = 256,
  quality = 0.82,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext("2d")!;

  ctx.drawImage(
    image,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    0,
    0,
    outputSize,
    outputSize,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas is empty"));
      },
      "image/jpeg",
      quality,
    );
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// ─── Component ──────────────────────────────────────────────────────────────

interface AvatarCropDialogProps {
  /** Object URL or data-URL of the selected image */
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  /** Labels (for i18n) */
  labels?: {
    title?: string;
    zoom?: string;
    confirm?: string;
    cancel?: string;
    processing?: string;
  };
}

export function AvatarCropDialog({
  imageSrc,
  onConfirm,
  onCancel,
  labels = {},
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  const {
    title = "调整头像",
    zoom: zoomLabel = "缩放",
    confirm = "确认",
    cancel = "取消",
    processing: processingLabel = "处理中…",
  } = labels;

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      onConfirm(blob);
    } finally {
      setProcessing(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.82)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden flex flex-col"
        style={{
          background:
            "linear-gradient(160deg, rgba(12,22,16,0.99) 0%, rgba(6,12,9,1) 100%)",
          border: "1px solid rgba(234,179,8,0.22)",
          boxShadow:
            "0 24px 60px rgba(0,0,0,0.75), 0 0 40px rgba(234,179,8,0.06)",
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(234,179,8,0.12)" }}
        >
          <span
            className="text-sm font-black tracking-[0.15em] uppercase"
            style={{ color: "#fcd34d" }}
          >
            🖼️ {title}
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full flex items-center justify-center text-lg transition-colors hover:bg-white/10"
            style={{ color: "rgba(156,163,175,0.8)" }}
          >
            ✕
          </button>
        </div>

        {/* Crop area */}
        <div
          className="relative w-full"
          style={{ height: 300, background: "#000" }}
        >
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { borderRadius: 0 },
              cropAreaStyle: {
                border: "2px solid rgba(250,204,21,0.85)",
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
              },
            }}
          />
        </div>

        {/* Zoom slider */}
        <div
          className="px-6 py-4 space-y-2"
          style={{ borderTop: "1px solid rgba(234,179,8,0.1)" }}
        >
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-bold tracking-[0.15em] uppercase"
              style={{ color: "rgba(245,158,11,0.65)" }}
            >
              {zoomLabel}
            </span>
            <span
              className="text-[11px] font-black tabular-nums"
              style={{ color: "rgba(245,158,11,0.75)" }}
            >
              {zoom.toFixed(1)}×
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-amber-500"
          />
        </div>

        {/* Actions */}
        <div
          className="px-6 py-4 flex gap-3"
          style={{ borderTop: "1px solid rgba(234,179,8,0.1)" }}
        >
          <button
            type="button"
            disabled={processing}
            onClick={onCancel}
            className="flex-1 h-10 rounded-xl text-xs font-black tracking-[0.12em] uppercase transition-all disabled:opacity-50"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(229,231,235,0.8)",
            }}
          >
            {cancel}
          </button>
          <button
            type="button"
            disabled={processing}
            onClick={handleConfirm}
            className="flex-2 flex-grow-[2] h-10 rounded-xl text-xs font-black tracking-[0.12em] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{
              background: processing
                ? "rgba(245,158,11,0.25)"
                : "linear-gradient(135deg, rgba(146,64,14,0.9) 0%, rgba(217,119,6,0.9) 60%, rgba(245,158,11,0.9) 100%)",
              border: "1px solid rgba(245,158,11,0.45)",
              color: processing ? "rgba(253,230,138,0.7)" : "#000",
            }}
          >
            {processing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                {processingLabel}
              </>
            ) : (
              confirm
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
