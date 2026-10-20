// Turns a name/email into a URL-safe referral slug, with a random suffix so
// two "Maria"s don't collide. Affiliates can change this later from
// /dashboard/link once approved (checked for uniqueness there via the API).
export function generateSlug(base: string): string {
  const cleaned = base
    .toLowerCase()
    .replace(/@.*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 20) || "affiliate";
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${cleaned}-${suffix}`;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{3,40}$/.test(slug);
}
