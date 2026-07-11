/**
 * Route URL helpers — thin wrappers around Wayfinder-generated URLs.
 * Use these instead of a global route() function.
 */

// ─── Customer Auth ────────────────────────────────────────────────────────────
export const customerAuthLogin = (qrToken?: string) => qrToken ? `/order/auth/login/${qrToken}` : `/order/auth/login`;
export const customerAuthLoginStore = () => `/order/auth/login`;
export const customerAuthRegister = (qrToken?: string) => qrToken ? `/order/auth/register/${qrToken}` : `/order/auth/register`;
export const customerAuthRegisterStore = () => `/order/auth/register`;
export const customerAuthLogout = () => `/order/auth/logout`;
export const customerAuthEmailNotice = () => `/order/auth/email/verify`;
export const customerAuthEmailResend = () => `/order/auth/email/resend`;
export const customerPromoApply = () => `/order/promo/apply`;

// ─── Customer Storefront ──────────────────────────────────────────────────────
export const storefrontShow = (qrToken: string) => `/order/${qrToken}`;
export const storefrontOrdersStore = () => `/order`;
export const storefrontOrdersShow = (orderId: number) => `/order/track/${orderId}`;
export const storefrontOrdersStatus = (orderId: number) => `/order/status/${orderId}`;
export const storefrontOrdersCancel = (orderId: number) => `/order/track/${orderId}/cancel`;
export const customerMyOrders = () => `/order/my/orders`;
export const customerMyProfile = () => `/order/my/profile`;
export const customerMyProfileUpdate = () => `/order/my/profile`;

// ─── Kitchen ─────────────────────────────────────────────────────────────────
export const kitchenIndex = () => `/kitchen`;
export const kitchenOrdersUpdateStatus = (orderId: number) => `/kitchen/orders/${orderId}/status`;

// ─── POS ─────────────────────────────────────────────────────────────────────
export const posIndex = () => `/pos`;
export const posOrdersStore = () => `/pos/orders`;
export const posOrdersUpdateStatus = (orderId: number) => `/pos/orders/${orderId}/status`;
export const posOrdersVoid = (orderId: number) => `/pos/orders/${orderId}/void`;
export const posOrdersPayment = (orderId: number) => `/pos/orders/${orderId}/payment`;

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminDashboard = () => `/admin`;
export const adminAccount = () => `/admin/account`;
export const adminCategoriesIndex = () => `/admin/categories`;
export const adminCategoriesStore = () => `/admin/categories`;
export const adminCategoriesUpdate = (id: number) => `/admin/categories/${id}`;
export const adminCategoriesDestroy = (id: number) => `/admin/categories/${id}`;

export const adminMenuItemsIndex = () => `/admin/menu-items`;
export const adminMenuItemsStore = () => `/admin/menu-items`;
export const adminMenuItemsUpdate = (id: number) => `/admin/menu-items/${id}`;
export const adminMenuItemsDestroy = (id: number) => `/admin/menu-items/${id}`;
export const adminMenuItemsToggleAvailability = (id: number) => `/admin/menu-items/${id}/toggle-availability`;
export const adminMenuItemsBulkPriceUpdate = () => `/admin/menu-items/bulk-price-update`;

export const adminAddonGroupsIndex = () => `/admin/addon-groups`;
export const adminAddonGroupsStore = () => `/admin/addon-groups`;
export const adminAddonGroupsUpdate = (id: number) => `/admin/addon-groups/${id}`;
export const adminAddonGroupsDestroy = (id: number) => `/admin/addon-groups/${id}`;

export const adminTablesIndex = () => `/admin/tables`;
export const adminTablesStore = () => `/admin/tables`;
export const adminTablesUpdate = (id: number) => `/admin/tables/${id}`;
export const adminTablesDestroy = (id: number) => `/admin/tables/${id}`;
export const adminTablesRegenerateQr = (id: number) => `/admin/tables/${id}/regenerate-qr`;

export const adminPromosIndex = () => `/admin/promos`;
export const adminPromosStore = () => `/admin/promos`;
export const adminPromosUpdate = (id: number) => `/admin/promos/${id}`;
export const adminPromosDestroy = (id: number) => `/admin/promos/${id}`;

export const adminDeliveryMenIndex = () => `/admin/delivery-men`;
export const adminDeliveryMenStore = () => `/admin/delivery-men`;
export const adminDeliveryMenUpdate = (id: number) => `/admin/delivery-men/${id}`;
export const adminDeliveryMenDestroy = (id: number) => `/admin/delivery-men/${id}`;
export const adminDeliveryMenAccount = (id: number) => `/admin/delivery-men/${id}/account`;
export const driverIndex = () => `/driver`;
export const driverLogin = () => `/driver/login`;
export const driverLoginStore = () => `/driver/login`;
export const driverCollectPayment = (id: number) => `/driver/orders/${id}/collect-payment`;
export const driverDelivered = (id: number) => `/driver/orders/${id}/delivered`;
export const adminOrdersMarkPaid = (id: number) => `/admin/orders/${id}/mark-paid`;
export const adminOrdersAssignDeliveryMan = (id: number) => `/admin/orders/${id}/delivery-man`;
export const adminCustomersIndex = () => `/admin/customers`;
export const adminCustomersShow = (id: number) => `/admin/customers/${id}`;
export const adminCustomersStore = () => `/admin/customers`;
export const adminCustomersUpdate = (id: number) => `/admin/customers/${id}`;
export const adminCustomersDestroy = (id: number) => `/admin/customers/${id}`;
export const adminCustomersAdjustLoyalty = (id: number) => `/admin/customers/${id}/adjust-loyalty`;
export const adminCustomersVerifyEmail = (id: number) => `/admin/customers/${id}/verify-email`;

export const posCustomersSearch = () => `/pos/customers/search`;
export const posCustomersStore = () => `/pos/customers`;

export const adminOrdersIndex = () => `/admin/orders`;
export const adminOrdersShow = (id: number) => `/admin/orders/${id}`;
export const adminOrdersUpdateStatus = (id: number) => `/admin/orders/${id}/status`;
export const adminOrdersVoid = (id: number) => `/admin/orders/${id}/void`;

export const adminRolesIndex = () => `/admin/roles`;
export const adminRolesStore = () => `/admin/roles`;
export const adminRolesUpdate = (id: number) => `/admin/roles/${id}`;
export const adminRolesDestroy = (id: number) => `/admin/roles/${id}`;
export const adminRolesTogglePermission = (id: number) => `/admin/roles/${id}/toggle-permission`;
export const adminRolesDuplicate = (id: number) => `/admin/roles/${id}/duplicate`;

export const adminUsersIndex = () => `/admin/users`;
export const adminUsersStore = () => `/admin/users`;
export const adminUsersUpdate = (id: number) => `/admin/users/${id}`;
export const adminUsersDestroy = (id: number) => `/admin/users/${id}`;

export const adminExpenseCategoriesIndex = () => `/admin/expense-categories`;
export const adminExpenseCategoriesStore = () => `/admin/expense-categories`;
export const adminExpenseCategoriesUpdate = (id: number) => `/admin/expense-categories/${id}`;
export const adminExpenseCategoriesDestroy = (id: number) => `/admin/expense-categories/${id}`;

export const adminExpensesIndex = () => `/admin/expenses`;
export const adminExpensesStore = () => `/admin/expenses`;
export const adminExpensesUpdate = (id: number) => `/admin/expenses/${id}`;
export const adminExpensesDestroy = (id: number) => `/admin/expenses/${id}`;

export const adminSettings = () => `/admin/settings`;
export const adminSettingsUpdate = () => `/admin/settings`;

// ─── Auth ────────────────────────────────────────────────────────────────────
export const logout = () => `/logout`;
export const home = () => `/home`;
