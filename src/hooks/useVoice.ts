import { useEffect, useRef, useState, useCallback } from "react";

// Minimal SpeechRecognition typings
type SR = any;
const getSR = (): SR | null => {
  if (typeof window === "undefined") return null;
  // @ts-ignore
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export interface UseVoiceResult {
  supported: boolean;
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  reset: () => void;
}

export function useVoice(): UseVoiceResult {
  const [supported] = useState<boolean>(() => !!getSR());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const finalRef = useRef<string>("");

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    finalRef.current = "";
    setTranscript("");
    setError(null);
  }, []);

  const start = useCallback(async () => {
    setError(null);
    const SR = getSR();
    if (!SR) {
      setError("Voice input isn't supported in this browser. You can type instead.");
      return;
    }
    try {
      // Trigger native permission prompt
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // We don't need to keep the raw stream open; SpeechRecognition manages mic itself
      stream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      setError("Microphone permission denied. You can type instead.");
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    finalRef.current = "";
    setTranscript("");

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) {
          finalRef.current += res[0].transcript;
        } else {
          interim += res[0].transcript;
        }
      }
      setTranscript((finalRef.current + " " + interim).trim());
    };
    rec.onerror = (e: any) => {
      if (e.error !== "aborted" && e.error !== "no-speech") {
        setError(`Voice error: ${e.error}`);
      }
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      setError("Could not start voice input.");
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, transcript, error, start, stop, reset };
}
