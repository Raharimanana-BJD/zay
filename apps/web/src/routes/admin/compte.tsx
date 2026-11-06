import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@zay-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zay-app/ui/components/card";
import { Input } from "@zay-app/ui/components/input";
import { Label } from "@zay-app/ui/components/label";
import { useState } from "react";
import { toast } from "sonner";
import z from "zod";

import PageHeader from "@/components/admin/page-header";
import { authClient } from "@/lib/auth-client";
import { errorLabel, ROLE_LABELS } from "@/lib/labels";

const MIN_PASSWORD_LENGTH = 8;

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Saisissez votre mot de passe actuel."),
    newPassword: z.string().min(MIN_PASSWORD_LENGTH, "8 caractères au moins."),
    confirmation: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmation, {
    message: "Les deux mots de passe ne correspondent pas.",
    path: ["confirmation"],
  });

const PASSWORD_FIELDS = [
  {
    name: "currentPassword",
    label: "Mot de passe actuel",
    autoComplete: "current-password",
  },
  {
    name: "newPassword",
    label: "Nouveau mot de passe",
    autoComplete: "new-password",
  },
  {
    name: "confirmation",
    label: "Confirmer le nouveau mot de passe",
    autoComplete: "new-password",
  },
] as const;

export const Route = createFileRoute("/admin/compte")({
  component: AccountPage,
});

function PasswordForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirmation: "" },
    validators: { onSubmit: passwordSchema },
    onSubmit: async ({ value, formApi }) => {
      setServerError(null);
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        setServerError(errorLabel(error));
        return;
      }
      formApi.reset();
      toast.success("Mot de passe changé. Vos autres sessions sont fermées.");
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
      {PASSWORD_FIELDS.map(({ name, label, autoComplete }) => (
        <form.Field key={name} name={name}>
          {(field) => (
            <div className="grid gap-2">
              <Label htmlFor={name}>{label}</Label>
              <Input
                aria-describedby={`${name}-error`}
                aria-invalid={field.state.meta.errors.length > 0}
                autoComplete={autoComplete}
                id={name}
                name={name}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                type="password"
                value={field.state.value}
              />
              <p className="text-destructive text-sm" id={`${name}-error`}>
                {field.state.meta.errors[0]?.message}
              </p>
            </div>
          )}
        </form.Field>
      ))}
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
          <Button className="w-fit" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Enregistrement..." : "Changer le mot de passe"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

function AccountPage() {
  const { user } = Route.useRouteContext();
  const details = [
    { label: "Nom", value: user.name },
    { label: "Email", value: user.email },
    { label: "Téléphone", value: user.phone },
    { label: "Rôle", value: ROLE_LABELS[user.role ?? ""] },
  ];

  return (
    <div className="grid gap-8">
      <PageHeader
        description="Vos informations et votre mot de passe."
        title="Mon compte"
      />
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Identité</h2>
            </CardTitle>
            <CardDescription>
              Pour changer ces informations, demandez à un administrateur.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4">
              {details.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-muted-foreground text-sm">{label}</dt>
                  <dd className="break-words font-medium text-base">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Mot de passe</h2>
            </CardTitle>
            <CardDescription>
              Le changer ferme vos sessions ouvertes sur d'autres appareils.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
