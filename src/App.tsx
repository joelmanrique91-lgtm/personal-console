import { useEffect, useMemo, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { BoardColumn } from "./components/BoardColumn";
import { CalendarMode, CalendarView } from "./components/CalendarView";
import { Filters } from "./components/Filters";
import { FocusTimer } from "./components/FocusTimer";
import { ReviewSummary } from "./components/ReviewSummary";
import { TaskCard } from "./components/TaskCard";
import { TaskInput } from "./components/TaskInput";
import { fetchMetaWithStatus, postSync } from "./services/api";
import { buildEmptyTask, useStore } from "./store/store";
import { PriorityLane, RiskBand, Status, Task, TaskPriority, TaskStream } from "./store/types";
import { useSyncEngine } from "./sync/engine";
import { EXPORT_SCHEMA_VERSION, buildExportPayload, importSyncPayload } from "./sync/importExport";
import {
  LaneLimits,
  AuthSession,
  clearAuthSession,
  getAuthSession,
  getCalendarViewMode,
  getFocusTaskId,
  getLaneLimits,
  getSyncSettings,
  setAuthSession,
  setCalendarViewMode,
  setFocusTaskId,
  setLaneLimits,
  setSyncSettings
} from "./sync/storage";
import { isSameDay } from "./utils/date";
import { parseQuickInput } from "./utils/quickParser";
import { computeRisk, enrichTaskRisk } from "./utils/risk";
import "./styles/app.css";

const defaultLanes: Array<{ lane: PriorityLane; label: string; limit: number }> = [
  { lane: "P0", label: "P0 Hoy", limit: 5 },
  { lane: "P1", label: "P1 Semana", limit: 12 },
  { lane: "P2", label: "P2 Mes", limit: 20 },
  { lane: "P3", label: "P3 60 días", limit: 30 },
  { lane: "P4", label: "P4 Algún día", limit: 0 }
];

const riskBandWeight: Record<RiskBand, number> = { critical: 4, high: 3, medium: 2, low: 1 };

type View = "inbox" | "board" | "focus" | "review" | "calendar" | "settings";

function laneFromDate(dateIso?: string): PriorityLane {
  if (!dateIso) return "P4";
  const now = new Date();
  const due = new Date(dateIso);
  const days = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
  if (days <= 1) return "P0";
  if (days <= 7) return "P1";
  if (days <= 28) return "P2";
  if (days <= 60) return "P3";
  return "P4";
}

function compareBoardOrder(a: Task, b: Task): number {
  const bandDiff = riskBandWeight[b.riskBand ?? "low"] - riskBandWeight[a.riskBand ?? "low"];
  if (bandDiff !== 0) return bandDiff;
  if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  if (!a.dueDate && b.dueDate) return 1;
  if (a.dueDate && !b.dueDate) return -1;
  return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
}

export function App() {
  const { state, dispatch, actions } = useStore();
  const [view, setView] = useState<View>("inbox");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [webAppUrl, setWebAppUrl] = useState("");
  const [connectionStatus, setConnectionStatus] = useState("");
  const [metaStatus, setMetaStatus] = useState<number | null>(null);
  const [metaBody, setMetaBody] = useState<unknown>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testBody, setTestBody] = useState<unknown>(null);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [showDone, setShowDone] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [streamFilter, setStreamFilter] = useState<TaskStream | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | "all">("all");
  const [includeDoneArchivedExport, setIncludeDoneArchivedExport] = useState(true);
  const [laneLimits, setLaneLimitsState] = useState<LaneLimits>({ P0: 5, P1: 12, P2: 20, P3: 30, P4: 0 });
  const [auth, setAuth] = useState<AuthSession | null>(null);
  const detailTitleRef = useRef<HTMLInputElement>(null);

  const { syncing, pendingOps, conflictsResolved, isOnline, syncNow, lastServerTime, lastSyncAt, refreshSyncState } =
    useSyncEngine(actions.replaceTasks, Boolean(auth?.idToken));

  useEffect(() => {
    void (async () => {
      const [storedMode, settings, focusTaskId, savedLimits, authSession] = await Promise.all([
        getCalendarViewMode(),
        getSyncSettings(),
        getFocusTaskId(),
        getLaneLimits(),
        getAuthSession()
      ]);
      if (storedMode) setCalendarMode(storedMode);
      if (settings.webAppUrl) setWebAppUrl(settings.webAppUrl);
      if (focusTaskId) dispatch({ type: "set-active", payload: focusTaskId });
      if (savedLimits) setLaneLimitsState(savedLimits);
      if (authSession) setAuth(authSession);
    })();
  }, [dispatch]);

  useEffect(() => {
    void setCalendarViewMode(calendarMode);
  }, [calendarMode]);

  useEffect(() => {
    if (state.activeTaskId) {
      void setFocusTaskId(state.activeTaskId);
    }
  }, [state.activeTaskId]);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = window.setTimeout(() => setStatusMessage(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    if (detailTaskId) detailTitleRef.current?.focus();
  }, [detailTaskId]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
      if (event.key === "Escape") {
        setPaletteOpen(false);
        setDetailTaskId(null);
      }
      if (event.ctrlKey && event.key === "Enter" && detailTaskId) {
        setStatusMessage("Cambios guardados.");
        setDetailTaskId(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [detailTaskId]);

  useEffect(() => {
    if (conflictsResolved > 0) setStatusMessage(`Conflictos resueltos automáticamente: ${conflictsResolved}.`);
  }, [conflictsResolved]);

  const visibleTasks = useMemo(() => state.tasks.filter((task) => !task.deletedAt), [state.tasks]);
  const tasksWithRisk = useMemo(() => visibleTasks.map((task) => enrichTaskRisk(task)), [visibleTasks]);
  const lanes = useMemo(
    () => defaultLanes.map((lane) => ({ ...lane, limit: laneLimits[lane.lane] ?? lane.limit })),
    [laneLimits]
  );

  const boardTasks = useMemo(() => {
    return tasksWithRisk
      .filter((task) => (statusFilter === "all" ? task.status !== "archived" : task.status === statusFilter))
      .filter((task) => (showDone ? true : !["done", "archived"].includes(task.status)))
      .filter((task) => (streamFilter === "all" ? true : task.stream === streamFilter))
      .filter((task) => (priorityFilter === "all" ? true : task.priority === priorityFilter))
      .sort(compareBoardOrder);
  }, [priorityFilter, showDone, statusFilter, streamFilter, tasksWithRisk]);

  const inboxTasks = useMemo(() => tasksWithRisk.filter((task) => task.status === "backlog").sort(compareBoardOrder), [tasksWithRisk]);
  const calendarTasks = useMemo(() => tasksWithRisk.filter((task) => Boolean(task.dueDate)), [tasksWithRisk]);

  const focusTask = tasksWithRisk.find((task) => task.id === state.activeTaskId);
  const detailTask = tasksWithRisk.find((task) => task.id === detailTaskId);

  const todaySessions = state.focusSessions.filter((session) => isSameDay(session.startedAt));
  const focusMinutes = todaySessions.reduce((sum, session) => sum + session.minutes, 0);

  const todayCompleted = tasksWithRisk.filter((task) => task.status === "done" && task.doneAt && isSameDay(task.doneAt));
  const todayPending = tasksWithRisk.filter((task) => task.status === "in_progress");
  const todayBlocked = tasksWithRisk.filter((task) => task.status === "blocked");

  const alerts = useMemo(() => {
    const now = Date.now();
    const active = tasksWithRisk.filter((task) => !["done", "archived"].includes(task.status));
    const overdue = active.filter((task) => task.dueDate && new Date(task.dueDate).getTime() < now);
    const due72h = active.filter((task) => {
      if (!task.dueDate) return false;
      const diff = new Date(task.dueDate).getTime() - now;
      return diff >= 0 && diff <= 72 * 60 * 60 * 1000;
    });
    const blockedN = active.filter(
      (task) =>
        task.status === "blocked" &&
        task.blockedSince &&
        (now - new Date(task.blockedSince).getTime()) / (24 * 60 * 60 * 1000) >= 3
    );
    const staleN = active.filter((task) => (now - new Date(task.lastTouchedAt).getTime()) / (24 * 60 * 60 * 1000) >= 7);
    const laneOverflow = lanes.flatMap(({ lane, limit }) => {
      if (!limit) return [];
      const laneTasks = active.filter((task) => task.priorityLane === lane);
      return laneTasks.length > limit ? laneTasks : [];
    });
    return [
      { id: "overdue", label: "Vencidas", count: overdue.length, tasks: overdue },
      { id: "due72h", label: "Vencen ≤ 72h", count: due72h.length, tasks: due72h },
      { id: "blocked", label: "Bloqueadas ≥ 3 días", count: blockedN.length, tasks: blockedN },
      { id: "stale", label: "Sin actividad ≥ 7 días", count: staleN.length, tasks: staleN },
      { id: "over", label: "Carriles sobre límite", count: laneOverflow.length, tasks: laneOverflow }
    ];
  }, [lanes, tasksWithRisk]);

  const addTask = (rawValue: string) => {
    const parsed = parseQuickInput(rawValue);
    if (!parsed.title) return;
    actions.addTask(buildEmptyTask({
      title: parsed.title,
      priority: parsed.priority ?? "med",
      stream: parsed.stream ?? "otro",
      estimateMin: parsed.estimateMin,
      effort: parsed.estimateMin,
      tags: parsed.tags,
      status: "backlog",
      priorityLane: "P4"
    }));
  };

  const setFocusTask = (task: Task) => {
    dispatch({ type: "set-active", payload: task.id });
    setStatusMessage(`Foco del día: ${task.title}`);
  };

  const canMoveToLane = (lane: PriorityLane, taskId: string) => {
    const limit = laneLimits[lane];
    if (!limit || !["P0", "P1"].includes(lane)) return true;
    const count = boardTasks.filter((task) => task.priorityLane === lane && task.id !== taskId).length;
    return count < limit;
  };

  const handleDrop = (lane: PriorityLane, taskId: string) => {
    if (!canMoveToLane(lane, taskId)) {
      setStatusMessage(`${lane} excedido. Mové algo fuera o aumentá límite en Configuración.`);
      return;
    }
    actions.setLane(taskId, lane);
  };

  const handleSetLane = (task: Task, lane: PriorityLane) => {
    if (!canMoveToLane(lane, task.id)) {
      setStatusMessage(`${lane} excedido. Mové algo fuera o aumentá límite en Configuración.`);
      return;
    }
    actions.setLane(task.id, lane);
  };

  const handleSuggestFocus = () => {
    const candidate = [...tasksWithRisk]
      .filter((task) => ["P0", "P1"].includes(task.priorityLane) && !["done", "archived"].includes(task.status))
      .sort(compareBoardOrder)[0];
    if (!candidate) return;
    if (focusTask && !window.confirm("¿Reemplazar foco actual?")) return;
    setFocusTask(candidate);
  };

  const handleExport = async () => {
    const count = includeDoneArchivedExport
      ? tasksWithRisk.length
      : tasksWithRisk.filter((task) => !["done", "archived"].includes(task.status)).length;
    if (!window.confirm(`Se exportarán ${count} tareas.`)) return;
    const payload = JSON.stringify(await buildExportPayload(includeDoneArchivedExport));
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `personal-console-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Exportación lista.");
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    try {
      const parsed = JSON.parse(text) as { schemaVersion?: number; tasks?: Task[]; focusSessions?: unknown[] };
      if (parsed.schemaVersion !== EXPORT_SCHEMA_VERSION) {
        setStatusMessage(`schemaVersion inválida. Esperada: ${EXPORT_SCHEMA_VERSION}.`);
        return;
      }
      if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
        setStatusMessage("Archivo inválido.");
        return;
      }
      const existingIds = new Set(tasksWithRisk.map((task) => task.id));
      const updating = parsed.tasks.filter((task) => existingIds.has(task.id)).length;
      const adding = parsed.tasks.length - updating;
      if (!window.confirm(`Se importarán ${parsed.tasks.length} tareas, se actualizarán ${updating} y se agregarán ${adding}.`)) return;
      await importSyncPayload({
        schemaVersion: parsed.schemaVersion,
        tasks: parsed.tasks,
        focusSessions: Array.isArray(parsed.focusSessions) ? (parsed.focusSessions as typeof state.focusSessions) : []
      }, actions.replaceTasks, actions.replaceFocusSessions);
      setStatusMessage("Importación completada.");
    } catch {
      setStatusMessage("No se pudo importar el archivo.");
    }
  };



  const parseJwtClaims = (token: string): { sub?: string; email?: string; exp?: number } => {
    try {
      const base = token.split(".")[1];
      const json = JSON.parse(atob(base.replace(/-/g, "+").replace(/_/g, "/")));
      return { sub: json.sub, email: json.email, exp: json.exp };
    } catch {
      return {};
    }
  };

  const handleGoogleSuccess = async (credential?: string) => {
    if (!credential) return;
    const claims = parseJwtClaims(credential);
    if (!claims.sub) {
      setStatusMessage("Token inválido: falta userId.");
      return;
    }
    const expiresAt = claims.exp ? new Date(claims.exp * 1000).toISOString() : new Date(Date.now() + 45 * 60 * 1000).toISOString();
    const session: AuthSession = { idToken: credential, userId: claims.sub, email: claims.email, expiresAt };
    await setAuthSession(session);
    setAuth(session);
    setStatusMessage("Sesión iniciada.");
    void refreshSyncState();
  };

  const handleLogout = async () => {
    await clearAuthSession();
    setAuth(null);
    setStatusMessage("Sesión cerrada. Queda modo local.");
  };
  const paletteResults = tasksWithRisk.filter((task) =>
    [task.title, ...(task.tags ?? []), task.blockedReason ?? ""].join(" ").toLowerCase().includes(paletteQuery.toLowerCase())
  );

  return (
    <div className="app">
      <header className="app-header">
        <div><h1>Personal Console</h1><p>Priorizá por tiempo. Visualizá riesgo. Elegí foco diario.</p><span className="product-badge">Offline-first · Sync opcional</span></div>
        <div className="app-header__actions">
                    <button type="button" className="btn btn--ghost" onClick={() => setPaletteOpen(true)}>Cómo se usa</button><button type="button" className="btn btn--secondary" onClick={() => setPaletteOpen(true)}>Buscar (Ctrl+K)</button>
          <label><input type="checkbox" checked={includeDoneArchivedExport} onChange={(e) => setIncludeDoneArchivedExport(e.target.checked)} />Incluir hechas y archivadas</label>
          <button type="button" className="btn btn--secondary" onClick={() => void handleExport()}>Exportar</button>
          <label className="import-label btn btn--secondary">Importar<input type="file" accept="application/json" onChange={(e) => { const f=e.target.files?.[0]; if (f) void handleImport(f); }} /></label>
        </div>
        <div className="app-header__status"><span className={isOnline ? "online" : "offline"}>Estado: {isOnline ? "Online" : "Offline"}</span><span>Ops pendientes: {pendingOps}</span>{syncing ? <span>Sincronizando…</span> : null}</div>
        {statusMessage ? <div className="status-banner">{statusMessage}</div> : null}
      </header>
      <nav className="app-nav">{([{"id":"inbox","label":"Entrada"},{"id":"board","label":"Tablero"},{"id":"focus","label":"Foco del día"},{"id":"review","label":"Revisión"},{"id":"calendar","label":"Calendario"},{"id":"settings","label":"Configuración"}] as {id:View;label:string}[]).map((item)=><button key={item.id} type="button" className={view===item.id?"active btn btn--primary":"btn btn--ghost"} onClick={()=>setView(item.id)}>{item.label}</button>)}</nav>

      {view === "inbox" ? <section className="view"><TaskInput onAdd={addTask} />{inboxTasks.length===0 ? <div className="empty-state"><p><strong>Entrada en cero.</strong></p><p>Capturá una tarea arriba o importá tu archivo para empezar.</p></div> : <div className="inbox-list">{inboxTasks.map((task)=><TaskCard key={task.id} task={task} onSetLane={(lane)=>handleSetLane(task,lane)} onSetStatus={(status)=>actions.setStatus(task.id,status)} onBlock={()=>{ const reason=window.prompt("Motivo de bloqueo")?.trim(); if(reason) actions.setStatus(task.id,"blocked",reason);}} onSetDueDate={(dueDate)=>actions.updateTask({...task,dueDate,priorityLane:dueDate?laneFromDate(dueDate):"P4"})} onSetFocus={()=>setFocusTask(task)} onSelect={()=>setDetailTaskId(task.id)} />)}</div>}</section> : null}

      {view === "board" ? <section className="view"><div className="board-header"><label>Filtrar por estado<select value={statusFilter} onChange={(event)=>setStatusFilter(event.target.value as Status | "all")}><option value="all">Todos</option><option value="backlog">Backlog</option><option value="in_progress">En curso</option><option value="blocked">Bloqueada</option><option value="done">Hecha</option><option value="archived">Archivada</option></select></label><label><input type="checkbox" checked={showDone} onChange={(event)=>setShowDone(event.target.checked)} /> Mostrar hechas</label><Filters stream={streamFilter} priority={priorityFilter} onStreamChange={setStreamFilter} onPriorityChange={setPriorityFilter} /></div>{boardTasks.length===0 ? <div className="empty-state"><p><strong>Sin resultados.</strong></p><p>Ajustá filtros o activá “Mostrar hechas”.</p></div> : <div className="board">{lanes.map(({lane,label,limit})=>{ const laneTasks=boardTasks.filter((task)=>task.priorityLane===lane); const stateLimit = limit===0?"normal":laneTasks.length>limit?"over_limit":laneTasks.length===limit?"at_limit":"normal"; return <BoardColumn key={lane} lane={lane} title={label} countLabel={limit>0?`${laneTasks.length}/${limit}`:`${laneTasks.length}/∞`} limitState={stateLimit} onDropTask={handleDrop}>{laneTasks.map((task)=><div key={task.id} draggable onDragStart={(event)=>event.dataTransfer.setData("text/task",task.id)}><TaskCard task={task} onSetStatus={(status)=>actions.setStatus(task.id,status)} onSetLane={(nextLane)=>handleSetLane(task,nextLane)} onSetFocus={()=>setFocusTask(task)} onSetDueDate={(dueDate)=>actions.updateTask({...task,dueDate,priorityLane:dueDate?laneFromDate(dueDate):"P4"})} onBlock={()=>{ const reason=window.prompt("Motivo de bloqueo")?.trim(); if(reason) actions.setStatus(task.id,"blocked",reason);}} onSelect={()=>setDetailTaskId(task.id)} /></div>)}</BoardColumn>;})}</div>}</section> : null}

      {view === "focus" ? <section className="view"><FocusTimer task={focusTask} sessions={todaySessions.filter((session)=>session.taskId===focusTask?.id)} candidates={[...tasksWithRisk].filter((task)=>["P0","P1"].includes(task.priorityLane)).sort(compareBoardOrder)} onAddSession={(minutes)=>{ if(!focusTask) return; actions.addSession({id:crypto.randomUUID(),taskId:focusTask.id,minutes,startedAt:new Date().toISOString()});}} onSuggest={handleSuggestFocus} onSetStatus={(status)=>{ if(!focusTask) return; actions.setStatus(focusTask.id,status);}} onSetLane={(lane)=>{ if(!focusTask) return; handleSetLane(focusTask,lane);}} onSetDueDate={(date)=>{ if(!focusTask) return; const dueDate = date ? new Date(date).toISOString() : undefined; const riskPreview=computeRisk({...focusTask,dueDate}); actions.updateTask({...focusTask,dueDate,priorityLane:dueDate?laneFromDate(dueDate):"P4",riskBand:riskPreview.band,riskScore:riskPreview.score,riskReasons:riskPreview.reasons});}} onBlock={(note)=>{ if(!focusTask) return; actions.setStatus(focusTask.id,"blocked",note);}} onChangeFocus={(taskId)=>{ const candidate=tasksWithRisk.find((task)=>task.id===taskId); if(candidate) setFocusTask(candidate);}} /></section> : null}

      {view === "review" ? <section className="view"><ReviewSummary completed={todayCompleted} pending={todayPending} blocked={todayBlocked} focusMinutes={focusMinutes} alerts={alerts} onOpenTask={(taskId)=>{setDetailTaskId(taskId); setView("board");}} onMovePendingToToday={()=>todayPending.forEach((task)=>actions.setLane(task.id,"P0"))} onClearTrash={()=>tasksWithRisk.filter((task)=>task.status==="backlog"&&task.title.length<3).forEach((task)=>actions.deleteTask(task.id))} /></section> : null}

      {view === "calendar" ? <section className="view">{calendarTasks.length===0 ? <p className="empty-state">No hay tareas con fecha. Asigná una fecha desde Entrada o Detalle.</p> : <CalendarView currentDate={calendarDate} tasks={calendarTasks} mode={calendarMode} onModeChange={setCalendarMode} onChangeDate={setCalendarDate} onDropTask={(date, taskId)=>{ const task=tasksWithRisk.find((item)=>item.id===taskId); if(!task) return; const dueDate=date.toISOString(); actions.updateTask({...task,dueDate,priorityLane:laneFromDate(dueDate)}); }} />}</section> : null}

      {view === "settings" ? <section className="view"><div className="settings"><h2>Cuenta / Sync</h2>{auth ? <p>Conectado como <strong>{auth.email ?? "(sin email)"}</strong> · {auth.userId}</p> : <p className="warning">Sin cuenta: tus datos quedan solo en este dispositivo.</p>}{!auth ? <GoogleLogin onSuccess={(cred)=>void handleGoogleSuccess(cred.credential)} onError={()=>setStatusMessage("No se pudo iniciar sesión con Google.")} /> : <button type="button" onClick={()=>void handleLogout()}>Cerrar sesión</button>}<label>URL del Web App<input type="url" value={webAppUrl} placeholder="https://script.google.com/macros/s/AKfycb.../exec" onChange={(event)=>setWebAppUrl(event.target.value)} /></label>{!webAppUrl ? <p className="warning">Para sincronizar, pegá la URL del Web App. Ejemplo: https://script.google.com/macros/s/AKfycb.../exec</p> : null}<div className="settings__actions"><button type="button" onClick={async()=>{ await setSyncSettings({webAppUrl}); setStatusMessage("URL guardada.");}}>Guardar URL</button><button type="button" onClick={async()=>{ if(!webAppUrl){setConnectionStatus("Para sincronizar, pegá la URL del Web App. Si no, la app queda local."); return;} setConnectionStatus("Probando conexión..."); setMetaStatus(null); setMetaBody(null); try{ const result=await fetchMetaWithStatus(webAppUrl); setMetaStatus(result.status); setMetaBody(result.body); setConnectionStatus(result.ok?"Conexión OK.":"Conexión falló.");}catch{ setConnectionStatus("No se pudo conectar.");}}} disabled={!webAppUrl}>Probar conexión</button><button type="button" onClick={async()=>{ if(!webAppUrl){ setConnectionStatus("Para sincronizar, pegá la URL del Web App. Si no, la app queda local."); return;} const now=new Date(); const testTask=buildEmptyTask({title:`TEST_SHEET_${now.getTime()}`}); setTestStatus(null); setTestBody(null); try{ const resultBody=await postSync(webAppUrl,{idToken:auth!.idToken,clientId:crypto.randomUUID(),since:undefined,ops:[{opId:crypto.randomUUID(),type:"upsertTask",taskId:testTask.id,task:testTask,ts:now.toISOString()}]}); const result={status:200,body:resultBody}; setTestStatus(result.status); setTestBody(result.body); setStatusMessage("Tarea de prueba enviada.");}catch{ setStatusMessage("No se pudo enviar la tarea de prueba.");}}} disabled={!webAppUrl||!auth}>Enviar tarea de prueba</button><button type="button" onClick={async()=>{try{await syncNow(); setStatusMessage("Sincronización completada.");}catch{ setStatusMessage("No se pudo sincronizar.");}}} disabled={!isOnline||syncing||!webAppUrl||!auth}>Sincronizar ahora</button><button type="button" onClick={async()=>{ try{ const text = await navigator.clipboard.readText(); if(text) setWebAppUrl(text.trim()); } catch { setStatusMessage("No se pudo leer portapapeles."); } }}>Pegar desde portapapeles</button></div>
      <h3>Límites por carril</h3>
      <div className="settings__status-grid">{(["P0","P1","P2","P3","P4"] as PriorityLane[]).map((lane)=><label key={lane}>{lane}<input type="number" min={0} value={laneLimits[lane]} onChange={(event)=>setLaneLimitsState((prev)=>({...prev,[lane]:Number(event.target.value)}))} /></label>)}</div>
      <button type="button" onClick={async()=>{ await setLaneLimits(laneLimits); setStatusMessage("Límites guardados.");}}>Guardar límites</button>
      {connectionStatus ? <p className="settings__status">{connectionStatus}</p> : null}<p>Último sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString("es-ES") : "--"}</p><p>Último serverTime: {lastServerTime ?? "--"}</p><p>Ops pendientes: {pendingOps}</p><div className="settings__results"><div><h3>Meta response</h3><p><strong>Status:</strong> {metaStatus ?? "--"}</p><pre>{metaBody ? JSON.stringify(metaBody, null, 2) : "--"}</pre></div><div><h3>TEST task response</h3><p><strong>Status:</strong> {testStatus ?? "--"}</p><pre>{testBody ? JSON.stringify(testBody, null, 2) : "--"}</pre></div></div>{metaBody && typeof metaBody === "object" && (metaBody as { spreadsheetUrl?: string }).spreadsheetUrl ? <button type="button" onClick={()=>window.open((metaBody as { spreadsheetUrl?: string }).spreadsheetUrl, "_blank")}>Abrir hoja</button> : null}</div></section> : null}

      {detailTask ? <div className="palette" onClick={() => setDetailTaskId(null)}><div className="palette__panel" onClick={(event) => event.stopPropagation()}><div className="palette__header"><p>Detalle de tarea</p><button type="button" onClick={() => setDetailTaskId(null)}>Cerrar</button></div>
      <label>Título<input ref={detailTitleRef} value={detailTask.title} onChange={(event)=>actions.updateTask({...detailTask,title:event.target.value})} /></label>
      <label>Descripción<textarea value={detailTask.description ?? ""} onChange={(event)=>actions.updateTask({...detailTask,description:event.target.value})} /></label>
      <label>Carril<select value={detailTask.priorityLane} onChange={(e)=>handleSetLane(detailTask,e.target.value as PriorityLane)}>{(["P0","P1","P2","P3","P4"] as PriorityLane[]).map((lane)=><option key={lane} value={lane}>{lane}</option>)}</select></label>
      <label>Estado<select value={detailTask.status} onChange={(e)=>{ const next=e.target.value as Status; if(next==="blocked"){ const reason=window.prompt("Motivo de bloqueo", detailTask.blockedReason ?? "")?.trim(); if(!reason){ setStatusMessage("Motivo obligatorio para bloqueada."); return;} actions.setStatus(detailTask.id,"blocked",reason); return;} actions.setStatus(detailTask.id,next); }}><option value="backlog">backlog</option><option value="in_progress">in_progress</option><option value="blocked">blocked</option><option value="done">done</option><option value="archived">archived</option></select></label>
      {detailTask.status === "blocked" ? <p>Bloqueada desde {detailTask.blockedSince ? new Date(detailTask.blockedSince).toLocaleDateString("es-ES") : "-"}</p> : null}
      <label>Fecha vencimiento<input type="date" value={detailTask.dueDate ? detailTask.dueDate.slice(0,10) : ""} onChange={(e)=>actions.updateTask({...detailTask,dueDate:e.target.value?new Date(e.target.value).toISOString():undefined})} /></label>
      <label>Esfuerzo (min)<input type="number" min={0} value={detailTask.effort ?? 0} onChange={(e)=>actions.updateTask({...detailTask,effort:Number(e.target.value)})} /></label>
      <label>Tags (coma separada)<input value={detailTask.tags.join(",")} onChange={(e)=>actions.updateTask({...detailTask,tags:e.target.value.split(",").map((tag)=>tag.trim()).filter(Boolean)})} /></label>
      <div><p>Riesgo: {detailTask.riskBand}</p><ul>{(detailTask.riskReasons ?? []).map((reason)=><li key={reason}>{reason}</li>)}</ul></div>
      <div className="task-card__actions"><button type="button" onClick={() => { setStatusMessage("Cambios guardados."); setDetailTaskId(null); }}>Guardar</button><button type="button" onClick={() => setDetailTaskId(null)}>Cerrar</button><button type="button" onClick={() => actions.setStatus(detailTask.id, "archived")}>Archivar</button><button type="button" onClick={() => { if(window.confirm("Es irreversible en este dispositivo")) actions.deleteTask(detailTask.id); }}>Borrar</button></div>
      </div></div> : null}

      {paletteOpen ? <div className="palette" onClick={() => setPaletteOpen(false)}><div className="palette__panel" onClick={(event) => event.stopPropagation()}><div className="palette__header"><p>Buscar tareas</p><button type="button" onClick={() => setPaletteOpen(false)}>Cerrar</button></div><input autoFocus placeholder="Buscar por título, tag, motivo de bloqueo..." value={paletteQuery} onChange={(event)=>setPaletteQuery(event.target.value)} /><div className="palette__results">{paletteResults.length===0?<p className="palette__empty">No hay tareas que coincidan.</p>:paletteResults.map((task)=><div key={task.id} className="palette__item"><div><strong>{task.title}</strong><span>{task.priorityLane}</span></div><div className="palette__actions"><button type="button" onClick={()=>{setDetailTaskId(task.id); setPaletteOpen(false);}}>Abrir detalle</button><button type="button" onClick={()=>{setView("board"); setPaletteOpen(false);}}>Ir al carril</button></div></div>)}</div></div></div> : null}
    </div>
  );
}
