import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { ENV } from "../env";

export const authClient = createAuthClient({
  baseURL: ENV.VITE_SERVER_URL,
  plugins: [
    inferAdditionalFields({
      user: {
        phone: { type: "string", required: true },
        locale: { type: "string", required: false },
        role: { type: "string", required: false, input: false },
      },
    }),
  ],
});
