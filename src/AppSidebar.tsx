import { CalendarDays, LayoutDashboard, LogOut, Settings, UsersRound, WalletCards } from "lucide-react";
import { Usuario } from "./lib/supabase";

type View = "dashboard" | "agenda" | "students" | "finance" | "settings";

function initials(nome: string) {
  return nome.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AL";
}

export default function AppSidebar({ usuario, active, onNavigate, onLogout, mobileOpen, onClose }: { usuario: Usuario; active: View; onNavigate: (view: View) => void; onLogout: () => void; mobileOpen: boolean; onClose: () => void }) {
  return <aside className={`dashboard-sidebar ${mobileOpen ? "open" : ""}`}>
    <div className="dashboard-brand user-brand">
      {usuario.avatar_url ? <img className="profile-avatar brand-avatar-photo" src={usuario.avatar_url} alt={`Foto de ${usuario.nome}`} /> : <span className="profile-avatar brand-avatar-photo">{initials(usuario.nome)}</span>}
      <span><strong>{usuario.nome || "Academia Livre"}</strong><small>Academia Livre</small></span>
    </div>
    <nav className="dashboard-nav">
      <button className={`nav-link ${active === "dashboard" ? "active" : ""}`} onClick={() => { onNavigate("dashboard"); onClose(); }}><LayoutDashboard size={18} /> Início</button>
      <button className={`nav-link ${active === "agenda" ? "active" : ""}`} onClick={() => { onNavigate("agenda"); onClose(); }}><CalendarDays size={18} /> Agenda</button>
      <button className={`nav-link ${active === "students" ? "active" : ""}`} onClick={() => { onNavigate("students"); onClose(); }}><UsersRound size={18} /> Alunos</button>
      <button className={`nav-link ${active === "finance" ? "active" : ""}`} onClick={() => { onNavigate("finance"); onClose(); }}><WalletCards size={18} /> Financeiro</button>
      <button className={`nav-link ${active === "settings" ? "active" : ""}`} onClick={() => { onNavigate("settings"); onClose(); }}><Settings size={18} /> Configurações</button>
    </nav>
    <div className="sidebar-bottom">
      <button className="logout-link" onClick={onLogout}><LogOut size={17} /> Sair</button>
    </div>
  </aside>;
}
