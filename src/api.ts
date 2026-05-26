import { DailyEntry, EntrySummary, StatsSummary } from "../shared/types";

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as { error?: { message?: string } }).error?.message
        : "请求失败，请稍后重试。";
    throw new Error(message || "请求失败，请稍后重试。");
  }

  return payload as T;
}

export async function fetchEntry(date: string): Promise<DailyEntry> {
  const payload = await requestJson<{ entry: DailyEntry }>(`/api/entries/${date}`);
  return payload.entry;
}

export async function saveEntry(entry: DailyEntry): Promise<DailyEntry> {
  const payload = await requestJson<{ entry: DailyEntry }>(`/api/entries/${entry.date}`, {
    method: "PUT",
    body: JSON.stringify(entry),
  });
  return payload.entry;
}

export async function deleteEntry(date: string): Promise<void> {
  await requestJson<{ ok: boolean }>(`/api/entries/${date}`, { method: "DELETE" });
}

export async function fetchEntrySummaries(search = ""): Promise<EntrySummary[]> {
  const params = new URLSearchParams();
  if (search.trim()) params.set("search", search.trim());
  const payload = await requestJson<{ entries: EntrySummary[] }>(`/api/entries?${params.toString()}`);
  return payload.entries;
}

export async function fetchStats(): Promise<StatsSummary> {
  const payload = await requestJson<{ stats: StatsSummary }>("/api/stats/summary");
  return payload.stats;
}

export async function fetchExportPayload(): Promise<unknown> {
  return requestJson("/api/export/json");
}

export async function importEntriesFromJson(payload: unknown): Promise<{ importedCount: number }> {
  return requestJson("/api/import/json", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
