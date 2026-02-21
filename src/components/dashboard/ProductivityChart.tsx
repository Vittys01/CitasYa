"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { formatPrice } from "@/lib/format-price";
import type { ManicuristProductivity } from "@/types";

const g = (s: Record<string, string> | undefined, k: string, fb: string) => (s && s[k]) ?? fb;

interface ProductivityChartProps {
  data: ManicuristProductivity[];
  settings?: Record<string, string>;
}

export default function ProductivityChart({ data, settings }: ProductivityChartProps) {
  return (
    <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-6 shadow-warm-sm h-full">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-bold text-earth">{g(settings, "chart.productivity.title", "Productividad")}</h2>
          <p className="text-xs text-earth-muted mt-0.5">{g(settings, "chart.productivity.subtitle", "Ingresos por profesional (mes actual)")}</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary-dark text-[18px]">bar_chart</span>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#bda696]">
          <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
          <p className="text-sm">{g(settings, "chart.empty", "Sin datos en el período")}</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: "#9c8273" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => v.split(" ")[0]}
              />
              <YAxis
                tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 10, fill: "#bda696" }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number) => [formatPrice(value, settings), g(settings, "chart.tooltip.revenue", "Ingresos")]}
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid #e6d5c3",
                  fontSize: 12,
                  backgroundColor: "#FFFDF5",
                  color: "#4a3b32",
                }}
                cursor={{ fill: "#f5ebe0" }}
              />
              <Bar dataKey="totalRevenue" radius={[6, 6, 0, 0]} maxBarSize={40}>
                {data.map((entry) => (
                  <Cell key={entry.manicuristId} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="mt-4 space-y-2.5 border-t border-[#f0ede8] pt-4">
            {data.map((m) => (
              <div key={m.manicuristId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: m.color }}
                  />
                  <span className="text-earth font-medium">{m.name}</span>
                </div>
                <div className="flex items-center gap-4 text-earth-muted">
                  <span className="text-xs">{m.completedAppointments}/{m.totalAppointments} {g(settings, "chart.legend.appointments", "turnos")}</span>
                  <span className="font-semibold text-earth text-sm">{formatPrice(m.totalRevenue, settings)}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
