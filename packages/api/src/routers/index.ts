import { protectedProcedure, publicProcedure, router } from "../index";
import { adminRouter } from "./admin/index";
import { clientRouter } from "./client";
import { driverRouter } from "./driver";
import { meRouter } from "./me";

export const appRouter = router({
  admin: adminRouter,
  client: clientRouter,
  driver: driverRouter,
  me: meRouter,
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
});
export type AppRouter = typeof appRouter;
