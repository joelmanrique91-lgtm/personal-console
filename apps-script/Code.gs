const USERS_HEADERS = ["userId", "email", "createdAt", "lastSeenAt"];
const TASKS_HEADERS = [
  "userId", "taskId", "title", "status", "priorityLane", "priority", "stream", "tagsJson",
  "dueDate", "plannedAt", "estimateMin", "effort",
  "blockedReason", "blockedSince",
  "riskScore", "riskBand", "riskReasonsJson",
  "createdAt", "updatedAt", "lastTouchedAt", "revision",
  "deletedAt", "doneAt"
];
const OPS_HEADERS = ["opId", "userId", "ts"];
const EVENTS_HEADERS = ["eventId", "userId", "taskId", "type", "ts", "payloadJson"];
const FOCUS_HEADERS = ["sessionId", "userId", "taskId", "minutes", "ts"];

const SPREADSHEET_NAME = "Personal Console DB";
const SCRIPT_PROPERTY_KEY = "SPREADSHEET_ID";

function doGet(e) {
  const route = getRoute_(e);
  if (route !== "meta") return jsonResponse_({ ok: false, error: "Route not found" }, 404);
  const db = ensureDb_();
  return jsonResponse_({
    ok: true,
    spreadsheetId: db.spreadsheetId,
    spreadsheetName: db.spreadsheetName,
    spreadsheetUrl: db.spreadsheetUrl,
    sheets: ["Users", "Tasks", "Ops", "TaskEvents", "FocusSessions"],
    serverTime: new Date().toISOString()
  });
}

function doPost(e) {
  const route = getRoute_(e);
  if (route !== "sync") return jsonResponse_({ ok: false, error: "Route not found" }, 404);
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  const body = JSON.parse(raw);
  const auth = validateIdToken_(body.idToken);
  if (!auth.ok) return jsonResponse_({ ok: false, error: "Unauthorized" }, 401);

  const userId = auth.userId;
  const email = auth.email;
  const clientId = String(body.clientId || "");
  const since = body.since || null;
  const ops = Array.isArray(body.ops) ? body.ops : [];

  const db = ensureDb_();
  upsertUser_(db.usersSheet, userId, email);
  const result = applyOps_(db, userId, clientId, ops);
  const tasks = tasksSince_(db.tasksSheet, userId, since);

  return jsonResponse_({
    serverTime: new Date().toISOString(),
    appliedOps: result.appliedOps,
    conflicts: result.conflicts,
    tasks: tasks
  });
}

function validateIdToken_(idToken) {
  if (!idToken) return { ok: false };
  const url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken);
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) return { ok: false };
    const body = JSON.parse(response.getContentText());
    if (!body.sub) return { ok: false };
    return { ok: true, userId: String(body.sub), email: body.email ? String(body.email) : "" };
  } catch (error) {
    return { ok: false };
  }
}

function getRoute_(e) {
  if (e && e.parameter && e.parameter.route) return e.parameter.route;
  return "meta";
}

function ensureDb_() {
  const props = PropertiesService.getScriptProperties();
  let spreadsheetId = props.getProperty(SCRIPT_PROPERTY_KEY);
  let ss = null;
  if (spreadsheetId) {
    try { ss = SpreadsheetApp.openById(spreadsheetId); } catch (error) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    spreadsheetId = ss.getId();
    props.setProperty(SCRIPT_PROPERTY_KEY, spreadsheetId);
  }

  const usersSheet = ensureSheet_(ss, "Users", USERS_HEADERS);
  const tasksSheet = ensureSheet_(ss, "Tasks", TASKS_HEADERS);
  const opsSheet = ensureSheet_(ss, "Ops", OPS_HEADERS);
  const eventsSheet = ensureSheet_(ss, "TaskEvents", EVENTS_HEADERS);
  const focusSheet = ensureSheet_(ss, "FocusSessions", FOCUS_HEADERS);

  return { ss, usersSheet, tasksSheet, opsSheet, eventsSheet, focusSheet, spreadsheetId, spreadsheetUrl: ss.getUrl(), spreadsheetName: ss.getName() };
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const range = sheet.getRange(1, 1, 1, headers.length);
  const values = range.getValues()[0];
  const hasHeaders = values.filter(String).length === headers.length;
  if (!hasHeaders) range.setValues([headers]);
  return sheet;
}

function upsertUser_(sheet, userId, email) {
  const data = sheet.getDataRange().getValues();
  const now = new Date().toISOString();
  for (let i = 1; i < data.length; i += 1) {
    if (String(data[i][0]) === userId) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[email || data[i][1], data[i][2] || now, now]]);
      return;
    }
  }
  sheet.appendRow([userId, email || "", now, now]);
}

function applyOps_(db, userId, clientId, ops) {
  const opsData = db.opsSheet.getDataRange().getValues();
  const seenOps = new Set();
  for (let i = 1; i < opsData.length; i += 1) {
    const opId = String(opsData[i][0] || "");
    const opUser = String(opsData[i][1] || "");
    if (opId && opUser === userId) seenOps.add(opId);
  }

  const tasksData = db.tasksSheet.getDataRange().getValues();
  const idx = indexHeaders_(tasksData[0] || TASKS_HEADERS);
  const rowByKey = new Map();
  for (let i = 1; i < tasksData.length; i += 1) {
    const key = String(tasksData[i][idx.userId]) + "::" + String(tasksData[i][idx.taskId]);
    if (tasksData[i][idx.userId] && tasksData[i][idx.taskId]) rowByKey.set(key, i + 1);
  }

  const appliedOps = [];
  const conflicts = [];

  ops.forEach(function (op) {
    if (!op || !op.opId || seenOps.has(op.opId)) { if (op && op.opId) appliedOps.push(op.opId); return; }

    if (op.type === "appendFocus" && op.session) {
      db.focusSheet.appendRow([op.session.id, userId, op.session.taskId, op.session.minutes, op.session.startedAt || op.ts || new Date().toISOString()]);
      db.opsSheet.appendRow([op.opId, userId, op.ts || new Date().toISOString()]);
      appliedOps.push(op.opId);
      return;
    }

    const taskId = String((op.task && op.task.id) || op.taskId || "");
    if (!taskId) return;
    const key = userId + "::" + taskId;
    const row = rowByKey.get(key);
    const now = op.ts || new Date().toISOString();

    if (op.type === "deleteTask") {
      if (row) {
        const oldTask = rowToTask_(db.tasksSheet.getRange(row, 1, 1, TASKS_HEADERS.length).getValues()[0], idx);
        oldTask.deletedAt = now;
        oldTask.updatedAt = now;
        oldTask.status = oldTask.status || "archived";
        oldTask.revision = Number(oldTask.revision || 0) + 1;
        db.tasksSheet.getRange(row, 1, 1, TASKS_HEADERS.length).setValues([taskToRow_(userId, oldTask)]);
      }
      db.eventsSheet.appendRow([op.opId + "-evt", userId, taskId, "update", now, JSON.stringify({ type: "deleteTask" })]);
      db.opsSheet.appendRow([op.opId, userId, now]);
      appliedOps.push(op.opId);
      return;
    }

    if (op.type !== "upsertTask" || !op.task) return;
    const incoming = op.task;

    if (!row) {
      if (incoming.status === "done" && !incoming.doneAt) incoming.doneAt = now;
      db.tasksSheet.appendRow(taskToRow_(userId, incoming));
      db.eventsSheet.appendRow([op.opId + "-evt", userId, taskId, "create", now, JSON.stringify(incoming)]);
      db.opsSheet.appendRow([op.opId, userId, now]);
      appliedOps.push(op.opId);
      return;
    }

    const serverTask = rowToTask_(db.tasksSheet.getRange(row, 1, 1, TASKS_HEADERS.length).getValues()[0], idx);
    if (!shouldApplyIncoming_(serverTask, incoming, clientId)) {
      conflicts.push({ opId: op.opId, reason: "conflict", serverTask: serverTask });
      db.opsSheet.appendRow([op.opId, userId, now]);
      appliedOps.push(op.opId);
      return;
    }

    if (incoming.status === "done" && !incoming.doneAt) incoming.doneAt = now;
    db.tasksSheet.getRange(row, 1, 1, TASKS_HEADERS.length).setValues([taskToRow_(userId, incoming)]);
    db.eventsSheet.appendRow([op.opId + "-evt", userId, taskId, "update", now, JSON.stringify(incoming)]);
    db.opsSheet.appendRow([op.opId, userId, now]);
    appliedOps.push(op.opId);
  });

  return { appliedOps: appliedOps, conflicts: conflicts };
}

function shouldApplyIncoming_(serverTask, incomingTask, clientId) {
  const su = String(serverTask.updatedAt || "");
  const iu = String(incomingTask.updatedAt || "");
  if (iu !== su) return iu > su;
  const sr = Number(serverTask.revision || 0);
  const ir = Number(incomingTask.revision || 0);
  if (ir !== sr) return ir > sr;
  return String(clientId || "") >= "";
}

function tasksSince_(sheet, userId, since) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const idx = indexHeaders_(data[0]);
  const out = [];
  for (let i = 1; i < data.length; i += 1) {
    const row = data[i];
    if (String(row[idx.userId]) !== userId) continue;
    const task = rowToTask_(row, idx);
    const touch = String(task.deletedAt || task.updatedAt || "");
    if (!since || touch >= since) out.push(task);
  }
  return out;
}

function indexHeaders_(headers) {
  const index = {};
  headers.forEach(function (header, pos) { index[String(header)] = pos; });
  return index;
}

function rowToTask_(row, i) {
  return {
    id: String(row[i.taskId] || ""),
    title: String(row[i.title] || ""),
    status: String(row[i.status] || "backlog"),
    priorityLane: String(row[i.priorityLane] || "P4"),
    priority: String(row[i.priority] || "med"),
    stream: String(row[i.stream] || "otro"),
    tags: parseJson_(row[i.tagsJson], []),
    dueDate: valueOrUndefined_(row[i.dueDate]),
    plannedAt: valueOrUndefined_(row[i.plannedAt]),
    estimateMin: numOrUndefined_(row[i.estimateMin]),
    effort: numOrUndefined_(row[i.effort]),
    blockedReason: valueOrUndefined_(row[i.blockedReason]),
    blockedSince: valueOrUndefined_(row[i.blockedSince]),
    riskScore: numOrUndefined_(row[i.riskScore]),
    riskBand: valueOrUndefined_(row[i.riskBand]),
    riskReasons: parseJson_(row[i.riskReasonsJson], []),
    createdAt: String(row[i.createdAt] || new Date().toISOString()),
    updatedAt: String(row[i.updatedAt] || new Date().toISOString()),
    lastTouchedAt: String(row[i.lastTouchedAt] || row[i.updatedAt] || new Date().toISOString()),
    revision: Number(row[i.revision] || 1),
    deletedAt: valueOrUndefined_(row[i.deletedAt]),
    doneAt: valueOrUndefined_(row[i.doneAt])
  };
}

function taskToRow_(userId, task) {
  return [
    userId,
    task.id,
    task.title || "",
    task.status || "backlog",
    task.priorityLane || "P4",
    task.priority || "med",
    task.stream || "otro",
    JSON.stringify(task.tags || []),
    task.dueDate || "",
    task.plannedAt || "",
    task.estimateMin || "",
    task.effort || "",
    task.blockedReason || "",
    task.blockedSince || "",
    task.riskScore || "",
    task.riskBand || "",
    JSON.stringify(task.riskReasons || []),
    task.createdAt || new Date().toISOString(),
    task.updatedAt || new Date().toISOString(),
    task.lastTouchedAt || task.updatedAt || new Date().toISOString(),
    task.revision || 1,
    task.deletedAt || "",
    task.doneAt || ""
  ];
}

function parseJson_(value, fallback) {
  if (!value) return fallback;
  try { return JSON.parse(String(value)); } catch (e) { return fallback; }
}
function valueOrUndefined_(value) { return value ? String(value) : undefined; }
function numOrUndefined_(value) { return value === "" || value === null || value === undefined ? undefined : Number(value); }

function jsonResponse_(payload, statusCode) {
  const response = ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
  if (statusCode) return response.setResponseCode(statusCode);
  return response;
}
