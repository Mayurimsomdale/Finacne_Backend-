import React, { useState, useEffect, useCallback } from "react";
import { Users, UserCheck, UserX, Clock } from "lucide-react";
import employeeService from "../../services/employeeService";

const StatsCards = () => {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    pending: 0,
    inactive: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);

      // ── Fetch both in parallel ──
      const [empResponse, pendingResponse] = await Promise.all([
        employeeService.getAllEmployees(), // active + inactive only
        employeeService.getPendingSubmissions(), // pending only
      ]);

      const employees = empResponse.success ? empResponse.data || [] : [];
      const pending = pendingResponse.success
        ? pendingResponse.data?.length || 0
        : 0;

      setStats({
        total: employees.length + pending, // total includes pending
        active: employees.filter((e) =>
          ["active", "approved"].includes(e.status?.toLowerCase()),
        ).length,
        pending,
        inactive: employees.filter((e) =>
          ["inactive", "rejected"].includes(e.status?.toLowerCase()),
        ).length,
      });
    } catch (err) {
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const cards = [
    {
      title: "Total Employees",
      value: stats.total,
      icon: Users,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100",
      trend: "All registered",
      trendColor: "text-blue-500",
    },
    {
      title: "Active",
      value: stats.active,
      icon: UserCheck,
      iconColor: "text-green-600",
      iconBg: "bg-green-100",
      trend: "Currently working",
      trendColor: "text-green-500",
    },
    {
      title: "Pending",
      value: stats.pending,
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100",
      trend: "Awaiting approval",
      trendColor: "text-amber-500",
    },
    {
      title: "Inactive",
      value: stats.inactive,
      icon: UserX,
      iconColor: "text-red-600",
      iconBg: "bg-red-100",
      trend: "Deactivated",
      trendColor: "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5 cursor-pointer group"
            style={{
              animationDelay: `${index * 100}ms`,
              animation: "fadeInUp 0.5s ease-out forwards",
              opacity: 0,
            }}
          >
            {/* Icon + spinner */}
            <div className="flex items-center justify-between mb-3">
              <div
                className={`${card.iconBg} p-2 rounded-lg group-hover:scale-110 transition-transform duration-300`}
              >
                <Icon className={card.iconColor} size={18} />
              </div>
              {loading && (
                <div className="w-4 h-4 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
              )}
            </div>

            {/* Label */}
            <p className="text-xs text-slate-500 font-medium mb-0.5">
              {card.title}
            </p>

            {/* Value */}
            <p className="text-2xl font-bold text-slate-800 tracking-tight">
              {loading ? (
                <span className="inline-block w-8 h-6 bg-gray-200 animate-pulse rounded" />
              ) : (
                card.value
              )}
            </p>

            {/* Trend */}
            <p className={`text-xs mt-1 ${card.trendColor}`}>{card.trend}</p>
          </div>
        );
      })}

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default StatsCards;
