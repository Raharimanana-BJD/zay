import { createContext, useContext } from "react";

export const RegisteringContext = createContext<(value: boolean) => void>(
  () => {
    // The root layout always provides the real setter.
  }
);

/** Holds the auth screen while a new driver's account changes role. */
export const useSetRegistering = () => useContext(RegisteringContext);
