"use client";

import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { ZoomIn, ZoomOut, FlipHorizontal, FlipVertical, RotateCw, RotateCcw, Loader2, X } from "lucide-react";

interface LogoCropModalProps {
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
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    canvasWidth, canvasHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error("canvas.toBlob returned null")); return; }
      resolve(new File([blob], "logo.webp", { type: "image/webp" }));
    }, "image/webp", 0.9);
  });
}

export default function LogoCropModal({ src, onConfirm, onCancel, onError }: LogoCropModalProps) {
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

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setFlipH(false);
    setFlipV(false);
    setRotation(0);
  };

  const handleConfirm = async () => {
    if (!croppedAreaPixels || confirming) return;
    setConfirming(true);
    try {
      const file = await getCroppedFile(src, croppedAreaPixels, flipH, flipV, rotation);
      onConfirm(file);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "No se pudo procesar la imagen.");
      onCancel();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-200 flex items-center justify-center p-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onCancel}
      />

      <div className="relative w-full max-w-md bg-white rounded-4xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border-theme/20">
          <div>
            <p className="text-sm font-black text-title tracking-tight">Ajustar logo</p>
            <p className="text-xs text-subtitle/50 mt-0.5">Recorta y ajusta antes de guardar</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 rounded-xl hover:bg-app-bg transition-colors text-subtitle/40 hover:text-subtitle"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Crop viewport */}
        <div className="relative w-full h-72 bg-gray-950 overflow-hidden">
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
              showGrid={true}
              cropShape="rect"
              style={{
                cropAreaStyle: {
                  border: "2px solid rgba(255,255,255,0.8)",
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                },
              }}
            />
          </div>
        </div>

        {/* Controls */}
        <div className="px-6 py-5 space-y-4 bg-white">

          {/* Zoom slider */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setZoom(z => Math.max(1, +(z - 0.1).toFixed(2)))}
              className="p-2 rounded-xl hover:bg-app-bg text-subtitle/50 hover:text-title transition-colors"
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
              className="flex-1 h-1.5 appearance-none bg-gray-200 rounded-full outline-none
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
              className="p-2 rounded-xl hover:bg-app-bg text-subtitle/50 hover:text-title transition-colors"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* Flip + reset tools */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setRotation(value => (value + 90) % 360)}
              title="Rotar"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                rotation
                  ? "bg-brand/10 border-brand/30 text-brand"
                  : "bg-app-bg border-border-theme/30 text-subtitle/60 hover:text-title hover:border-border-theme/60"
              }`}
            >
              <RotateCw className="w-3.5 h-3.5" />
              Rotar
            </button>
            <button
              onClick={() => setFlipH(v => !v)}
              title="Voltear horizontal"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                flipH
                  ? "bg-brand/10 border-brand/30 text-brand"
                  : "bg-app-bg border-border-theme/30 text-subtitle/60 hover:text-title hover:border-border-theme/60"
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
              Horizontal
            </button>
            <button
              onClick={() => setFlipV(v => !v)}
              title="Voltear vertical"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                flipV
                  ? "bg-brand/10 border-brand/30 text-brand"
                  : "bg-app-bg border-border-theme/30 text-subtitle/60 hover:text-title hover:border-border-theme/60"
              }`}
            >
              <FlipVertical className="w-3.5 h-3.5" />
              Vertical
            </button>
            <button
              onClick={handleReset}
              title="Restablecer"
              className="ml-auto p-2 rounded-xl bg-app-bg border border-border-theme/30 text-subtitle/50 hover:text-title hover:border-border-theme/60 transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-subtitle/60 hover:bg-app-bg transition-all border border-border-theme/30"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 py-2.5 rounded-xl text-sm font-black text-white bg-brand hover:bg-brand/90 active:scale-95 disabled:opacity-60 disabled:scale-100 transition-all shadow-lg shadow-brand/20 flex items-center justify-center gap-2"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
