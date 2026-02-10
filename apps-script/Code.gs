const TASKS_HEADERS = [
  "workspaceKey",
  "taskId",
  "title",
  "status",
  "priorityLane",
  "priority",
  "stream",
  "tagsJson",
  "dueDate",
  "plannedAt",
  "estimateMin",
  "effort",
  "blockedReason",
  "blockedSince",
  "riskScore",
  "riskBand",
  "riskReasonsJson",
  "createdAt",
  "updatedAt",
  "lastTouchedAt",
  "revision",
  "deletedAt",
  "doneAt"
];
const OPS_HEADERS = ["workspaceKey", "opId", "ts"];
const EVENTS_HEADERS = [
  "eventId",
  "workspaceKey",
  "taskId",
  "type",
  "ts",
  "payloadJson"
];
const FOCUS_HEADERS = ["sessionId", "workspaceKey", "taskId", "minutes", "ts"];

const SPREADSHEET_NAME = "Personal Console DB";
const SCRIPT_PROPERTY_KEY = "SPREADSHEET_ID";

function doGet(e) {
  const route = getRoute_(e);
  if (route === "meta") {
    return jsonResponse_(meta_(), 200);
  }
  if (route === "diag") {
    return jsonResponse_(diag_(), 200);
  }
  return jsonResponse_({ ok: false, error: "Route not found" }, 404);
}

function doPost(e) {
  const route = getRoute_(e);
  if (route !== "sync")
    return jsonResponse_({ ok: false, error: "Route not found" }, 404);

  const raw =
    e && e.postData && e.postData.contents ? e.postData.contents : "{}";
  const body = JSON.parse(raw);
  const workspaceKey = String(body.workspaceKey || "").trim();
  const ops = Array.isArray(body.ops) ? body.ops : [];
  Logger.log(
    "sync_request route=%s workspaceKey=%s ops=%s",
    route,
    workspaceKey,
    ops.length
  );
  const response = sync_(body);
  Logger.log(
    "sync_response route=%s workspaceKey=%s spreadsheetId=%s appliedOps=%s tasksPulled=%s",
    route,
    workspaceKey,
    response.spreadsheetId || "",
    (response.appliedOps || []).length,
    (response.tasks || []).length
  );
  return jsonResponse_(response, 200);
}

function meta_() {
  const db = ensureDb_();
  return {
    ok: true,
    spreadsheetId: db.spreadsheetId,
    spreadsheetName: db.spreadsheetName,
    spreadsheetUrl: db.spreadsheetUrl,
    sheets: ["Tasks", "Ops", "TaskEvents", "FocusSessions"],
    serverTime: new Date().toISOString()
  };
}

function diag_() {
  const db = ensureDb_();
  return {
    ok: true,
    spreadsheetId: db.spreadsheetId,
    spreadsheetUrl: db.spreadsheetUrl,
    tasksRowCount: dataRowCount_(db.tasksSheet),
    opsRowCount: dataRowCount_(db.opsSheet),
    eventsRowCount: dataRowCount_(db.eventsSheet),
    focusRowCount: dataRowCount_(db.focusSheet),
    serverTime: new Date().toISOString()
  };
}

function sync_(body) {
  const workspaceKey = String(body.workspaceKey || "").trim();
  const clientId = String(body.clientId || "");
  const since = body.since || null;
  const ops = Array.isArray(body.ops) ? body.ops : [];

  if (!workspaceKey) {
    return { ok: false, error: "workspaceKey is required" };
  }

  const db = ensureDb_();
  Logger.log("sync_db spreadsheetId=%s", db.spreadsheetId);
  const result = applyOps_(db, workspaceKey, clientId, ops);
  const tasks = tasksSince_(db.tasksSheet, workspaceKey, since);
  Logger.log(
    "sync_apply workspaceKey=%s appliedOps=%s tasksPulled=%s",
    workspaceKey,
    result.appliedOps.length,
    tasks.length
  );

  return {
    ok: true,
    spreadsheetId: db.spreadsheetId,
    spreadsheetUrl: db.spreadsheetUrl,
    serverTime: new Date().toISOString(),
    appliedOps: result.appliedOps,
    conflicts: result.conflicts,
    tasks: tasks
  };
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
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (error) {
      ss = null;
    }
  }
  if (!ss) {
    ss = SpreadsheetApp.create(SPREADSHEET_NAME);
    spreadsheetId = ss.getId();
    props.setProperty(SCRIPT_PROPERTY_KEY, spreadsheetId);
  }

  const tasksSheet = ensureSheet_(ss, "Tasks", TASKS_HEADERS);
  const opsSheet = ensureSheet_(ss, "Ops", OPS_HEADERS);
  const eventsSheet = ensureSheet_(ss, "TaskEvents", EVENTS_HEADERS);
  const focusSheet = ensureSheet_(ss, "FocusSessions", FOCUS_HEADERS);

  return {
    ss,
    tasksSheet,
    opsSheet,
    eventsSheet,
    focusSheet,
    spreadsheetId,
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName()
  };
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

function applyOps_(db, workspaceKey, clientId, ops) {
  const opsData = db.opsSheet.getDataRange().getValues();
  const seenOps = new Set();
  for (let i = 1; i < opsData.length; i += 1) {
    const opWorkspace = String(opsData[i][0] || "");
    const opId = String(opsData[i][1] || "");
    if (opWorkspace === workspaceKey && opId) {
      seenOps.add(opId);
    }
  }

  const tasksData = db.tasksSheet.getDataRange().getValues();
  const idx = indexHeaders_(tasksData[0] || TASKS_HEADERS);
  const rowByKey = new Map();
  for (let i = 1; i < tasksData.length; i += 1) {
    const key =
      String(tasksData[i][idx.workspaceKey]) +
      "::" +
      String(tasksData[i][idx.taskId]);
    if (tasksData[i][idx.workspaceKey] && tasksData[i][idx.taskId])
      rowByKey.set(key, i + 1);
  }

  const appliedOps = [];
  const conflicts = [];

  ops.forEach(function (op) {
    if (!op || !op.opId) return;
    if (seenOps.has(op.opId)) {
      appliedOps.push(op.opId);
      appendEvent_(db.eventsSheet, {
        eventId: op.opId + "-noop",
        workspaceKey: workspaceKey,
        taskId: op.taskId || (op.task && op.task.id) || "",
        type: "noop",
        ts: op.ts || new Date().toISOString(),
        payload: { reason: "duplicate_op" }
      });
      return;
    }

    if (op.type === "appendFocus" && op.session) {
      db.focusSheet.appendRow([
        op.session.id,
        workspaceKey,
        op.session.taskId,
        op.session.minutes,
        op.session.startedAt || op.ts || new Date().toISOString()
      ]);
      db.opsSheet.appendRow([
        workspaceKey,
        op.opId,
        op.ts || new Date().toISOString()
      ]);
      appendEvent_(db.eventsSheet, {
        eventId: op.opId + "-focus",
        workspaceKey: workspaceKey,
        taskId: op.session.taskId,
        type: "focus",
        ts: op.ts || new Date().toISOString(),
        payload: op.session
      });
      appliedOps.push(op.opId);
      return;
    }

    const taskId = String((op.task && op.task.id) || op.taskId || "");
    if (!taskId) return;
    const key = workspaceKey + "::" + taskId;
    const row = rowByKey.get(key);
    const now = op.ts || new Date().toISOString();

    if (op.type === "deleteTask") {
      if (row) {
        const serverTask = rowToTask_(
          db.tasksSheet
            .getRange(row, 1, 1, TASKS_HEADERS.length)
            .getValues()[0],
          idx
        );
        serverTask.deletedAt = now;
        serverTask.updatedAt = now;
        serverTask.revision = Number(serverTask.revision || 0) + 1;
        db.tasksSheet
          .getRange(row, 1, 1, TASKS_HEADERS.length)
          .setValues([taskToRow_(workspaceKey, serverTask)]);
      } else {
        db.tasksSheet.appendRow(
          taskToRow_(workspaceKey, {
            id: taskId,
            title: "",
            status: "archived",
            priorityLane: "P4",
            priority: "med",
            stream: "otro",
            tags: [],
            createdAt: now,
            updatedAt: now,
            lastTouchedAt: now,
            revision: 1,
            deletedAt: now
          })
        );
        rowByKey.set(key, db.tasksSheet.getLastRow());
      }
      db.opsSheet.appendRow([workspaceKey, op.opId, now]);
      appendEvent_(db.eventsSheet, {
        eventId: op.opId + "-delete",
        workspaceKey: workspaceKey,
        taskId: taskId,
        type: "delete",
        ts: now,
        payload: { type: "deleteTask" }
      });
      appliedOps.push(op.opId);
      return;
    }

    if (op.type !== "upsertTask" || !op.task) return;
    const incoming = op.task;

    if (!row) {
      db.tasksSheet.appendRow(taskToRow_(workspaceKey, incoming));
      rowByKey.set(key, db.tasksSheet.getLastRow());
      db.opsSheet.appendRow([workspaceKey, op.opId, now]);
      appendEvent_(db.eventsSheet, {
        eventId: op.opId + "-create",
        workspaceKey: workspaceKey,
        taskId: taskId,
        type: "create",
        ts: now,
        payload: incoming
      });
      appliedOps.push(op.opId);
      return;
    }

    const serverTask = rowToTask_(
      db.tasksSheet.getRange(row, 1, 1, TASKS_HEADERS.length).getValues()[0],
      idx
    );
    const decision = shouldApplyIncoming_(serverTask, incoming, clientId);
    if (decision === "conflict") {
      conflicts.push({
        opId: op.opId,
        reason: "conflict",
        serverTask: serverTask
      });
      db.opsSheet.appendRow([workspaceKey, op.opId, now]);
      appendEvent_(db.eventsSheet, {
        eventId: op.opId + "-conflict",
        workspaceKey: workspaceKey,
        taskId: taskId,
        type: "conflict",
        ts: now,
        payload: { serverTask: serverTask, incomingTask: incoming }
      });
      appliedOps.push(op.opId);
      return;
    }

    if (decision === "server") {
      db.opsSheet.appendRow([workspaceKey, op.opId, now]);
      appendEvent_(db.eventsSheet, {
        eventId: op.opId + "-noop",
        workspaceKey: workspaceKey,
        taskId: taskId,
        type: "noop",
        ts: now,
        payload: { reason: "server_wins" }
      });
      appliedOps.push(op.opId);
      return;
    }

    db.tasksSheet
      .getRange(row, 1, 1, TASKS_HEADERS.length)
      .setValues([taskToRow_(workspaceKey, incoming)]);
    db.opsSheet.appendRow([workspaceKey, op.opId, now]);
    appendEvent_(db.eventsSheet, {
      eventId: op.opId + "-update",
      workspaceKey: workspaceKey,
      taskId: taskId,
      type: "update",
      ts: now,
      payload: incoming
    });
    appliedOps.push(op.opId);
  });

  return { appliedOps: appliedOps, conflicts: conflicts };
}

function shouldApplyIncoming_(serverTask, incomingTask, clientId) {
  const su = String(serverTask.updatedAt || "");
  const iu = String(incomingTask.updatedAt || "");
  if (iu > su) return "incoming";
  if (iu < su) return "server";

  const sr = Number(serverTask.revision || 0);
  const ir = Number(incomingTask.revision || 0);
  if (ir > sr) return "incoming";
  if (ir < sr) return "server";

  if (String(clientId || "").trim()) return "conflict";
  return "server";
}

function tasksSince_(sheet, workspaceKey, since) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const idx = indexHeaders_(data[0]);
  const out = [];
  for (let i = 1; i < data.length; i += 1) {
    const row = data[i];
    if (String(row[idx.workspaceKey]) !== workspaceKey) continue;
    const task = rowToTask_(row, idx);
    const touch = String(task.deletedAt || task.updatedAt || "");
    if (!since || touch >= since) out.push(task);
  }
  return out;
}

function indexHeaders_(headers) {
  const index = {};
  headers.forEach(function (header, pos) {
    index[String(header)] = pos;
  });
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
    lastTouchedAt: String(
      row[i.lastTouchedAt] || row[i.updatedAt] || new Date().toISOString()
    ),
    revision: Number(row[i.revision] || 1),
    deletedAt: valueOrUndefined_(row[i.deletedAt]),
    doneAt: valueOrUndefined_(row[i.doneAt])
  };
}

function taskToRow_(workspaceKey, task) {
  return [
    workspaceKey,
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

function appendEvent_(sheet, event) {
  sheet.appendRow([
    event.eventId,
    event.workspaceKey,
    event.taskId || "",
    event.type,
    event.ts || new Date().toISOString(),
    JSON.stringify(event.payload || {})
  ]);
}

function parseJson_(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(String(value));
  } catch (e) {
    return fallback;
  }
}

function valueOrUndefined_(value) {
  return value ? String(value) : undefined;
}

function numOrUndefined_(value) {
  return value === "" || value === null || value === undefined
    ? undefined
    : Number(value);
}

function jsonResponse_(payload, statusCode) {
  const response = ContentService.createTextOutput(
    JSON.stringify(payload)
  ).setMimeType(ContentService.MimeType.JSON);
  if (statusCode) return response.setResponseCode(statusCode);
  return response;
}

function dataRowCount_(sheet) {
  return Math.max(sheet.getLastRow() - 1, 0);
}
