import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.QR_CODE,
    ]);
    const reader = new BrowserMultiFormatReader(hints);

    (async () => {
      try {
        if (!videoRef.current) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined, // pick default (back camera on mobile when available)
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled || detectedRef.current) return;
            if (result) {
              detectedRef.current = true;
              ctrl.stop();
              onDetected(result.getText());
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
        setStarting(false);
      } catch (e: any) {
        if (cancelled) return;
        setStarting(false);
        const msg =
          e?.name === "NotAllowedError"
            ? "Camera permission denied. Enable it in your browser settings to scan."
            : e?.name === "NotFoundError"
              ? "No camera found on this device."
              : e?.message || "Couldn't start the camera.";
        setError(msg);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[60] bg-black flex flex-col">
      <header className="flex items-center justify-between px-5 py-3 text-white">
        <span className="font-serif text-base">Scan barcode</span>
        <button
          onClick={onClose}
          aria-label="Close scanner"
          className="p-2 rounded-full hover:bg-white/10"
        >
          <X size={22} />
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />

        {/* Reticle */}
        {!error && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-40">
              <div className="absolute inset-0 border-2 border-white/70 rounded-2xl" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-primary/90 shadow-[0_0_8px_hsl(var(--primary))]" />
            </div>
          </div>
        )}

        {starting && !error && (
          <div className="absolute inset-x-0 bottom-24 flex items-center justify-center text-white/90 gap-2 text-sm">
            <Loader2 size={16} className="animate-spin" />
            Starting camera…
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex items-center justify-center px-8">
            <div className="bg-background text-foreground rounded-2xl border border-border p-5 max-w-sm text-center">
              <p className="text-sm leading-relaxed">{error}</p>
              <button
                onClick={onClose}
                className="mt-4 text-sm font-medium text-primary hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>

      {!error && (
        <p className="text-center text-xs text-white/70 py-4 px-6">
          Point your camera at a product barcode
        </p>
      )}
    </div>
  );
}
