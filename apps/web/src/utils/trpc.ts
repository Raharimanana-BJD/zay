import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@zay-app/api/routers/index";

export const { TRPCProvider, useTRPC, useTRPCClient } =
  createTRPCContext<AppRouter>();

export type RouterOutputs = inferRouterOutputs<AppRouter>;
