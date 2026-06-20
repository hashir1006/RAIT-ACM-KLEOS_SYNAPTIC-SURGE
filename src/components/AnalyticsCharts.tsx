import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Invoice, GSTR2BRecord, SupplierRisk } from '../types';

interface ChartsProps {
  invoices: Invoice[];
  gstr2b: GSTR2BRecord[];
  supplierRiskList: SupplierRisk[];
}

export default function AnalyticsCharts({ invoices, gstr2b, supplierRiskList }: ChartsProps) {
  // 1. Monthly ITC Trend Data
  const monthlyItcData = [
    { month: 'Jan', Eligible: 45000, Blocked: 5200 },
    { month: 'Feb', Eligible: 62000, Blocked: 13500 },
    { month: 'Mar', Eligible: 58000, Blocked: 9000 },
    { month: 'Apr', Eligible: 89000, Blocked: 4000 },
    { month: 'May', Eligible: 105000, Blocked: 19800 },
    { month: 'Jun', Eligible: 132000, Blocked: 89600 }, // June Cement ITC is currently blocked!
  ];

  // 2. GST Collection Trend (CGST vs SGST vs IGST)
  const gstCollectionData = invoices.map(inv => ({
    name: inv.invoice_number,
    CGST: inv.cgst,
    SGST: inv.sgst,
    IGST: inv.igst,
  }));

  // 3. Mismatch Trend (simulated over past 5 months)
  const mismatchTrendData = [
    { month: 'Feb', 'Missing Invoices': 4, 'GSTIN Mismatch': 1, 'HSN Mismatch': 2 },
    { month: 'Mar', 'Missing Invoices': 2, 'GSTIN Mismatch': 0, 'HSN Mismatch': 1 },
    { month: 'Apr', 'Missing Invoices': 5, 'GSTIN Mismatch': 2, 'HSN Mismatch': 3 },
    { month: 'May', 'Missing Invoices': 1, 'GSTIN Mismatch': 1, 'HSN Mismatch': 1 },
    { month: 'Jun', 'Missing Invoices': 2, 'GSTIN Mismatch': 1, 'HSN Mismatch': 2 },
  ];

  // 4. Supplier Risk Score vs Total Invoices
  const supplierRiskChartData = supplierRiskList.map(s => ({
    name: s.name.split(' ')[0], // short name
    'Risk Score': s.riskScore,
    'Total Invoices': s.totalInvoices * 8, // scaled for chart representation
  }));

  // 5. Invoice Status Pie Chart
  const statusCounts = invoices.reduce((acc, current) => {
    acc[current.validation_status] = (acc[current.validation_status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = [
    { name: 'Valid Invoices', value: statusCounts.valid || 0, color: '#10b981' },
    { name: 'Warnings', value: statusCounts.warning || 0, color: '#f59e0b' },
    { name: 'Critical Issues', value: statusCounts.critical || 0, color: '#ef4444' },
  ].filter(item => item.value > 0);

  // 6. Compliance Score Trend
  const complianceTrendData = [
    { period: 'Jan (Filing)', Score: 68 },
    { period: 'Feb (Filing)', Score: 72 },
    { period: 'Mar (Filing)', Score: 59 },
    { period: 'Apr (Filing)', Score: 81 },
    { period: 'May (Filing)', Score: 85 },
    { period: 'June (Current UI)', Score: 76 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      
      {/* Chart 1: Monthly ITC Trend */}
      <div id="chart-monthly-itc" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-80">
        <div className="mb-2">
          <h4 className="text-sm font-semibold font-display text-slate-800">Monthly ITC Trend (₹)</h4>
          <p className="text-xs text-slate-400">Eligible vs blocked Input Tax Credit claimable status</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyItcData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tickFormatter={(val) => `₹${val/1000}k`} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(value) => [`₹${(value as number).toLocaleString()}`, '']} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Eligible" fill="#0284c7" name="Eligible (Claims)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Blocked" fill="#f43f5e" name="Blocked / Lost" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: GST Collection Trend */}
      <div id="chart-gst-collection" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-80">
        <div className="mb-2">
          <h4 className="text-sm font-semibold font-display text-slate-800">Tax Type Breakdown (₹)</h4>
          <p className="text-xs text-slate-400">Division between CGST, SGST & IGST per invoice</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={gstCollectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tickFormatter={(val) => val.replace('INV-2026-', '#')} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip formatter={(v) => `₹${v}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="CGST" stackId="a" fill="#1e3a8a" />
              <Bar dataKey="SGST" stackId="a" fill="#3b82f6" />
              <Bar dataKey="IGST" stackId="a" fill="#06b6d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: Mismatch Trend */}
      <div id="chart-mismatch-trend" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-80">
        <div className="mb-2">
          <h4 className="text-sm font-semibold font-display text-slate-800">Compliance Mismatch Monthly Trend</h4>
          <p className="text-xs text-slate-400">Total detected compliance anomalies history</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mismatchTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Missing Invoices" stroke="#ef4444" strokeWidth={2} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="GSTIN Mismatch" stroke="#f59e0b" strokeWidth={2} />
              <Line type="monotone" dataKey="HSN Mismatch" stroke="#06b6d4" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 4: Supplier Risk analysis chart */}
      <div id="chart-supplier-risk" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-80">
        <div className="mb-2">
          <h4 className="text-sm font-semibold font-display text-slate-800">Supplier Risk Scoring Spectrum</h4>
          <p className="text-xs text-slate-400">Higher score indicates unreliable invoice filings</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierRiskChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" strokeOpacity={0.5} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip />
              <Bar dataKey="Risk Score" fill="#e11d48" radius={[4, 4, 0, 0]}>
                {supplierRiskChartData.map((entry, index) => {
                  const score = entry['Risk Score'];
                  const color = score > 70 ? '#ef4444' : score > 30 ? '#f59e0b' : '#10b981';
                  return <Cell key={index} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 5: Invoice Status Pie Chart */}
      <div id="chart-invoice-pie" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-80">
        <div className="mb-2">
          <h4 className="text-sm font-semibold font-display text-slate-800">Invoice Audit Health Share</h4>
          <p className="text-xs text-slate-400">Distribution of clean invoices vs problematic ones</p>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <div className="w-1/2 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-1/2 flex flex-col gap-2 pl-2">
            {pieData.map((entry, index) => (
              <div key={index} className="flex items-center gap-1.5 text-xs">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }}></span>
                <span className="text-slate-600 font-medium truncate">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 6: Compliance Score Trend */}
      <div id="chart-compliance-trend" className="bg-white p-4 rounded-2xl border border-slate-100 shadow-xs flex flex-col h-80">
        <div className="mb-2">
          <h4 className="text-sm font-semibold font-display text-slate-800">Filing Compliance Velocity</h4>
          <p className="text-xs text-slate-400">Score performance improvement over past periods</p>
        </div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={complianceTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip />
              <Line type="monotone" dataKey="Score" stroke="#10b981" strokeWidth={3} dot={{ stroke: '#10b981', strokeWidth: 3, r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
