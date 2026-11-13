export type OriginSettings = {
  appUrl?: string;
  deploymentHost?: string;
  branchHost?: string;
  productionHost?: string;
  development?: boolean;
};
export type BrowserRequest = {
  url: string;
  origin: string | null;
  referer: string | null;
  fetchSite: string | null;
};
function url(
  value: string | null | undefined,
  hostnameOnly = false,
): URL | null {
  if (!value || value.trim() === "null") return null;
  try {
    const parsed = new URL(
      hostnameOnly ? `https://${value.trim()}` : value.trim(),
    );
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed
      : null;
  } catch {
    return null;
  }
}
export function isTrustedBrowserRequest(
  request: BrowserRequest,
  settings: OriginSettings,
): boolean {
  if (request.fetchSite === "cross-site") return false;
  const allowed = new Set<string>();
  const configured = url(settings.appUrl);
  if (configured) allowed.add(configured.origin);
  // Only platform-provided exact hostnames are trusted. Other *.vercel.app projects are never allowed.
  for (const host of [
    settings.deploymentHost,
    settings.branchHost,
    settings.productionHost,
  ]) {
    const candidate = url(host, true);
    if (
      candidate &&
      candidate.pathname === "/" &&
      !candidate.search &&
      !candidate.hash
    )
      allowed.add(candidate.origin);
  }
  const target = url(request.url);
  if (
    settings.development &&
    target &&
    ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)
  )
    allowed.add(target.origin);
  if (request.origin !== null) {
    const origin = url(request.origin);
    return (
      !!origin &&
      origin.pathname === "/" &&
      !origin.search &&
      !origin.hash &&
      allowed.has(origin.origin)
    );
  }
  // A browser extension may remove Origin. Retain CSRF protection with two independent
  // browser signals: same-origin Fetch Metadata and a matching, explicitly trusted Referer.
  if (request.fetchSite !== "same-origin") return false;
  const referer = url(request.referer);
  return (
    !!referer &&
    !!target &&
    referer.origin === target.origin &&
    allowed.has(referer.origin)
  );
}
