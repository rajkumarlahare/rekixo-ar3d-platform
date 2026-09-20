export type ClientLoginType = "email" | "mobile";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_PATTERN = /^\+[1-9]\d{7,14}$/;

export function normalizeEmailLogin(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function normalizeMobileLogin(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  let compact = raw.replace(/[\s().-]+/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;

  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
  if (/^91[6-9]\d{9}$/.test(compact)) return `+${compact}`;
  if (/^\+91[6-9]\d{9}$/.test(compact)) return compact;
  if (E164_PATTERN.test(compact)) return compact;
  return null;
}

export function normalizeClientLoginId(type: ClientLoginType, value: unknown) {
  return type === "mobile" ? normalizeMobileLogin(value) : normalizeEmailLogin(value);
}

export function loginCandidates(value: unknown) {
  const raw = String(value ?? "").trim();
  return {
    email: normalizeEmailLogin(raw) || "",
    mobile: normalizeMobileLogin(raw) || "",
    raw: raw.toLowerCase(),
  };
}

export function internalEmailForMobile(adminId: string) {
  const safe = adminId.replace(/[^a-z0-9-]/gi, "").toLowerCase() || crypto.randomUUID();
  return `mobile.${safe}@login.invalid`;
}

export function clientLoginLabel(type: ClientLoginType | "mixed") {
  if (type === "mobile") return "Mobile Number";
  if (type === "email") return "Email Address";
  return "Email or Mobile Number";
}
