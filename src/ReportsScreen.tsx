import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, CalendarDays, CheckCircle2, Clock3, Menu, RefreshCw, TrendingUp, UsersRound, X } from "lucide-react";
import { supabase, Usuario } from "./lib/supabase";
import AppSidebar from "./AppSidebar";

type View = "dashboard" | "agenda" | "students" | "finance" | "reports" | "settings";
type Lesson = { id: number; data: string; horario: string; status: string | null; presenca: string | null; aluno_id: number | null };
type Student = { id: number; nome: string; ativo: boolean };
type PeriodKey = "7" | "30" | "90" | "year";

const CAPACITY = 4;
function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function rangeFor(key: PeriodKey) { const end = new Date(); const start = new Date(); if (key === "year") start.setMonth(0, 1); else start.setDate(start.getDate() - (Number(key) - 1)); return { start: localDate(start), end: localDate(end) }; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`)).replace(" de ", " ").replace(".", ""); }
function percent(value: number) { return `${Math.round(value)}%`; }
function initials(value: string) { return value.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "AL"; }

export default function ReportsScreen({ usuario, onNavigate, onLogout }: { usuario: Usuario; onNavigate: (view: View) => void; onLogout: () => void }) {
  const [periodKey, setPeriodKey] = useState<PeriodKey>("30");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  async function load(refresh = false) {
    refresh ? setRefreshing(true) : setLoading(true); setError("");
    const range = rangeFor(periodKey);
    const [lessonsQuery, studentsQuery] = await Promise.all([
      supabase.from("aulas").select("id, data, horario, status, presenca, aluno_id").gte("data", range.start).lte("data", range.end).order("data", { ascending: true }).order("horario", { ascending: true }).limit(5000),
      supabase.from("alunos").select("id, nome, ativo").eq("ativo", true).order("nome", { ascending: true }).limit(1500),
    ]);
    if (lessonsQuery.error || studentsQuery.error) setError("Alguns dados não puderam ser carregados agora.");
    setLessons((lessonsQuery.data || []) as Lesson[]); setStudents((studentsQuery.data || []) as Student[]);
    setLoading(false); setRefreshing(false);
  }
  useEffect(() => { load(); }, [periodKey]);

  const names = useMemo(() => Object.fromEntries(students.map((item) => [item.id, item.nome])), [students]);
  const activeLessons = lessons.filter((item) => item.status !== "cancelada");
  const today = localDate();
  const todayLessons = activeLessons.filter((item) => item.data === today);
  const attended = activeLessons.filter((item) => item.presenca === "presente").length;
  const absent = activeLessons.filter((item) => item.presenca === "ausente").length;
  const justified = activeLessons.filter((item) => item.presenca === "justificada").length;
  const marked = activeLessons.filter((item) => item.presenca);
  const attendanceRate = marked.length ? attended / marked.length * 100 : 0;
  const occupancy = activeLessons.length ? Math.min(100, activeLessons.length / Math.max(1, new Set(activeLessons.map((item) => `${item.data}-${item.horario.slice(0, 5)}`)).size * CAPACITY) * 100) : 0;
  const studentAbsences = useMemo(() => Object.entries(activeLessons.filter((item) => item.presenca === "ausente").reduce<Record<string, number>>((acc, item) => { const key = String(item.aluno_id || "unknown"); acc[key] = (acc[key] || 0) + 1; return acc; }, {})).map(([id, count]) => ({ id, count, name: names[Number(id)] || "Aluno" })).filter((item) => item.count >= 2).sort((a, b) => b.count - a.count).slice(0, 5), [activeLessons, names]);
  const byDay = useMemo(() => Array.from({ length: periodKey === "year" ? 12 : Math.min(Number(periodKey), 7) }, (_, index) => { const date = new Date(); if (periodKey === "year") { date.setMonth(index, 1); } else { date.setDate(date.getDate() - (Math.min(Number(periodKey), 7) - 1 - index)); } const token = localDate(date); return { label: periodKey === "year" ? new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "") : dateLabel(token), value: activeLessons.filter((item) => item.data === token).length }; }), [activeLessons, periodKey]);
  const maxDay = Math.max(1, ...byDay.map((item) => item.value));
  const occupiedHours = Object.entries(todayLessons.reduce<Record<string, number>>((acc, item) => { const key = item.horario.slice(0, 5); acc[key] = (acc[key] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return <main className="dashboard-shell reports-shell"><AppSidebar usuario={usuario} active="reports" onNavigate={onNavigate} onLogout={onLogout} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} /><div className="dashboard-main reports-main"><header className="reports-header"><button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div><p className="eyebrow"><BarChart3 size={15} /> Visão da rotina</p><h1>Relatórios</h1><p>Uma leitura simples para entender a agenda e cuidar melhor dos alunos.</p></div><button className="outline-button compact" onClick={() => load(true)} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "spin-icon" : ""} /> Atualizar</button></header>{error && <div className="reports-alert"><AlertTriangle size={17} /> {error}</div>}<section className="reports-toolbar"><div><span>Período de análise</span><strong>{periodKey === "year" ? "Este ano" : `Últimos ${periodKey} dias`}</strong></div><div className="reports-periods">{(["7", "30", "90", "year"] as PeriodKey[]).map((key) => <button key={key} className={periodKey === key ? "active" : ""} onClick={() => setPeriodKey(key)}>{key === "year" ? "Este ano" : `${key} dias`}</button>)}</div></section><section className="reports-kpis"><ReportKpi icon={<CalendarDays size={18} />} label="Aulas no período" value={loading ? "—" : String(activeLessons.length)} detail={`${todayLessons.length} hoje`} tone="green" /><ReportKpi icon={<CheckCircle2 size={18} />} label="Presença marcada" value={loading ? "—" : percent(attendanceRate)} detail={`${attended} presenças confirmadas`} tone="blue" /><ReportKpi icon={<TrendingUp size={18} />} label="Ocupação estimada" value={loading ? "—" : percent(occupancy)} detail={`Capacidade de ${CAPACITY} por horário`} tone="gold" /><ReportKpi icon={<AlertTriangle size={18} />} label="Faltas" value={loading ? "—" : String(absent)} detail={`${justified} justificadas`} tone="red" /></section><section className="reports-grid"><section className="report-panel report-chart-panel"><div className="report-panel-heading"><div><p className="section-kicker"><BarChart3 size={14} /> Ritmo da agenda</p><h2>Aulas realizadas por dia</h2></div><span className="report-badge">{activeLessons.length} aulas</span></div><div className="report-bars">{byDay.map((item) => <div className="report-bar-column" key={item.label}><div className="report-bar-track"><i style={{ height: `${Math.max(item.value ? 8 : 2, item.value / maxDay * 100)}%` }} title={`${item.value} aulas`} /></div><strong>{item.value}</strong><small>{item.label}</small></div>)}</div><div className="report-chart-note"><span><i /> Aulas agendadas</span><span>Média: {byDay.length ? (activeLessons.length / byDay.length).toFixed(1) : "0"} por dia</span></div></section><section className="report-panel today-report"><div className="report-panel-heading"><div><p className="section-kicker"><Clock3 size={14} /> Hoje</p><h2>O que merece atenção</h2></div><span className="today-dot">Ao vivo</span></div><div className="today-highlight"><strong>{todayLessons.length}</strong><span>aulas programadas hoje</span><small>{todayLessons.filter((item) => item.presenca === "presente").length} presenças · {todayLessons.filter((item) => !item.presenca).length} pendentes</small></div>{occupiedHours.length ? <div className="hour-list">{occupiedHours.map(([hour, count]) => <div key={hour}><span>{hour}</span><div><i style={{ width: `${Math.min(100, count / CAPACITY * 100)}%` }} /></div><b>{count}/{CAPACITY}</b></div>)}</div> : <div className="report-empty"><CalendarDays size={20} /><span>Nenhuma aula agendada para hoje.</span></div>}</section></section><section className="reports-grid second"><section className="report-panel"><div className="report-panel-heading"><div><p className="section-kicker"><UsersRound size={14} /> Acompanhamento</p><h2>Alunos com faltas recorrentes</h2></div><span className="report-badge">{studentAbsences.length} alertas</span></div>{studentAbsences.length ? <div className="absence-list">{studentAbsences.map((item) => <div className="absence-item" key={item.id}><span className="report-avatar">{initials(item.name)}</span><div><strong>{item.name}</strong><small>Precisa de um contato próximo</small></div><b>{item.count} faltas</b><ArrowRight size={15} /></div>)}</div> : <div className="report-empty"><CheckCircle2 size={22} /><strong>Nenhum alerta de faltas</strong><span>Os alunos com duas ou mais faltas aparecerão aqui.</span></div>}</section><section className="report-panel quick-reading"><div className="report-panel-heading"><div><p className="section-kicker"><TrendingUp size={14} /> Resumo executivo</p><h2>Leitura rápida</h2></div></div><div className="reading-list"><div><span>Alunos ativos</span><strong>{loading ? "—" : students.length}</strong></div><div><span>Aulas sem presença registrada</span><strong>{loading ? "—" : activeLessons.filter((item) => !item.presenca).length}</strong></div><div><span>Horários mais procurados hoje</span><strong>{occupiedHours[0]?.[0] || "—"}</strong></div><div><span>Taxa de faltas</span><strong>{loading ? "—" : percent(activeLessons.length ? absent / activeLessons.length * 100 : 0)}</strong></div></div></section></section><div className="reports-help"><span><BarChart3 size={18} /></span><div><strong>Use os relatórios para agir, não só para consultar.</strong><small>Um contato hoje pode evitar uma desistência amanhã.</small></div><button className="subtle-button" onClick={() => onNavigate("students")}>Ver alunos <ArrowRight size={15} /></button></div></div></main>;
}

function ReportKpi({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: string }) { return <div className="report-kpi"><span className={`report-kpi-icon ${tone}`}>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></div>; }
