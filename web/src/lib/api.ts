const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

interface RequestOptions extends RequestInit {
  strategy?: string;
  simulatedUserId?: string;
}

export async function fetchApi<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('atomic_seat_token') : null;
  const currentStrategy =
    options.strategy ||
    (typeof window !== 'undefined' ? localStorage.getItem('atomic_seat_strategy') : null) ||
    'mongo-atomic';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-lock-strategy': currentStrategy,
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (options.simulatedUserId) {
    headers['x-simulated-user-id'] = options.simulatedUserId;
  }

  const url = `${API_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({
    success: false,
    error: 'Failed to parse JSON response',
  }));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
  }

  return data;
}
