'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCw, RotateCcw, FlipHorizontal, FlipVertical, ZoomIn, ZoomOut, Check, RefreshCw, Crop } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
  onComplete: (dataUrl: string) => void;
  initialAspectRatio?: number | 'free'; // e.g. 1 for square, 4/3, 16/9, or 'free'
  title?: string;
}

export function ImageCropModal({
  isOpen,
  imageSrc,
  onClose,
  onComplete,
  initialAspectRatio = 1,
  title = 'Chỉnh sửa & Cắt ảnh',
}: ImageCropModalProps) {
  const [aspect, setAspect] = useState<number | 'free'>(initialAspectRatio);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // in degrees: 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Reset transforms when new imageSrc is opened
  useEffect(() => {
    if (isOpen && imageSrc) {
      setZoom(1);
      setRotation(0);
      setFlipH(false);
      setFlipV(false);
      setPan({ x: 0, y: 0 });
      setAspect(initialAspectRatio);
      setImgLoaded(false);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgRef.current = img;
        setImgLoaded(true);
      };
      img.src = imageSrc;
    }
  }, [isOpen, imageSrc, initialAspectRatio]);

  // Handle Drag / Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setZoom((prev) => Math.min(Math.max(0.5, prev + delta), 4));
  };

  // Rotate 90 degrees
  const rotateRight = () => setRotation((prev) => (prev + 90) % 360);
  const rotateLeft = () => setRotation((prev) => (prev - 90 + 360) % 360);

  // Reset all adjustments
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setPan({ x: 0, y: 0 });
  };

  // Perform Final Crop & Export using Canvas
  const handleSave = useCallback(() => {
    const img = imgRef.current;
    if (!img || !containerRef.current) return;

    const frameRect = containerRef.current.getBoundingClientRect();
    const frameW = frameRect.width;
    const frameH = frameRect.height;

    // Calculate crop frame dimensions inside the container
    let cropW = frameW * 0.85;
    let cropH = frameH * 0.85;

    if (aspect !== 'free') {
      if (cropW / aspect <= cropH) {
        cropH = cropW / aspect;
      } else {
        cropW = cropH * aspect;
      }
    }

    // Export canvas (resolution: 800px max width for great quality & small size)
    const exportScale = Math.min(2, 800 / cropW);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(cropW * exportScale);
    canvas.height = Math.round(cropH * exportScale);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Center canvas context
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply rotation & flip
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale((flipH ? -1 : 1) * exportScale, (flipV ? -1 : 1) * exportScale);

    // Apply pan offset & zoom
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Rotate pan offset to match canvas coordinates
    const rotatedPanX = pan.x * cos + pan.y * sin;
    const rotatedPanY = -pan.x * sin + pan.y * cos;

    // Determine scale to fit base image inside frame
    const baseScale = Math.min(cropW / img.width, cropH / img.height);
    const drawW = img.width * baseScale * zoom;
    const drawH = img.height * baseScale * zoom;

    ctx.drawImage(img, -drawW / 2 + rotatedPanX, -drawH / 2 + rotatedPanY, drawW, drawH);

    // Export as JPEG with 0.88 quality
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    onComplete(dataUrl);
    onClose();
  }, [aspect, zoom, rotation, flipH, flipV, pan, onComplete, onClose]);

  if (!isOpen || !imageSrc) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-ink/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-xl bg-surface-base rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
          style={{ maxHeight: '90vh' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary">
                <Crop className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-brand-ink text-sm sm:text-base">{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-text-muted hover:text-brand-ink hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Interactive Workspace Area */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="relative flex-1 min-h-[300px] sm:min-h-[380px] bg-slate-900 select-none cursor-grab active:cursor-grabbing overflow-hidden flex items-center justify-center"
          >
            {/* Dark background grid */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }}
            />

            {/* Transformable Image Container */}
            {imgLoaded && (
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom}) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                }}
                className="flex items-center justify-center pointer-events-none"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageSrc}
                  alt="Crop preview"
                  className="max-w-[85vw] max-h-[50vh] sm:max-h-[340px] object-contain select-none shadow-lg"
                  draggable={false}
                />
              </div>
            )}

            {/* Crop Boundary Visual Frame */}
            <div
              className="absolute pointer-events-none border-2 border-white/90 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] rounded-lg"
              style={{
                width: aspect === 1 ? '240px' : aspect === 4 / 3 ? '280px' : aspect === 16 / 9 ? '320px' : '280px',
                height: aspect === 1 ? '240px' : aspect === 4 / 3 ? '210px' : aspect === 16 / 9 ? '180px' : '220px',
              }}
            >
              {/* Corner handles indicator */}
              <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-brand-primary" />
              <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-brand-primary" />
              <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-brand-primary" />
              <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-brand-primary" />
              {/* Grid 3x3 lines */}
              <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>
            </div>

            {/* Drag helper hint */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white/90 text-[11px] px-3 py-1 rounded-full pointer-events-none">
              Kéo để căn chỉnh • Cuộn chuột để thu phóng
            </div>
          </div>

          {/* Controls Toolbar */}
          <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
            {/* Row 1: Aspect Ratio selection */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="font-medium text-text-secondary">Tỷ lệ khung:</span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setAspect(1)}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    aspect === 1 ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-ink'
                  }`}
                >
                  1:1 (Vuông)
                </button>
                <button
                  type="button"
                  onClick={() => setAspect(4 / 3)}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    aspect === 4 / 3 ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-ink'
                  }`}
                >
                  4:3
                </button>
                <button
                  type="button"
                  onClick={() => setAspect(16 / 9)}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    aspect === 16 / 9 ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-ink'
                  }`}
                >
                  16:9
                </button>
                <button
                  type="button"
                  onClick={() => setAspect('free')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    aspect === 'free' ? 'bg-brand-primary text-white shadow-xs' : 'text-text-secondary hover:text-brand-ink'
                  }`}
                >
                  Tự do
                </button>
              </div>
            </div>

            {/* Row 2: Zoom Slider & Transformation Buttons */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {/* Zoom control */}
              <div className="flex items-center gap-2 text-xs flex-1 min-w-[180px]">
                <ZoomOut className="w-4 h-4 text-text-muted" />
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.05"
                  value={zoom}
                  onChange={(e) => setZoom(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-brand-primary"
                />
                <ZoomIn className="w-4 h-4 text-text-muted" />
                <span className="text-[11px] text-text-muted w-9 text-right font-mono">{Math.round(zoom * 100)}%</span>
              </div>

              {/* Rotate & Flip Tools */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={rotateLeft}
                  title="Xoay trái 90°"
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-brand-ink transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={rotateRight}
                  title="Xoay phải 90°"
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-brand-ink transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFlipH(!flipH)}
                  title="Lật ngang"
                  className={`p-1.5 rounded-lg border transition-colors ${
                    flipH ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-white border-slate-200 text-brand-ink hover:bg-slate-100'
                  }`}
                >
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setFlipV(!flipV)}
                  title="Lật dọc"
                  className={`p-1.5 rounded-lg border transition-colors ${
                    flipV ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-white border-slate-200 text-brand-ink hover:bg-slate-100'
                  }`}
                >
                  <FlipVertical className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  title="Đặt lại vị trí"
                  className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-text-muted hover:text-brand-ink transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Row 3: Action Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-slate-200/60 transition-colors"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Check className="w-4 h-4" />
                Xác nhận & Dùng ảnh
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
