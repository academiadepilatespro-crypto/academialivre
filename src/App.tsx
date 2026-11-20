import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Clock3,
  DoorOpen,
  Eye,
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
  WalletCards,
  X,
} from "lucide-react";
import { supabase, Usuario } from "./lib/supabase";

type View = "login" | "first-access" | "dashboard";
type Feedback = { type: "error" | "success"; message: string };
type ProfileForm = { nome: string; telefone: string; novaSenha: string; confirmarSenha: string };
type Aula = { id: number; data: string; horario: string; status: string; presenca: string | null; aluno: { id: number; nome: string } | null };
type Aluno = { id: number; nome: string; telefone: string | null; ativo: boolean };
type DashboardData = { alunosAtivos: number; aulasHoje: Aula[]; parcelasEmAtencao: number; alunosRecentes: Aluno[] };

const initialDashboard: DashboardData = { alunosAtivos: 0, aulasHoje: [], parcelasEmAtencao: 0, alunosRecentes: [] };

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function firstName(nome: string) { return nome.trim().split(" ")[0] || "Rafaela"; }

function App() {
  const [view, setView] = useState<View>("login");
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [profile, setProfile] = useState<ProfileForm>({ nome: "", telefone: "", novaSenha: "", confirmarSenha: "" });

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.user) { setBooting(false); return; }
      await loadProfile(data.session.user.id, data.session.user.email ?? "");
      if (active) setBooting(false);
    };
    restoreSession();
    return () => { active = false; };
  }, []);

  async function loadProfile(userId: string, userEmail: string) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, email, telefone, cargo, avatar_url, role, ativo, ultimo_acesso")
      .eq("id", userId).eq("ativo", true).maybeSingle<Usuario>();
    if (error || !data) {
      await supabase.auth.signOut({ scope: "local" });
      setFeedback({ type: "error", message: "Não encontramos um perfil ativo para este acesso." });
      return;
    }
    const currentUser = { ...data, email: data.email || userEmail };
    setUsuario(currentUser);
    setProfile((current) => ({ ...current, nome: currentUser.nome || "", telefone: currentUser.telefone || "" }));
    if (!currentUser.ultimo_acesso) { setView("first-access"); return; }
    await supabase.from("usuarios").update({ ultimo_acesso: new Date().toISOString() }).eq("id", userId);
    setView("dashboard");
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback(null);
    if (!email.trim() || !senha) { setFeedback({ type: "error", message: "Informe seu e-mail e sua senha para continuar." }); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error || !data.user) { setFeedback({ type: "error", message: "Não foi possível entrar. Confira o e-mail e a senha." }); setLoading(false); return; }
    await loadProfile(data.user.id, data.user.email ?? email.trim());
    setSenha(""); setLoading(false);
  }

  async function handleForgotPassword() {
    setFeedback(null);
    if (!email.trim()) { setFeedback({ type: "error", message: "Digite seu e-mail para receber o link de recuperação." }); return; }
    setLoading(true);
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    setFeedback(error ? { type: "error", message: "Não foi possível enviar o link agora. Tente novamente em instantes." } : { type: "success", message: "Se esse e-mail estiver cadastrado, você receberá as instruções para redefinir a senha." });
  }

  async function handleFirstAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFeedback(null); if (!usuario) return;
    if (profile.nome.trim().length < 3) { setFeedback({ type: "error", message: "Informe seu nome para personalizarmos o sistema." }); return; }
    if (profile.novaSenha.length < 8) { setFeedback({ type: "error", message: "A nova senha precisa ter pelo menos 8 caracteres." }); return; }
    if (profile.novaSenha !== profile.confirmarSenha) { setFeedback({ type: "error", message: "As senhas não conferem." }); return; }
    setLoading(true);
    const { error: passwordError } = await supabase.auth.updateUser({ password: profile.novaSenha });
    if (passwordError) { setFeedback({ type: "error", message: "Não foi possível definir sua nova senha." }); setLoading(false); return; }
    const now = new Date().toISOString();
    const { data: updated, error: profileError } = await supabase.from("usuarios")
      .update({ nome: profile.nome.trim(), telefone: profile.telefone.trim() || null, ultimo_acesso: now })
      .eq("id", usuario.id).select("id, nome, email, telefone, cargo, avatar_url, role, ativo, ultimo_acesso").single<Usuario>();
    if (profileError || !updated) { setFeedback({ type: "error", message: "A senha foi atualizada, mas não conseguimos salvar seu perfil. Tente novamente." }); setLoading(false); return; }
    setUsuario(updated); setView("dashboard"); setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut(); setUsuario(null); setView("login"); setFeedback(null);
  }

  if (booting) return <div className="boot-screen"><div className="brand-mark small">AL</div><span>Preparando seu espaço…</span></div>;
  if (usuario && view === "dashboard") return <DashboardScreen usuario={usuario} onLogout={handleLogout} />;
  if (view === "first-access" && usuario) return <FirstAccess profile={profile} setProfile={setProfile} loading={loading} feedback={feedback} onSubmit={handleFirstAccess} />;

  return <LoginScreen email={email} senha={senha} mostrarSenha={mostrarSenha} loading={loading} feedback={feedback} setEmail={setEmail} setSenha={setSenha} setMostrarSenha={setMostrarSenha} onSubmit={handleLogin} onForgotPassword={handleForgotPassword} />;
}

function LoginScreen({ email, senha, mostrarSenha, loading, feedback, setEmail, setSenha, setMostrarSenha, onSubmit, onForgotPassword }: { email: string; senha: string; mostrarSenha: boolean; loading: boolean; feedback: Feedback | null; setEmail: (value: string) => void; setSenha: (value: string) => void; setMostrarSenha: (value: boolean) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onForgotPassword: () => void }) {
  return <main className="auth-shell"><section className="auth-story" aria-label="Academia Livre"><div className="story-topline"><span className="brand-mark">AL</span><span>Academia Livre</span></div><div className="story-content"><p className="eyebrow"><Sparkles size={15} /> Gestão que acompanha seu ritmo</p><h1>Mais tempo para cuidar das pessoas.</h1><p className="story-copy">Sua agenda, seus alunos e as pequenas pendências do dia organizados com leveza — para você cuidar do estúdio sem perder o que importa.</p><div className="story-pills"><span>Agenda em um só lugar</span><span>Rotina mais leve</span></div></div><div className="story-footer"><span className="dot" /> Feito para pequenos estúdios, com cuidado em cada detalhe.</div></section><section className="auth-panel"><div className="auth-card"><div className="mobile-brand"><span className="brand-mark">AL</span><span>Academia Livre</span></div><div className="card-heading"><p className="eyebrow">Bom ter você aqui</p><h2>Entre no seu espaço</h2><p>Use o e-mail cadastrado para continuar sua rotina.</p></div><form onSubmit={onSubmit} className="auth-form"><label htmlFor="email">E-mail</label><div className="input-wrap"><Mail size={18} /><input id="email" type="email" autoComplete="email" placeholder="voce@seuestudio.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div><label htmlFor="senha">Senha</label><div className="input-wrap"><LockKeyhole size={18} /><input id="senha" type={mostrarSenha ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" value={senha} onChange={(event) => setSenha(event.target.value)} /><button type="button" className="icon-button" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} onClick={() => setMostrarSenha(!mostrarSenha)}>{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}</button></div><button type="button" className="text-button forgot" onClick={onForgotPassword}>Esqueci minha senha</button>{feedback && <Feedback feedback={feedback} />}<button className="primary-button" type="submit" disabled={loading}>{loading ? "Entrando…" : <>Entrar <ArrowRight size={18} /></>}</button></form><div className="security-note"><ShieldCheck size={17} /><span>Seus dados ficam protegidos pelo Supabase Auth.</span></div></div></section></main>;
}

function DashboardScreen({ usuario, onLogout }: { usuario: Usuario; onLogout: () => void }) {
  const [data, setData] = useState<DashboardData>(initialDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let active = true;
    async function loadDashboard() {
      setLoading(true); setError("");
      const hoje = localDateString();
      const [alunosQuery, aulasQuery, parcelasQuery, recentesQuery] = await Promise.all([
        supabase.from("alunos").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("aulas").select("id, data, horario, status, presenca, alunos!inner(id, nome)").eq("data", hoje).order("horario", { ascending: true }).limit(12),
        supabase.from("parcelas").select("id", { count: "exact", head: true }).in("status", ["pendente", "atrasado"]),
        supabase.from("alunos").select("id, nome, telefone, ativo").eq("ativo", true).order("criado_em", { ascending: false }).limit(8),
      ]);
      if (!active) return;
      if (alunosQuery.error || aulasQuery.error || parcelasQuery.error || recentesQuery.error) setError("Algumas informações não puderam ser carregadas agora.");
      const aulas = ((aulasQuery.data || []) as Array<Record<string, unknown>>).map((item) => ({
        id: Number(item.id), data: String(item.data), horario: String(item.horario || ""), status: String(item.status || ""), presenca: item.presenca ? String(item.presenca) : null,
        aluno: Array.isArray(item.alunos) ? ((item.alunos[0] as { id: number; nome: string } | undefined) || null) : ((item.alunos as { id: number; nome: string } | null) || null),
      }));
      setData({ alunosAtivos: alunosQuery.count || 0, aulasHoje: aulas, parcelasEmAtencao: parcelasQuery.count || 0, alunosRecentes: (recentesQuery.data || []) as Aluno[] });
      setLoading(false);
    }
    loadDashboard();
    return () => { active = false; };
  }, []);

  const filtrados = data.alunosRecentes.filter((aluno) => aluno.nome.toLowerCase().includes(busca.toLowerCase()));
  const proxima = data.aulasHoje.find((aula) => aula.status !== "cancelada") || null;
  const saudacao = new Date().getHours() < 12 ? "Bom dia" : new Date().getHours() < 18 ? "Boa tarde" : "Boa noite";

  return <main className="dashboard-shell"><aside className={`dashboard-sidebar ${menuOpen ? "open" : ""}`}><div className="dashboard-brand"><span className="brand-mark">AL</span><span>Academia Livre</span></div><nav className="dashboard-nav"><button className="nav-link active"><LayoutDashboard size={18} /> Início</button><button className="nav-link"><CalendarDays size={18} /> Agenda</button><button className="nav-link"><UsersRound size={18} /> Alunos</button><button className="nav-link"><WalletCards size={18} /> Financeiro</button></nav><div className="sidebar-bottom"><div className="mini-profile"><span className="profile-avatar">{initials(usuario.nome)}</span><span><strong>{firstName(usuario.nome)}</strong><small>Seu espaço</small></span></div><button className="logout-link" onClick={onLogout}><LogOut size={17} /> Sair</button></div></aside><div className="dashboard-main"><header className="dashboard-header"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div><p className="dashboard-kicker">{formatDate()}</p><h1>{saudacao}, {firstName(usuario.nome)}.</h1></div><button className="header-profile" onClick={onLogout}><span className="profile-avatar">{initials(usuario.nome)}</span><span><strong>{firstName(usuario.nome)}</strong><small>Administradora</small></span><ChevronRight size={16} /></button></header><section className="dashboard-intro"><div><p className="eyebrow"><Sparkles size={15} /> Seu resumo de hoje</p><h2>Vamos deixar o dia mais leve?</h2><p>Acompanhe o essencial do seu estúdio sem precisar procurar em vários lugares.</p></div><div className="next-glance">{proxima ? <><span className="next-label">Próxima aula</span><strong>{formatTime(proxima.horario)} · {proxima.aluno?.nome || "Aluno"}</strong><small>Hoje</small></> : <><span className="next-label">Sua agenda</span><strong>Nenhuma aula hoje</strong><small>Um bom momento para organizar a rotina.</small></>}</div></section>{error && <div className="dashboard-alert"><CircleAlert size={17} /> {error}</div>}<section className="stats-grid dashboard-stats"><StatCard icon={<UsersRound size={19} />} label="Alunos ativos" value={loading ? "—" : String(data.alunosAtivos)} tone="green" /><StatCard icon={<CalendarDays size={19} />} label="Aulas hoje" value={loading ? "—" : String(data.aulasHoje.length)} tone="blue" /><StatCard icon={<CircleAlert size={19} />} label="Em atenção" value={loading ? "—" : String(data.parcelasEmAtencao)} tone="gold" /></section><div className="dashboard-columns"><section className="dashboard-card agenda-card"><div className="section-heading"><div><p className="section-kicker">Hoje</p><h3>Minha agenda</h3></div><button className="subtle-button">Ver agenda <ArrowRight size={15} /></button></div>{loading ? <LoadingRows /> : data.aulasHoje.length === 0 ? <EmptyState icon={<CalendarDays size={23} />} title="Nenhuma aula hoje" text="Quando houver horários, eles aparecerão aqui." /> : <div className="agenda-list">{data.aulasHoje.map((aula) => <div className="agenda-item" key={aula.id}><span className="agenda-time">{formatTime(aula.horario)}</span><span className={`agenda-dot ${aula.presenca ? "done" : ""}`} /><div className="agenda-person"><strong>{aula.aluno?.nome || "Aluno sem nome"}</strong><small>{aula.status === "cancelada" ? "Aula cancelada" : aula.presenca ? `Presença: ${aula.presenca}` : "Presença pendente"}</small></div><ChevronRight size={17} /></div>)}</div>}</section><section className="dashboard-card students-card"><div className="section-heading"><div><p className="section-kicker">Cadastro</p><h3>Alunos ativos</h3></div><button className="round-button" aria-label="Adicionar aluno"><Plus size={17} /></button></div><div className="search-box"><Search size={16} /><input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar aluno" /></div>{loading ? <LoadingRows compact /> : filtrados.length === 0 ? <EmptyState icon={<UsersRound size={23} />} title="Nenhum aluno encontrado" text={busca ? "Tente outro nome." : "Seus alunos aparecerão aqui."} /> : <div className="student-list">{filtrados.slice(0, 5).map((aluno) => <div className="student-item" key={aluno.id}><span className="student-avatar">{initials(aluno.nome)}</span><span><strong>{aluno.nome}</strong><small>{aluno.telefone || "Telefone não informado"}</small></span><ChevronRight size={16} /></div>)}</div>}<button className="outline-button"><UsersRound size={16} /> Ver todos os alunos</button></section></div><section className="help-strip"><div className="help-icon"><ShieldCheck size={19} /></div><div><strong>Você está no controle.</strong><span>O painel foi pensado para mostrar primeiro o que merece sua atenção.</span></div><button className="subtle-button">Como funciona <ArrowRight size={15} /></button></section></div></main>;
}

function StatCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: string }) { return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span><small>{label}</small><strong>{value}</strong></span></div>; }
function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{text}</p></div>; }
function LoadingRows({ compact = false }: { compact?: boolean }) { return <div className={`loading-rows ${compact ? "compact" : ""}`}><i /><i /><i /></div>; }
function initials(nome: string) { return nome.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AL"; }
function formatTime(time: string) { return time ? time.slice(0, 5) : "—"; }

function FirstAccess({ profile, setProfile, loading, feedback, onSubmit }: { profile: ProfileForm; setProfile: React.Dispatch<React.SetStateAction<ProfileForm>>; loading: boolean; feedback: Feedback | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const update = (key: keyof ProfileForm, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  return <main className="auth-shell compact-shell"><section className="auth-story"><div className="story-topline"><span className="brand-mark">AL</span><span>Academia Livre</span></div><div className="story-content"><p className="eyebrow"><Check size={15} /> Primeiro acesso</p><h1>Vamos deixar tudo com a sua cara.</h1><p className="story-copy">Esse é um passo rápido. Depois dele, sua rotina de gestão começa em um só lugar.</p></div><div className="story-footer"><span className="dot" /> Você poderá ajustar seus dados quando quiser.</div></section><section className="auth-panel"><div className="auth-card"><div className="mobile-brand"><span className="brand-mark">AL</span><span>Academia Livre</span></div><div className="card-heading"><p className="eyebrow">Seu primeiro acesso</p><h2>Complete seu cadastro</h2><p>Informe os dados essenciais e crie sua senha pessoal.</p></div><form onSubmit={onSubmit} className="auth-form"><label htmlFor="nome">Como devemos chamar você?</label><div className="input-wrap"><UserRound size={18} /><input id="nome" autoComplete="name" placeholder="Seu nome completo" value={profile.nome} onChange={(event) => update("nome", event.target.value)} /></div><label htmlFor="telefone">WhatsApp ou telefone <span className="optional">opcional</span></label><div className="input-wrap"><Phone size={18} /><input id="telefone" autoComplete="tel" placeholder="(00) 00000-0000" value={profile.telefone} onChange={(event) => update("telefone", event.target.value)} /></div><label htmlFor="nova-senha">Crie sua senha</label><div className="input-wrap"><LockKeyhole size={18} /><input id="nova-senha" type="password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={profile.novaSenha} onChange={(event) => update("novaSenha", event.target.value)} /></div><label htmlFor="confirmar-senha">Confirme sua senha</label><div className="input-wrap"><LockKeyhole size={18} /><input id="confirmar-senha" type="password" autoComplete="new-password" placeholder="Repita a nova senha" value={profile.confirmarSenha} onChange={(event) => update("confirmarSenha", event.target.value)} /></div>{feedback && <Feedback feedback={feedback} />}<button className="primary-button" type="submit" disabled={loading}>{loading ? "Salvando…" : <>Concluir cadastro <ArrowRight size={18} /></>}</button></form><div className="security-note"><ShieldCheck size={17} /><span>Usaremos esses dados para personalizar sua experiência.</span></div></div></section></main>;
}

function Feedback({ feedback }: { feedback: Feedback }) { return <div className={`feedback ${feedback.type}`} role="alert">{feedback.message}</div>; }

export default App;
