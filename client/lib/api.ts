type ApiError = {
  status: number;
  message: string;
};

const API_PREFIX = "/api";

async function apiFetch<T>(
  path: string,
  options: RequestInit & { json?: unknown; token?: string } = {},
): Promise<T> {
  const { json, token, headers, ...rest } = options;

  const res = await fetch(`${API_PREFIX}${path}`, {
    ...rest,
    headers: {
      ...(json ? { "Content-Type": "application/json" } : null),
      ...(token ? { Authorization: `Bearer ${token}` } : null),
      ...(headers ?? null),
    },
    body: json ? JSON.stringify(json) : rest.body,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { error?: string };
      if (data?.error) message = data.error;
    } catch {
      // ignore
    }

    const err: ApiError = { status: res.status, message };
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string, token?: string) {
  return apiFetch<T>(path, { method: "GET", token });
}

export function apiPost<T>(path: string, json?: unknown, token?: string) {
  return apiFetch<T>(path, { method: "POST", json, token });
}

export function apiPatch<T>(path: string, json?: unknown, token?: string) {
  return apiFetch<T>(path, { method: "PATCH", json, token });
}

export function apiDelete<T>(path: string, token?: string) {
  return apiFetch<T>(path, { method: "DELETE", token });
}
