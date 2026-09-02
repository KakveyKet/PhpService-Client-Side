export const datePeriodOptions = [
  { label: "All dates", value: "ALL" },
  { label: "Today", value: "TODAY" },
  { label: "Yesterday", value: "YESTERDAY" },
  { label: "This week", value: "THIS_WEEK" },
  { label: "Last week", value: "LAST_WEEK" },
  { label: "This month", value: "THIS_MONTH" },
  { label: "Last month", value: "LAST_MONTH" },
  { label: "Custom date range", value: "CUSTOM" },
];

function startOfDay(value) {
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(value) {
  const result = new Date(value);
  result.setHours(23, 59, 59, 999);
  return result;
}

function startOfWeek(value) {
  const result = startOfDay(value);
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

export function dateRangeForPeriod(
  period,
  customRange = null,
  now = new Date(),
) {
  if (period === "ALL") return null;

  if (period === "CUSTOM") {
    const [from, to] = customRange || [];
    if (!from) return null;
    return [startOfDay(from), endOfDay(to || from)];
  }

  if (period === "TODAY") return [startOfDay(now), endOfDay(now)];

  if (period === "YESTERDAY") {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return [startOfDay(yesterday), endOfDay(yesterday)];
  }

  if (period === "THIS_WEEK") {
    return [startOfWeek(now), endOfDay(now)];
  }

  if (period === "LAST_WEEK") {
    const thisWeek = startOfWeek(now);
    const from = new Date(thisWeek);
    from.setDate(from.getDate() - 7);
    const to = new Date(thisWeek);
    to.setMilliseconds(-1);
    return [from, to];
  }

  if (period === "THIS_MONTH") {
    return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)];
  }

  if (period === "LAST_MONTH") {
    return [
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
      new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
    ];
  }

  return null;
}

export function matchesDatePeriod(value, period, customRange = null) {
  const range = dateRangeForPeriod(period, customRange);
  if (!range) return period === "CUSTOM" ? !customRange?.[0] : true;

  const candidate = new Date(value);
  if (Number.isNaN(candidate.getTime())) return false;
  return candidate >= range[0] && candidate <= range[1];
}

export function matchesCustomerSearch(customer, query) {
  const search = String(query || "")
    .trim()
    .toLocaleLowerCase();
  if (!search) return true;

  const searchable = [
    customer?.name,
    customer?.firstName,
    customer?.middleName,
    customer?.lastName,
    customer?.customerCode,
    customer?.phone,
    customer?.userId?.username,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase();

  return searchable.includes(search);
}
