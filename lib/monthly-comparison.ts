export type MonthlyValues = {
  month: string;
  values: Record<string, number>;
};

const total = (row?: MonthlyValues) =>
  Object.values(row?.values ?? {}).reduce(
    (sum, value) => sum + Number(value),
    0,
  );

export function buildMonthlyComparison(
  months: string[],
  incomeSeries: MonthlyValues[],
  expenseSeries: MonthlyValues[],
  savingSeries: MonthlyValues[],
) {
  const income = new Map(incomeSeries.map((row) => [row.month, row]));
  const expense = new Map(expenseSeries.map((row) => [row.month, row]));
  const saving = new Map(savingSeries.map((row) => [row.month, row]));

  return months.map((month) => ({
    month,
    income: total(income.get(month)),
    expense: total(expense.get(month)),
    saving: total(saving.get(month)),
  }));
}
