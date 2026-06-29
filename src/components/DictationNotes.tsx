import { useState } from "react";
import { Mic } from "lucide-react";

type SpeechRecognitionConstructor = new () => {
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
};

interface SpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

export function DictationNotes({ value, onChange, rows = 3 }: { value: string; onChange: (value: string) => void; rows?: number }) {
  const [listening, setListening] = useState(false);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const supported = Boolean(SpeechRecognition);

  function dictate() {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((result) => result[0]?.transcript || "").join(" ");
      onChange([value, transcript].filter(Boolean).join(" "));
    };
    recognition.start();
  }

  return (
    <div className="grid gap-2">
      <textarea className="w-full rounded-md border border-slate-300 p-3" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
      <button
        type="button"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm disabled:opacity-50"
        onClick={dictate}
        disabled={!supported}
        title={supported ? "Append voice dictation" : "Voice dictation not supported in this browser. Typing works as normal."}
      >
        <Mic className="h-4 w-4" /> {listening ? "Listening..." : "Dictate"}
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
