import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export function DictationNotes({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<InstanceType<SpeechRecognitionConstructor> | null>(null);
  const valueRef = useRef(value);
  const processedResultCountRef = useRef(0);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = Boolean(SpeechRecognition);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  function toggleDictation() {
    if (!SpeechRecognition) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => {
      processedResultCountRef.current = 0;
      setListening(true);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognition.onresult = (event) => {
      const startIndex = Math.max(event.resultIndex ?? 0, processedResultCountRef.current);
      const transcript = Array.from(event.results)
        .slice(startIndex)
        .map((result) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      processedResultCountRef.current = event.results.length;
      if (!transcript) return;
      const nextValue = [valueRef.current, transcript].filter(Boolean).join(" ");
      valueRef.current = nextValue;
      onChange(nextValue);
    };
    recognitionRef.current = recognition;
    recognition.start();
  }

  return (
    <div className="grid gap-2">
      <textarea className="w-full rounded-md border border-slate-300 p-3" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      <button
        type="button"
        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm disabled:opacity-50 ${
          listening ? "border-red-300 bg-red-50 text-red-800" : "border-slate-300"
        }`}
        onClick={toggleDictation}
        disabled={!supported}
        title={supported ? "Start or stop voice dictation" : "Voice dictation not supported in this browser. Typing works as normal."}
      >
        {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} {listening ? "Stop Dictation" : "Start Dictation"}
      </button>
    </div>
  );
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}
