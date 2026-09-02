const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export type UserRole = "customer" | "admin" | "superadmin";
export type UserStatus = "active" | "disabled";
export type AuthUser = { id: string; email: string; firstName: string; lastName: string; phone: string | null; role: UserRole };
export type AdminUser = AuthUser & { status: UserStatus; createdAt: string; orderCount: number; totalSpent: string };
export type CustomerOrder = { id: string; orderNumber: string; status: string; fulfillmentType: string; currency: string; subtotal: string; taxTotal: string; total: string; createdAt: string; submittedAt: string | null; fulfillmentAt: string; items: { name: string; quantity: number; lineTotal: string }[] };
export type AdminOrder = { id: string; orderNumber: string; status: string; total: string; currency: string; fulfillmentType: string; createdAt: string; firstName: string; lastName: string; email: string };
export type AdminOrderDetail = AdminOrder & { contactSnapshot: { email: string; firstName: string; lastName: string; phone: string }; addressSnapshot: { addressLine: string; requestedDeliveryTime?: string; sector: string; reference: string; locationText?: string; latitude?: number; longitude?: number } | null; customerNotes: string | null; adminPublicNote: string | null; adminPrivateNote: string | null; subtotal: string; taxTotal: string; submittedAt: string | null; confirmedAt: string | null; fulfillmentAt: string; items: Array<{ id: string; name: string; quantity: number; unitBasePrice: string; modifierTotal: string; unitTotal: string; lineTotal: string; taxTotal: string; customerNote: string | null; snapshotJson: { modifiers?: Array<{ optionName: string; quantity: number }> } }>; proof: { id: string; status: string; originalName: string; mimeType: string; sizeBytes: number; rejectionReason: string | null; createdAt: string; reviewedAt: string | null } | null; history: Array<{ id: string; fromStatus: string | null; toStatus: string; publicNote: string | null; createdAt: string; actorName: string | null }> };
export type CatalogCategory = { id: string; name: string; slug: string; sortOrder: number };
export type ModifierOption = { id: string; name: string; description: string | null; priceDelta: string; priceDeltaCents?: number; includedQuantity: number; defaultQuantity: number; maxQuantity: number; isLocked: boolean; isActive: boolean; sortOrder: number };
export type ModifierGroup = { id: string; productId: string; name: string; description: string | null; selectionType: "single" | "multiple"; minSelections: number; maxSelections: number; isActive: boolean; sortOrder: number; options: ModifierOption[] };
export type ModifierSelection = { groupId: string; options: { optionId: string; quantity: number }[] };
export type CatalogProduct = { id: string; name: string; slug: string; description: string; categoryId: string; category: string; categorySlug: string; imageUrl: string | null; imageAlt: string | null; badge: string | null; basePriceCents: number; taxRateBps: number; available: number; modifierGroups: ModifierGroup[] };
export type CatalogCycle = { id: string; name: string; status: string; opensAt: string; closesAt: string; fulfillmentAt: string; publicMessage: string | null };
export type AdminCategory = CatalogCategory & { description: string | null; isActive: boolean; createdAt: string; productCount: number };
export type AdminProduct = { id: string; categoryId: string; categoryName: string; name: string; slug: string; shortDescription: string; description: string | null; imageKey: string | null; imageAlt: string | null; badge: string | null; basePrice: string; taxRate: string; sortOrder: number; isActive: boolean; createdAt: string };
export type AdminCycle = { id: string; name: string; opensAt: string; closesAt: string; fulfillmentAt: string; status: "draft" | "scheduled" | "open" | "closed" | "fulfilled" | "cancelled"; globalCapacity: number | null; fulfillmentModes: ("pickup" | "delivery")[]; publicMessage: string | null; createdAt: string; productCount: number; orderCount: number };
export type AdminCycleProduct = { productId: string; capacity: number | null; priceOverride: string | null; isAvailable: boolean; sortOrder: number };

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const hasJsonBody = Boolean(init.body) && !(init.body instanceof FormData);
  const response = await fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers: { ...(hasJsonBody ? { "Content-Type": "application/json" } : {}), ...init.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string; code?: string };
    throw new ApiError(body.message ?? "No pudimos procesar la solicitud.", response.status, body.code);
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function productImageUrl(pathOrKey: string | null | undefined) {
  if (!pathOrKey) return "/brand/hero-food.png";
  if (/^https?:\/\//.test(pathOrKey)) return pathOrKey;
  const path = pathOrKey.startsWith("/media/products/") ? pathOrKey : `/media/products/${encodeURIComponent(pathOrKey)}`;
  return `${API_URL}${path}`;
}

export function paymentProofUrl(proofId: string) { return `${API_URL}/payment-proofs/${encodeURIComponent(proofId)}/file`; }

export function googleAuthUrl(next = "/account") {
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return `${API_URL}/auth/google?next=${encodeURIComponent(safeNext)}`;
}

export const api = {
  catalog: () => request<{ cycle: CatalogCycle | null; categories: CatalogCategory[]; products: CatalogProduct[] }>("/catalog"),
  login: (input: { email: string; password: string }) => request<{ user: AuthUser }>("/auth/login", { method: "POST", body: JSON.stringify(input) }),
  me: () => request<{ user: AuthUser }>("/auth/me"),
  updateProfile: (input: { firstName: string; lastName: string; phone: string }) => request<{ user: AuthUser }>("/auth/profile", { method: "PATCH", body: JSON.stringify(input) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  myOrders: () => request<{ orders: CustomerOrder[] }>("/orders/mine"),
  adminDashboard: () => request<{ cycle: { id: string; name: string; globalCapacity: number | null } | null; metrics: { orders: number; sales: string; averageTicket: string; pendingPayments: number }; products: { name: string; units: number; capacity: number }[] }>("/admin/dashboard"),
  adminOrders: (search = "") => request<{ orders: AdminOrder[] }>(`/admin/orders${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  adminOrder: (id: string) => request<{ order: AdminOrderDetail }>(`/admin/orders/${id}`),
  reviewPayment: (proofId: string, input: { decision: "approve" } | { decision: "reject"; reason: string }) => request<{ result: { proofId: string; orderId: string; orderStatus: string } }>(`/admin/payments/${proofId}/review`, { method: "POST", body: JSON.stringify(input) }),
  adminUsers: (search = "") => request<{ users: AdminUser[] }>(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  adminCategories: () => request<{ categories: AdminCategory[] }>("/admin/categories"),
  createCategory: (input: { name: string; slug: string; description?: string; sortOrder: number; isActive: boolean }) => request<{ category: AdminCategory }>("/admin/categories", { method: "POST", body: JSON.stringify(input) }),
  updateCategory: (id: string, input: Partial<{ name: string; slug: string; description: string; sortOrder: number; isActive: boolean }>) => request<{ category: AdminCategory }>(`/admin/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteCategory: (id: string) => request<void>(`/admin/categories/${id}`, { method: "DELETE" }),
  adminProducts: () => request<{ products: AdminProduct[] }>("/admin/products"),
  adminProductConfiguration: (id: string) => request<{ groups: ModifierGroup[] }>(`/admin/products/${id}/configuration`),
  saveProductConfiguration: (id: string, groups: Array<{ id?: string; name: string; description?: string; selectionType: "single" | "multiple"; minSelections: number; maxSelections: number; isActive: boolean; sortOrder: number; options: Array<{ id?: string; name: string; description?: string; priceDelta: number; includedQuantity: number; defaultQuantity: number; maxQuantity: number; isLocked: boolean; isActive: boolean; sortOrder: number }> }>) => request<{ groups: ModifierGroup[] }>(`/admin/products/${id}/configuration`, { method: "PUT", body: JSON.stringify({ groups }) }),
  createProduct: (input: { categoryId: string; name: string; slug: string; shortDescription: string; description?: string; imageAlt?: string; badge?: string; basePrice: number; taxRate: number; sortOrder: number; isActive: boolean }) => request<{ product: AdminProduct }>("/admin/products", { method: "POST", body: JSON.stringify(input) }),
  updateProduct: (id: string, input: Partial<{ categoryId: string; name: string; slug: string; shortDescription: string; description: string; imageAlt: string; badge: string; basePrice: number; taxRate: number; sortOrder: number; isActive: boolean }>) => request<{ product: AdminProduct }>(`/admin/products/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  uploadProductImage: (id: string, file: File) => { const data = new FormData(); data.append("file", file); return request<{ product: Pick<AdminProduct, "id" | "imageKey" | "imageAlt"> }>(`/admin/products/${id}/image`, { method: "POST", body: data }); },
  removeProductImage: (id: string) => request<void>(`/admin/products/${id}/image`, { method: "DELETE" }),
  deleteProduct: (id: string) => request<void>(`/admin/products/${id}`, { method: "DELETE" }),
  adminCycles: () => request<{ cycles: AdminCycle[] }>("/admin/cycles"),
  adminCycleProducts: (id: string) => request<{ products: AdminCycleProduct[] }>(`/admin/cycles/${id}/products`),
  createCycle: (input: { name: string; opensAt: string; closesAt: string; fulfillmentAt: string; globalCapacity: number | null; fulfillmentModes: ("pickup" | "delivery")[]; publicMessage?: string }) => request<{ cycle: AdminCycle }>("/admin/cycles", { method: "POST", body: JSON.stringify(input) }),
  updateCycle: (id: string, input: Partial<{ name: string; opensAt: string; closesAt: string; fulfillmentAt: string; globalCapacity: number | null; fulfillmentModes: ("pickup" | "delivery")[]; publicMessage: string; status: AdminCycle["status"] }>) => request<{ cycle: AdminCycle }>(`/admin/cycles/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  deleteCycle: (id: string) => request<void>(`/admin/cycles/${id}`, { method: "DELETE" }),
  setCycleProducts: (id: string, products: { productId: string; capacity: number | null; priceOverride: number | null; isAvailable: boolean; sortOrder: number }[]) => request<{ products: unknown[] }>(`/admin/cycles/${id}/products`, { method: "PUT", body: JSON.stringify({ products }) }),
  quoteOrder: (input: { cycleId: string; items: Array<{ productId: string; quantity: number; selections: ModifierSelection[] }> }) => request<{ currency: string; subtotalCents: number; taxCents: number; totalCents: number; items: Array<{ productId: string; modifierCents: number; unitCents: number }> }>("/orders/quote", { method: "POST", body: JSON.stringify(input) }),
  createAdminUser: (input: { email: string; password: string; firstName: string; lastName: string; phone?: string; role: UserRole }) => request<{ user: AdminUser }>("/admin/users", { method: "POST", body: JSON.stringify(input) }),
  updateAdminUser: (userId: string, input: Partial<Pick<AdminUser, "email" | "firstName" | "lastName" | "phone" | "role" | "status">>) => request<{ user: AdminUser }>(`/admin/users/${userId}`, { method: "PATCH", body: JSON.stringify(input) }),
  createOrder: (input: unknown) => request<{ order: { id: string; orderNumber: string; totalCents: number } }>("/orders", { method: "POST", body: JSON.stringify(input) }),
  uploadProof: (orderId: string, file: File) => { const data = new FormData(); data.append("file", file); return request<{ proof: unknown }>(`/orders/${orderId}/payment-proof`, { method: "POST", body: data }); },
};
