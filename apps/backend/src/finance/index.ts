import { Router } from 'express';
import type { Deps } from '../core/types.js';
import { categoryRoutes } from './categories.js';
import { transactionRoutes } from './transactions.js';
import { budgetRoutes } from './budgets.js';
import { goalRoutes } from './goals.js';
import { planRoutes } from './plans.js';
import { syncRoutes } from './sync.js';

export function financeRouter(deps: Deps) {
  return Router().use(
    categoryRoutes(deps),
    transactionRoutes(deps),
    budgetRoutes(deps),
    goalRoutes(deps),
    planRoutes(deps),
    syncRoutes(deps),
  );
}
