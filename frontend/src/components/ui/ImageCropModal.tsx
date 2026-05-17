"use client";

import React, { useState, useCallback } from "react";
import Cropper, { Area } from "react-easy-crop";
import { ZoomIn, ZoomOut } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface ImageCropModalProps {
  src: string;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

async function getCroppedFile(imageSrc: string, pixelCrop: Area): Promise<File> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise<void>(resolve => { image.onload = () => resolve(); });

  const canvas = document.createElement("canvas");
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);

  return new Promise(resolve => {
    canvas.toBlob(blob => {
      resolve(new File([blob!], "thumbnail.webp", { type: "image/webp" }));
    }, "image/webp", 0.92);
  });
}

export default function ImageCropModal({ src, onConfirm, onCancel }: ImageCropModalProps) {
  const { t } = useLanguage();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedAreaPixels) return;
    const file = await getCroppedFile(src, croppedAreaPixels);
    onConfirm(file);
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
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
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
              className="flex-2 py-3 rounded-2xl text-sm font-black text-white bg-brand hover:bg-brand/90 active:scale-95 transition-all shadow-lg shadow-brand/20"
            >
              {t.common.confirm}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
