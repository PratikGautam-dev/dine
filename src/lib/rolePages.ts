/** The portal pages a role can be given, grouped the way the portal's own menus group them. Page keys are the backend's
 * (portal/permissions.py); `covers` says in plain words what the page is for. */
export type RolePage = { key: string; label: string; group: string; covers: string };

export const ROLE_PAGES: RolePage[] = [
  { key: "dashboard", label: "Dashboard", group: "Main", covers: "Today's figures and activity" },
  { key: "live_operations", label: "Live Operations", group: "Main", covers: "What is happening in the restaurant right now" },
  { key: "appointments", label: "Table Bookings", group: "Main", covers: "Reservations and the booking calendar" },
  { key: "food_orders", label: "Food Orders", group: "Main", covers: "Orders from WhatsApp, the website and the counter" },
  { key: "tables", label: "Tables", group: "Main", covers: "The floor plan and table status" },
  { key: "customers", label: "Customers", group: "Main", covers: "Guests, tags, segments, membership and campaigns" },
  { key: "messages", label: "WhatsApp Inbox", group: "Main", covers: "Conversations with guests" },
  { key: "automations", label: "Messages & Automations", group: "Main", covers: "Automatic WhatsApp messages" },
  { key: "feedback", label: "Feedback", group: "Main", covers: "Guest ratings and comments" },
  { key: "reports", label: "Reports", group: "Main", covers: "Sales and booking analytics" },
  { key: "food_menu", label: "Menu", group: "Catalog", covers: "Dishes, categories and collections" },
  { key: "offers", label: "Offers", group: "Catalog", covers: "Coupons and offers" },
  { key: "check_in_out", label: "Clock in / out", group: "Workforce", covers: "Your own attendance" },
  { key: "my_leave", label: "My Leave", group: "Workforce", covers: "Your own leave requests" },
  { key: "leave_requests", label: "Leave Requests (review)", group: "Workforce", covers: "Approving the team's leave" },
  { key: "attendance", label: "Team Attendance", group: "Workforce", covers: "Everyone's attendance and corrections" },
  { key: "attendance_settings", label: "Attendance Settings", group: "Workforce", covers: "Shift and clock-in rules" },
  { key: "settings", label: "Settings", group: "Settings", covers: "Restaurant settings, branches and storefront" },
  { key: "staff", label: "Users", group: "Settings", covers: "People who can sign in" },
  { key: "roles", label: "Roles & Permissions", group: "Settings", covers: "What each role may do" },
  { key: "support", label: "Support", group: "Settings", covers: "Tickets to the DAAP team" },
  { key: "doctors", label: "Team roster", group: "Settings", covers: "The roster of people and sections" },
];

export const GROUP_ORDER = ["Main", "Catalog", "Workforce", "Settings"];
