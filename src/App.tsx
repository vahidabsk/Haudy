import { Route, Routes } from "react-router-dom";
import { AuditorGate } from "./components/AuditorGate";
import { UlHeader } from "./components/UlHeader";
import { useAuditor } from "./hooks/use-auditor";
import { Dashboard } from "./pages/Dashboard";
import { AuditPage } from "./pages/Audit";
import { ExportPage } from "./pages/Export";

export default function App() {
  const auditor = useAuditor();

  return (
    <AuditorGate auditor={auditor.auditor} onSave={auditor.setAuditorName}>
      <UlHeader auditor={auditor.auditor} onChange={() => auditor.setAuditorName("")} />
      <Routes>
        <Route path="/" element={<Dashboard auditorName={auditor.auditor?.name || ""} />} />
        <Route path="/audit/:auditId" element={<AuditPage auditorName={auditor.auditor?.name || ""} />} />
        <Route path="/audit/:auditId/export" element={<ExportPage auditorName={auditor.auditor?.name || ""} />} />
      </Routes>
    </AuditorGate>
  );
}
