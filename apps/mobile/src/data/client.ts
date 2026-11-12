export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}
export type Vault = {
  get(): Promise<string | null>;
  set(value: string, ownerId?: string): Promise<void>;
  clear(): Promise<void>;
};
type Credentials = { accessToken: string; refreshToken: string };
export class ApiClient {
  private access: string | null = null;
  private refreshValue: string | null = null;
  private refreshing: Promise<void> | null = null;
  private generation = 0;
  constructor(
    private base: string,
    private vault: Vault,
    private fetcher: typeof fetch = fetch,
    private expired: () => void = () => {},
  ) {}
  async restore() {
    this.refreshValue = await this.vault.get();
    if (!this.refreshValue) return false;
    await this.refresh();
    return true;
  }
  async accept(value: Credentials, ownerId?: string) {
    await this.vault.set(value.refreshToken, ownerId);
    this.generation++;
    this.refreshValue = value.refreshToken;
    this.access = value.accessToken;
  }
  async clear() {
    this.generation++;
    this.access = null;
    this.refreshValue = null;
    await this.vault.clear();
  }
  async logout() {
    try {
      if (this.refreshing) await this.refreshing;
      if (this.refreshValue)
        await this.raw('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: this.refreshValue }),
        });
    } finally {
      await this.clear();
    }
  }
  private async raw(path: string, init: RequestInit = {}, access?: string | null) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await this.fetcher(`${this.base}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
          ...init.headers,
        },
      });
      const body = (await response.json()) as {
        data: unknown;
        error?: { code: string; message: string };
        requestId?: string;
      };
      if (!response.ok)
        throw new ApiError(
          response.status,
          body.error?.code ?? 'REQUEST_FAILED',
          body.error?.message ?? 'Request failed.',
          body.error,
        );
      return body;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        'Could not reach Nivvi. Check your connection, then retry. Your draft is still on this screen.',
      );
    } finally {
      clearTimeout(timer);
    }
  }
  private refresh() {
    if (this.refreshing) return this.refreshing;
    const generation = this.generation;
    const token = this.refreshValue;
    this.refreshing = (async () => {
      if (!token) {
        this.expired();
        throw new ApiError(
          401,
          'SESSION_EXPIRED',
          'Sign in again to continue. Your unsaved draft stays on this screen.',
        );
      }
      try {
        const { data } = await this.raw('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: token }),
        });
        if (generation !== this.generation)
          throw new ApiError(401, 'ACCOUNT_CHANGED', 'The account changed.');
        const value = data as Credentials;
        await this.vault.set(value.refreshToken);
        if (generation !== this.generation) {
          await this.vault.clear();
          throw new ApiError(401, 'ACCOUNT_CHANGED', 'The account changed.');
        }
        this.refreshValue = value.refreshToken;
        this.access = value.accessToken;
      } catch (error) {
        const transient = error instanceof ApiError && (error.status === 0 || error.status === 429 || error.status >= 500);
        if (generation === this.generation && !transient) {
          await this.clear();
          this.expired();
        }
        throw error;
      }
    })().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
  async request<T>(
    path: string,
    init: RequestInit = {},
    authenticated = true,
    envelope = false,
  ): Promise<T> {
    if (!authenticated) {
      const result = await this.raw(path, init);
      return (envelope ? result : result.data) as T;
    }
    if (!this.access) await this.refresh();
    const generation = this.generation;
    const used = this.access;
    try {
      const result = await this.raw(path, init, used);
      if (generation !== this.generation)
        throw new ApiError(401, 'ACCOUNT_CHANGED', 'The account changed.');
      return (envelope ? result : result.data) as T;
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || generation !== this.generation)
        throw error;
      if (this.access === used) await this.refresh();
      const result = await this.raw(path, init, this.access);
      if (generation !== this.generation)
        throw new ApiError(401, 'ACCOUNT_CHANGED', 'The account changed.');
      return (envelope ? result : result.data) as T;
    }
  }
  async page<T>(
    path: string,
  ): Promise<{ data: T[]; page: { nextCursor: string | null; hasMore: boolean } }> {
    return this.request(path, {}, true, true);
  }
}
