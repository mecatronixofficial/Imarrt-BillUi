/** A datetime-local value in the user's timezone, without converting the clock to UTC. */
export function localPaymentDateTime(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Send the selected local date and time as an unambiguous instant to the API. */
export function paymentDateToIso(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Enter a valid payment date and time.');
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || localPaymentDateTime(date) !== value) throw new Error('Enter a valid payment date and time.');
  return date.toISOString();
}
