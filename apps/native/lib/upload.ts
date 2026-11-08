import { authClient } from "@/lib/auth-client";

import { ENV } from "../src/env";

export type UploadKind = "avatar" | "doc" | "photo";

/** Sends a local file to the server and returns its storage key. Throws the server code. */
export async function uploadFile(uri: string, kind: UploadKind) {
  const file = await fetch(uri);
  const cookie = await authClient.getCookie();
  const response = await fetch(`${ENV.EXPO_PUBLIC_SERVER_URL}/files/${kind}`, {
    method: "POST",
    credentials: "omit",
    headers: {
      "Content-Type": "application/octet-stream",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: await file.blob(),
  });
  const body = (await response.json().catch(() => ({}))) as {
    code?: string;
    key?: string;
  };
  if (!(response.ok && body.key)) {
    throw new Error(body.code ?? "UPLOAD_FAILED");
  }
  return body.key;
}
