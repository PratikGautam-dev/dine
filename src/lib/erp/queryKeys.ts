// TanStack Query keys for the portal's hooks (src/hooks), in one place because a save in one area refreshes screens owned by another
// (placing an order changes the orders list, the customer's history and stock). Each area's first key is the prefix that invalidates
// everything in it. Keys do not carry the signed-in person: the cache is cleared when that changes (lib/queryClient).

type Params = Record<string, string | number | boolean | null | undefined>;

export const queryKeys = {
  orders: ["erp", "orders"] as const,
  orderList: (params: Params) => ["erp", "orders", "list", params] as const,
  order: (id: string) => ["erp", "orders", "detail", id] as const,
  orderShipments: (id: string) => ["erp", "orders", "shipments", id] as const,

  customers: ["erp", "customers"] as const,
  customerList: (params: Params) =>
    ["erp", "customers", "list", params] as const,
  customer: (id: string) => ["erp", "customers", "detail", id] as const,
  storeCredit: (id: string) => ["erp", "customers", "credit", id] as const,

  products: ["erp", "products"] as const,
  productList: (params: Params) => ["erp", "products", "list", params] as const,

  inventory: ["erp", "inventory"] as const,
  stockLevels: (params: Params) =>
    ["erp", "inventory", "levels", params] as const,
  stockConsolidated: (params: Params) =>
    ["erp", "inventory", "consolidated", params] as const,
  stockMovements: (params: Params) =>
    ["erp", "inventory", "ledger", params] as const,

  transfers: ["erp", "transfers"] as const,
  transferList: (params: Params) =>
    ["erp", "transfers", "list", params] as const,
  transfer: (id: string) => ["erp", "transfers", "detail", id] as const,

  taxes: ["erp", "taxes"] as const,
  taxRules: ["erp", "taxes", "rules"] as const,
  taxBands: ["erp", "taxes", "bands"] as const,
  gstRegistrations: ["erp", "taxes", "gst-registrations"] as const,

  branches: ["erp", "branches"] as const,
  branch: (id: string) => ["erp", "branches", "detail", id] as const,
  branchSchedule: (id: string) => ["erp", "branches", "schedule", id] as const,
  terminals: ["erp", "terminals"] as const,
  terminal: (id: string) => ["erp", "terminals", "detail", id] as const,
  branchTerminals: (id: string) => ["erp", "terminals", "branch", id] as const,
  cashiers: ["erp", "terminals", "cashiers"] as const,
  branchCashiers: (id: string) => ["erp", "terminals", "cashiers", id] as const,
  terminalDayCloses: (from: string, to: string, branchId: string | null) =>
    ["erp", "terminals", "day-closes", from, to, branchId] as const,
  terminalHandover: (status: string, terminalId: string | null) =>
    ["erp", "terminals", "handover", status, terminalId] as const,
  terminalSyncHealth: (id: string, problemsOnly: boolean, limit: number) =>
    ["erp", "terminals", "sync-health", id, problemsOnly, limit] as const,

  activity: ["erp", "activity"] as const,
  activityList: (params: Params) =>
    ["erp", "activity", "list", params] as const,
  recordActivity: (params: Params) =>
    ["erp", "activity", "record", params] as const,

  channels: ["erp", "channels"] as const,
  channelReadiness: (channel: string) =>
    ["erp", "channels", "readiness", channel] as const,
  channelBranches: ["erp", "channels", "branches"] as const,
  channelClients: ["erp", "channels", "clients"] as const,
  terminalSummary: ["erp", "terminals", "summary"] as const,
  whatsapp: ["erp", "whatsapp"] as const,
  whatsappAccount: ["erp", "whatsapp", "account"] as const,
  whatsappTemplates: ["erp", "whatsapp", "templates"] as const,
  whatsappConversations: (params: Params) =>
    ["erp", "whatsapp", "conversations", params] as const,
  whatsappConversation: (id: string) =>
    ["erp", "whatsapp", "conversation", id] as const,

  supportCategories: ["erp", "support", "categories"] as const,
  supportTickets: (params: Params) =>
    ["erp", "support", "tickets", params] as const,
  supportTicket: (id: string) => ["erp", "support", "ticket", id] as const,
  support: ["erp", "support"] as const,
  returns: ["erp", "returns"] as const,
  returnList: (params: Params) => ["erp", "returns", "list", params] as const,
  returnDetail: (id: string) => ["erp", "returns", "detail", id] as const,
  orderReturns: (orderId: string) =>
    ["erp", "returns", "order", orderId] as const,
  returnable: (orderId: string) =>
    ["erp", "returns", "returnable", orderId] as const,
  returnPolicy: ["erp", "returns", "policy"] as const,
  shippingSettings: ["erp", "shipping", "settings"] as const,
  deliveryZones: ["erp", "shipping", "zones"] as const,
  deliveryDistricts: (state: string) =>
    ["erp", "shipping", "districts", state] as const,
  deliveryCheck: (pincode: string) =>
    ["erp", "shipping", "check", pincode] as const,
  deliveryMap: ["erp", "shipping", "map"] as const,
  pincodePlace: (pincode: string) => ["erp", "pincode", pincode] as const,
  districtSearch: (q: string) =>
    ["erp", "shipping", "district-search", q] as const,
  zonePreview: (body: string) => ["erp", "shipping", "preview", body] as const,
  /** Settings > Policies (the shop's written policies). */
  storePolicies: ["erp", "store-policies"] as const,
  /** Settings > Domains (the shop's own domains). */
  storeDomains: ["erp", "store-domains"] as const,
  /** Settings > Notifications (the business's customer-facing email). */
  shopEmail: ["erp", "shop-email"] as const,
  emailTemplates: ["erp", "email-templates"] as const,
  emailTemplate: (key: string) => ["erp", "email-templates", key] as const,

  analytics: ["erp", "analytics"] as const,
  today: (params: Params) => ["erp", "analytics", "today", params] as const,
  dashboard: (params: Params) =>
    ["erp", "analytics", "dashboard", params] as const,
  salesOverview: (params: Params) =>
    ["erp", "analytics", "sales", params] as const,
  recentOrders: (params: Params) =>
    ["erp", "orders", "recent", params] as const,
  lowStock: (params: Params) => ["erp", "inventory", "low", params] as const,

  // HR (leave, attendance, holidays). Everything attendance-related shares the ["hr", "attendance"] prefix, so one invalidation after
  // a punch, a correction or a rule change refreshes every screen that could show it.
  hrLeave: ["hr", "leave"] as const,
  hrLeaveMine: ["hr", "leave", "mine"] as const,
  hrLeaveRequests: (status: string) =>
    ["hr", "leave", "requests", status] as const,
  hrCalendar: (year: number) => ["hr", "leave", "calendar", year] as const,
  hrAttendance: ["hr", "attendance"] as const,
  hrClockToday: ["hr", "attendance", "today"] as const,
  hrMyMonth: (month: string) =>
    ["hr", "attendance", "my-month", month] as const,
  hrStaffMonth: (userId: string, month: string) =>
    ["hr", "attendance", "staff", userId, month] as const,
  hrTeamDay: (date: string, branchId: string) =>
    ["hr", "attendance", "team-day", date, branchId] as const,
  hrTeamMonth: (month: string, branchId: string) =>
    ["hr", "attendance", "team-month", month, branchId] as const,
  hrCheckinRequests: ["hr", "attendance", "requests"] as const,
  hrHolidays: (year: number) => ["hr", "attendance", "holidays", year] as const,
  hrPattern: (userId: string) =>
    ["hr", "attendance", "pattern", userId] as const,
  hrAttendanceSettings: ["hr", "attendance", "settings"] as const,

  billing: ["erp", "billing"] as const,
  billingContact: ["erp", "billing", "contact"] as const,
  checkoutQuote: (service: string, plan: string, cycle: string) =>
    ["erp", "billing", "quote", service, plan, cycle] as const,
  servicePlans: (service: string) =>
    ["erp", "billing", "plans", service] as const,

  tenant: ["erp", "tenant"] as const,
  tenantView: ["erp", "tenant", "view"] as const,
  onboarding: ["erp", "onboarding"] as const,

  team: ["erp", "team"] as const,
  teamUsers: ["erp", "team", "users"] as const,
  roles: ["erp", "team", "roles"] as const,
  roleCatalogue: ["erp", "team", "role-catalogue"] as const,
  userAccess: (userId: string) => ["erp", "team", "access", userId] as const,

  procurement: ["erp", "procurement"] as const,
  purchaseOrderList: (params: Params) =>
    ["erp", "procurement", "orders", params] as const,
  purchaseOrder: (id: string) => ["erp", "procurement", "order", id] as const,
  purchaseRequestList: (params: Params) =>
    ["erp", "procurement", "requests", params] as const,
  suppliers: ["erp", "procurement", "suppliers"] as const,
  supplierStatement: (id: string) =>
    ["erp", "procurement", "supplier-statement", id] as const,
  supplierBillList: (params: Params) =>
    ["erp", "procurement", "bills", params] as const,
  supplierPaymentList: (params: Params) =>
    ["erp", "procurement", "payments", params] as const,
  goodsReceipt: (id: string) =>
    ["erp", "procurement", "goods-receipt", id] as const,

  wholesale: ["erp", "wholesale"] as const,
  wholesaleSettings: ["erp", "wholesale", "settings"] as const,
  modules: ["erp", "tenant", "modules"] as const,
  labelSettings: ["erp", "labels", "settings"] as const,
  posBranding: ["erp", "channels", "pos", "branding"] as const,
  paymentMachines: ["erp", "payment-machines"] as const,
  paymentSettings: ["erp", "payment-machines", "settings"] as const,
  paymentProviders: ["erp", "payment-machines", "providers"] as const,
  razorpayAccount: ["erp", "payment-machines", "razorpay"] as const,
  razorpayTestPayment: (id: string) =>
    ["erp", "payment-machines", "razorpay", "test-payment", id] as const,
  paymentConnections: ["erp", "payment-machines", "connections"] as const,
  paymentDevices: ["erp", "payment-machines", "devices"] as const,
  paymentRequests: (unused: boolean) =>
    ["erp", "payment-machines", "requests", unused] as const,
  posLatestRelease: ["pos", "latest-release"] as const,
  priceLists: ["erp", "wholesale", "price-lists"] as const,
  priceList: (id: string, q: string) =>
    ["erp", "wholesale", "price-list", id, q] as const,
  customerAccountList: (params: Params) =>
    ["erp", "wholesale", "accounts", params] as const,
  customerAccount: (id: string) => ["erp", "wholesale", "account", id] as const,
  customerAccountSearch: (q: string) =>
    ["erp", "wholesale", "account-search", q] as const,
  accountCredit: (id: string) => ["erp", "wholesale", "credit", id] as const,
  salesOrderList: (params: Params) =>
    ["erp", "wholesale", "sales-orders", params] as const,
  salesOrder: (id: string) => ["erp", "wholesale", "sales-order", id] as const,
  statement: (id: string) => ["erp", "wholesale", "statement", id] as const,
  receivables: ["erp", "wholesale", "receivables"] as const,
  receiptList: (params: Params) =>
    ["erp", "wholesale", "receipts", params] as const,
  wholesaleInvoiceList: (params: Params) =>
    ["erp", "wholesale", "invoices", params] as const,
  wholesaleQuote: (body: string) =>
    ["erp", "wholesale", "quote", body] as const,

  finance: ["erp", "finance"] as const,
  financeSummary: (params: Params) =>
    ["erp", "finance", "summary", params] as const,
  financeReport: (name: string, params: Params) =>
    ["erp", "finance", "reports", name, params] as const,
  expenseList: (params: Params) =>
    ["erp", "finance", "expenses", params] as const,
  expenseCategories: ["erp", "finance", "expense-categories"] as const,
  journalList: (params: Params) =>
    ["erp", "finance", "journal", params] as const,
  journalEntry: (id: string) =>
    ["erp", "finance", "journal-entry", id] as const,
  accounts: ["erp", "finance", "accounts"] as const,
  unreconciled: ["erp", "finance", "unreconciled"] as const,
  settlements: ["erp", "finance", "settlements"] as const,
  taxDocuments: (params: Params) =>
    ["erp", "finance", "tax-documents", params] as const,

  themes: ["erp", "themes"] as const,
  theme: (key: string) => ["erp", "themes", "detail", key] as const,
  themePreview: (key: string) => ["erp", "themes", "preview", key] as const,
  themeCollections: ["erp", "themes", "collections"] as const,
  /** A theme's schema and defaults, from the storefront app (not the ERP). */
  themeDefinition: (key: string) => ["storefront", "theme", key] as const,
};
