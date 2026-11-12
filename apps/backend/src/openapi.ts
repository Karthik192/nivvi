import * as contracts from '@nivvi/contracts';
import { z, publicSchemas } from '@nivvi/contracts';

type Schema = Record<string, unknown>;
type Operation = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const string = { type: 'string' };
const money = {
  type: 'string',
  pattern: '^-?(0|[1-9][0-9]*)$',
  description:
    'Exact integer paise, including negative reporting totals. No floating point conversion.',
};
const dateTime = { type: 'string', format: 'date-time' };
const nullable = (schema: Schema) => ({ anyOf: [schema, { type: 'null' }] });
const array = (items: Schema) => ({ type: 'array', items });
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({ type: 'object', properties, required });
const envelope = (data: Schema) => object({ data });
const json = (schema: Schema) => ({ 'application/json': { schema } });

export function makeOpenApi() {
  // Generate input contracts directly from the same Zod validators used by routes.
  const schemas: Record<string, Schema> = Object.fromEntries(
    Object.entries(publicSchemas).map(([name, schema]) => [
      name,
      z.toJSONSchema(schema, { io: 'input' }),
    ]),
  );
  const queries = {
    transactionQuery: contracts.transactionQuery,
    categoryQuery: contracts.categoryQuery,
    budgetQuery: contracts.budgetQuery,
    goalQuery: contracts.goalQuery,
    deleteQuery: contracts.deleteQuery,
    goalDeleteQuery: contracts.goalDeleteQuery,
    pagination: contracts.pagination.strict(),
    reportQuery: contracts.reportQuery,
    dashboardQuery: contracts.dashboardQuery,
    comparisonQuery: contracts.comparisonQuery,
    syncBootstrapQuery: z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict(),
    syncPullQuery: z.object({ cursor: z.string().regex(/^(0|[1-9][0-9]*)$/).max(30).default('0'), limit: z.coerce.number().int().min(1).max(100).default(50) }).strict(),
  };
  for (const [name, schema] of Object.entries(queries))
    schemas[name] = z.toJSONSchema(schema, { io: 'input' });
  schemas.reauthBody = z.toJSONSchema(contracts.reauthBody, { io: 'input' });
  schemas.budgetPlan = z.toJSONSchema(contracts.budgetPlan, { io: 'input' });
  schemas.Totals = object(
    Object.fromEntries(
      ['grossExpense', 'refunds', 'netExpense', 'income', 'surplus'].map((key) => [key, money]),
    ),
  );
  schemas.Error = object({
    error: object(
      {
        code: string,
        message: string,
        entityId: { type: 'string', format: 'uuid' },
        currentVersion: { type: 'integer', minimum: 1 },
        current: {
          type: 'object',
          description: 'Current owned record or tombstone when supplied by a version conflict.',
        },
        fieldErrors: {
          anyOf: [
            { type: 'array', items: object({ field: string, message: string }) },
            { type: 'object' },
          ],
        },
      },
      ['code', 'message'],
    ),
    requestId: string,
  });
  schemas.Tombstone = object({
    id: { type: 'string', format: 'uuid' },
    version: { type: 'integer', minimum: 1 },
    deletedAt: dateTime,
  });
  schemas.Page = object({ nextCursor: nullable(string), hasMore: { type: 'boolean' } });
  const metadata = {
    id: { type: 'string', format: 'uuid' },
    userId: { type: 'string', format: 'uuid' },
    version: { type: 'integer', minimum: 1 },
    deletedAt: nullable(dateTime),
    createdAt: dateTime,
    updatedAt: dateTime,
  };
  const record = (input: z.ZodObject, extras: Record<string, Schema> = {}, omit: string[] = []) => {
    const generated = z.toJSONSchema(input, { io: 'input' });
    const properties = { ...generated.properties, ...metadata, ...extras } as Record<
      string,
      Schema
    >;
    for (const name of omit) delete properties[name];
    return object(properties);
  };
  schemas.Category = record(contracts.categoryCreate, {
    defaultKey: nullable(string),
    normalizedName: string,
    archivedAt: nullable(dateTime),
  });
  schemas.Transaction = record(contracts.transactionCreate, {
    description: nullable(string),
    merchantOrPayee: nullable(string),
    originalExpenseId: nullable({ type: 'string', format: 'uuid' }),
    source: { type: 'string', enum: ['MANUAL_APP', 'MANUAL_WIDGET'] },
  });
  schemas.Allocation = record(contracts.allocationCreate, {
    monthlyBudgetId: { type: 'string', format: 'uuid' },
  });
  schemas.Budget = record(contracts.budgetCreate);
  schemas.BudgetListItem = record(contracts.budgetCreate, {
    allocations: array(ref('Allocation')),
  });
  schemas.BudgetDetail = record(contracts.budgetCreate, {
    allocations: array(ref('Allocation')),
    spending: ref('Totals'),
    remainingMinor: money,
    progressBasisPoints: nullable({
      type: 'string',
      pattern: '^-?(0|[1-9][0-9]*)$',
      description:
        'Exact signed integer basis points, truncated toward zero; 10000 means 100%. Null for a zero budget limit.',
    }),
    nearLimit: { type: 'boolean' },
    overLimit: { type: 'boolean' },
  });
  schemas.Goal = record(contracts.goalCreate, {
    targetDate: nullable({ type: 'string', format: 'date' }),
    archivedAt: nullable(dateTime),
  });
  schemas.GoalListItem = { allOf: [ref('Goal'), object({ savedMinor: money })] };
  schemas.GoalDetail = {
    allOf: [ref('Goal'), object({ savedMinor: money, completed: { type: 'boolean' } })],
  };
  schemas.Contribution = record(contracts.contributionCreate, {
    goalId: { type: 'string', format: 'uuid' },
    note: nullable(string),
  });
  schemas.User = object({
    id: metadata.id,
    email: { type: 'string', format: 'email' },
    displayName: string,
    currency: { const: 'INR' },
    locale: string,
    timezone: string,
    theme: { enum: ['system', 'light', 'dark'] },
    emailVerifiedAt: nullable(dateTime),
    status: string,
    profileVersion: { type: 'integer', minimum: 1 },
    createdAt: dateTime,
    updatedAt: dateTime,
  });
  const tokenProperties = {
    accessToken: string,
    refreshToken: string,
    expiresIn: { type: 'integer' },
  };
  schemas.Tokens = object(tokenProperties);
  schemas.Login = object({ user: ref('User'), ...tokenProperties });
  schemas.Session = object({
    id: metadata.id,
    installationId: string,
    createdAt: dateTime,
    lastUsedAt: dateTime,
    familyExpiresAt: dateTime,
    revokedAt: nullable(dateTime),
  });
  schemas.Summary = object({
    from: dateTime,
    to: dateTime,
    timezone: string,
    groupBy: { enum: ['day', 'week', 'month'] },
    totals: ref('Totals'),
    buckets: array({
      allOf: [
        ref('Totals'),
        object({ localDate: { type: 'string', format: 'date' }, from: dateTime, to: dateTime }),
      ],
    }),
  });
  schemas.CategoryReport = object({
    totals: ref('Totals'),
    denominator: object({ metric: { const: 'netExpense' }, amountMinor: money }),
    categories: array({
      allOf: [
        ref('Totals'),
        object({ categoryId: metadata.id, name: string, kind: { enum: ['EXPENSE', 'INCOME'] } }),
      ],
    }),
  });
  schemas.MerchantReport = object({
    totals: ref('Totals'),
    merchants: array({
      allOf: [ref('Totals'), object({ merchantOrPayee: nullable(string), label: string })],
    }),
  });
  const change = object({
    absolute: money,
    percentage: nullable({
      type: 'string',
      pattern: '^-?[0-9]+\\.[0-9]{2}$',
      description:
        '(current - baseline) / abs(baseline) * 100, truncated toward zero to two decimal places; null when baseline is zero.',
    }),
  });
  schemas.Comparison = object({
    month: string,
    comparisonMonth: string,
    timezone: string,
    current: ref('Totals'),
    baseline: ref('Totals'),
    changes: object(
      Object.fromEntries(
        ['grossExpense', 'refunds', 'netExpense', 'income', 'surplus'].map((key) => [key, change]),
      ),
    ),
    percentageDenominator: { const: 'absoluteBaseline' },
  });
  schemas.Dashboard = object({
    month: string,
    timezone: string,
    from: dateTime,
    to: dateTime,
    totals: ref('Totals'),
    budget: nullable(object({ id: metadata.id, limitMinor: money, availableMinor: money })),
    availableBudgetMinor: nullable(money),
    goals: object({
      count: { type: 'string', pattern: '^[0-9]+$' },
      targetMinor: money,
      contributedMinor: money,
    }),
    recentRecords: { ...array(ref('Transaction')), maxItems: 5 },
    alerts: array(
      object({
        scope: { enum: ['MONTH', 'CATEGORY'] },
        categoryId: nullable(metadata.id),
        level: { enum: ['NEAR_LIMIT', 'OVER_LIMIT'] },
        limitMinor: money,
        netExpense: money,
      }),
    ),
    freshness: object({ generatedAt: dateTime, source: { const: 'database' } }),
  });
  const paths: Record<string, Record<string, Operation>> = {};
  type Options = {
    body?: string;
    query?: keyof typeof queries;
    response?: Schema;
    status?: number;
    public?: boolean;
    mutation?: boolean;
    paged?: boolean;
    description?: string;
  };
  function route(method: string, path: string, options: Options = {}) {
    const parameters: Schema[] = [...path.matchAll(/\{([^}]+)\}/g)].map((match) => ({
      name: match[1],
      in: 'path',
      required: true,
      schema:
        match[1] === 'month'
          ? { type: 'string', pattern: '^[0-9]{4}-(0[1-9]|1[0-2])$' }
          : { type: 'string', format: 'uuid' },
    }));
    if (options.query) {
      const query = z.toJSONSchema(queries[options.query], { io: 'input' });
      for (const [name, schema] of Object.entries(query.properties ?? {}))
        parameters.push({
          name,
          in: 'query',
          required: query.required?.includes(name) ?? false,
          schema,
        });
    }
    if (options.mutation)
      parameters.push({
        name: 'Idempotency-Key',
        in: 'header',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description:
          'Required UUID operation key, scoped to the authenticated user. Retry with the same method, path, query and body to replay the original status and response. Recorded business failures also replay. Reusing a key with different request content returns 409 IDEMPOTENCY_KEY_REUSED. A missing or invalid key returns 400 IDEMPOTENCY_KEY_REQUIRED.',
      });
    const data = options.response ?? { type: 'object' };
    const success = options.paged
      ? object({ data: array(data), page: ref('Page') })
      : envelope(data);
    const responses: Record<string, unknown> = {
      [options.status ?? 200]: { description: 'Success', content: json(success) },
    };
    for (const [status, description] of Object.entries({
      400: 'Invalid request, query, UUID or JSON.',
      401: 'Authentication or credential invalid.',
      403: 'Insufficient privilege.',
      404: 'Record absent or owned by another user.',
      409: 'Version, idempotency or financial business conflict. Error may include currentVersion, entityId and current.',
      413: 'Request body too large.',
      422: 'Invalid financial state or reporting window.',
      429: 'Rate limited; inspect rate limit headers.',
      500: 'Unexpected server error.',
    }))
      responses[status] = { description, content: json(ref('Error')) };
    if (options.mutation)
      responses[503] = {
        description: 'Transient contention: retry with the same operation key.',
        content: json(ref('Error')),
      };
    const descriptions = [options.description];
    if (options.query)
      descriptions.push(
        'Query names are restricted to the listed parameters; unknown keys, invalid values and repeated scalar parameters are rejected with 400. See the referenced strict query schema.',
      );
    if (options.mutation)
      descriptions.push(
        'This financial write requires Idempotency-Key. Ownership, version, timestamps and capture source are server-controlled.',
      );
    if (options.mutation && method === 'patch')
      descriptions.push(
        'Supply the current positive baseVersion in the JSON body. A stale version returns 409 VERSION_CONFLICT with currentVersion and, when available, entityId and current.',
      );
    if (options.mutation && method === 'delete')
      descriptions.push(
        'Supply the current positive baseVersion in the query. A stale version returns 409 VERSION_CONFLICT. Success returns a versioned tombstone in {data}; cascaded changes commit atomically.',
      );
    if (path === '/me' && method === 'patch')
      descriptions.push(
        'Supply profileVersion as baseVersion in the JSON body; stale versions return 409 VERSION_CONFLICT. Profile edits do not require an Idempotency-Key.',
      );
    (paths[path] ??= {})[method] = {
      operationId: `${method}_${path.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      security: options.public ? [] : [{ bearerAuth: [] }],
      parameters,
      responses,
      ...(descriptions.some(Boolean) && { description: descriptions.filter(Boolean).join(' ') }),
      ...(options.query && { 'x-query-schema': ref(options.query) }),
      ...(options.body && { requestBody: { required: true, content: json(ref(options.body)) } }),
    };
  }
  for (const [path, body, response, status] of [
    ['/auth/register', 'registerBody', 'Login', 201],
    ['/auth/login', 'loginBody', 'Login', 200],
    ['/auth/refresh', 'refreshBody', 'Tokens', 200],
    ['/auth/logout', 'refreshBody', 'Revoked', 200],
    ['/auth/password/forgot', 'forgotBody', 'Message', 202],
    ['/auth/password/reset', 'resetBody', 'Reset', 200],
    ['/auth/email/verify', 'verifyBody', 'Verified', 200],
  ] as const)
    route('post', path, { body, public: true, status, response: ref(response) });
  schemas.Revoked = object({ revoked: { const: true } });
  schemas.Message = object({ message: string });
  schemas.Reset = object({ reset: { const: true } });
  schemas.Verified = object({ verified: { const: true } });
  route('post', '/auth/logout-all', {
    body: 'reauthBody',
    response: object({ revoked: { const: true } }),
  });
  route('post', '/auth/email/resend', { status: 202, response: object({ message: string }) });
  route('get', '/me', { response: ref('User') });
  route('patch', '/me', { body: 'profilePatch', response: ref('User') });
  route('get', '/sync/bootstrap', { query: 'syncBootstrapQuery', response: object({ categories: array(ref('Category')), transactions: array(ref('Transaction')), watermark: string, cursor: nullable(string), hasMore: { type: 'boolean' } }) });
  route('get', '/sync/pull', { query: 'syncPullQuery', response: object({ events: array(object({ sequence: string, entityType: string, entityId: string, entityVersion: { type: 'integer' }, operation: string, payload: { type: 'object' }, recordedAt: dateTime })), nextCursor: string, highWater: string, hasMore: { type: 'boolean' } }) });
  route('delete', '/me', {
    body: 'accountDeleteBody',
    status: 202,
    response: object({ status: { const: 'DELETION_PENDING' } }),
  });
  route('get', '/me/sessions', { query: 'pagination', paged: true, response: ref('Session') });
  route('delete', '/me/sessions/{id}', { response: object({ revoked: { const: true } }) });
  route('get', '/categories', { query: 'categoryQuery', response: array(ref('Category')) });
  route('post', '/categories', {
    body: 'categoryCreate',
    mutation: true,
    status: 201,
    response: ref('Category'),
  });
  route('patch', '/categories/{id}', {
    body: 'categoryPatch',
    mutation: true,
    response: ref('Category'),
  });
  for (const [path, entity, create, patch, query, list, detail] of [
    [
      '/transactions',
      'Transaction',
      'transactionCreate',
      'transactionPatch',
      'transactionQuery',
      'Transaction',
      'Transaction',
    ],
    [
      '/budgets',
      'Budget',
      'budgetCreate',
      'budgetPatch',
      'budgetQuery',
      'BudgetListItem',
      'BudgetDetail',
    ],
    ['/goals', 'Goal', 'goalCreate', 'goalPatch', 'goalQuery', 'GoalListItem', 'GoalDetail'],
  ] as const) {
    route('get', path, { query, response: ref(list), paged: true });
    route('get', `${path}/{id}`, { response: ref(detail) });
    route('post', path, { body: create, response: ref(entity), mutation: true, status: 201 });
    route('patch', `${path}/{id}`, { body: patch, response: ref(entity), mutation: true });
    route('delete', `${path}/{id}`, {
      query: entity === 'Goal' ? 'goalDeleteQuery' : 'deleteQuery',
      response: ref('Tombstone'),
      mutation: true,
    });
  }
  route('put', '/budget-plans/{month}', {
    body: 'budgetPlan',
    response: ref('BudgetListItem'),
    mutation: true,
    description:
      'Atomically create or replace a monthly budget plan. Checks the parent version and the complete base allocation ID/version set; null parent version requires no existing live budget. Duplicate categories, foreign references and allocation sums above the overall limit are rejected without partial writes.',
  });
  const planResponses = paths['/budget-plans/{month}'].put.responses as Record<string, unknown>;
  planResponses['201'] = planResponses['200'];
  route('post', '/budgets/{id}/categories', {
    body: 'allocationCreate',
    response: ref('Allocation'),
    mutation: true,
    status: 201,
  });
  route('patch', '/budgets/{id}/categories/{allocationId}', {
    body: 'allocationPatch',
    response: ref('Allocation'),
    mutation: true,
  });
  route('delete', '/budgets/{id}/categories/{allocationId}', {
    query: 'deleteQuery',
    response: ref('Tombstone'),
    mutation: true,
  });
  route('get', '/goals/{id}/contributions', {
    query: 'pagination',
    response: ref('Contribution'),
    paged: true,
  });
  route('post', '/goals/{id}/contributions', {
    body: 'contributionCreate',
    response: ref('Contribution'),
    mutation: true,
    status: 201,
  });
  route('patch', '/goals/{id}/contributions/{contributionId}', {
    body: 'contributionPatch',
    response: ref('Contribution'),
    mutation: true,
  });
  route('delete', '/goals/{id}/contributions/{contributionId}', {
    query: 'deleteQuery',
    response: ref('Tombstone'),
    mutation: true,
  });
  const reporting =
    'Half-open [from,to) window, positive duration up to 366 elapsed days. All amounts are exact integer paise strings. Refunds offset expenses on the refund date; goal contributions never affect financial totals. Surplus is income minus net expense, not a bank balance. Reporting uses the authenticated user timezone.';
  route('get', '/dashboard', {
    query: 'dashboardQuery',
    response: ref('Dashboard'),
    description: `${reporting} Unset budget is null; zero is a set limit. Active goal totals are lifetime earmarks. Recent records are limited to five in the selected month. Alerts are derived in-app at 80% (near) and above 100% (over); this does not report push/email delivery.`,
  });
  route('get', '/analytics/summary', {
    query: 'reportQuery',
    response: ref('Summary'),
    description: `${reporting} Only nonempty buckets are returned. Weeks begin Monday locally; full bucket boundaries carry their UTC offsets and may extend beyond the requested window. Amounts include only records in the requested window.`,
  });
  route('get', '/analytics/categories', {
    query: 'reportQuery',
    response: ref('CategoryReport'),
    description: `${reporting} Denominator is total net expense; categories may have negative net expense and are not positive pie slices.`,
  });
  route('get', '/analytics/merchants', {
    query: 'reportQuery',
    response: ref('MerchantReport'),
    description: `${reporting} Null/blank merchant is grouped as Unspecified; other merchant labels retain their spelling and case.`,
  });
  route('get', '/analytics/comparison', {
    query: 'comparisonQuery',
    response: ref('Comparison'),
    description: `${reporting} Percentage uses abs(baseline); a zero baseline yields null. Percentage strings truncate toward zero to two decimal places.`,
  });
  route('get', '/health/live', { public: true, response: object({ status: { const: 'ok' } }) });
  route('get', '/health/ready', { public: true, response: object({ status: { const: 'ready' } }) });
  route('get', '/openapi.json', { public: true });
  for (const path of ['/health/live', '/health/ready', '/openapi.json'])
    paths[path].get.servers = [{ url: '/' }];
  // The specification endpoint returns the plain OpenAPI object, without a data envelope.
  paths['/openapi.json'].get.responses = {
    200: {
      description: 'OpenAPI 3.1 document',
      content: json({ type: 'object', required: ['openapi', 'info', 'paths', 'components'] }),
    },
  };
  paths['/health/ready'].get.responses = {
    200: { description: 'Ready', content: json(envelope(object({ status: { const: 'ready' } }))) },
    503: {
      description: 'Dependency unavailable',
      content: json(
        object({
          error: object({ code: { const: 'NOT_READY' }, message: string }),
          requestId: string,
        }),
      ),
    },
  };
  return {
    openapi: '3.1.0',
    info: {
      title: 'Nivvi API',
      version: '1.0.0',
      description:
        'Relative paths use the /api/v1 server prefix; health and OpenAPI document operations override the server to /. JSON successes use {data}; paginated lists use {data,page:{nextCursor,hasMore}}. Errors use {error:{code,message,...details},requestId}. Input object schemas reject unknown fields. Operations with query schemas reject unknown query names; x-query-schema links the complete strict validator schema. Financial mutations require UUID Idempotency-Key; edits use body baseVersion and deletes use query baseVersion. Versions and ownership are server-controlled. List cursors are user/filter/sort-bound. Sync bootstrap uses a fixed watermark and signed, user-bound ID cursor; changes are read by per-user sequence. Money is exact base-10 integer paise text in INR. Timestamps require an explicit ISO UTC offset.',
    },
    servers: [{ url: '/api/v1' }],
    security: [{ bearerAuth: [] }],
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas,
    },
  };
}
