import { useEffect, useRef } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuditorGate } from "./components/AuditorGate";
import { UlHeader } from "./components/UlHeader";
import { useAuditor } from "./hooks/use-auditor";
import { AscPropertiesPage, Dashboard } from "./pages/Dashboard";
import { AuditPage } from "./pages/Audit";
import { ExportPage } from "./pages/Export";
import { ConfirmationPage } from "./pages/Confirmation";

export default function App() {
  const auditor = useAuditor();
  const navigate = useNavigate();
  const location = useLocation();
  const hiddenAt = useRef<number | null>(null);

  useEffect(() => {
    if (location.pathname !== "/") navigate("/", { replace: true });
  }, []);

  useEffect(() => {
    function returnHomeIfNeeded() {
      if (!hiddenAt.current) return;
      const hiddenForMs = Date.now() - hiddenAt.current;
      hiddenAt.current = null;
      if (hiddenForMs >= 60000 && window.location.pathname !== "/") navigate("/", { replace: true });
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        hiddenAt.current = Date.now();
        return;
      }
      returnHomeIfNeeded();
    }

    function handlePageHide() {
      hiddenAt.current = Date.now();
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", returnHomeIfNeeded);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", returnHomeIfNeeded);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [navigate]);

  return (
    <AuditorGate auditor={auditor.auditor} onSave={auditor.setAuditorName}>
      <UlHeader auditor={auditor.auditor} onChange={() => auditor.setAuditorName("")} />
      <Routes>
        <Route path="/" element={<Dashboard auditorName={auditor.auditor?.name || ""} />} />
        <Route path="/asc/:ascKey/confirmation" element={<ConfirmationPage auditorName={auditor.auditor?.name || ""} />} />
        <Route path="/asc/:ascKey" element={<AscPropertiesPage auditorName={auditor.auditor?.name || ""} />} />
        <Route path="/audit/:auditId" element={<AuditPage auditorName={auditor.auditor?.name || ""} />} />
        <Route path="/audit/:auditId/export" element={<ExportPage auditorName={auditor.auditor?.name || ""} />} />
      </Routes>
    </AuditorGate>
  );
}
