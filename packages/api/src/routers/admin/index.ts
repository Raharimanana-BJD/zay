import { router } from "../../index";
import { accountsRouter } from "./accounts";
import { auditRouter } from "./audit";
import { bookingsRouter } from "./bookings";
import { dashboardRouter } from "./dashboard";
import { driversRouter } from "./drivers";
import { liveMapRouter } from "./live-map";
import { reportsRouter } from "./reports";
import { settingsRouter } from "./settings";
import { teamRouter } from "./team";

export const adminRouter = router({
  accounts: accountsRouter,
  audit: auditRouter,
  bookings: bookingsRouter,
  dashboard: dashboardRouter,
  drivers: driversRouter,
  liveMap: liveMapRouter,
  reports: reportsRouter,
  settings: settingsRouter,
  team: teamRouter,
});
