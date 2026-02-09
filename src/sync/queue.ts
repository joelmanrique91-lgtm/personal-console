import { Task } from "../store/types";
import { QueueOp, getOpsQueue, setOpsQueue } from "./storage";

const MAX_QUEUE_BATCH = 100;

export function compactQueue(ops: QueueOp[]): QueueOp[] {
  const byTask = new Map<string, QueueOp>();
  ops.forEach((op) => {
    const existing = byTask.get(op.taskId);
    if (!existing) {
      byTask.set(op.taskId, op);
      return;
    }
    if (existing.type === "delete") {
      return;
    }
    if (op.type === "delete") {
      byTask.set(op.taskId, op);
      return;
    }
    byTask.set(op.taskId, op);
  });
  return Array.from(byTask.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function enqueueUpsert(task: Task): Promise<QueueOp[]> {
  const existing = await getOpsQueue();
  const op: QueueOp = {
    opId: crypto.randomUUID(),
    taskId: task.id,
    type: "upsert",
    task,
    createdAt: new Date().toISOString()
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
    type: "delete",
    task,
    createdAt: new Date().toISOString(),
    baseRevision: task.revision
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

export async function replaceQueue(ops: QueueOp[]): Promise<void> {
  await setOpsQueue(ops);
}

export function chunkOps(ops: QueueOp[]): QueueOp[][] {
  const batches: QueueOp[][] = [];
  for (let i = 0; i < ops.length; i += MAX_QUEUE_BATCH) {
    batches.push(ops.slice(i, i + MAX_QUEUE_BATCH));
  }
  return batches;
}
