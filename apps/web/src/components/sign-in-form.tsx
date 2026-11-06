import { useForm } from "@tanstack/react-form";
import { useNavigate } from "@tanstack/react-router";
import { Button } from "@zay-app/ui/components/button";
import { Input } from "@zay-app/ui/components/input";
import { Label } from "@zay-app/ui/components/label";
import { useState } from "react";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { errorLabel } from "@/lib/labels";

const signInSchema = z.object({
  email: z.email("Saisissez une adresse email valide."),
  password: z.string().min(1, "Saisissez votre mot de passe."),
});

export default function SignInForm() {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const { error } = await authClient.signIn.email(value);
      if (error) {
        setServerError(errorLabel(error));
        return;
      }
      await navigate({ to: "/admin" });
    },
  });

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Email</Label>
            <Input
              aria-describedby={`${field.name}-error`}
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="username"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              type="email"
              value={field.state.value}
            />
            <p className="text-destructive text-sm" id={`${field.name}-error`}>
              {field.state.meta.errors[0]?.message}
            </p>
          </div>
        )}
      </form.Field>

      <form.Field name="password">
        {(field) => (
          <div className="grid gap-2">
            <Label htmlFor={field.name}>Mot de passe</Label>
            <Input
              aria-describedby={`${field.name}-error`}
              aria-invalid={field.state.meta.errors.length > 0}
              autoComplete="current-password"
              id={field.name}
              name={field.name}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              type="password"
              value={field.state.value}
            />
            <p className="text-destructive text-sm" id={`${field.name}-error`}>
              {field.state.meta.errors[0]?.message}
            </p>
          </div>
        )}
      </form.Field>

      {serverError ? (
        <p
          className="rounded-2xl bg-destructive/10 p-3 text-destructive text-sm"
          role="alert"
        >
          {serverError}
        </p>
      ) : null}

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            className="w-full"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Connexion..." : "Se connecter"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
