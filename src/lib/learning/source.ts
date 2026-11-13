export function courseSourceUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !["drive.google.com", "docs.google.com"].includes(url.hostname)
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}
