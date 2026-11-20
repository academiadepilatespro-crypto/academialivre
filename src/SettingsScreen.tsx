import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Check, Clock3, Menu, Pencil, Plus, Save, Settings, Trash2, X } from "lucide-react";
import { supabase, Usuario } from "./lib/supabase";
import AppSidebar from "./AppSidebar";

type Config = { id: number; horario_abertura: string; horario_fechamento: string; intervalo_almoco_inicio: string | null; intervalo_almoco_fim: string | null; duracao_padrao: number; dias_funcionamento: number[] };
type Holiday = { id: number; titulo: string; data: string; descricao: string | null; recorrente: boolean; bloquear_agenda: boolean; ativo: boolean };
type HolidayForm = { id: number | null; titulo: string; data: string; descricao: string; recorrente: boolean; bloquear_agenda: boolean };

const DEFAULT_CONFIG: Config = { id: 1, horario_abertura: "08:00", horario_fechamento: "20:30", intervalo_almoco_inicio: null, intervalo_almoco_fim: null, duracao_padrao: 60, dias_funcionamento: [1, 2, 3, 4, 5] };
const DAYS = [{ id: 1, label: "Segunda" }, { id: 2, label: "Terça" }, { id: 3, label: "Quarta" }, { id: 4, label: "Quinta" }, { id: 5, label: "Sexta" }, { id: 6, label: "Sábado" }, { id: 7, label: "Domingo" }];

function localDate(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(value: string) { if (!value) return ""; return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${value}T12:00:00`)); }
function emptyHoliday(): HolidayForm { return { id: null, titulo: "", data: localDate(), descricao: "", recorrente: false, bloquear_agenda: true }; }

export default function SettingsScreen({ usuario, onNavigate, onLogout }: { usuario: Usuario; onNavigate: (view: "dashboard" | "agenda" | "settings") => void; onLogout: () => void }) {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayForm, setHolidayForm] = useState<HolidayForm>(emptyHoliday());
  const [menuOpen, setMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    setLoading(true);
    const [configQuery, holidaysQuery] = await Promise.all([
      supabase.from("config_estudio").select("id, horario_abertura, horario_fechamento, intervalo_almoco_inicio, intervalo_almoco_fim, duracao_padrao, dias_funcionamento").eq("id", 1).maybeSingle(),
      supabase.from("eventos").select("id, titulo, data, descricao, recorrente, bloquear_agenda, ativo").eq("tipo", "feriado").eq("ativo", true).order("data", { ascending: true }).limit(200),
    ]);
    if (configQuery.error || holidaysQuery.error) setMessage({ type: "error", text: "Não foi possível carregar todas as configurações." });
    if (configQuery.data) setConfig({ ...DEFAULT_CONFIG, ...(configQuery.data as Partial<Config>), dias_funcionamento: (configQuery.data.dias_funcionamento as number[]) || DEFAULT_CONFIG.dias_funcionamento });
    setHolidays((holidaysQuery.data || []) as Holiday[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function notify(text: string, type: "success" | "error") { setMessage({ text, type }); window.setTimeout(() => setMessage(null), 4500); }
  function toggleDay(day: number) { setConfig((current) => ({ ...current, dias_funcionamento: current.dias_funcionamento.includes(day) ? current.dias_funcionamento.filter((value) => value !== day) : [...current.dias_funcionamento, day].sort() })); }
  async function saveConfig(event: FormEvent) {
    event.preventDefault();
    if (!config.dias_funcionamento.length) { notify("Selecione pelo menos um dia de funcionamento.", "error"); return; }
    if (config.horario_fechamento <= config.horario_abertura) { notify("O horário de fechamento deve ser depois da abertura.", "error"); return; }
    const lunchStart = config.intervalo_almoco_inicio || "";
    const lunchEnd = config.intervalo_almoco_fim || "";
    if ((lunchStart && !lunchEnd) || (!lunchStart && lunchEnd) || (lunchStart && lunchEnd && lunchEnd <= lunchStart)) { notify("O fim do intervalo deve ser depois do início.", "error"); return; }
    if (lunchStart && (lunchStart < config.horario_abertura || lunchEnd > config.horario_fechamento)) { notify("O intervalo de almoço deve ficar dentro do horário de funcionamento.", "error"); return; }
    if (![30, 60, 90].includes(Number(config.duracao_padrao))) { notify("Escolha uma duração padrão válida.", "error"); return; }
    setSavingConfig(true);
    const { error } = await supabase.from("config_estudio").upsert({ id: 1, horario_abertura: `${config.horario_abertura.slice(0, 5)}:00`, horario_fechamento: `${config.horario_fechamento.slice(0, 5)}:00`, intervalo_almoco_inicio: lunchStart ? `${lunchStart.slice(0, 5)}:00` : null, intervalo_almoco_fim: lunchEnd ? `${lunchEnd.slice(0, 5)}:00` : null, duracao_padrao: Number(config.duracao_padrao), dias_funcionamento: config.dias_funcionamento, atualizado_em: new Date().toISOString() }, { onConflict: "id" });
    setSavingConfig(false);
    if (error) notify("Não foi possível salvar os horários.", "error"); else notify("Horários da agenda atualizados.", "success");
  }
  async function saveHoliday(event: FormEvent) {
    event.preventDefault();
    if (!holidayForm.titulo.trim() || !holidayForm.data) { notify("Informe o nome e a data do feriado.", "error"); return; }
    setSavingHoliday(true);
    const payload = { titulo: holidayForm.titulo.trim(), data: holidayForm.data, tipo: "feriado", descricao: holidayForm.descricao.trim() || null, recorrente: holidayForm.recorrente, bloquear_agenda: holidayForm.bloquear_agenda, ativo: true };
    const query = holidayForm.id ? supabase.from("eventos").update(payload).eq("id", holidayForm.id) : supabase.from("eventos").insert(payload);
    const { error } = await query;
    setSavingHoliday(false);
    if (error) notify("Não foi possível salvar o feriado.", "error"); else { notify("Feriado salvo.", "success"); setHolidayForm(emptyHoliday()); await load(); }
  }
  async function archiveHoliday(id: number) {
    if (!window.confirm("Remover este feriado da agenda?")) return;
    const { error } = await supabase.from("eventos").update({ ativo: false }).eq("id", id);
    if (error) notify("Não foi possível remover o feriado.", "error"); else { notify("Feriado removido.", "success"); await load(); }
  }

  return <main className="dashboard-shell settings-shell"><AppSidebar usuario={usuario} active="settings" onNavigate={onNavigate} onLogout={onLogout} mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} /><div className="dashboard-main settings-main"><header className="settings-header"><button className="mobile-menu settings-mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div><p className="eyebrow"><Settings size={15} /> Configurações</p><h1>Regras da agenda</h1><p>Defina quando o estúdio funciona e quais dias devem ficar bloqueados.</p></div></header>{message && <div className={`settings-feedback ${message.type}`}><span>{message.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}</span>{message.text}</div>}<div className="settings-grid"><section className="settings-card"><div className="settings-card-heading"><div><span className="settings-icon"><Clock3 size={18} /></span><div><h2>Horários de funcionamento</h2><p>Os horários fora deste intervalo não aparecem para novos agendamentos.</p></div></div><Save size={17} /></div>{loading ? <div className="settings-loading">Carregando configurações…</div> : <form onSubmit={saveConfig}><div className="settings-fields"><label>Abre às<input type="time" value={config.horario_abertura.slice(0, 5)} onChange={(event) => setConfig({ ...config, horario_abertura: event.target.value })} /></label><label>Fecha às<input type="time" value={config.horario_fechamento.slice(0, 5)} onChange={(event) => setConfig({ ...config, horario_fechamento: event.target.value })} /></label><label>Almoço — início<input type="time" value={config.intervalo_almoco_inicio?.slice(0, 5) || ""} onChange={(event) => setConfig({ ...config, intervalo_almoco_inicio: event.target.value || null })} /></label><label>Almoço — fim<input type="time" value={config.intervalo_almoco_fim?.slice(0, 5) || ""} onChange={(event) => setConfig({ ...config, intervalo_almoco_fim: event.target.value || null })} /></label><label>Duração padrão<select value={config.duracao_padrao} onChange={(event) => setConfig({ ...config, duracao_padrao: Number(event.target.value) })}><option value={30}>30 minutos</option><option value={60}>60 minutos</option><option value={90}>90 minutos</option></select></label></div><div className="working-days"><span>Dias em que o estúdio trabalha</span><div>{DAYS.map((day) => <button type="button" className={config.dias_funcionamento.includes(day.id) ? "selected" : ""} onClick={() => toggleDay(day.id)} key={day.id}>{day.label}</button>)}</div><small>Os dias não selecionados ficam bloqueados para novos agendamentos.</small></div><button className="primary-button settings-save" type="submit" disabled={savingConfig}>{savingConfig ? "Salvando…" : <><Save size={16} /> Salvar regras da agenda</>}</button></form>}</section><section className="settings-card holidays-card"><div className="settings-card-heading"><div><span className="settings-icon gold"><CalendarDays size={18} /></span><div><h2>Feriados e bloqueios</h2><p>Cadastre os dias sem aula e escolha se a agenda ficará bloqueada.</p></div></div></div><form className="holiday-form" onSubmit={saveHoliday}><div className="settings-fields"><label>Nome do feriado<input value={holidayForm.titulo} onChange={(event) => setHolidayForm({ ...holidayForm, titulo: event.target.value })} placeholder="Ex.: Feriado municipal" /></label><label>Data<input type="date" value={holidayForm.data} onChange={(event) => setHolidayForm({ ...holidayForm, data: event.target.value })} /></label></div><label className="settings-wide">Observação <textarea rows={2} value={holidayForm.descricao} onChange={(event) => setHolidayForm({ ...holidayForm, descricao: event.target.value })} placeholder="Opcional" /></label><div className="holiday-options"><label><input type="checkbox" checked={holidayForm.recorrente} onChange={(event) => setHolidayForm({ ...holidayForm, recorrente: event.target.checked })} /> Repetir todos os anos</label><label><input type="checkbox" checked={holidayForm.bloquear_agenda} onChange={(event) => setHolidayForm({ ...holidayForm, bloquear_agenda: event.target.checked })} /> Bloquear a agenda neste dia</label></div><div className="holiday-form-actions"><button className="primary-button" type="submit" disabled={savingHoliday}>{savingHoliday ? "Salvando…" : <><Plus size={16} /> {holidayForm.id ? "Atualizar feriado" : "Adicionar feriado"}</>}</button>{holidayForm.id && <button type="button" className="outline-button" onClick={() => setHolidayForm(emptyHoliday())}>Cancelar edição</button>}</div></form><div className="holiday-list">{holidays.length === 0 ? <div className="settings-empty">Nenhum feriado cadastrado.</div> : holidays.map((holiday) => <article className="holiday-item" key={holiday.id}><div><strong>{holiday.titulo}</strong><span>{formatDate(holiday.data)}{holiday.recorrente ? " · todos os anos" : ""}</span></div><div className="holiday-status"><span className={holiday.bloquear_agenda ? "blocked" : "open"}>{holiday.bloquear_agenda ? "Agenda bloqueada" : "Agenda aberta"}</span><button className="icon-action" onClick={() => setHolidayForm({ id: holiday.id, titulo: holiday.titulo, data: holiday.data, descricao: holiday.descricao || "", recorrente: holiday.recorrente, bloquear_agenda: holiday.bloquear_agenda })} aria-label={`Editar ${holiday.titulo}`}><Pencil size={15} /></button><button className="icon-action danger" onClick={() => archiveHoliday(holiday.id)} aria-label={`Remover ${holiday.titulo}`}><Trash2 size={15} /></button></div></article>)}</div></section></div></div></main>;
}
