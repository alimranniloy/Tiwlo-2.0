export function formatEmailDate(value, { includeTime = false } = {}) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '';
  const now = new Date();
  if (includeTime) {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date);
  }
  const sameDay = date.toDateString() === now.toDateString();
  const daysAgo = (now.setHours(0, 0, 0, 0) - new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) / 86400000;
  if (sameDay) return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
  if (daysAgo >= 1 && daysAgo < 7) return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}
