const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const siteBasePath = configuredBasePath.replace(/\/$/, "");

export function siteHref(pathname: string): string {
  return `${siteBasePath}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function encodePath(pathname: string): string {
  return pathname
    .split("/")
    .map((part) => encodeURIComponent(decodeURIComponent(part)))
    .join("/");
}
