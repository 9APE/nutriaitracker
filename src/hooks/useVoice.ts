import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface UseVoiceResult {
  supported: boolean;
  listening: boolean;
  transcribing: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<string>; // resolves to final transcript
  reset: () => void;
}

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg;codecs=opus",
  ];
  for (const t of candidates) {
    // @ts-ignore
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip data:...;base64, prefix
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function useVoice(): UseVoiceResult {
  const [supported] = useState<boolean>(
    () => typeof navigator !== "undefined" && !!navigator.mediaDevices && typeof MediaRecorder !== "undefined"
  );
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const mimeRef = useRef<string>("");
  const stopResolveRef = useRef<((t: string) => void) | null>(null);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    chunksRef.current = [];
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!supported) {
      setError("Voice input isn't supported in this browser. You can type instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime;
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onerror = (e: any) => {
        console.error("MediaRecorder error", e);
        setError("Recording error. Please try again.");
      };
      rec.onstop = async () => {
        cleanupStream();
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: mimeRef.current || "audio/webm" });
        chunksRef.current = [];

        if (blob.size < 1000) {
          setTranscribing(false);
          stopResolveRef.current?.("");
          stopResolveRef.current = null;
          return;
        }

        setTranscribing(true);
        try {
          const base64 = await blobToBase64(blob);
          const { getLanguageName, getLocale } = await import("@/lib/nouri-i18n");
          const { data, error: fnError } = await supabase.functions.invoke("transcribe-audio", {
            body: {
              audio: base64,
              mime_type: mimeRef.current || "audio/webm",
              languageName: getLanguageName(),
              locale: getLocale(),
            },
          });
          if (fnError) throw new Error(fnError.message || "Transcription failed");
          const t = (data?.transcript ?? "").trim();
          setTranscript(t);
          stopResolveRef.current?.(t);
        } catch (err: any) {
          console.error("transcription error", err);
          setError(err?.message || "Could not transcribe audio. Try again or type instead.");
          stopResolveRef.current?.("");
        } finally {
          setTranscribing(false);
          stopResolveRef.current = null;
        }
      };

      recorderRef.current = rec;
      rec.start(250); // collect chunks every 250ms for reliability
      setListening(true);
    } catch (e: any) {
      console.error("getUserMedia error", e);
      cleanupStream();
      setError("Microphone permission denied. You can type instead.");
    }
  }, [supported]);

  const stop = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current;
      if (!rec || rec.state === "inactive") {
        resolve(transcript);
        return;
      }
      stopResolveRef.current = resolve;
      try {
        rec.stop();
      } catch (e) {
        console.error("stop error", e);
        cleanupStream();
        setListening(false);
        resolve("");
      }
    });
  }, [transcript]);

  useEffect(() => {
    return () => {
      try {
        recorderRef.current?.state !== "inactive" && recorderRef.current?.stop();
      } catch {}
      cleanupStream();
    };
  }, []);

  return { supported, listening, transcribing, transcript, error, start, stop, reset };
}
