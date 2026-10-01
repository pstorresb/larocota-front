import type { CatalogResponse, PublicSettings } from "@/lib/api/client";

/**
 * Server-side reads for public endpoints. Only imported from server components.
 * `API_INTERNAL_URL` lets production call the API over loopback instead of going through nginx.
 * `cache: "no-store"` keeps the home dynamic: without it Next 16 would prerender it at build time.
 */
const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function read<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}${path}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

export function fetchCatalog() { return read<CatalogResponse>("/catalog"); }
export function fetchPublicSettings() { return read<PublicSettings>("/settings/public"); }
