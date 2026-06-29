export function useDictationSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}
