"use client";

import { useCallback, useEffect, useRef } from 'react';

interface SignaturePadProps {
  value: string;
  onChange: (value: string) => void;
}

export function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const isApplyingExternalValueRef = useRef(false);
  const lastAppliedValueRef = useRef('');

  const getContext = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const context = canvas.getContext('2d');
    if (!context) return null;

    context.lineWidth = 2;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#111827';

    return context;
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    if (!width || !height) return;

    const previous = document.createElement('canvas');
    previous.width = canvas.width;
    previous.height = canvas.height;
    const previousCtx = previous.getContext('2d');
    if (previousCtx) {
      previousCtx.drawImage(canvas, 0, 0);
    }

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const context = getContext();
    if (!context) return;

    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    if (previous.width > 0 && previous.height > 0) {
      context.drawImage(previous, 0, 0, previous.width, previous.height, 0, 0, width, height);
    }
  }, [getContext]);

  const pointFromEvent = (event: PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  };

  const emitChange = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || isApplyingExternalValueRef.current) return;

    const dataUrl = canvas.toDataURL('image/png');
    lastAppliedValueRef.current = dataUrl;
    onChange(dataUrl);
  }, [onChange]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = getContext();
    if (!context) return;

    context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    lastPointRef.current = null;
  }, [getContext]);

  useEffect(() => {
    resizeCanvas();

    const handleResize = () => resizeCanvas();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [resizeCanvas]);

  useEffect(() => {
    if (!canvasRef.current) return;

    if (!value) {
      lastAppliedValueRef.current = '';
      clear();
      return;
    }

    if (value === lastAppliedValueRef.current) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = getContext();
      if (!context) return;

      isApplyingExternalValueRef.current = true;
      context.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      context.drawImage(image, 0, 0, canvas.clientWidth, canvas.clientHeight);
      isApplyingExternalValueRef.current = false;
      lastAppliedValueRef.current = value;
    };
    image.src = value;
  }, [clear, getContext, value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onPointerDown = (event: PointerEvent) => {
      event.preventDefault();
      const context = getContext();
      const point = pointFromEvent(event);
      if (!context || !point) return;

      isDrawingRef.current = true;
      lastPointRef.current = point;
      canvas.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isDrawingRef.current) return;

      const context = getContext();
      const point = pointFromEvent(event);
      const previous = lastPointRef.current;
      if (!context || !point || !previous) return;

      context.beginPath();
      context.moveTo(previous.x, previous.y);
      context.lineTo(point.x, point.y);
      context.stroke();
      lastPointRef.current = point;
    };

    const onPointerUpOrLeave = (event: PointerEvent) => {
      if (!isDrawingRef.current) return;

      isDrawingRef.current = false;
      lastPointRef.current = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      emitChange();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUpOrLeave);
    canvas.addEventListener('pointerleave', onPointerUpOrLeave);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUpOrLeave);
      canvas.removeEventListener('pointerleave', onPointerUpOrLeave);
    };
  }, [emitChange, getContext]);

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        className="w-full h-36 border-2 border-gray-200 rounded-2xl bg-white touch-none"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            clear();
            lastAppliedValueRef.current = '';
            onChange('');
          }}
          className="px-3 py-2 text-sm rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Effacer la signature
        </button>
      </div>
    </div>
  );
}
