import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Phone, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { supabase, Usuario } from "./lib/supabase";

type View = "login" | "first-access";

type ProfileForm = {
  nome: string;
  telefone: string;
  novaSenha: string;
  confirmarSenha: string;
};

function App() {
  const [view, setView] = useState<View>("login");
  const [booting, setBooting] = useState(true);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [profile, setProfile] = useState<ProfileForm>({ nome: "", telefone: "", novaSenha: "", confirmarSenha: "" });

  useEffect(() => {
    let active = true;
    const restoreSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session?.user) {
        setBooting(false);
        return;
      }
      await loadProfile(data.session.user.id, data.session.user.email ?? "");
      if (active) setBooting(false);
    };
    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function loadProfile(userId: string, userEmail: string) {
    const { data, error } = await supabase
      .from("usuarios")
      .select("id, nome, email, telefone, cargo, avatar_url, role, ativo, ultimo_acesso")
      .eq("id", userId)
      .eq("ativo", true)
      .maybeSingle<Usuario>();

    if (error || !data) {
      await supabase.auth.signOut({ scope: "local" });
      setFeedback({ type: "error", message: "Não encontramos um perfil ativo para este acesso." });
      return;
    }

    const currentUser = { ...data, email: data.email || userEmail };
    setUsuario(currentUser);
    setProfile((current) => ({
      ...current,
      nome: currentUser.nome || "",
      telefone: currentUser.telefone || "",
    }));

    if (!currentUser.ultimo_acesso) {
      setView("first-access");
      return;
    }

    await supabase.from("usuarios").update({ ultimo_acesso: new Date().toISOString() }).eq("id", userId);
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!email.trim() || !senha) {
      setFeedback({ type: "error", message: "Informe seu e-mail e sua senha para continuar." });
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error || !data.user) {
      setFeedback({ type: "error", message: "Não foi possível entrar. Confira o e-mail e a senha." });
      setLoading(false);
      return;
    }

    await loadProfile(data.user.id, data.user.email ?? email.trim());
    setSenha("");
    setLoading(false);
  }

  async function handleForgotPassword() {
    setFeedback(null);
    if (!email.trim()) {
      setFeedback({ type: "error", message: "Digite seu e-mail para receber o link de recuperação." });
      return;
    }
    setLoading(true);
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
    setLoading(false);
    setFeedback(error
      ? { type: "error", message: "Não foi possível enviar o link agora. Tente novamente em instantes." }
      : { type: "success", message: "Se esse e-mail estiver cadastrado, você receberá as instruções para redefinir a senha." });
  }

  async function handleFirstAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    if (!usuario) return;
    if (profile.nome.trim().length < 3) {
      setFeedback({ type: "error", message: "Informe seu nome para personalizarmos o sistema." });
      return;
    }
    if (profile.novaSenha.length < 8) {
      setFeedback({ type: "error", message: "A nova senha precisa ter pelo menos 8 caracteres." });
      return;
    }
    if (profile.novaSenha !== profile.confirmarSenha) {
      setFeedback({ type: "error", message: "As senhas não conferem." });
      return;
    }

    setLoading(true);
    const { error: passwordError } = await supabase.auth.updateUser({ password: profile.novaSenha });
    if (passwordError) {
      setFeedback({ type: "error", message: "Não foi possível definir sua nova senha." });
      setLoading(false);
      return;
    }

    const now = new Date().toISOString();
    const { data: updated, error: profileError } = await supabase
      .from("usuarios")
      .update({ nome: profile.nome.trim(), telefone: profile.telefone.trim() || null, ultimo_acesso: now })
      .eq("id", usuario.id)
      .select("id, nome, email, telefone, cargo, avatar_url, role, ativo, ultimo_acesso")
      .single<Usuario>();

    if (profileError || !updated) {
      setFeedback({ type: "error", message: "A senha foi atualizada, mas não conseguimos salvar seu perfil. Tente novamente." });
      setLoading(false);
      return;
    }

    setUsuario(updated);
    setFeedback({ type: "success", message: "Cadastro concluído. Seu espaço está pronto para começar." });
    setView("login");
    setLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUsuario(null);
    setView("login");
    setFeedback(null);
  }

  if (booting) return <div className="boot-screen"><div className="brand-mark small">AL</div><span>Preparando seu espaço…</span></div>;
  if (usuario && view === "login") return <WelcomeScreen usuario={usuario} onLogout={handleLogout} />;
  if (view === "first-access" && usuario) return <FirstAccess profile={profile} setProfile={setProfile} loading={loading} feedback={feedback} onSubmit={handleFirstAccess} />;

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="Academia Livre">
        <div className="story-topline"><span className="brand-mark">AL</span><span>Academia Livre</span></div>
        <div className="story-content">
          <p className="eyebrow"><Sparkles size={15} /> Gestão que acompanha seu ritmo</p>
          <h1>Mais tempo para cuidar das pessoas.</h1>
          <p className="story-copy">Uma visão tranquila da sua agenda, dos seus alunos e das tarefas que precisam da sua atenção hoje.</p>
        </div>
        <div className="story-footer"><span className="dot" /> Feito para pequenos estúdios, com cuidado em cada detalhe.</div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="mobile-brand"><span className="brand-mark">AL</span><span>Academia Livre</span></div>
          <div className="card-heading">
            <p className="eyebrow">Bom ter você aqui</p>
            <h2>Entre no seu espaço</h2>
            <p>Use o e-mail cadastrado para continuar sua rotina.</p>
          </div>
          <form onSubmit={handleLogin} className="auth-form">
            <label htmlFor="email">E-mail</label>
            <div className="input-wrap"><Mail size={18} /><input id="email" type="email" autoComplete="email" placeholder="voce@seuestudio.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <label htmlFor="senha">Senha</label>
            <div className="input-wrap"><LockKeyhole size={18} /><input id="senha" type={mostrarSenha ? "text" : "password"} autoComplete="current-password" placeholder="Digite sua senha" value={senha} onChange={(event) => setSenha(event.target.value)} /><button type="button" className="icon-button" aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"} onClick={() => setMostrarSenha((value) => !value)}>{mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
            <button type="button" className="text-button forgot" onClick={handleForgotPassword}>Esqueci minha senha</button>
            {feedback && <Feedback feedback={feedback} />}
            <button className="primary-button" type="submit" disabled={loading}>{loading ? "Entrando…" : <>Entrar <ArrowRight size={18} /></>}</button>
          </form>
          <div className="security-note"><ShieldCheck size={17} /><span>Seus dados ficam protegidos pelo Supabase Auth.</span></div>
        </div>
      </section>
    </main>
  );
}

function FirstAccess({ profile, setProfile, loading, feedback, onSubmit }: { profile: ProfileForm; setProfile: React.Dispatch<React.SetStateAction<ProfileForm>>; loading: boolean; feedback: { type: "error" | "success"; message: string } | null; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const update = (key: keyof ProfileForm, value: string) => setProfile((current) => ({ ...current, [key]: value }));
  return <main className="auth-shell compact-shell"><section className="auth-story"><div className="story-topline"><span className="brand-mark">AL</span><span>Academia Livre</span></div><div className="story-content"><p className="eyebrow"><Check size={15} /> Primeiro acesso</p><h1>Vamos deixar tudo com a sua cara.</h1><p className="story-copy">Esse é um passo rápido. Depois dele, sua rotina de gestão começa em um só lugar.</p></div><div className="story-footer"><span className="dot" /> Você poderá ajustar seus dados quando quiser.</div></section><section className="auth-panel"><div className="auth-card"><div className="mobile-brand"><span className="brand-mark">AL</span><span>Academia Livre</span></div><div className="card-heading"><p className="eyebrow">Seu primeiro acesso</p><h2>Complete seu cadastro</h2><p>Informe os dados essenciais e crie sua senha pessoal.</p></div><form onSubmit={onSubmit} className="auth-form"><label htmlFor="nome">Como devemos chamar você?</label><div className="input-wrap"><UserRound size={18} /><input id="nome" autoComplete="name" placeholder="Seu nome completo" value={profile.nome} onChange={(event) => update("nome", event.target.value)} /></div><label htmlFor="telefone">WhatsApp ou telefone <span className="optional">opcional</span></label><div className="input-wrap"><Phone size={18} /><input id="telefone" autoComplete="tel" placeholder="(00) 00000-0000" value={profile.telefone} onChange={(event) => update("telefone", event.target.value)} /></div><label htmlFor="nova-senha">Crie sua senha</label><div className="input-wrap"><LockKeyhole size={18} /><input id="nova-senha" type="password" autoComplete="new-password" placeholder="Mínimo de 8 caracteres" value={profile.novaSenha} onChange={(event) => update("novaSenha", event.target.value)} /></div><label htmlFor="confirmar-senha">Confirme sua senha</label><div className="input-wrap"><LockKeyhole size={18} /><input id="confirmar-senha" type="password" autoComplete="new-password" placeholder="Repita a nova senha" value={profile.confirmarSenha} onChange={(event) => update("confirmarSenha", event.target.value)} /></div>{feedback && <Feedback feedback={feedback} />}<button className="primary-button" type="submit" disabled={loading}>{loading ? "Salvando…" : <>Concluir cadastro <ArrowRight size={18} /></>}</button></form><div className="security-note"><ShieldCheck size={17} /><span>Usaremos esses dados para personalizar sua experiência.</span></div></div></section></main>;
}

function Feedback({ feedback }: { feedback: { type: "error" | "success"; message: string } }) { return <div className={`feedback ${feedback.type}`} role="alert">{feedback.message}</div>; }

function WelcomeScreen({ usuario, onLogout }: { usuario: Usuario; onLogout: () => void }) { return <main className="welcome-screen"><div className="welcome-card"><span className="brand-mark">AL</span><p className="eyebrow">Cadastro concluído</p><h1>Olá, {usuario.nome.split(" ")[0]}.</h1><p>O próximo passo será construir sua visão diária: agenda, alunos e pendências em um só lugar.</p><button className="primary-button" onClick={onLogout}>Sair da demonstração</button></div></main>; }

export default App;
