export function numberValue(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'object' && value.$numberDecimal !== undefined) return Number(value.$numberDecimal);
  return Number(value);
}

export function currency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2
  }).format(numberValue(value));
}

export function date(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value));
}

export function dateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function fullName(customer) {
  if (!customer) return '—';
  return (
    customer.name ||
    [customer.firstName, customer.middleName, customer.lastName]
      .filter(Boolean)
      .join(' ') ||
    '—'
  );
}

export function statusSeverity(status) {
  const map = {
    ACTIVE: 'success',
    APPROVED: 'success',
    PAID: 'success',
    COMPLETED: 'success',
    CONFIRMED: 'success',
    SUBMITTED: 'info',
    UNDER_REVIEW: 'warn',
    PENDING: 'secondary',
    PARTIALLY_PAID: 'warn',
    OVERDUE: 'danger',
    REJECTED: 'danger',
    REVERSED: 'danger',
    LOCKED: 'danger',
    INACTIVE: 'secondary'
  };
  return map[status] || 'secondary';
}

export function apiError(error) {
  return error.response?.data?.message || error.message || 'Something went wrong';
}
