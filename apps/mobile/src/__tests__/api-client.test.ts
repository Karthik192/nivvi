import { ApiClient, ApiError, type Vault } from '../data/client';
const response = (data: unknown, status = 200) =>
  ({
    ok: status < 400,
    status,
    json: async () =>
      status < 400 ? { data } : { error: { code: 'UNAUTHORIZED', message: 'Sign in again.' } },
  }) as Response;
const setup = (fetcher: jest.Mock) => {
  let stored: string | null = null;
  const vault: Vault = {
    get: async () => stored,
    set: async (value) => {
      stored = value;
    },
    clear: async () => {
      stored = null;
    },
  };
  const expired = jest.fn();
  const client = new ApiClient('http://test/api/v1', vault, fetcher, expired);
  return { client, vault, expired, stored: () => stored };
};
test('a fresh installation does not refresh and credentials persist only the refresh token', async () => {
  const fetcher = jest.fn();
  const { client, stored } = setup(fetcher);
  expect(await client.restore()).toBe(false);
  await client.accept({ accessToken: 'access', refreshToken: 'refresh' });
  expect(stored()).toBe('refresh');
  expect(fetcher).not.toHaveBeenCalled();
});
test('simultaneous unauthorized requests serialize one rotation and retry with the new bearer', async () => {
  const fetcher = jest.fn(async (path: string, init: RequestInit) => {
    if (path.endsWith('/auth/refresh')) {
      await Promise.resolve();
      return response({ accessToken: 'new', refreshToken: 'rotated' });
    }
    return init.headers && (init.headers as Record<string, string>).Authorization === 'Bearer new'
      ? response('ok')
      : response(null, 401);
  });
  const { client, stored } = setup(fetcher);
  await client.accept({ accessToken: 'old', refreshToken: 'refresh' });
  expect(await Promise.all([client.request('/me'), client.request('/transactions')])).toEqual([
    'ok',
    'ok',
  ]);
  expect(fetcher.mock.calls.filter(([p]) => p.endsWith('/auth/refresh'))).toHaveLength(1);
  expect(stored()).toBe('rotated');
});
test('temporary refresh network failure preserves the credential for recovery', async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error('connection lost'));
  const { client, expired, stored } = setup(fetcher);
  await client.accept({ accessToken: 'old', refreshToken: 'refresh' });
  fetcher.mockResolvedValueOnce(response(null, 401));
  await expect(client.request('/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  expect(stored()).toBe('refresh');
  expect(expired).not.toHaveBeenCalled();
  fetcher.mockResolvedValueOnce(response({ accessToken: 'new', refreshToken: 'rotated' }));
  expect(await client.restore()).toBe(true);
  expect(stored()).toBe('rotated');
});
test('lost financial response reports failure without automatic duplicate POST attempts', async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error('network'));
  const { client } = setup(fetcher);
  await client.accept({ accessToken: 'access', refreshToken: 'refresh' });
  await expect(
    client.request('/transactions', {
      method: 'POST',
      body: '{}',
      headers: { 'Idempotency-Key': 'same-key' },
    }),
  ).rejects.toBeInstanceOf(ApiError);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1].headers['Idempotency-Key']).toBe('same-key');
});
test('late responses after an account change cannot be published', async () => {
  let resolve!: (value: Response) => void;
  const fetcher = jest.fn(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  const { client } = setup(fetcher);
  await client.accept({ accessToken: 'alice', refreshToken: 'alice-r' });
  const pending = client.request('/me');
  await client.clear();
  await client.accept({ accessToken: 'bob', refreshToken: 'bob-r' });
  resolve(response({ id: 'alice' }));
  await expect(pending).rejects.toMatchObject({ code: 'ACCOUNT_CHANGED' });
});
test('logout revokes the refresh family before clearing native storage', async () => {
  const fetcher = jest.fn().mockResolvedValue(response({ revoked: true }));
  const { client, stored } = setup(fetcher);
  await client.accept({ accessToken: 'a', refreshToken: 'r' });
  await client.logout();
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ refreshToken: 'r' });
  expect(stored()).toBe(null);
});
test('failed remote logout still clears credentials from this device', async () => {
  const fetcher = jest.fn().mockRejectedValue(new Error('offline'));
  const { client, stored } = setup(fetcher);
  await client.accept({ accessToken: 'a', refreshToken: 'r' });
  await expect(client.logout()).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  expect(stored()).toBe(null);
});
test('storage failure does not publish an authenticated session', async () => {
  const fetcher = jest.fn();
  const client = new ApiClient(
    'http://test',
    {
      get: async () => null,
      set: async () => {
        throw new Error('keystore locked');
      },
      clear: async () => {},
    },
    fetcher,
  );
  await expect(client.accept({ accessToken: 'a', refreshToken: 'r' })).rejects.toThrow(
    'keystore locked',
  );
  await expect(client.request('/me')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
  expect(fetcher).not.toHaveBeenCalled();
});
