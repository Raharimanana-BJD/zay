import { useForm } from "@tanstack/react-form";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@zay-app/ui/components/button";
import { Input } from "@zay-app/ui/components/input";
import { Label } from "@zay-app/ui/components/label";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";
import { errorLabel } from "@/lib/labels";

const MIN_PASSWORD_LENGTH = 8;
const OTP_LENGTH = 6;

const emailSchema = z.object({
  email: z.email("Saisissez une adresse email valide."),
});

const resetSchema = z
  .object({
    otp: z.string().regex(/^\d{6}$/, "Le code a 6 chiffres."),
    password: z.string().min(MIN_PASSWORD_LENGTH, "8 caractères au moins."),
    confirmation: z.string(),
  })
  .refine((value) => value.password === value.confirmation, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

export const Route = createFileRoute("/mot-de-passe-oublie")({
  ssr: false,
  component: ForgotPasswordPage,
});

function ErrorText({ id, message }: { id: string; message?: string }) {
  return (
    <p className="text-destructive text-sm" id={id}>
      {message}
    </p>
  );
}

function ServerError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p
      className="rounded-2xl bg-destructive/10 p-3 text-destructive text-sm"
      role="alert"
    >
      {message}
    </p>
  );
}

function EmailStep({ onSent }: { onSent: (email: string) => void }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: emailSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const email = value.email.trim();
      // Same answer whether the account exists or not.
      const { error } = await authClient.emailOtp.requestPasswordReset({
        email,
      });
      if (error) {
        setServerError(errorLabel(error));
        return;
      }
      onSent(email);
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
            <ErrorText
              id={`${field.name}-error`}
              message={field.state.meta.errors[0]?.message}
            />
          </div>
        )}
      </form.Field>
      <ServerError message={serverError} />
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            className="w-full"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Envoi..." : "Recevoir un code"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

const RESET_FIELDS = [
  {
    name: "otp",
    label: "Code reçu par email",
    autoComplete: "one-time-code",
    type: "text",
  },
  {
    name: "password",
    label: "Nouveau mot de passe",
    autoComplete: "new-password",
    type: "password",
  },
  {
    name: "confirmation",
    label: "Confirmer le nouveau mot de passe",
    autoComplete: "new-password",
    type: "password",
  },
] as const;

function ResetStep({ email }: { email: string }) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { otp: "", password: "", confirmation: "" },
    validators: { onSubmit: resetSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      const { error } = await authClient.emailOtp.resetPassword({
        email,
        otp: value.otp,
        password: value.password,
      });
      if (error) {
        setServerError(errorLabel(error));
        return;
      }
      toast.success("Mot de passe changé. Connectez-vous avec le nouveau.");
      await navigate({ to: "/login" });
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
      {RESET_FIELDS.map(({ name, label, autoComplete, type }) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor={name}>{label}</Label>
              <Input
                aria-describedby={`${name}-error`}
                aria-invalid={field.state.meta.errors.length > 0}
                autoComplete={autoComplete}
                id={name}
                inputMode={name === "otp" ? "numeric" : undefined}
                maxLength={name === "otp" ? OTP_LENGTH : undefined}
                name={name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                type={type}
                value={field.state.value}
              />
              <ErrorText
                id={`${name}-error`}
                message={field.state.meta.errors[0]?.message}
              />
            </div>
          )}
        </form.Field>
      ))}
      <ServerError message={serverError} />
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button
            className="w-full"
            disabled={isSubmitting}
            size="lg"
            type="submit"
          >
            {isSubmitting ? "Enregistrement..." : "Changer le mot de passe"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function ForgotPasswordPage() {
  const [email, setEmail] = useState<string | null>(null);

  return (
    <main className="flex min-h-svh flex-col px-6 py-8 sm:px-12">
      <div className="flex items-center gap-2">
        <img alt="" className="size-9" height={36} src="/logo.png" width={36} />
        <span className="font-bold text-xl">Zay</span>
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-4xl">Mot de passe oublié</h1>
          <p className="mt-2 mb-8 text-muted-foreground">
            {email
              ? `Saisissez le code envoyé à ${email} et votre nouveau mot de passe.`
              : "Saisissez l'email de votre compte. Nous vous envoyons un code à 6 chiffres."}
          </p>
          {email ? (
            <ResetStep email={email} />
          ) : (
            <EmailStep onSent={setEmail} />
          )}
          <Link
            className="mt-6 block text-center text-muted-foreground text-sm underline-offset-4 hover:underline"
            to="/login"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    </main>
  );
}
