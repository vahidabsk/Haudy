import { useCallback } from "react";
import { Toast } from "../components/ui/toast";

export function useToast() {
  return {
    toast: useCallback((message: Toast) => {
      window.alert([message.title, message.description].filter(Boolean).join("\n"));
    }, []),
  };
}
