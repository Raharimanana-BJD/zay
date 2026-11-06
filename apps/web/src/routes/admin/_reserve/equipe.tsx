import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Badge } from "@zay-app/ui/components/badge";
import { Button } from "@zay-app/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@zay-app/ui/components/dialog";
import { Input } from "@zay-app/ui/components/input";
import { Label } from "@zay-app/ui/components/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@zay-app/ui/components/table";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import z from "zod";

import ActionDialog from "@/components/admin/action-dialog";
import BanControls from "@/components/admin/ban-controls";
import { LabeledSelect, Pagination } from "@/components/admin/list-controls";
import PageHeader from "@/components/admin/page-header";
import { QueryState } from "@/components/admin/query-state";
import { errorLabel, ROLE_LABELS } from "@/lib/labels";
import { useTRPC } from "@/utils/trpc";

const STAFF_ROLE_LABELS = { admin: "Administrateur", support: "Support" };
const MIN_PASSWORD_LENGTH = 8;

const searchSchema = z.object({ page: z.number().int().min(1).catch(1) });

export const Route = createFileRoute("/admin/_reserve/equipe")({
  validateSearch: searchSchema,
  component: TeamPage,
});

const EMPTY_FORM = { name: "", email: "", phone: "", temporaryPassword: "" };
const FIELDS = [
  { key: "name", label: "Nom", type: "text", autoComplete: "off" },
  { key: "email", label: "Email", type: "email", autoComplete: "off" },
  {
    key: "phone",
    label: "Téléphone",
    type: "tel",
    autoComplete: "off",
    placeholder: "+261340000000",
  },
  {
    key: "temporaryPassword",
    label: "Mot de passe temporaire",
    type: "password",
    autoComplete: "new-password",
  },
] as const;

function CreateMember() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const create = useMutation(trpc.admin.team.create.mutationOptions());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [role, setRole] = useState<string | undefined>("support");
  const [problem, setProblem] = useState<string | null>(null);

  const canSubmit =
    form.name.trim() &&
    form.email.trim() &&
    form.phone.trim() &&
    form.temporaryPassword.length >= MIN_PASSWORD_LENGTH &&
    role;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setProblem(null);
    try {
      const result = await create.mutateAsync({
        ...form,
        role: role as "admin" | "support",
      });
      setForm(EMPTY_FORM);
      setOpen(false);
      if (result.auditWritten) {
        toast.success(
          "Compte créé. Donnez le mot de passe temporaire à la personne."
        );
      } else {
        toast.error("Le compte existe, mais sans trace dans le journal.");
      }
      await queryClient.invalidateQueries();
    } catch (error) {
      setProblem(errorLabel(error));
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setProblem(null);
          setOpen(true);
        }}
      >
        Créer un compte
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un compte équipe</DialogTitle>
          </DialogHeader>
          <form className="grid grid-cols-1 gap-4" onSubmit={submit}>
            {FIELDS.map((field) => (
              <div className="grid gap-2" key={field.key}>
                <Label htmlFor={field.key}>{field.label}</Label>
                <Input
                  autoComplete={field.autoComplete}
                  id={field.key}
                  onChange={(event) =>
                    setForm({ ...form, [field.key]: event.target.value })
                  }
                  placeholder={
                    "placeholder" in field ? field.placeholder : undefined
                  }
                  type={field.type}
                  value={form[field.key]}
                />
              </div>
            ))}
            <LabeledSelect
              label="Rôle"
              onChange={setRole}
              options={STAFF_ROLE_LABELS}
              value={role}
            />
            {problem ? (
              <p
                className="rounded-2xl bg-destructive/10 p-3 text-destructive text-sm"
                role="alert"
              >
                {problem}
              </p>
            ) : null}
            <DialogFooter>
              <Button
                onClick={() => setOpen(false)}
                type="button"
                variant="secondary"
              >
                Fermer
              </Button>
              <Button disabled={!canSubmit || create.isPending} type="submit">
                {create.isPending ? "Création..." : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RoleSwitch({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: string;
}) {
  const trpc = useTRPC();
  const setRole = useMutation(trpc.admin.team.setRole.mutationOptions());
  const next = role === "admin" ? "support" : "admin";
  return (
    <ActionDialog
      confirmLabel="Changer le rôle"
      description={`${name} devient ${STAFF_ROLE_LABELS[next].toLowerCase()} dès sa prochaine action.`}
      label={`Passer ${STAFF_ROLE_LABELS[next].toLowerCase()}`}
      onConfirm={async () => {
        await setRole.mutateAsync({ userId, role: next });
      }}
      showNote={false}
      success="Rôle changé."
      title="Changer le rôle ?"
    />
  );
}

function TeamPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = Route.useRouteContext();
  const trpc = useTRPC();
  const query = useQuery(trpc.admin.team.list.queryOptions(search));

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        action={<CreateMember />}
        description="Comptes de l'équipe et rôles."
        title="Équipe"
      />
      <QueryState query={query}>
        {({ items, total }) => (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.email}</TableCell>
                    <TableCell>{item.phone}</TableCell>
                    <TableCell>{ROLE_LABELS[item.role ?? ""]}</TableCell>
                    <TableCell>
                      {item.banned ? (
                        <Badge variant="destructive">Suspendu</Badge>
                      ) : (
                        <Badge variant="secondary">Actif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.id === user.id ? (
                        <span className="text-muted-foreground">
                          Votre compte
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <RoleSwitch
                            name={item.name}
                            role={item.role ?? "support"}
                            userId={item.id}
                          />
                          <BanControls
                            banned={item.banned}
                            name={item.name}
                            suspensionIncomplete={item.suspensionIncomplete}
                            userId={item.id}
                          />
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              onPageChange={(page) => navigate({ search: { page } })}
              page={search.page}
              total={total}
            />
          </div>
        )}
      </QueryState>
    </div>
  );
}
