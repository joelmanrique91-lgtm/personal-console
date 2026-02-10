import { FocusSession, Task } from "../store/types";
import { QueueOp, getOpsQueue, setOpsQueue } from "./storage";

const MAX_QUEUE_BATCH = 100;

export function compactQueue(ops: QueueOp[]): QueueOp[] {
  const taskOps = new Map<string, QueueOp>();
  const passthrough: QueueOp[] = [];

  ops.forEach((op) => {
    if (op.type === "appendFocus") {
      passthrough.push(op);
      return;
    }
    if (!op.taskId) return;
    const existing = taskOps.get(op.taskId);
    if (!existing) {
      taskOps.set(op.taskId, op);
      return;
    }
    if (op.type === "deleteTask") {
      taskOps.set(op.taskId, op);
      return;
    }
    if (existing.type === "deleteTask") {
      return;
    }
    taskOps.set(op.taskId, op);
  });

  return [...taskOps.values(), ...passthrough].sort((a, b) => a.ts.localeCompare(b.ts));
}

export async function enqueueUpsert(task: Task): Promise<QueueOp[]> {
  const existing = await getOpsQueue();
  const op: QueueOp = {
    opId: crypto.randomUUID(),
    taskId: task.id,
    type: "upsertTask",
    task,
    ts: new Date().toISOString()
  };
  const next = compactQueue([...existing, op]);
  await setOpsQueue(next);
  return next;
}

export async function enqueueDelete(task: Task): Promise<QueueOp[]> {
  const existing = await getOpsQueue();
  const op: QueueOp = {
    opId: crypto.randomUUID(),
    taskId: task.id,
    type: "deleteTask",
    task,
    ts: new Date().toISOString(),
    baseRevision: task.revision
  };
  const next = compactQueue([...existing, op]);
  await setOpsQueue(next);
  return next;
}

export async function enqueueFocusSession(session: FocusSession): Promise<QueueOp[]> {
  const existing = await getOpsQueue();
  const op: QueueOp = {
    opId: crypto.randomUUID(),
    taskId: session.taskId,
    type: "appendFocus",
    session,
    ts: session.startedAt
  };
  const next = compactQueue([...existing, op]);
  await setOpsQueue(next);
  return next;
}

export async function dequeueOps(opIds: string[]): Promise<QueueOp[]> {
  const existing = await getOpsQueue();
  const remaining = existing.filter((op) => !opIds.includes(op.opId));
  await setOpsQueue(remaining);
  return remaining;
}

export function chunkOps(ops: QueueOp[]): QueueOp[][] {
  const batches: QueueOp[][] = [];
  for (let i = 0; i < ops.length; i += MAX_QUEUE_BATCH) {
    batches.push(ops.slice(i, i + MAX_QUEUE_BATCH));
  }
  return batches;
}
