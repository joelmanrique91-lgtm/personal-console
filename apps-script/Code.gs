const TASK_HEADERS = [
  "id",
  "title",
  "status",
  "priority",
  "stream",
  "tags",
  "estimateMin",
  "plannedAt",
  "dueAt",
  "createdAt",
  "updatedAt",
  "revision",
  "deletedAt",
  "blockedNote",
  "doneAt"
];

const OPS_HEADERS = ["opId", "processedAt"];

function doGet(e) {
  const route = getRoute_(e);
  if (route === "meta") {
    return jsonResponse_({ ok: true, serverTime: new Date().toISOString() });
  }
  if (route !== "tasks") {
    return jsonResponse_({ ok: false, error: "Route not found" }, 404);
  }
  const since = e && e.parameter ? e.parameter.since : null;
  const tasks = getTasksSince_(since);
  return jsonResponse_({ tasks: tasks, serverTime: new Date().toISOString() });
}

function doPost(e) {
  const route = getRoute_(e);
  if (route !== "upsert") {
    return jsonResponse_({ ok: false, error: "Route not found" }, 404);
  }
  const body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : null;
  const ops = body && Array.isArray(body.ops) ? body.ops : [];
  const result = upsertOps_(ops);
  return jsonResponse_({
    accepted: result.accepted,
    rejected: result.rejected,
    serverTime: new Date().toISOString()
  });
}

function getRoute_(e) {
  if (e && e.pathInfo) {
    const path = e.pathInfo.replace(/^\/+/, "");
    if (path) {
      return path;
    }
  }
  if (e && e.parameter && e.parameter.route) {
    return e.parameter.route;
  }
  return "tasks";
}

function getSheet_(name, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }
  ensureHeaders_(sheet, headers);
  return sheet;
}

function ensureHeaders_(sheet, headers) {
  const range = sheet.getRange(1, 1, 1, headers.length);
  const values = range.getValues()[0];
  const hasHeaders = values.filter(String).length === headers.length;
  if (!hasHeaders) {
    range.setValues([headers]);
  }
}

function getTasksSince_(since) {
  const sheet = getSheet_("Tasks", TASK_HEADERS);
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return [];
  }
  const headers = data[0];
  const headerIndex = indexHeaders_(headers);
  const tasks = [];
  for (let i = 1; i < data.length; i += 1) {
    const row = data[i];
    const task = rowToTask_(row, headerIndex);
    if (!since || !task.updatedAt || task.updatedAt > since) {
      tasks.push(task);
    }
  }
  return tasks;
}

function upsertOps_(ops) {
  const tasksSheet = getSheet_("Tasks", TASK_HEADERS);
  const opsSheet = getSheet_("Ops", OPS_HEADERS);

  const tasksData = tasksSheet.getDataRange().getValues();
  const tasksHeaderIndex = indexHeaders_(tasksData[0]);
  const taskRowMap = new Map();
  for (let i = 1; i < tasksData.length; i += 1) {
    const row = tasksData[i];
    const id = row[tasksHeaderIndex.id];
    if (id) {
      taskRowMap.set(String(id), i + 1);
    }
  }

  const opsData = opsSheet.getDataRange().getValues();
  const processedOps = new Set();
  for (let i = 1; i < opsData.length; i += 1) {
    const opId = opsData[i][0];
    if (opId) {
      processedOps.add(String(opId));
    }
  }

  const accepted = [];
  const rejected = [];
  const opsToRecord = [];
  const rowsToUpdate = [];
  const rowsToAppend = [];

  ops.forEach((op) => {
    if (!op || !op.opId || !op.task) {
      return;
    }
    if (processedOps.has(op.opId)) {
      accepted.push(op.opId);
      return;
    }

    const incoming = op.task;
    const existingRow = taskRowMap.get(incoming.id);
    if (existingRow) {
      const existingValues = tasksSheet
        .getRange(existingRow, 1, 1, TASK_HEADERS.length)
        .getValues()[0];
      const existingTask = rowToTask_(existingValues, tasksHeaderIndex);
      const isNewer =
        incoming.revision > existingTask.revision ||
        (incoming.revision === existingTask.revision &&
          incoming.updatedAt > existingTask.updatedAt);
      if (!isNewer) {
        rejected.push({ opId: op.opId, reason: "conflict", task: existingTask });
        return;
      }
      rowsToUpdate.push({ row: existingRow, values: taskToRow_(incoming) });
    } else {
      rowsToAppend.push(taskToRow_(incoming));
    }

    opsToRecord.push([op.opId, new Date().toISOString()]);
    accepted.push(op.opId);
  });

  if (rowsToUpdate.length > 0) {
    rowsToUpdate.forEach((entry) => {
      tasksSheet
        .getRange(entry.row, 1, 1, TASK_HEADERS.length)
        .setValues([entry.values]);
    });
  }

  if (rowsToAppend.length > 0) {
    const startRow = tasksSheet.getLastRow() + 1;
    tasksSheet
      .getRange(startRow, 1, rowsToAppend.length, TASK_HEADERS.length)
      .setValues(rowsToAppend);
  }

  if (opsToRecord.length > 0) {
    const startRow = opsSheet.getLastRow() + 1;
    opsSheet.getRange(startRow, 1, opsToRecord.length, OPS_HEADERS.length).setValues(opsToRecord);
  }

  return { accepted: accepted, rejected: rejected };
}

function indexHeaders_(headers) {
  const index = {};
  headers.forEach((header, position) => {
    index[String(header)] = position;
  });
  return index;
}

function rowToTask_(row, index) {
  const tagsValue = row[index.tags];
  let tags = [];
  if (tagsValue) {
    try {
      tags = JSON.parse(tagsValue);
    } catch (error) {
      tags = [];
    }
  }
  return {
    id: String(row[index.id]),
    title: String(row[index.title]),
    status: String(row[index.status]),
    priority: String(row[index.priority]),
    stream: String(row[index.stream]),
    tags: tags,
    estimateMin: row[index.estimateMin] ? Number(row[index.estimateMin]) : undefined,
    plannedAt: row[index.plannedAt] ? String(row[index.plannedAt]) : undefined,
    dueAt: row[index.dueAt] ? String(row[index.dueAt]) : undefined,
    createdAt: String(row[index.createdAt]),
    updatedAt: String(row[index.updatedAt]),
    revision: Number(row[index.revision]) || 0,
    deletedAt: row[index.deletedAt] ? String(row[index.deletedAt]) : undefined,
    blockedNote: row[index.blockedNote] ? String(row[index.blockedNote]) : undefined,
    doneAt: row[index.doneAt] ? String(row[index.doneAt]) : undefined
  };
}

function taskToRow_(task) {
  return [
    task.id,
    task.title,
    task.status,
    task.priority,
    task.stream,
    JSON.stringify(task.tags || []),
    task.estimateMin || "",
    task.plannedAt || "",
    task.dueAt || "",
    task.createdAt,
    task.updatedAt,
    task.revision,
    task.deletedAt || "",
    task.blockedNote || "",
    task.doneAt || ""
  ];
}

function jsonResponse_(payload, statusCode) {
  const response = ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
  if (statusCode) {
    return response.setResponseCode(statusCode);
  }
  return response;
}
