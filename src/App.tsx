import { useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuditorGate } from "./components/AuditorGate";
import { LocalAuthGate } from "./components/LocalAuthGate";
import { OperatingHelp } from "./components/OperatingHelp";
import { UlHeader } from "./components/UlHeader";
import { useAuditor } from "./hooks/use-auditor";
import { AscPropertiesPage, Dashboard } from "./pages/Dashboard";
import { AuditPage } from "./pages/Audit";
import { ExportPage } from "./pages/Export";
import { ConfirmationPage } from "./pages/Confirmation";
import { ReportPage } from "./pages/Report";

export default function App() {
  const auditor = useAuditor();
  const [editingAuditor, setEditingAuditor] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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
    <LocalAuthGate>
      {(session, logout) => (
        <AuditorGate
          auditor={auditor.auditor}
          editing={editingAuditor}
          onSave={(profile) => {
            auditor.saveAuditor(profile);
            setEditingAuditor(false);
          }}
          onCancel={() => setEditingAuditor(false)}
        >
          <UlHeader auditor={auditor.auditor} localUsername={session.username} onChange={() => setEditingAuditor(true)} onHelp={() => setShowHelp(true)} onLogout={logout} />
          <Routes>
            <Route path="/" element={<Dashboard auditorName={auditor.auditor?.name || ""} />} />
            <Route path="/asc/:ascKey/report" element={<ReportPage auditor={auditor.auditor} />} />
            <Route path="/asc/:ascKey/confirmation" element={<ConfirmationPage auditor={auditor.auditor} />} />
            <Route path="/asc/:ascKey" element={<AscPropertiesPage auditorName={auditor.auditor?.name || ""} />} />
            <Route path="/audit/:auditId" element={<AuditPage auditorName={auditor.auditor?.name || ""} />} />
            <Route path="/audit/:auditId/export" element={<ExportPage auditorName={auditor.auditor?.name || ""} />} />
          </Routes>
          {showHelp ? <OperatingHelp onClose={() => setShowHelp(false)} /> : null}
        </AuditorGate>
      )}
    </LocalAuthGate>
  );
}
