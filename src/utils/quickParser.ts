import { TaskPriority, TaskStream } from "../store/types";

const contextToStream: Record<string, TaskStream> = {
  work: "finanzas",
  home: "casa",
  errands: "casa",
  health: "salud",
  study: "geologia",
  other: "otro"
};

const priorityMap: Record<string, TaskPriority> = {
  alta: "high",
  media: "med",
  baja: "low"
};

export interface ParsedInput {
  title: string;
  priority?: TaskPriority;
  stream?: TaskStream;
  estimateMin?: number;
  tags: string[];
}

export function parseQuickInput(input: string): ParsedInput {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  const tags: string[] = [];
  let priority: TaskPriority | undefined;
  let stream: TaskStream | undefined;
  let estimateMin: number | undefined;
  const titleParts: string[] = [];

  tokens.forEach((token) => {
    if (token.startsWith("#")) {
      tags.push(token.slice(1));
      return;
    }
    if (token.startsWith("@")) {
      const context = token.slice(1).toLowerCase();
      if (!stream && contextToStream[context]) {
        stream = contextToStream[context];
        return;
      }
    }
    if (token.startsWith("!")) {
      const key = token.slice(1).toLowerCase();
      priority = priorityMap[key] ?? priority;
      return;
    }
    if (token.startsWith("~")) {
      const value = token.slice(1).toLowerCase();
      const match = value.match(/(\d+)(m|min)?/);
      if (match) {
        estimateMin = Number(match[1]);
        return;
      }
    }
    titleParts.push(token);
  });

  return {
    title: titleParts.join(" "),
    priority,
    stream,
    estimateMin,
    tags
  };
}
