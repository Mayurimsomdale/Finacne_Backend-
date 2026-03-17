import React, { useState } from "react";
import {
  Users,
  UserCheck,
  UserX,
  FileText,
  CreditCard,
  DollarSign,
  Calendar,
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import StatCard from "./components/StatCard";
import QuickActionCard from "./components/QuickActionCard";

const EmployeeDashboard = () => {
  const [activeMenuItem, setActiveMenuItem] = useState("dashboard");

  // Dynamic data - can be fetched from API
  const [stats, setStats] = useState([
    {
      id: 1,
      icon: Users,
      label: "Total Employee",
      value: 1254,
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      textColor: "text-gray-800",
    },
    {
      id: 2,
      icon: UserCheck,
      label: "Active",
      value: 78,
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      textColor: "text-gray-800",
    },
    {
      id: 3,
      icon: Calendar,
      label: "On Leave",
      value: 352,
      bgColor: "bg-yellow-50",
      iconColor: "text-yellow-600",
      textColor: "text-gray-800",
    },
    {
      id: 4,
      icon: UserX,
      label: "Inactive",
      value: 293,
      bgColor: "bg-red-50",
      iconColor: "text-red-600",
      textColor: "text-gray-800",
    },
  ]);

  const quickActions = [
    {
      id: 1,
      icon: Users,
      title: "Manage Employees",
      description: "View and edit records",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
      action: () => console.log("Manage Employees clicked"),
    },
    {
      id: 2,
      icon: CreditCard,
      title: "Advance Payments",
      description: "Process requests",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
      action: () => console.log("Advance Payments clicked"),
    },
    {
      id: 3,
      icon: DollarSign,
      title: "Payroll Processing",
      description: "Manage salaries",
      bgColor: "bg-green-50",
      iconColor: "text-green-600",
      action: () => console.log("Payroll Processing clicked"),
    },
    {
      id: 4,
      icon: FileText,
      title: "Generate Reports",
      description: "Download analytics",
      bgColor: "bg-blue-50",
      iconColor: "text-blue-600",
      action: () => console.log("Generate Reports clicked"),
    },
  ];

  const user = {
    name: "Admin User",
    email: "adminuser@gmail.com",
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeItem={activeMenuItem} onItemClick={setActiveMenuItem} />

      <div className="flex-1 overflow-auto">
        <Header title="Dashboard" user={user} />

        <main className="p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {stats.map((stat) => (
              <StatCard
                key={stat.id}
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                bgColor={stat.bgColor}
                iconColor={stat.iconColor}
                textColor={stat.textColor}
              />
            ))}
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              Quick Actions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <QuickActionCard
                  key={action.id}
                  icon={action.icon}
                  title={action.title}
                  description={action.description}
                  bgColor={action.bgColor}
                  iconColor={action.iconColor}
                  onClick={action.action}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
