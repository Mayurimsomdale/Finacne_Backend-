import React, { useState } from "react";
import StatsCards from "../Ui/Dashboard/StatsCards";
import QuickActions from "../Ui/Dashboard/QuickActions";

const Dashboard = () => {
  
  const [stats] = useState({
    totalEmployees: 1254,
    active: 78,
    onLeave: 352,
    inactive: 293,
  });

  return (
    <>
      <h1 className="text-3xl font-bold text-slate-800 mb-8 tracking-tight">
        Dashboard
      </h1>

      <StatsCards stats={stats} />
      <QuickActions />
    </>
  );
};

export default Dashboard;

