export const PROJECT_CUSTOMER_ACTION_SETTING_KEYS = {
  customerCallEnabled: "customerCallEnabled",
} as const;

export type ProjectCustomerActions = {
  customerCallEnabled: boolean;
};

export function projectCustomerActionsFromSettings(
  values: Record<string, string | undefined>,
): ProjectCustomerActions {
  return {
    // Backward-compatible default: every existing/future project keeps calling
    // unless Super Admin explicitly disables it for that project.
    customerCallEnabled: String(values.customerCallEnabled ?? "1") !== "0",
  };
}

export function validateProjectCustomerActionsPatch(raw: unknown):
  | { ok: true; values: Partial<ProjectCustomerActions> }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Customer action changes invalid hain" };
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const unknown = entries.find(([key]) => key !== "customerCallEnabled");
  if (unknown) {
    return { ok: false, error: `Customer action allowed nahi hai: ${unknown[0]}` };
  }

  const values: Partial<ProjectCustomerActions> = {};
  for (const [key, value] of entries) {
    if (key === "customerCallEnabled") {
      if (typeof value !== "boolean") {
        return { ok: false, error: "Customer Calling true/false hona chahiye" };
      }
      values.customerCallEnabled = value;
    }
  }
  return { ok: true, values };
}

export function projectCustomerActionSettingEntries(
  values: Partial<ProjectCustomerActions>,
) {
  const entries: Array<[string, string]> = [];
  if (typeof values.customerCallEnabled === "boolean") {
    entries.push([
      PROJECT_CUSTOMER_ACTION_SETTING_KEYS.customerCallEnabled,
      values.customerCallEnabled ? "1" : "0",
    ]);
  }
  return entries;
}
