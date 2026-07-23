type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
};

export function normalizeSupabaseError(error: unknown) {
  const candidate = error as SupabaseLikeError;
  const code = candidate?.code ?? "";
  const message = candidate?.message ?? "";
  const details = candidate?.details ?? "";
  const combined = `${message} ${details}`.toLowerCase();

  if (code === "23505" || combined.includes("duplicate")) {
    if (combined.includes("recipe")) return "A recipe with this code already exists.";
    if (combined.includes("sku")) return "An ingredient with this SKU already exists.";
    return "A record with these details already exists.";
  }

  if (code === "23503" || combined.includes("foreign key")) {
    return "This record is linked to other data and cannot be deleted.";
  }

  if (code === "42501" || combined.includes("row-level security")) {
    return "You do not have permission to perform this action.";
  }

  if (combined.includes("failed to fetch") || combined.includes("network")) {
    return "The server could not be reached. Check your connection and try again.";
  }

  return message || "Something went wrong. Please try again.";
}
