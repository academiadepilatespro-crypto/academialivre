import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronRight, Mail, Menu, Pencil, Phone, Plus, Search, Trash2, UserRound, UsersRound, X } from "lucide-react";
import { supabase, Usuario } from "./lib/supabase";
import AppSidebar from "./AppSidebar";

type Student = {
  id: number;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string;
  telefone2: string | null;
  nascimento: string;
  profissao: string | null;
  ativo: boolean;
  data_matricula: string | null;
  contato_emergencia: string | null;
  observacoes_saude: string | null;
};

type StudentForm = Omit<Student, "id">;
type Feedback = { type: "success" | "error"; text: string };

const EMPTY_FORM: StudentForm = {
  nome: "", cpf: "", email: "", telefone: "", telefone2: "", nascimento: "", profissao: "", ativo: true,
  data_matricula: "", contato_emergencia: "", observacoes_saude: "",
};

function initials(nome: string) { return nome.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AL"; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR").format(new Date(`${value.slice(0, 10)}T12:00:00`)) : "Não informado"; }
function age(value: string) { if (!value) return ""; const birthday = new Date(`${value.slice(0, 10)}T12:00:00`); const today = new Date(); let years = today.getFullYear() - birthday.getFullYear(); if (today.getMonth() < birthday.getMonth() || (today.getMonth() === birthday.getMonth() && today.getDate() < birthday.getDate())) years--; return `${years} anos`; }

export default function StudentsScreen({ usuario, onNavigate, onLogout }: { usuario: Usuario; onNavigate: (view: "dashboard" | "agenda" | "students" | "settings") => void; onLogout: () => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [form, setForm] = useState<StudentForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [message, setMessage] = useState<Feedback | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("alunos").select("id, nome, cpf, email, telefone, telefone2, nascimento, profissao, ativo, data_matricula, contato_emergencia, observacoes_saude").order("nome", { ascending: true }).limit(500);
    if (error) setMessage({ type: "error", text: "Não foi possível carregar os alunos agora." });
    setStudents((data || []) as Student[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);
  function notify(text: string, type: Feedback["type"]) { setMessage({ text, type }); window.setTimeout(() => setMessage(null), 4500); }
  function openNew() { setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); }
  function openEdit(student: Student) { setEditingId(student.id); setForm({ nome: student.nome || "", cpf: student.cpf || "", email: student.email || "", telefone: student.telefone || "", telefone2: student.telefone2 || "", nascimento: student.nascimento || "", profissao: student.profissao || "", ativo: student.ativo, data_matricula: student.data_matricula || "", contato_emergencia: student.contato_emergencia || "", observacoes_saude: student.observacoes_saude || "" }); setModalOpen(true); }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (form.nome.trim().length < 3) { notify("Informe o nome completo do aluno.", "error"); return; }
    if (!form.telefone.trim()) { notify("Informe pelo menos um telefone.", "error"); return; }
    if (!form.nascimento) { notify("Informe a data de nascimento.", "error"); return; }
    setSaving(true);
    const payload = { ...form, nome: form.nome.trim(), cpf: form.cpf?.trim() || null, email: form.email?.trim() || null, telefone: form.telefone.trim(), telefone2: form.telefone2?.trim() || null, profissao: form.profissao?.trim() || null, data_matricula: form.data_matricula || null, contato_emergencia: form.contato_emergencia?.trim() || null, observacoes_saude: form.observacoes_saude?.trim() || null, atualizado_em: new Date().toISOString() };
    const query = editingId ? supabase.from("alunos").update(payload).eq("id", editingId) : supabase.from("alunos").insert({ ...payload, criado_em: new Date().toISOString() });
    const { error } = await query;
    setSaving(false);
    if (error) notify("Não foi possível salvar o cadastro. Confira os dados e tente novamente.", "error"); else { notify(editingId ? "Cadastro atualizado." : "Aluno cadastrado com sucesso.", "success"); setModalOpen(false); await load(); }
  }
  async function toggleActive(student: Student) {
    const action = student.ativo ? "arquivar" : "reativar";
    if (!window.confirm(`Deseja ${action} o cadastro de ${student.nome}?`)) return;
    const { error } = await supabase.from("alunos").update({ ativo: !student.ativo, atualizado_em: new Date().toISOString() }).eq("id", student.id);
    if (error) notify("Não foi possível atualizar o status do aluno.", "error"); else { notify(student.ativo ? "Aluno arquivado." : "Aluno reativado.", "success"); await load(); }
  }
  const filtered = useMemo(() => students.filter((student) => (status === "todos" || (status === "ativos" ? student.ativo : !student.ativo)) && `${student.nome} ${student.telefone} ${student.email || ""}`.toLowerCase().includes(search.toLowerCase().trim())), [students, search, status]);
  const activeCount = students.filter((student) => student.ativo).length;
  const field = (key: keyof StudentForm, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));

  return <main className="dashboard-shell students-shell"><AppSidebar usuario={usuario} active="students" onNavigate={onNavigate} onLogout={onLogout} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} /><div className="dashboard-main students-main"><header className="students-header"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div><p className="eyebrow"><UsersRound size={15} /> Cadastro</p><h1>Alunos</h1><p>Tenha as informações essenciais sempre à mão, sem complicar a rotina.</p></div><button className="primary-button" onClick={openNew}><Plus size={17} /> Novo aluno</button></header>{message && <div className={`students-feedback ${message.type}`}><span>{message.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}</span>{message.text}<button onClick={() => setMessage(null)} aria-label="Fechar aviso"><X size={15} /></button></div>}<section className="students-summary"><div><span className="section-kicker">Sua base</span><strong>{activeCount}</strong><p>alunos ativos</p></div><div><span className="section-kicker">Exibição</span><strong>{filtered.length}</strong><p>{status === "ativos" ? "cadastros ativos" : status === "inativos" ? "cadastros arquivados" : "cadastros encontrados"}</p></div><div className="students-summary-note"><UserRound size={20} /><span>Cadastros arquivados continuam preservados para manter o histórico.</span></div></section><section className="students-card"><div className="students-toolbar"><div className="student-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, telefone ou e-mail" /></div><div className="student-tabs">{(["ativos", "inativos", "todos"] as const).map((item) => <button className={status === item ? "active" : ""} onClick={() => setStatus(item)} key={item}>{item === "ativos" ? "Ativos" : item === "inativos" ? "Arquivados" : "Todos"}</button>)}</div></div>{loading ? <div className="students-loading">Carregando alunos…</div> : filtered.length === 0 ? <div className="students-empty"><UsersRound size={28} /><strong>{search ? "Nenhum aluno encontrado" : "Ainda não há alunos nesta lista"}</strong><p>{search ? "Tente buscar por outro nome ou telefone." : "Comece cadastrando o primeiro aluno da academia."}</p>{!search && status === "ativos" && <button className="primary-button" onClick={openNew}><Plus size={16} /> Cadastrar aluno</button>}</div> : <div className="students-list">{filtered.map((student) => <article className="student-row" key={student.id}><span className="student-avatar large">{initials(student.nome)}</span><div className="student-main-info"><strong>{student.nome}</strong><span>{age(student.nascimento)}{student.profissao ? ` · ${student.profissao}` : ""}</span></div><div className="student-contact"><span><Phone size={14} /> {student.telefone}</span>{student.email && <span><Mail size={14} /> {student.email}</span>}</div><span className={`student-status ${student.ativo ? "active" : "inactive"}`}>{student.ativo ? "Ativo" : "Arquivado"}</span><button className="student-edit" onClick={() => openEdit(student)} aria-label={`Editar ${student.nome}`}><Pencil size={16} /></button><ChevronRight className="student-chevron" size={17} /></article>)}</div>}</section></div>{modalOpen && <StudentModal form={form} editing={Boolean(editingId)} saving={saving} update={field} onSubmit={save} onClose={() => setModalOpen(false)} onToggleStatus={() => field("ativo", !form.ativo)} onArchive={() => { const student = students.find((item) => item.id === editingId); if (student) { setModalOpen(false); toggleActive(student); } }} />}</main>;
}

function StudentModal({ form, editing, saving, update, onSubmit, onClose, onToggleStatus, onArchive }: { form: StudentForm; editing: boolean; saving: boolean; update: (key: keyof StudentForm, value: string | boolean) => void; onSubmit: (event: FormEvent) => void; onClose: () => void; onToggleStatus: () => void; onArchive: () => void }) {
  return <div className="agenda-modal-backdrop"><section className="agenda-modal student-modal"><header><div><p className="section-kicker">{editing ? "Editar cadastro" : "Novo aluno"}</p><h2>{editing ? "Atualize as informações" : "Vamos cadastrar este aluno"}</h2></div><button onClick={onClose} aria-label="Fechar"><X size={20} /></button></header><form onSubmit={onSubmit}><div className="student-form-section"><span className="student-form-title">Dados principais</span><div className="agenda-form-grid"><label className="wide">Nome completo<input autoFocus value={form.nome} onChange={(event) => update("nome", event.target.value)} placeholder="Ex.: Mariana Souza" /></label><label>Telefone<input value={form.telefone} onChange={(event) => update("telefone", event.target.value)} placeholder="(00) 00000-0000" /></label><label>Segundo telefone <small>(opcional)</small><input value={form.telefone2 || ""} onChange={(event) => update("telefone2", event.target.value)} /></label><label>Data de nascimento<input type="date" value={form.nascimento} onChange={(event) => update("nascimento", event.target.value)} /></label><label>Data de matrícula <small>(opcional)</small><input type="date" value={form.data_matricula || ""} onChange={(event) => update("data_matricula", event.target.value)} /></label></div></div><div className="student-form-section"><span className="student-form-title">Contato e identificação</span><div className="agenda-form-grid"><label>CPF <small>(opcional)</small><input value={form.cpf || ""} onChange={(event) => update("cpf", event.target.value)} /></label><label>E-mail <small>(opcional)</small><input type="email" value={form.email || ""} onChange={(event) => update("email", event.target.value)} /></label><label>Profissão <small>(opcional)</small><input value={form.profissao || ""} onChange={(event) => update("profissao", event.target.value)} /></label><label>Contato de emergência <small>(opcional)</small><input value={form.contato_emergencia || ""} onChange={(event) => update("contato_emergencia", event.target.value)} /></label></div></div><div className="student-form-section"><span className="student-form-title">Observações de saúde</span><textarea rows={3} value={form.observacoes_saude || ""} onChange={(event) => update("observacoes_saude", event.target.value)} placeholder="Restrições, cuidados ou informações importantes para o atendimento…" /></div><label className="student-active-toggle"><input type="checkbox" checked={form.ativo} onChange={onToggleStatus} /> Cadastro ativo e disponível para novos agendamentos</label><footer><button type="button" className="outline-button" onClick={onClose}>Cancelar</button>{editing && form.ativo && <button type="button" className="danger-button" onClick={onArchive}><Trash2 size={15} /> Arquivar</button>}<button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando…" : <><Check size={16} /> {editing ? "Salvar alterações" : "Cadastrar aluno"}</>}</button></footer></form></section></div>;
}
