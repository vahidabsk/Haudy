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
    saveAuditor(profile: Omit<Auditor, "since" | "updatedAt">) {
      setAuditor(saveAuditor({ ...profile, since: auditor?.since }));
    },
    clearAuditor() {
      setAuditor(null);
    },
  };
}
