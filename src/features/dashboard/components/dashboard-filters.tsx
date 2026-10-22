import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Preset } from "@/lib/dashboard/period";

export type Filters = {
  period: Preset;
  start: string;
  end: string;
  professionalId: string;
  compare: boolean;
};
const periods: [Preset, string][] = [
  ["today", "Hoje"],
  ["yesterday", "Ontem"],
  ["week", "Últimos 7 dias"],
  ["month", "Este mês"],
  ["previousMonth", "Mês anterior"],
  ["year", "Este ano"],
  ["custom", "Personalizado"],
];
export function DashboardFilters({
  value,
  onChange,
  professionals,
}: {
  value: Filters;
  onChange: (value: Filters) => void;
  professionals: { id: string; name: string }[];
}) {
  return (
    <section
      aria-label="Filtros globais"
      className="space-y-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-wrap gap-1">
        {periods.map(([period, label]) => (
          <Button
            key={period}
            size="sm"
            variant={value.period === period ? "default" : "ghost"}
            aria-pressed={value.period === period}
            onClick={() => onChange({ ...value, period })}
          >
            {label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {value.period === "custom" && (
          <>
            <label className="text-sm">
              Início
              <Input
                type="date"
                value={value.start}
                onChange={(e) => onChange({ ...value, start: e.target.value })}
              />
            </label>
            <label className="text-sm">
              Fim
              <Input
                type="date"
                value={value.end}
                onChange={(e) => onChange({ ...value, end: e.target.value })}
              />
            </label>
          </>
        )}
        <label className="text-sm">
          Profissional
          <select
            className="ml-2 max-w-full rounded-md border bg-background p-2 focus-visible:ring-2 focus-visible:ring-primary"
            value={value.professionalId}
            onChange={(e) =>
              onChange({ ...value, professionalId: e.target.value })
            }
          >
            <option value="">Todos os profissionais</option>
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            className="accent-amber-500"
            type="checkbox"
            checked={value.compare}
            onChange={(e) => onChange({ ...value, compare: e.target.checked })}
          />
          Comparar período anterior
        </label>
      </div>
    </section>
  );
}
