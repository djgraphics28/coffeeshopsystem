/**
 * Route URL helpers — thin wrappers around Wayfinder-generated URLs.
 * Use these instead of a global route() function.
 */

// ─── Customer Storefront ──────────────────────────────────────────────────────
export const storefrontShow = (qrToken: string) => `/order/${qrToken}`;
export const storefrontOrdersStore = () => `/order`;
export const storefrontOrdersShow = (orderId: number) => `/order/track/${orderId}`;
export const storefrontOrdersStatus = (orderId: number) => `/order/status/${orderId}`;

// ─── Kitchen ─────────────────────────────────────────────────────────────────
export const kitchenIndex = () => `/kitchen`;
export const kitchenOrdersUpdateStatus = (orderId: number) => `/kitchen/orders/${orderId}/status`;

// ─── POS ─────────────────────────────────────────────────────────────────────
export const posIndex = () => `/pos`;
export const posOrdersStore = () => `/pos/orders`;
export const posOrdersUpdateStatus = (orderId: number) => `/pos/orders/${orderId}/status`;
export const posOrdersPayment = (orderId: number) => `/pos/orders/${orderId}/payment`;

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminDashboard = () => `/admin`;
export const adminCategoriesIndex = () => `/admin/categories`;
export const adminCategoriesStore = () => `/admin/categories`;
export const adminCategoriesUpdate = (id: number) => `/admin/categories/${id}`;
export const adminCategoriesDestroy = (id: number) => `/admin/categories/${id}`;

export const adminMenuItemsIndex = () => `/admin/menu-items`;
export const adminMenuItemsStore = () => `/admin/menu-items`;
export const adminMenuItemsUpdate = (id: number) => `/admin/menu-items/${id}`;
export const adminMenuItemsDestroy = (id: number) => `/admin/menu-items/${id}`;

export const adminAddonGroupsIndex = () => `/admin/addon-groups`;
export const adminAddonGroupsStore = () => `/admin/addon-groups`;
export const adminAddonGroupsUpdate = (id: number) => `/admin/addon-groups/${id}`;
export const adminAddonGroupsDestroy = (id: number) => `/admin/addon-groups/${id}`;

export const adminTablesIndex = () => `/admin/tables`;
export const adminTablesStore = () => `/admin/tables`;
export const adminTablesUpdate = (id: number) => `/admin/tables/${id}`;
export const adminTablesDestroy = (id: number) => `/admin/tables/${id}`;
export const adminTablesRegenerateQr = (id: number) => `/admin/tables/${id}/regenerate-qr`;

export const adminOrdersIndex = () => `/admin/orders`;
export const adminOrdersShow = (id: number) => `/admin/orders/${id}`;
export const adminOrdersUpdateStatus = (id: number) => `/admin/orders/${id}/status`;

export const adminUsersIndex = () => `/admin/users`;
export const adminUsersStore = () => `/admin/users`;
export const adminUsersUpdate = (id: number) => `/admin/users/${id}`;
export const adminUsersDestroy = (id: number) => `/admin/users/${id}`;

export const adminSettings = () => `/admin/settings`;
export const adminSettingsUpdate = () => `/admin/settings`;

// ─── Auth ────────────────────────────────────────────────────────────────────
export const logout = () => `/logout`;
export const dashboard = () => `/dashboard`;
