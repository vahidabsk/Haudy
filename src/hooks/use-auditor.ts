import { useEffect, useState } from "react";
import { Auditor } from "../lib/types";
import { loadAuditor, saveAuditor } from "../lib/audit-storage";

export function useAuditor() {
  const [auditor, setAuditor] = useState<Auditor | null>(() => loadAuditor());

  useEffect(() => {
    setAuditor(loadAuditor());
  }, []);

  return {
    auditor,
    setAuditorName(name: string) {
      setAuditor(saveAuditor(name));
    },
  };
}
