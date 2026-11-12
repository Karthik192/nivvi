export type TotalsDTO = {
  grossExpense: string;
  refunds: string;
  netExpense: string;
  income: string;
  surplus: string;
};
export type DashboardDTO = {
  month: string;
  timezone: string;
  from: string;
  to: string;
  totals: TotalsDTO;
  budget: { id: string; limitMinor: string; availableMinor: string } | null;
  recentRecords: import('./runtime').RecordDTO[];
  goals: { contributedMinor: string };
  alerts: {
    scope: string;
    categoryId: string | null;
    level: string;
    limitMinor: string;
    netExpense: string;
  }[];
  freshness: { generatedAt: string };
};
