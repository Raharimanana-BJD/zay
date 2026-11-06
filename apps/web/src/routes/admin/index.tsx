import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@zay-app/ui/components/chart";
import { Checkbox } from "@zay-app/ui/components/checkbox";
import { Label } from "@zay-app/ui/components/label";
import { Tabs, TabsList, TabsTrigger } from "@zay-app/ui/components/tabs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import z from "zod";

import { Section } from "@/components/admin/detail";
import PageHeader from "@/components/admin/page-header";
import { QueryState } from "@/components/admin/query-state";
import { reasonLabel } from "@/lib/labels";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

const REFRESH_MS = 10_000;
const PERIODS = ["today", "7d", "30d"] as const;
const PERIOD_LABELS = {
  today: "Aujourd'hui",
  "7d": "7 jours",
  "30d": "30 jours",
};
const BAR_ROW_PX = 40;

type Stats = RouterOutputs["admin"]["dashboard"]["stats"];

const searchSchema = z.object({
  period: z.enum(PERIODS).optional().catch(undefined),
  simulated: z.boolean().optional().catch(undefined),
});

const lineConfig = {
  created: { label: "Réservations créées", color: "var(--chart-1)" },
  completed: { label: "Courses terminées", color: "var(--chart-2)" },
} satisfies ChartConfig;
const barConfig = {
  count: { label: "Annulations", color: "var(--chart-1)" },
} satisfies ChartConfig;

export const Route = createFileRoute("/admin/")({
  validateSearch: searchSchema,
  component: DashboardPage,
});

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-muted p-4">
      <p className="font-bold text-4xl">{value}</p>
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

/** The bucket comes as local time from the server, so it is cut as text, never reparsed. */
const bucketLabel = (bucket: string, period: string) =>
  period === "today"
    ? `${bucket.slice(11, 13)} h`
    : `${bucket.slice(8, 10)}/${bucket.slice(5, 7)}`;

function Charts({ stats, period }: { stats: Stats; period: string }) {
  const series = stats.series.map((row) => ({
    ...row,
    label: bucketLabel(row.bucket, period),
  }));
  const reasons = stats.cancellationsByReason.map((row) => ({
    reason: reasonLabel(row.reasonCode),
    count: row.count,
  }));
  const { created, completed } = stats.totals;
  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <Section title="Évolution">
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0.5 w-5 bg-chart-1" />
              Réservations créées
            </span>
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="w-5 border-chart-2 border-t-2 border-dashed"
              />
              Courses terminées
            </span>
          </div>
          <div
            aria-label={`Sur la période : ${created} réservations créées et ${completed} courses terminées.`}
            role="img"
          >
            <ChartContainer className="h-64 w-full" config={lineConfig}>
              <LineChart
                accessibilityLayer={false}
                data={series}
                margin={{ left: -16, right: 32 }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="label"
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tickLine={false}
                />
                <YAxis allowDecimals={false} tickLine={false} width={40} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  dataKey="created"
                  dot={false}
                  isAnimationActive={false}
                  stroke="var(--color-created)"
                  strokeWidth={2}
                  type="monotone"
                />
                <Line
                  dataKey="completed"
                  dot={false}
                  isAnimationActive={false}
                  stroke="var(--color-completed)"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  type="monotone"
                />
              </LineChart>
            </ChartContainer>
          </div>
        </div>
      </Section>
      <Section title="Annulations par motif">
        {reasons.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Aucune annulation sur cette période.
          </p>
        ) : (
          <ChartContainer
            className="w-full"
            config={barConfig}
            style={{ height: reasons.length * BAR_ROW_PX + BAR_ROW_PX }}
          >
            <BarChart
              accessibilityLayer={false}
              data={reasons}
              layout="vertical"
              margin={{ left: 8, right: 32 }}
            >
              <XAxis hide type="number" />
              <YAxis
                dataKey="reason"
                tickLine={false}
                type="category"
                width={170}
              />
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                isAnimationActive={false}
                radius={4}
              >
                <LabelList
                  className="fill-foreground"
                  dataKey="count"
                  position="right"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </Section>
    </div>
  );
}

function DashboardPage() {
  const { period = "today", simulated = true } = Route.useSearch();
  const navigate = Route.useNavigate();
  const trpc = useTRPC();
  const query = useQuery(
    trpc.admin.dashboard.stats.queryOptions(
      { period, includeSimulated: simulated },
      { refetchInterval: REFRESH_MS }
    )
  );

  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader
        description="Les chiffres essentiels de la plateforme."
        title="Tableau de bord"
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Tabs
          onValueChange={(next) =>
            navigate({ search: (previous) => ({ ...previous, period: next }) })
          }
          value={period}
        >
          <TabsList>
            {PERIODS.map((item) => (
              <TabsTrigger key={item} value={item}>
                {PERIOD_LABELS[item]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={simulated}
            id="simulated"
            onCheckedChange={(checked) =>
              navigate({
                search: (previous) => ({ ...previous, simulated: checked }),
              })
            }
          />
          <Label htmlFor="simulated">Inclure les chauffeurs simulés</Label>
        </div>
      </div>
      <QueryState query={query}>
        {(stats) => {
          const isEmpty = Object.values(stats.totals).every(
            (value) => value === 0
          );
          return (
            <div className="grid grid-cols-1 gap-6">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <Tile
                  label="Réservations créées"
                  value={stats.totals.created}
                />
                <Tile
                  label="Courses terminées"
                  value={stats.totals.completed}
                />
                <Tile label="Annulations" value={stats.totals.cancelled} />
                <Tile
                  label="Recherches sans chauffeur"
                  value={stats.totals.noDriver}
                />
                <Tile label="Offres envoyées" value={stats.totals.offers} />
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Tile label="Courses actives" value={stats.now.activeRides} />
                <Tile
                  label="Chauffeurs en ligne"
                  value={stats.now.onlineDrivers}
                />
                <Tile
                  label="Signalements ouverts"
                  value={stats.now.openReports}
                />
                <Tile
                  label="Dossiers en attente"
                  value={stats.now.pendingFiles}
                />
              </div>
              {isEmpty ? (
                <p className="rounded-2xl bg-muted p-6 text-center text-muted-foreground">
                  Aucune activité sur cette période. Les courbes apparaîtront
                  avec les premières réservations.
                </p>
              ) : (
                <Charts period={period} stats={stats} />
              )}
            </div>
          );
        }}
      </QueryState>
    </div>
  );
}
