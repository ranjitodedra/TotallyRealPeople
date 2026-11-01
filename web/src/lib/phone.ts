export const phoneInputPattern = /^(?:\d{10}|\d{3}-\d{3}-\d{4})$/;

export function normalizePhoneNumber(value: string) {
  if (!phoneInputPattern.test(value.trim())) return null;
  const digits = value.replace(/\D/g, "");
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}
