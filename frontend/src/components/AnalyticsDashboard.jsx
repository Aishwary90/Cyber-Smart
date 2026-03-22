import { useEffect, useMemo, useState } from "react";
import { Line, Bar, Doughnut, Radar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { motion } from "framer-motion";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top",
      labels: {
        color: "#e0e7ff",
        font: { size: 12 },
      },
    },
  },
  scales: {
    x: {
      ticks: { color: "#a5b4fc" },
      grid: { color: "rgba(165, 180, 252, 0.1)" },
    },
    y: {
      ticks: { color: "#a5b4fc" },
      grid: { color: "rgba(165, 180, 252, 0.1)" },
    },
  },
};

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right",
      labels: {
        color: "#e0e7ff",
        font: { size: 12 },
        padding: 15,
      },
    },
  },
};

const radarOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    r: {
      ticks: { color: "#a5b4fc", backdropColor: "transparent" },
      grid: { color: "rgba(165, 180, 252, 0.2)" },
      pointLabels: { color: "#e0e7ff" },
    },
  },
  plugins: {
    legend: {
      position: "top",
      labels: {
        color: "#e0e7ff",
        font: { size: 12 },
      },
    },
  },
};

function generateMockAnalyticsData() {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const crimeTypes = [
    "Online Financial Fraud",
    "Account Hacking",
    "Phishing Scam",
    "Sextortion",
    "Identity Theft",
  ];

  return {
    casesTrend: {
      labels: months,
      datasets: [
        {
          label: "Cases Analyzed",
          data: [45, 59, 80, 81, 96, 115],
          borderColor: "#6366f1",
          backgroundColor: "rgba(99, 102, 241, 0.1)",
          fill: true,
          tension: 0.4,
        },
        {
          label: "Cases Resolved",
          data: [35, 48, 65, 72, 85, 98],
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    crimeDistribution: {
      labels: crimeTypes,
      datasets: [
        {
          label: "Cases",
          data: [45, 30, 25, 15, 10],
          backgroundColor: [
            "rgba(99, 102, 241, 0.8)",
            "rgba(139, 92, 246, 0.8)",
            "rgba(236, 72, 153, 0.8)",
            "rgba(251, 146, 60, 0.8)",
            "rgba(34, 197, 94, 0.8)",
          ],
          borderColor: [
            "#6366f1",
            "#8b5cf6",
            "#ec4899",
            "#fb923c",
            "#22c55e",
          ],
          borderWidth: 2,
        },
      ],
    },
    monthlyIncidents: {
      labels: months,
      datasets: [
        {
          label: "High Risk",
          data: [30, 35, 45, 50, 55, 60],
          backgroundColor: "rgba(239, 68, 68, 0.8)",
          borderColor: "#ef4444",
          borderWidth: 1,
        },
        {
          label: "Medium Risk",
          data: [20, 25, 30, 28, 35, 40],
          backgroundColor: "rgba(251, 146, 60, 0.8)",
          borderColor: "#fb923c",
          borderWidth: 1,
        },
        {
          label: "Low Risk",
          data: [15, 18, 20, 22, 25, 28],
          backgroundColor: "rgba(34, 197, 94, 0.8)",
          borderColor: "#22c55e",
          borderWidth: 1,
        },
      ],
    },
    riskHeatmap: {
      labels: [
        "Financial",
        "Identity",
        "Privacy",
        "Reputation",
        "Legal",
        "Emotional",
      ],
      datasets: [
        {
          label: "Risk Score",
          data: [85, 72, 65, 58, 90, 45],
          backgroundColor: "rgba(236, 72, 153, 0.3)",
          borderColor: "#ec4899",
          borderWidth: 2,
          pointBackgroundColor: "#ec4899",
          pointBorderColor: "#fff",
          pointHoverBackgroundColor: "#fff",
          pointHoverBorderColor: "#ec4899",
        },
      ],
    },
  };
}

export function AnalyticsDashboard({ cases = [] }) {
  const [selectedPeriod, setSelectedPeriod] = useState("6months");
  const analyticsData = useMemo(() => generateMockAnalyticsData(), []);

  const stats = useMemo(() => {
    return {
      totalCases: 125,
      activeCases: 18,
      resolvedCases: 98,
      averageResolutionTime: "4.2 days",
      highRiskCases: 15,
      satisfactionRate: "94%",
    };
  }, [cases]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <div>
          <h2 className="analytics-title">Analytics Dashboard</h2>
          <p className="analytics-subtitle">
            Comprehensive insights into cybercrime trends and case metrics
          </p>
        </div>
        <div className="analytics-period-selector">
          <button
            className={selectedPeriod === "1month" ? "active" : ""}
            onClick={() => setSelectedPeriod("1month")}
          >
            1M
          </button>
          <button
            className={selectedPeriod === "3months" ? "active" : ""}
            onClick={() => setSelectedPeriod("3months")}
          >
            3M
          </button>
          <button
            className={selectedPeriod === "6months" ? "active" : ""}
            onClick={() => setSelectedPeriod("6months")}
          >
            6M
          </button>
          <button
            className={selectedPeriod === "1year" ? "active" : ""}
            onClick={() => setSelectedPeriod("1year")}
          >
            1Y
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <motion.div
        className="analytics-stats-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="stat-card" variants={itemVariants}>
          <div className="stat-icon" style={{ background: "rgba(99, 102, 241, 0.2)" }}>
            📊
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalCases}</div>
            <div className="stat-label">Total Cases</div>
          </div>
        </motion.div>

        <motion.div className="stat-card" variants={itemVariants}>
          <div className="stat-icon" style={{ background: "rgba(251, 146, 60, 0.2)" }}>
            ⏳
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.activeCases}</div>
            <div className="stat-label">Active Cases</div>
          </div>
        </motion.div>

        <motion.div className="stat-card" variants={itemVariants}>
          <div className="stat-icon" style={{ background: "rgba(34, 197, 94, 0.2)" }}>
            ✅
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.resolvedCases}</div>
            <div className="stat-label">Resolved Cases</div>
          </div>
        </motion.div>

        <motion.div className="stat-card" variants={itemVariants}>
          <div className="stat-icon" style={{ background: "rgba(236, 72, 153, 0.2)" }}>
            ⚠️
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.highRiskCases}</div>
            <div className="stat-label">High Risk</div>
          </div>
        </motion.div>

        <motion.div className="stat-card" variants={itemVariants}>
          <div className="stat-icon" style={{ background: "rgba(139, 92, 246, 0.2)" }}>
            ⏱️
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.averageResolutionTime}</div>
            <div className="stat-label">Avg. Resolution</div>
          </div>
        </motion.div>

        <motion.div className="stat-card" variants={itemVariants}>
          <div className="stat-icon" style={{ background: "rgba(59, 130, 246, 0.2)" }}>
            😊
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.satisfactionRate}</div>
            <div className="stat-label">Satisfaction</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Charts Grid */}
      <motion.div
        className="analytics-charts-grid"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <motion.div className="chart-card large" variants={itemVariants}>
          <h3 className="chart-title">Crime Trends Over Time</h3>
          <div className="chart-container" style={{ height: "300px" }}>
            <Line data={analyticsData.casesTrend} options={chartOptions} />
          </div>
        </motion.div>

        <motion.div className="chart-card" variants={itemVariants}>
          <h3 className="chart-title">Case Status Distribution</h3>
          <div className="chart-container" style={{ height: "300px" }}>
            <Doughnut
              data={analyticsData.crimeDistribution}
              options={doughnutOptions}
            />
          </div>
        </motion.div>

        <motion.div className="chart-card" variants={itemVariants}>
          <h3 className="chart-title">Monthly Incident Breakdown</h3>
          <div className="chart-container" style={{ height: "300px" }}>
            <Bar data={analyticsData.monthlyIncidents} options={chartOptions} />
          </div>
        </motion.div>

        <motion.div className="chart-card" variants={itemVariants}>
          <h3 className="chart-title">Risk Heatmap</h3>
          <div className="chart-container" style={{ height: "300px" }}>
            <Radar data={analyticsData.riskHeatmap} options={radarOptions} />
          </div>
        </motion.div>
      </motion.div>

      {/* Export Options */}
      <motion.div className="analytics-actions" variants={itemVariants}>
        <button className="export-btn primary">
          <span>📥</span>
          Export as PDF
        </button>
        <button className="export-btn secondary">
          <span>📊</span>
          Export as CSV
        </button>
        <button className="export-btn secondary">
          <span>📄</span>
          Generate Report
        </button>
      </motion.div>
    </div>
  );
}
