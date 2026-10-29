export class CheckoutRequestError extends Error {
  constructor(readonly status: number) {
    super(
      (
        {
          400: "Confira os dados informados.",
          401: "Sua sessão expirou. Entre novamente.",
          403: "Você não tem permissão para esta operação.",
          404: "Registro não encontrado.",
          409: "Os dados mudaram ou há um conflito. Atualize o catálogo e confira estoque, caixa e pagamentos.",
          503: "Serviço temporariamente indisponível. Tente novamente.",
        } as Record<number, string>
      )[status] ?? "Não foi possível concluir a operação. Tente novamente.",
    );
  }
}

// One key per exact intent. An uncertain response must be retried unchanged.
export class CheckoutHttp {
  private intents = new Map<string, string>();
  constructor(
    private readonly fetcher: typeof fetch = (...args) => fetch(...args),
  ) {}
  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }
  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.post<T>(path, body, "PATCH");
  }
  async post<T>(path: string, body: unknown, method = "POST"): Promise<T> {
    const json = JSON.stringify(body),
      intent = `${method}:${path}:${json}`;
    let key = this.intents.get(intent);
    if (!key) {
      key = crypto.randomUUID();
      this.intents.set(intent, key);
    }
    return this.request<T>(path, {
      method,
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: json,
    });
  }
  newIntent() {
    this.intents.clear();
  }
  acknowledged(path: string, body: unknown) {
    this.intents.delete(`POST:${path}:${JSON.stringify(body)}`);
  }
  private async request<T>(path: string, options: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await this.fetcher(`/api/checkout/${path}`, {
        ...options,
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) throw new CheckoutRequestError(response.status);
      return (await response.json()) as T;
    } finally {
      clearTimeout(timeout);
    }
  }
}
