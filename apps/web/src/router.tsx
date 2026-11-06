import { QueryClient } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@zay-app/api/routers/index";

import Loader from "./components/loader";
import NotFound from "./components/not-found";
import RouteError from "./components/route-error";
import { ENV } from "./env";
import { routeTree } from "./routeTree.gen";
import { TRPCProvider } from "./utils/trpc";

function createQueryClient() {
  // Every screen shows its own error state, with its own retry button.
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 60 * 1000, retry: 1 } },
  });
}

const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${ENV.VITE_SERVER_URL.replace(/\/$/, "")}/trpc`,
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export const getRouter = () => {
  const queryClient = createQueryClient();
  const trpc = createTRPCOptionsProxy({
    client: trpcClient,
    queryClient,
  });

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    context: { trpc, queryClient },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: NotFound,
    defaultErrorComponent: RouteError,
    Wrap: ({ children }) => (
      <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
        {children}
      </TRPCProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
