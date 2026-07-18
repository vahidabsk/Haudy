import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ContactRound, Database, DownloadCloud, Flame, HelpCircle, LogOut, Menu, UploadCloud, UserCog, UserRound, X } from "lucide-react";
import { Auditor } from "../lib/types";
import { HAUDY_VERSION } from "../lib/version";

export function UlHeader({ auditor, localUsername, onChange, onHelp, onPatch, onLogout }: { auditor: Auditor | null; localUsername: string; onChange: () => void; onHelp: () => void; onPatch: () => void; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [workspaceCounts, setWorkspaceCounts] = useState({ ascs: 0, certificates: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    function updateCounts(event: Event) {
      const detail = (event as CustomEvent<{ ascs: number; certificates: number }>).detail;
      if (detail) setWorkspaceCounts(detail);
    }
    window.addEventListener("haudy:workspace-counts", updateCounts);
    return () => window.removeEventListener("haudy:workspace-counts", updateCounts);
  }, []);
  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  function runDashboardAction(eventName: string) {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate("/");
      window.setTimeout(() => window.dispatchEvent(new Event(eventName)), 80);
      return;
    }
    window.dispatchEvent(new Event(eventName));
  }

  const menuItem = "flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white";
  return (
    <header className="no-print sticky top-0 z-50">
      <div className="h-1 bg-signal" />
      <div className="bg-navy text-white shadow-sm">
        <div className="flex min-h-16 w-full items-center gap-4 px-4 py-3">
          <div className="relative shrink-0" ref={menuRef}>
            <button className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-white/35 bg-white/5 px-3 transition hover:bg-white/15" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu" aria-label={open ? "Close application menu" : "Open application menu"}>
              {open ? <X size={23} /> : <Menu size={24} />}
            </button>
            {open ? (
              <div className="absolute left-0 mt-2 w-72 overflow-hidden rounded-xl border border-white/20 bg-[#102f52] p-2 text-white shadow-2xl" role="menu">
                <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-white/60">Data</p>
                <button className={menuItem} role="menuitem" onClick={() => runDashboardAction("haudy:import-audit-tracker")}><UploadCloud size={18} /> Import Audit Tracker</button>
                <button className={menuItem} role="menuitem" onClick={() => runDashboardAction("haudy:import-customer-contact-list")}><ContactRound size={18} /> Import Customer Contact List</button>
                <button className={menuItem} role="menuitem" onClick={() => runDashboardAction("haudy:open-customer-phone-book")}><BookOpen size={18} /> Customer Phone Book</button>
                <button className={menuItem} role="menuitem" onClick={() => runDashboardAction("haudy:choose-database")}><Database size={18} /> Choose Haudy Database</button>
                <div className="my-2 border-t border-white/15" />
                <button className={menuItem} role="menuitem" onClick={() => { setOpen(false); onHelp(); }}><HelpCircle size={18} /> Help</button>
                <button className={menuItem} role="menuitem" onClick={() => { setOpen(false); onPatch(); }}><DownloadCloud size={18} /> Patch &amp; Updates</button>
                <button className={menuItem} role="menuitem" onClick={() => { setOpen(false); onChange(); }}><UserCog size={18} /> Edit Profile</button>
                <button className={`${menuItem} hover:bg-red-500/20`} role="menuitem" onClick={() => { setOpen(false); onLogout(); }}><LogOut size={18} /> Logout</button>
              </div>
            ) : null}
          </div>
          <Link className="flex min-w-0 items-center gap-3" to="/">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-white text-navy"><Flame size={24} strokeWidth={2.4} /></div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-wide text-white/70">Haudy Audit Suite</p>
                <span className="rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white/80">Ver. {HAUDY_VERSION}</span>
              </div>
              <h1 className="truncate text-lg font-semibold">Fire Alarm and Security Certificate Audits</h1>
            </div>
          </Link>
          <div className="ml-auto hidden shrink-0 items-center gap-2 text-xs font-bold uppercase tracking-wide md:flex">
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2"><strong className="mr-1 text-base text-white">{workspaceCounts.ascs}</strong> ASCs</span>
            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-2"><strong className="mr-1 text-base text-white">{workspaceCounts.certificates}</strong> Certificates</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-sm">
            <span className="hidden items-center gap-2 rounded-full bg-white/10 px-3 py-2 sm:flex"><UserRound size={16} />{localUsername || auditor?.name || "No user"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
