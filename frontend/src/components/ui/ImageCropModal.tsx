"use client";

import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { ZoomIn, ZoomOut, FlipHorizontal, FlipVertical, RotateCw, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { ASSET_IMAGE_MAX_BYTES, formatBytes } from "@/lib/imageCompression";

interface ImageCropModalProps {
  src: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
  onError?: (message: string) => void;
}

const MAX_CANVAS_DIM = 1200;

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area,
  flipH: boolean,
  flipV: boolean,
  rotation: number,
): Promise<File> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = imageSrc;
  });

  const rotRad = getRadianAngle(rotation);
  const { width: rotatedWidth, height: rotatedHeight } = rotateSize(image.width, image.height, rotation);

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = rotatedWidth;
  rotatedCanvas.height = rotatedHeight;
  const ctx = rotatedCanvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.save();
  ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);
  ctx.restore();

  // Cap output dimensions to avoid OOM / size-limit issues with high-res camera photos
  const scale = Math.min(1, MAX_CANVAS_DIM / Math.max(pixelCrop.width, pixelCrop.height));
  const canvasWidth = Math.round(pixelCrop.width * scale);
  const canvasHeight = Math.round(pixelCrop.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const croppedCtx = canvas.getContext("2d");
  if (!croppedCtx) throw new Error("Could not get canvas context");
  croppedCtx.drawImage(
    rotatedCanvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    canvasWidth,
    canvasHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) {
        reject(new Error("canvas.toBlob returned null"));
        return;
      }
      if (blob.size > ASSET_IMAGE_MAX_BYTES) {
        reject(new Error(`La imagen comprimida pesa ${formatBytes(blob.size)}. El maximo permitido es ${formatBytes(ASSET_IMAGE_MAX_BYTES)}.`));
        return;
      }
      resolve(new File([blob], "thumbnail.webp", { type: "image/webp" }));
    }, "image/webp", 0.8);
  });
}

export default function ImageCropModal({ src, onConfirm, onCancel, onError }: ImageCropModalProps) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [confirming, setConfirming] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels || confirming) return;
    setConfirming(true);
    try {
      const file = await getCroppedFile(src, croppedAreaPixels, flipH, flipV, rotation);
      onConfirm(file);
    } catch (err) {
      console.error("getCroppedFile failed:", err);
      onError?.(err instanceof Error ? err.message : "No se pudo procesar la imagen seleccionada.");
      onCancel();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      {/* Card */}
      <div className="relative w-full max-w-sm bg-white rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Crop viewport */}
        <div className="relative w-full h-72 bg-gray-900">
          <div
            className="absolute inset-0"
            style={{ transform: `scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})` }}
          >
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid={false}
              cropShape="round"
              style={{
                cropAreaStyle: {
                  border: "3px solid white",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
                },
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-5 space-y-4 bg-white">
          {/* Zoom slider */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setZoom(z => Math.max(1, +(z - 0.1).toFixed(2)))}
              className="p-1.5 rounded-full hover:bg-gray-100 text-subtitle/50 hover:text-title transition-colors"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="flex-1 h-1 appearance-none bg-gray-200 rounded-full outline-none
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-4
                [&::-webkit-slider-thumb]:h-4
                [&::-webkit-slider-thumb]:rounded-full
                [&::-webkit-slider-thumb]:bg-brand
                [&::-webkit-slider-thumb]:cursor-pointer
                [&::-webkit-slider-thumb]:shadow-md"
            />
            <button
              onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))}
              className="p-1.5 rounded-full hover:bg-gray-100 text-subtitle/50 hover:text-title transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setRotation(value => (value + 90) % 360)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                rotation ? "bg-brand/10 text-brand border-brand/20" : "text-subtitle hover:bg-gray-100 border-border-theme/30"
              }`}
            >
              <RotateCw className="w-4 h-4" />
              <span>Rotar</span>
            </button>
            <button
              type="button"
              onClick={() => setFlipH(v => !v)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                flipH ? "bg-brand/10 text-brand border-brand/20" : "text-subtitle hover:bg-gray-100 border-border-theme/30"
              }`}
            >
              <FlipHorizontal className="w-4 h-4" />
              <span>Horizontal</span>
            </button>
            <button
              type="button"
              onClick={() => setFlipV(v => !v)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-bold transition-all border ${
                flipV ? "bg-brand/10 text-brand border-brand/20" : "text-subtitle hover:bg-gray-100 border-border-theme/30"
              }`}
            >
              <FlipVertical className="w-4 h-4" />
              <span>Vertical</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 rounded-2xl text-sm font-bold text-subtitle hover:bg-gray-100 transition-all"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-2 py-3 rounded-2xl text-sm font-black text-white bg-brand hover:bg-brand/90 active:scale-95 disabled:opacity-60 disabled:scale-100 transition-all shadow-lg shadow-brand/20 flex items-center justify-center"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : t.common.confirm}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
