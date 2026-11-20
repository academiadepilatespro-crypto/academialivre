import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListPlus,
  LoaderCircle,
  Menu,
  Plus,
  RefreshCw,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import { supabase, Usuario } from "./lib/supabase";
import AppSidebar from "./AppSidebar";

type ViewMode = "dia" | "semana" | "mes";
type AgendaFilter = { aluno: string; status: string; horario: string; periodo: string };
type Student = { id: number; nome: string; telefone: string | null; email: string | null; ativo: boolean };
type EventBlock = { id: number; data: string; titulo: string; recorrente: boolean; bloquear_agenda: boolean };
type ClassItem = { id: number; aluno_id: number; data: string; horario: string; duracao: number; status: string; presenca: string | null; checkin: string | null; checkout: string | null; observacoes: string | null; plano_aluno_id: number | null; aluno: { id: number; nome: string; telefone: string | null; email: string | null } | null };
type CommercialPlan = { id: number; nome: string; ativo: boolean };
type FormState = { id: number | null; alunoId: string; data: string; horario: string; duracao: string; status: string; presenca: string; foco: string; observacoes: string; originalId: number | null; tipo: "avulsa" | "continuo" | "sessoes" | "periodo"; planoId: string; dias: number[]; periodoMeses: string; totalSessoes: string; dataFim: string; pausaInicio: string; pausaFim: string };

const CAPACITY = 5;
const ALERT_CAPACITY = 4;
const HOURS = ["08:00", "09:00", "10:00", "11:00", "13:30", "14:30", "15:30", "16:30", "17:30", "18:30", "19:30", "20:30"];
const DAYS = [{ id: 1, label: "Seg" }, { id: 2, label: "Ter" }, { id: 3, label: "Qua" }, { id: 4, label: "Qui" }, { id: 5, label: "Sex" }, { id: 6, label: "Sáb" }, { id: 7, label: "Dom" }];

function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function fromDate(value: string) { const [year, month, day] = value.split("-").map(Number); return new Date(year, month - 1, day); }
function addDays(value: string, amount: number) { const date = fromDate(value); date.setDate(date.getDate() + amount); return localDate(date); }
function startOfWeek(date: Date) { const result = new Date(date); result.setDate(result.getDate() - result.getDay()); return result; }
function formatLong(value: string) { return fromDate(value).toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); }
function formatShort(value: string) { return fromDate(value).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" }); }
function time(value: string) { return value?.slice(0, 5) || "—"; }
function initials(name: string) { return name.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AL"; }
function minutes(value: string) { const [hour, minute] = value.slice(0, 5).split(":").map(Number); return hour * 60 + minute; }
function dayOfWeek(value: string) { const day = fromDate(value).getDay(); return day === 0 ? 7 : day; }
function emptyForm(date = localDate()): FormState { return { id: null, alunoId: "", data: date, horario: "09:00", duracao: "60", status: "confirmada", presenca: "", foco: "", observacoes: "", originalId: null, tipo: "avulsa", planoId: "", dias: [], periodoMeses: "12", totalSessoes: "20", dataFim: addDays(date, 365), pausaInicio: "", pausaFim: "" }; }

export default function AgendaScreen({ usuario, onNavigate, onLogout }: { usuario: Usuario; onNavigate: (view: "dashboard" | "agenda") => void; onLogout: () => void }) {
  const [view, setView] = useState<ViewMode>("dia");
  const [cursor, setCursor] = useState(new Date());
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [events, setEvents] = useState<EventBlock[]>([]);
  const [filters, setFilters] = useState<AgendaFilter>({ aluno: "", status: "", horario: "", periodo: "" });
  const [form, setForm] = useState<FormState>(emptyForm());
  const [modal, setModal] = useState<"none" | "class" | "details">("none");
  const [selected, setSelected] = useState<ClassItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const range = useMemo(() => {
    const center = new Date(cursor);
    const start = new Date(center.getFullYear(), center.getMonth(), 1); start.setDate(start.getDate() - 7);
    const end = new Date(center.getFullYear(), center.getMonth() + 1, 0); end.setDate(end.getDate() + 14);
    return { start: localDate(start), end: localDate(end) };
  }, [cursor]);

  async function load() {
    setLoading(true); setMessage(null);
    const [aulas, alunos, planos, eventos] = await Promise.all([
      supabase.from("aulas").select("id, aluno_id, data, horario, duracao, status, presenca, checkin, checkout, observacoes, plano_aluno_id, alunos(id, nome, telefone, email)").gte("data", range.start).lte("data", range.end).order("data").order("horario"),
      supabase.from("alunos").select("id, nome, telefone, email, ativo").eq("ativo", true).order("nome"),
      supabase.from("planos").select("id, nome, ativo").eq("ativo", true).order("nome"),
      supabase.from("eventos").select("id, data, titulo, recorrente, bloquear_agenda").eq("ativo", true).eq("bloquear_agenda", true).order("data"),
    ]);
    if (aulas.error || alunos.error || planos.error || eventos.error) setMessage({ type: "error", text: "Não foi possível carregar toda a agenda agora." });
    setClasses((aulas.data || []) as unknown as ClassItem[]); setStudents((alunos.data || []) as Student[]); setPlans((planos.data || []) as CommercialPlan[]); setEvents((eventos.data || []) as EventBlock[]); setLoading(false);
  }
  useEffect(() => { load(); }, [range.start, range.end]);

  const eventFor = (date: string) => events.find((event) => event.data === date || (event.recorrente && event.data?.slice(5) === date.slice(5)));
  const currentDate = localDate(cursor);
  const weekStart = localDate(startOfWeek(cursor));
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const monthStart = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-01`;
  const monthDays = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const filtered = (items: ClassItem[]) => items.filter((item) => {
    if (filters.aluno && String(item.aluno_id) !== filters.aluno) return false;
    if (filters.horario && time(item.horario) !== filters.horario) return false;
    if (filters.periodo === "manha" && (minutes(item.horario) < 480 || minutes(item.horario) >= 720)) return false;
    if (filters.periodo === "tarde" && (minutes(item.horario) < 810 || minutes(item.horario) >= 1230)) return false;
    if (filters.status === "confirmada" && (item.status !== "confirmada" || Boolean(item.presenca))) return false;
    if (filters.status === "presente" && item.presenca !== "presente") return false;
    if (filters.status === "ausente" && item.presenca !== "ausente") return false;
    if (filters.status === "justificada" && item.presenca !== "justificada") return false;
    if (filters.status === "reagendada" && item.status !== "reagendada") return false;
    if (filters.status === "cancelada" && item.status !== "cancelada") return false;
    return true;
  });
  const forDate = (date: string) => filtered(classes.filter((item) => item.data === date && (filters.status === "cancelada" || item.status !== "cancelada")));
  const capacity = (date: string, hour: string, ignoreId?: number) => classes.filter((item) => item.data === date && time(item.horario) === hour && item.status !== "cancelada" && item.id !== ignoreId).length;

  function notify(text: string, type: "success" | "error") { setMessage({ text, type }); window.setTimeout(() => setMessage(null), 5000); }
  function navigate(amount: number) { if (view === "dia") setCursor((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount)); else if (view === "semana") setCursor((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + amount * 7)); else setCursor((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1)); }
  function goToday() { setCursor(new Date()); }
  function openNew(date = currentDate, hour = "09:00") { const blocked = eventFor(date); if (blocked) { notify(`A agenda está bloqueada em ${formatShort(date)}: ${blocked.titulo}.`, "error"); return; } setForm({ ...emptyForm(date), horario: hour }); setSelected(null); setModal("class"); }
  function openEdit(item: ClassItem) { const obs = item.observacoes || ""; const match = obs.match(/^Foco: (.*?)( \| Obs: |$)/); setForm({ ...emptyForm(item.data), id: item.id, alunoId: String(item.aluno_id), data: item.data, horario: time(item.horario), duracao: String(item.duracao || 60), status: item.status || "confirmada", presenca: item.presenca || "", foco: match ? match[1] : obs, observacoes: match ? obs.replace(/^Foco: .*?( \| Obs: |$)/, "").trim() : "", originalId: null, tipo: "avulsa", planoId: "", dias: [], periodoMeses: "12", totalSessoes: "20", dataFim: item.data, pausaInicio: "", pausaFim: "" }); setModal("class"); }
  function openDetails(item: ClassItem) { setSelected(item); setModal("details"); }
  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }
  function toggleDay(day: number) { updateForm("dias", form.dias.includes(day) ? form.dias.filter((value) => value !== day) : [...form.dias, day].sort()); }

  function datesForForm() {
    if (form.tipo === "avulsa") return [{ data: form.data, horario: form.horario }];
    if (!form.dias.length) return [];
    const start = fromDate(form.data); const end = form.tipo === "sessoes" ? new Date(start.getFullYear() + 3, start.getMonth(), start.getDate()) : fromDate(form.tipo === "continuo" ? addMonths(form.data, Number(form.periodoMeses) || 12) : form.dataFim);
    const result: { data: string; horario: string }[] = []; let current = new Date(start); let count = 0; const max = form.tipo === "sessoes" ? Number(form.totalSessoes) || 0 : 1000;
    while (current <= end && result.length < max) { const date = localDate(current); if (form.dias.includes(dayOfWeek(date)) && !(form.pausaInicio && form.pausaFim && date >= form.pausaInicio && date <= form.pausaFim)) { const day = form.dias.indexOf(dayOfWeek(date)); result.push({ data: date, horario: form.dias.length === 1 ? form.horario : form.horario }); count++; } current.setDate(current.getDate() + 1); if (form.tipo === "sessoes" && count >= max) break; }
    return result;
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setMessage(null);
    if (!form.alunoId || !form.data || !form.horario) { notify("Selecione aluno, data e horário.", "error"); return; }
    if (form.tipo !== "avulsa" && !form.dias.length) { notify("Selecione pelo menos um dia da semana.", "error"); return; }
    if (form.tipo !== "avulsa" && !form.planoId) { notify("Selecione um plano para o agendamento recorrente.", "error"); return; }
    if ((form.pausaInicio && !form.pausaFim) || (!form.pausaInicio && form.pausaFim) || form.pausaFim < form.pausaInicio) { notify("Informe um período de pausa válido.", "error"); return; }
    const dates = datesForForm(); if (!dates.length) { notify("Nenhuma aula foi gerada com os critérios atuais.", "error"); return; }
    const conflict = dates.find(({ data, horario }) => classes.some((item) => item.aluno_id === Number(form.alunoId) && item.data === data && item.status !== "cancelada" && item.id !== form.id && minutes(item.horario) < minutes(horario) + Number(form.duracao) && minutes(item.horario) + Number(item.duracao || 60) > minutes(horario)));
    if (conflict) { notify(`Conflito de horário em ${formatShort(conflict.data)} às ${conflict.horario}.`, "error"); return; }
    const blocked = dates.find(({ data }) => eventFor(data)); if (blocked) { notify(`A agenda está bloqueada em ${formatShort(blocked.data)}: ${eventFor(blocked.data)?.titulo}.`, "error"); return; }
    setSaving(true);
    try {
      const combined = [form.foco && `Foco: ${form.foco}`, form.observacoes && `Obs: ${form.observacoes}`].filter(Boolean).join(" | ");
      if (form.id) {
        const { error } = await supabase.from("aulas").update({ aluno_id: Number(form.alunoId), data: form.data, horario: `${form.horario}:00`, duracao: Number(form.duracao), status: form.status, presenca: form.presenca || null, observacoes: combined }).eq("id", form.id); if (error) throw error;
        notify("Aula atualizada com sucesso.", "success");
      } else if (form.tipo === "avulsa") {
        const { error } = await supabase.from("aulas").insert({ aluno_id: Number(form.alunoId), data: form.data, horario: `${form.horario}:00`, duracao: Number(form.duracao), status: form.status, presenca: form.presenca || null, observacoes: combined }); if (error) throw error;
        if (form.originalId) { await supabase.from("aulas").update({ status: "reagendada", observacoes: `Reagendada para ${form.data} às ${form.horario}` }).eq("id", form.originalId); await supabase.from("notificacoes").insert({ aluno_id: Number(form.alunoId), tipo: "reagendamento", titulo: "Aula reagendada", mensagem: `Sua aula foi reagendada para ${formatShort(form.data)} às ${form.horario}.` }); }
        notify(form.originalId ? "Aula reagendada com sucesso." : "Aula agendada com sucesso.", "success");
      } else {
        const plan = plans.find((item) => String(item.id) === form.planoId); if (!plan) throw new Error("Plano não encontrado");
        const planData: Record<string, unknown> = { aluno_id: Number(form.alunoId), plano: plan.nome, plano_id: plan.id, tipo_plano: form.tipo, duracao: Number(form.duracao), data_inicio: form.data, observacoes: combined, pausa_inicio: form.pausaInicio || null, pausa_fim: form.pausaFim || null, status: "ativo", criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() };
        if (form.tipo === "continuo") { planData.periodo_meses = Number(form.periodoMeses) || 12; planData.data_fim = addMonths(form.data, Number(form.periodoMeses) || 12); planData.renovacao_automatica = true; } else if (form.tipo === "sessoes") { planData.total_sessoes = Number(form.totalSessoes); planData.sessoes_realizadas = 0; } else planData.data_fim = form.dataFim;
        const { data: createdPlan, error: planError } = await supabase.from("planos_alunos").insert(planData).select("id").single(); if (planError || !createdPlan) throw planError || new Error("Não foi possível criar o plano");
        const { error: hoursError } = await supabase.from("planos_horarios").insert(form.dias.map((day) => ({ plano_aluno_id: createdPlan.id, dia_semana: day, horario: `${form.horario}:00` }))); if (hoursError) throw hoursError;
        const rows = dates.map(({ data, horario }) => ({ aluno_id: Number(form.alunoId), plano_aluno_id: createdPlan.id, data, horario: `${horario}:00`, duracao: Number(form.duracao), status: "confirmada", observacoes: combined }));
        const { error: classesError } = await supabase.from("aulas").insert(rows); if (classesError) throw classesError;
        notify(`Plano criado com ${rows.length} aulas.`, "success");
      }
      setModal("none"); await load();
    } catch (error) { notify(`Não foi possível salvar: ${(error as Error).message}`, "error"); } finally { setSaving(false); }
  }
  async function updateClass(fields: Record<string, unknown>, text: string) { if (!selected) return; setSaving(true); const { error } = await supabase.from("aulas").update(fields).eq("id", selected.id); setSaving(false); if (error) notify("Não foi possível atualizar a aula.", "error"); else { notify(text, "success"); setModal("none"); await load(); } }
  async function addToWaitlist() {
    if (!form.alunoId || !form.data || !form.horario) { notify("Selecione aluno, data e horário.", "error"); return; }
    setSaving(true);
    const day = dayOfWeek(form.data);
    const { count, error: countError } = await supabase.from("lista_espera").select("id", { count: "exact", head: true }).eq("dia_semana", day).eq("horario", `${form.horario}:00`);
    if (countError) { setSaving(false); notify("Não foi possível consultar a lista de espera.", "error"); return; }
    const { error } = await supabase.from("lista_espera").insert({ aluno_id: Number(form.alunoId), dia_semana: day, horario: `${form.horario}:00`, posicao: (count || 0) + 1 });
    setSaving(false);
    if (error) notify("Não foi possível inserir na lista de espera.", "error"); else { notify(`Aluno incluído na lista de espera, posição ${(count || 0) + 1}.`, "success"); setModal("none"); }
  }
  function askCancel() { if (window.confirm("Tem certeza que deseja cancelar esta aula?")) updateClass({ status: "cancelada" }, "Aula cancelada."); }
  function checkin() { updateClass({ checkin: new Date().toTimeString().slice(0, 8) }, "Check-in registrado."); }
  function checkout() { updateClass({ checkout: new Date().toTimeString().slice(0, 8) }, "Check-out registrado."); }
  function reschedule() { if (!selected) return; setModal("none"); setForm({ ...emptyForm(selected.data), alunoId: String(selected.aluno_id), data: selected.data, horario: time(selected.horario), duracao: String(selected.duracao || 60), originalId: selected.id, foco: selected.observacoes || "" }); setModal("class"); }

  const title = view === "dia" ? formatLong(currentDate) : view === "semana" ? `Semana de ${formatShort(days[0])} a ${formatShort(days[6])}` : cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const renderCard = (item: ClassItem) => { const at = capacity(item.data, time(item.horario)); return <button className={`agenda-class ${item.presenca || item.status} ${at >= CAPACITY ? "full" : at >= ALERT_CAPACITY ? "warning" : ""}`} key={item.id} onClick={() => openDetails(item)}><span className="agenda-class-time">{time(item.horario)}</span><strong>{item.aluno?.nome || "Aluno sem nome"}</strong><small>{item.presenca ? item.presenca : item.status === "reagendada" ? "Reagendada" : "Confirmada"}</small></button>; };
  const renderDay = (date: string) => { const items = forDate(date); const blocked = eventFor(date); return <section className={`agenda-day-panel ${date === localDate() ? "today" : ""} ${blocked ? "blocked" : ""}`} key={date}><div className="agenda-day-heading"><div><span>{formatShort(date)}</span><strong>{items.length} aula{items.length === 1 ? "" : "s"}</strong></div><button className="icon-button-light" onClick={() => openNew(date)} disabled={Boolean(blocked)} aria-label={`Agendar em ${date}`}><Plus size={17} /></button></div>{blocked && <div className="agenda-blocked"><AlertTriangle size={15} /> {blocked.titulo}</div>}{items.length ? <div className="agenda-day-list">{items.map(renderCard)}</div> : <button className="agenda-empty-slot" onClick={() => openNew(date)} disabled={Boolean(blocked)}><Plus size={16} /> {blocked ? "Dia bloqueado" : "Adicionar aula"}</button>}</section>; };

  return <main className="dashboard-shell agenda-shell"><AppSidebar usuario={usuario} active="agenda" onNavigate={onNavigate} onLogout={onLogout} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} /><div className="dashboard-main agenda-main-shell"><div className="agenda-content"><header className="agenda-page-head"><button className="mobile-menu agenda-mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div><p className="eyebrow"><CalendarDays size={15} /> Agenda</p><h1>Agenda</h1><p>Aulas, horários e presença em um só lugar.</p></div><div className="agenda-actions"><button className="outline-button" onClick={load}><RefreshCw size={15} /> Atualizar</button><button className="primary-button" onClick={() => openNew()} disabled={Boolean(eventFor(currentDate))}><Plus size={17} /> Nova aula</button></div></header>{message && <div className={`agenda-feedback ${message.type}`}><span>{message.type === "success" ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}</span>{message.text}<button onClick={() => setMessage(null)}><X size={15} /></button></div>}<section className="agenda-toolbar"><div className="agenda-view-tabs">{(["dia", "semana", "mes"] as ViewMode[]).map((mode) => <button className={view === mode ? "active" : ""} onClick={() => setView(mode)} key={mode}>{mode === "dia" ? "Dia" : mode === "semana" ? "Semana" : "Mês"}</button>)}</div><div className="agenda-navigation"><button onClick={() => navigate(-1)} aria-label="Anterior"><ChevronLeft size={17} /></button><button className="today-button" onClick={goToday}>Hoje</button><button onClick={() => navigate(1)} aria-label="Próximo"><ChevronRight size={17} /></button><strong>{title}</strong></div></section><section className="agenda-filters"><div className="filter-search"><Search size={16} /><select value={filters.aluno} onChange={(event) => setFilters({ ...filters, aluno: event.target.value })}><option value="">Todos os alunos</option>{students.map((student) => <option value={student.id} key={student.id}>{student.nome}</option>)}</select></div><select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Todos os status</option><option value="confirmada">Confirmadas</option><option value="presente">Presentes</option><option value="ausente">Ausentes</option><option value="justificada">Justificadas</option><option value="reagendada">Reagendadas</option><option value="cancelada">Canceladas</option></select><select value={filters.horario} onChange={(event) => setFilters({ ...filters, horario: event.target.value })}><option value="">Todos os horários</option>{HOURS.map((hour) => <option value={hour} key={hour}>{hour}</option>)}</select><select value={filters.periodo} onChange={(event) => setFilters({ ...filters, periodo: event.target.value })}><option value="">Manhã e tarde</option><option value="manha">Manhã</option><option value="tarde">Tarde</option></select></section>{loading ? <div className="agenda-loading"><LoaderCircle size={24} /> Carregando sua agenda…</div> : view === "dia" ? <section className="day-timeline"><div className="day-summary"><div><span className="section-kicker">Agenda do dia</span><h2>{forDate(currentDate).length} aulas programadas</h2></div><div className="capacity-note"><UsersRound size={16} /> Capacidade por horário: {CAPACITY}</div></div>{eventFor(currentDate) && <div className="agenda-blocked large"><AlertTriangle size={17} /> {eventFor(currentDate)?.titulo} — a agenda está bloqueada neste dia.</div>}<div className="day-slots">{HOURS.map((hour) => { const items = forDate(currentDate).filter((item) => time(item.horario) === hour); const occupied = capacity(currentDate, hour); return <div className={`time-slot ${occupied >= CAPACITY ? "full" : occupied >= ALERT_CAPACITY ? "warning" : ""}`} key={hour}><div className="time-slot-label"><strong>{hour}</strong><small>{occupied}/{CAPACITY}</small></div><div className="time-slot-classes">{items.map(renderCard)}{!items.length && <button className="slot-add" onClick={() => openNew(currentDate, hour)} disabled={Boolean(eventFor(currentDate))}><Plus size={15} /> Horário livre</button>}</div></div>; })}</div></section> : view === "semana" ? <section className="week-grid">{days.map(renderDay)}</section> : <section className="month-grid"><div className="month-weekdays">{["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((day) => <span key={day}>{day}</span>)}</div><div className="month-days">{Array.from({ length: fromDate(monthStart).getDay() }, (_, index) => <span className="month-blank" key={`blank-${index}`} />)}{Array.from({ length: monthDays }, (_, index) => { const date = `${monthStart.slice(0, 8)}${String(index + 1).padStart(2, "0")}`; return <button className={`month-cell ${date === localDate() ? "today" : ""}`} key={date} onClick={() => { setCursor(fromDate(date)); setView("dia"); }}><strong>{index + 1}</strong><small>{forDate(date).length ? `${forDate(date).length} aula${forDate(date).length > 1 ? "s" : ""}` : "Livre"}</small>{eventFor(date) && <i>Bloqueado</i>}{forDate(date).slice(0, 3).map((item) => <span key={item.id}>{time(item.horario)} {item.aluno?.nome?.split(" ")[0]}</span>)}</button>; })}</div></section>}<div className="agenda-legend"><span><i className="legend-dot normal" /> Normal</span><span><i className="legend-dot warning" /> Alta ocupação ({ALERT_CAPACITY})</span><span><i className="legend-dot full" /> Lotado ({CAPACITY})</span><span><i className="legend-dot present" /> Presença registrada</span></div></div></div>{modal === "class" && <ClassModal form={form} students={students} plans={plans} saving={saving} updateForm={updateForm} toggleDay={toggleDay} onSubmit={save} onClose={() => setModal("none")} onWaitlist={addToWaitlist} preview={datesForForm().length} full={capacity(form.data, form.horario, form.id || undefined)} />}{modal === "details" && selected && <DetailsModal item={selected} saving={saving} onClose={() => setModal("none")} onEdit={() => openEdit(selected)} onReschedule={reschedule} onCancel={askCancel} onCheckin={checkin} onCheckout={checkout} />}</main>;
}

function addMonths(value: string, months: number) { const date = fromDate(value); date.setMonth(date.getMonth() + months); return localDate(date); }

function ClassModal({ form, students, plans, saving, updateForm, toggleDay, onSubmit, onClose, onWaitlist, preview, full }: { form: FormState; students: Student[]; plans: CommercialPlan[]; saving: boolean; updateForm: <K extends keyof FormState>(key: K, value: FormState[K]) => void; toggleDay: (day: number) => void; onSubmit: (event: FormEvent) => void; onClose: () => void; onWaitlist: () => void; preview: number; full: number }) {
  return <div className="agenda-modal-backdrop"><section className="agenda-modal"><header><div><p className="section-kicker">{form.id ? "Editar aula" : form.originalId ? "Reagendar aula" : "Novo agendamento"}</p><h2>{form.id ? "Ajuste os detalhes da aula" : "Vamos organizar este horário"}</h2></div><button onClick={onClose} aria-label="Fechar"><X size={20} /></button></header><form onSubmit={onSubmit}><div className="agenda-form-grid"><label>Aluno<select value={form.alunoId} onChange={(event) => updateForm("alunoId", event.target.value)}><option value="">Selecione um aluno</option>{students.map((student) => <option value={student.id} key={student.id}>{student.nome}</option>)}</select></label><label>Tipo de agendamento<select value={form.tipo} onChange={(event) => updateForm("tipo", event.target.value as FormState["tipo"])} disabled={Boolean(form.id || form.originalId)}><option value="avulsa">Aula avulsa</option><option value="continuo">Recorrente por período</option><option value="sessoes">Pacote de sessões</option><option value="periodo">Período com data final</option></select></label><label>Data de início<input type="date" value={form.data} onChange={(event) => updateForm("data", event.target.value)} /></label><label>Horário<select value={form.horario} onChange={(event) => updateForm("horario", event.target.value)}>{HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></label><label>Duração<select value={form.duracao} onChange={(event) => updateForm("duracao", event.target.value)}><option value="30">30 minutos</option><option value="60">60 minutos</option><option value="90">90 minutos</option></select></label>{form.id && <label>Status<select value={form.status} onChange={(event) => updateForm("status", event.target.value)}><option value="confirmada">Confirmada</option><option value="reagendada">Reagendada</option><option value="cancelada">Cancelada</option></select></label>}{form.id && <label>Presença<select value={form.presenca} onChange={(event) => updateForm("presenca", event.target.value)}><option value="">Pendente</option><option value="presente">Presente</option><option value="ausente">Ausente</option><option value="justificada">Justificada</option></select></label>}</div>{form.tipo !== "avulsa" && !form.id && <div className="recurrence-box"><div className="recurrence-title"><ListPlus size={17} /> Regras do plano</div><div className="agenda-form-grid"><label>Plano<select value={form.planoId} onChange={(event) => updateForm("planoId", event.target.value)}><option value="">Selecione o plano</option>{plans.map((plan) => <option value={plan.id} key={plan.id}>{plan.nome}</option>)}</select></label>{form.tipo === "continuo" && <label>Período<select value={form.periodoMeses} onChange={(event) => updateForm("periodoMeses", event.target.value)}><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="0">Até o fim do ano</option></select></label>}{form.tipo === "sessoes" && <label>Total de sessões<input type="number" min="1" max="200" value={form.totalSessoes} onChange={(event) => updateForm("totalSessoes", event.target.value)} /></label>}{form.tipo === "periodo" && <label>Data final<input type="date" min={form.data} value={form.dataFim} onChange={(event) => updateForm("dataFim", event.target.value)} /></label>}</div><div className="day-picker"><span>Dias da semana</span><div>{DAYS.map((day) => <button type="button" className={form.dias.includes(day.id) ? "selected" : ""} onClick={() => toggleDay(day.id)} key={day.id}>{day.label}</button>)}</div></div><div className="agenda-form-grid"><label>Pausa / férias — início<input type="date" value={form.pausaInicio} onChange={(event) => updateForm("pausaInicio", event.target.value)} /></label><label>Pausa / férias — fim<input type="date" value={form.pausaFim} onChange={(event) => updateForm("pausaFim", event.target.value)} /></label></div><p className="recurrence-preview"><CalendarDays size={15} /> Esta configuração criará aproximadamente <strong>{preview}</strong> aula{preview === 1 ? "" : "s"}. A pausa não gera aulas nesse intervalo.</p></div>}<div className="agenda-form-grid"><label className="wide">Foco da aula<input value={form.foco} onChange={(event) => updateForm("foco", event.target.value)} placeholder="Ex.: mobilidade, fortalecimento…" /></label><label className="wide">Observações<textarea rows={3} value={form.observacoes} onChange={(event) => updateForm("observacoes", event.target.value)} placeholder="Alguma informação importante para a aula?" /></label></div>{full >= CAPACITY && <div className="capacity-warning"><AlertTriangle size={17} /><span>Este horário está lotado ({full}/{CAPACITY}). A aula não será criada nesse horário.</span><button type="button" className="outline-button" onClick={onWaitlist} disabled={saving}><ListPlus size={14} /> Entrar na espera</button></div>}<footer><button type="button" className="outline-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={saving || full >= CAPACITY}>{saving ? "Salvando…" : <><Check size={17} /> {form.id ? "Salvar alterações" : form.originalId ? "Confirmar reagendamento" : "Salvar agendamento"}</>}</button></footer></form></section></div>;
}

function DetailsModal({ item, saving, onClose, onEdit, onReschedule, onCancel, onCheckin, onCheckout }: { item: ClassItem; saving: boolean; onClose: () => void; onEdit: () => void; onReschedule: () => void; onCancel: () => void; onCheckin: () => void; onCheckout: () => void }) {
  const isToday = item.data === localDate();
  return <div className="agenda-modal-backdrop"><section className="agenda-modal details-modal"><header><div><p className="section-kicker">Detalhes da aula</p><h2>{item.aluno?.nome || "Aluno sem nome"}</h2></div><button onClick={onClose} aria-label="Fechar"><X size={20} /></button></header><div className="details-status"><span className={`status-pill ${item.presenca || item.status}`}>{item.presenca || item.status}</span>{item.plano_aluno_id && <span className="plan-pill">Aula de plano</span>}</div><div className="details-grid"><div><small>Data</small><strong>{fromDate(item.data).toLocaleDateString("pt-BR")}</strong></div><div><small>Horário</small><strong>{time(item.horario)} · {item.duracao || 60} min</strong></div><div><small>Telefone</small><strong>{item.aluno?.telefone || "Não informado"}</strong></div><div><small>Presença</small><strong>{item.presenca || "Pendente"}</strong></div></div><div className="checkin-box"><div><Clock3 size={18} /><span>Check-in<strong>{item.checkin ? time(item.checkin) : "Ainda não registrado"}</strong></span></div><div><CheckCircle2 size={18} /><span>Check-out<strong>{item.checkout ? time(item.checkout) : "Ainda não registrado"}</strong></span></div></div>{item.observacoes && <div className="details-notes"><small>Foco e observações</small><p>{item.observacoes}</p></div>}<div className="details-actions">{isToday && !item.checkin && <button className="outline-button" onClick={onCheckin} disabled={saving}>Registrar check-in</button>}{isToday && item.checkin && !item.checkout && <button className="outline-button" onClick={onCheckout} disabled={saving}>Registrar check-out</button>}<button className="outline-button" onClick={onEdit}>Editar</button><button className="outline-button" onClick={onReschedule}>Reagendar</button><button className="danger-button" onClick={onCancel} disabled={saving || item.status === "cancelada"}>Cancelar aula</button></div></section></div>;
}
