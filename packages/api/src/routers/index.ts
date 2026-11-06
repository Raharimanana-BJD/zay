import { protectedProcedure, publicProcedure, router } from "../index";
import { adminRouter } from "./admin/index";

export const appRouter = router({
  admin: adminRouter,
  healthCheck: publicProcedure.query(() => "OK"),
  privateData: protectedProcedure.query(({ ctx }) => ({
    message: "This is private",
    user: ctx.session.user,
  })),
});
export type AppRouter = typeof appRouter;
