import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, Camera, RotateCcw } from "lucide-react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

interface Props {
  onDetected: (barcode: string) => void;
  onClose: () => void;
  /** User chose "Add from photo" instead — give them a label image to OCR. */
  onPhotoCaptured: (file: File) => void;
}

const SCAN_TIMEOUT_MS = 5000;

export function BarcodeScanner({ onDetected, onClose, onPhotoCaptured }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const [restartKey, setRestartKey] = useState(0);

  const clearTimeoutSafe = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    detectedRef.current = false;
    setTimedOut(false);
    setStarting(true);
    setError(null);

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
          undefined,
          videoRef.current,
          (result, _err, ctrl) => {
            if (cancelled || detectedRef.current) return;
            if (result) {
              detectedRef.current = true;
              clearTimeoutSafe();
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

        // Start the 5-second no-detection timer
        timeoutRef.current = window.setTimeout(() => {
          if (cancelled || detectedRef.current) return;
          controls.stop();
          setTimedOut(true);
        }, SCAN_TIMEOUT_MS);
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
      clearTimeoutSafe();
      controlsRef.current?.stop();
    };
  }, [onDetected, restartKey]);

  const handleTryAgain = useCallback(() => {
    setRestartKey((k) => k + 1);
  }, []);

  const handleAddFromPhoto = useCallback(() => {
    photoInputRef.current?.click();
  }, []);

  const handlePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-pick
    if (!file) return;
    controlsRef.current?.stop();
    onPhotoCaptured(file);
  };

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
        {!error && !timedOut && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-40">
              <div className="absolute inset-0 border-2 border-white/70 rounded-2xl" />
              <div className="absolute left-0 right-0 top-1/2 h-px bg-primary/90 shadow-[0_0_8px_hsl(var(--primary))]" />
            </div>
          </div>
        )}

        {starting && !error && !timedOut && (
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

        {/* "Product not recognized" overlay after 5s */}
        {timedOut && !error && (
          <div className="absolute inset-0 flex items-center justify-center px-6 bg-black/60">
            <div className="w-full max-w-sm bg-background text-foreground rounded-2xl border border-border p-5 text-center shadow-card animate-bubble-in">
              <h3 className="font-serif text-lg font-medium">Product not recognized</h3>
              <p className="text-sm text-muted-foreground mt-1">
                We couldn't read a barcode. Try again or take a photo of the nutrition label.
              </p>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={handleTryAgain}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium hover:border-primary/40 transition-colors"
                >
                  <RotateCcw size={16} /> Try again
                </button>
                <button
                  onClick={handleAddFromPhoto}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-medium hover:opacity-95 transition-opacity"
                >
                  <Camera size={16} /> Add from photo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!error && !timedOut && (
        <p className="text-center text-xs text-white/70 py-4 px-6">
          Point your camera at a product barcode
        </p>
      )}

      {/* Hidden file input opens the device camera in photo mode on mobile */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handlePhotoFile}
      />
    </div>
  );
}
