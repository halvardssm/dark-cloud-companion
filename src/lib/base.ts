/**
 * The site is served from a subpath on GitHub Pages (`base` in astro.config.ts).
 * `import.meta.env.BASE_URL` is that base with a trailing slash ("/" when served from the root),
 * so both helpers are no-ops for root deployments.
 */

/** Turns a root-relative path ("/guides") into one valid under the deployment base. */
export const withBase = (path: string) => import.meta.env.BASE_URL.replace(/\/$/, "") + path;

/** The inverse: strips the deployment base from a pathname, if present. */
export const stripBase = (pathname: string) => {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (!base || (pathname !== base && !pathname.startsWith(`${base}/`))) return pathname;
  return pathname.slice(base.length) || "/";
};
