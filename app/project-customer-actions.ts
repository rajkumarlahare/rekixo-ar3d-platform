export const PROJECT_CUSTOMER_ACTION_SETTING_KEYS = {
  customerCallEnabled: "customerCallEnabled",
  plotFacingEnabled: "plotFacingEnabled",
  plotNorthDirection: "plotNorthDirection",
} as const;

export type ProjectCustomerActions = {
  customerCallEnabled: boolean;
  plotFacingEnabled: boolean;
  plotNorthDirection: "top" | "right" | "bottom" | "left";
};

export function projectCustomerActionsFromSettings(
  values: Record<string, string | undefined>,
): ProjectCustomerActions {
  const north = String(values.plotNorthDirection || "top").trim().toLowerCase();
  return {
    // Backward-compatible default: every existing/future project keeps calling
    // unless Super Admin explicitly disables it for that project.
    customerCallEnabled: String(values.customerCallEnabled ?? "1") !== "0",
    // Facing is opt-in so every already-published project remains visually
    // unchanged until Super Admin explicitly enables the feature.
    plotFacingEnabled: String(values.plotFacingEnabled ?? "0") === "1",
    plotNorthDirection:
      north === "right" || north === "bottom" || north === "left"
        ? north
        : "top",
  };
}

export function validateProjectCustomerActionsPatch(raw: unknown):
  | { ok: true; values: Partial<ProjectCustomerActions> }
  | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Customer action changes invalid hain" };
  }

  const entries = Object.entries(raw as Record<string, unknown>);
  const unknown = entries.find(
    ([key]) =>
      !["customerCallEnabled", "plotFacingEnabled", "plotNorthDirection"].includes(key),
  );
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
    if (key === "plotFacingEnabled") {
      if (typeof value !== "boolean") {
        return { ok: false, error: "Plot Facing true/false hona chahiye" };
      }
      values.plotFacingEnabled = value;
    }
    if (key === "plotNorthDirection") {
      const direction = String(value || "").trim().toLowerCase();
      if (!["top", "right", "bottom", "left"].includes(direction)) {
        return {
          ok: false,
          error: "Plot North Direction top/right/bottom/left me se hona chahiye",
        };
      }
      values.plotNorthDirection = direction as ProjectCustomerActions["plotNorthDirection"];
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
  if (typeof values.plotFacingEnabled === "boolean") {
    entries.push([
      PROJECT_CUSTOMER_ACTION_SETTING_KEYS.plotFacingEnabled,
      values.plotFacingEnabled ? "1" : "0",
    ]);
  }
  if (values.plotNorthDirection) {
    entries.push([
      PROJECT_CUSTOMER_ACTION_SETTING_KEYS.plotNorthDirection,
      values.plotNorthDirection,
    ]);
  }
  return entries;
}
