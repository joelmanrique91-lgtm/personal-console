import { RiskBand, Task } from "../store/types";

export interface RiskResult {
  score: number;
  band: RiskBand;
  reasons: string[];
}

function daysBetween(fromIso: string, toDate: Date): number {
  const from = new Date(fromIso);
  return Math.floor((toDate.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export function computeRisk(task: Task, now = new Date()): RiskResult {
  if (task.deletedAt || task.status === "done" || task.status === "archived") {
    return { score: 0, band: "low", reasons: [] };
  }

  let score = 0;
  const reasons: string[] = [];

  if (task.dueDate) {
    const due = new Date(task.dueDate);
    const daysToDue = Math.ceil((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    if (daysToDue < 0) {
      score += 85;
      reasons.push("Tarea vencida");
    } else if (daysToDue <= 3) {
      score += 65;
      reasons.push("Vence pronto (≤ 3 días)");
    }
  }

  if (task.status === "blocked" && task.blockedSince) {
    const blockedDays = daysBetween(task.blockedSince, now);
    if (blockedDays >= 3) {
      score += 60;
      reasons.push(`Bloqueada hace ${blockedDays} días`);
    }
  }

  const staleDays = daysBetween(task.lastTouchedAt, now);
  if (staleDays >= 7) {
    score += 35;
    reasons.push(`Sin actividad hace ${staleDays} días`);
  }

  if (!task.dueDate) {
    score += 10;
    reasons.push("Sin fecha de vencimiento");
  }

  const band: RiskBand =
    score >= 80 ? "critical" : score >= 55 ? "high" : score >= 25 ? "medium" : "low";

  return { score, band, reasons: reasons.slice(0, 3) };
}

export function enrichTaskRisk(task: Task): Task {
  const risk = computeRisk(task);
  return {
    ...task,
    riskScore: risk.score,
    riskBand: risk.band,
    riskReasons: risk.reasons
  };
}
