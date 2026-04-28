"use client";

import { useState } from "react";
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

type TabType = "revenue" | "appointments" | "avg";

interface ProductivityChartProps {
  data: ManicuristProductivity[];
  settings?: Record<string, string>;
}

const tabs = [
  { id: "revenue" as const, labelKey: "chart.tab.revenue", fallback: "Ingresos" },
  { id: "appointments" as const, labelKey: "chart.tab.appointments", fallback: "Turnos" },
  { id: "avg" as const, labelKey: "chart.tab.avg", fallback: "Promedio" },
];

export default function ProductivityChart({ data, settings }: ProductivityChartProps) {
  const [activeTab, setActiveTab] = useState<TabType>("revenue");

  const getChartData = (tab: TabType) => {
    return data.map((m) => ({
      name: m.name,
      value:
        tab === "revenue"
          ? m.totalRevenue
          : tab === "appointments"
          ? m.completedAppointments
          : m.avgPerAppointment,
      totalAppointments: m.totalAppointments,
      completedAppointments: m.completedAppointments,
      totalRevenue: m.totalRevenue,
    }));
  };

  const chartData = getChartData(activeTab);

  const formatValue = (value: number) => {
    if (activeTab === "revenue") return formatPrice(value, settings);
    if (activeTab === "appointments") return value.toString();
    return formatPrice(value, settings);
  };

  const formatTooltip = (value: number) => [
    formatValue(value),
    activeTab === "revenue"
      ? g(settings, "chart.tooltip.revenue", "Ingresos")
      : activeTab === "appointments"
      ? g(settings, "chart.tab.appointments", "Turnos")
      : g(settings, "chart.tooltip.avg", "Promedio"),
  ];

  const getYAxisFormat = (v: number) => {
    if (activeTab === "revenue") return `$${(v / 1000).toFixed(0)}k`;
    if (activeTab === "appointments") return v.toString();
    return `$${(v / 1000).toFixed(0)}k`;
  };

  return (
    <div className="bg-[#FFFDF5] rounded-xl border border-[#e6d5c3] p-5 lg:p-6 shadow-warm-sm h-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-earth truncate">
            {g(settings, "chart.productivity.title", "Productividad")}
          </h2>
          <p className="text-xs text-earth-muted mt-0.5 truncate">
            {g(settings, "chart.productivity.subtitle", "Ingresos por profesional (mes actual)")}
          </p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-primary-dark text-[18px]">bar_chart</span>
        </div>
      </div>

      <div className="flex gap-1 mb-4 bg-[#f5ebe0] p-1 rounded-lg">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-md transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-white text-earth shadow-sm"
                : "text-earth-muted hover:text-earth"
            }`}
          >
            {g(settings, tab.labelKey, tab.fallback)}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-[#bda696]">
          <span className="material-symbols-outlined text-4xl mb-2">analytics</span>
          <p className="text-sm">{g(settings, "chart.empty", "Sin datos en el periodo")}</p>
        </div>
      ) : (
        <>
          <div className="w-full min-w-0">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0ede8" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#9c8273" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => v.split(" ")[0]}
                  interval={0}
                />
                <YAxis
                  tickFormatter={(v: number) => getYAxisFormat(v)}
                  tick={{ fontSize: 10, fill: "#bda696" }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value: number) => formatTooltip(value)}
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid #e6d5c3",
                    fontSize: 12,
                    backgroundColor: "#FFFDF5",
                    color: "#4a3b32",
                    maxWidth: 220,
                  }}
                  cursor={{ fill: "#f5ebe0" }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {data.map((entry) => (
                    <Cell key={entry.manicuristId} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 space-y-2.5 border-t border-[#f0ede8] pt-4">
            {data.map((m) => {
              const rate =
                m.totalAppointments > 0
                  ? Math.round((m.completedAppointments / m.totalAppointments) * 100)
                  : 0;

              return (
                <div
                  key={m.manicuristId}
                  className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-sm"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="text-earth font-medium truncate">{m.name}</span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 text-earth-muted sm:ml-auto">
                    <span className="text-xs whitespace-nowrap">
                      {m.completedAppointments}/{m.totalAppointments}{" "}
                      {g(settings, "chart.legend.appointments", "turnos")} ({rate}%)
                    </span>
                    <span className="font-semibold text-earth text-sm whitespace-nowrap">
                      {formatPrice(m.totalRevenue, settings)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
