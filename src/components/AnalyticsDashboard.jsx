import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import { BarChart as BarChartIcon } from 'lucide-react';
import './AnalyticsDashboard.css';

const COLORS = ['#1a3a52', '#ff9933', '#27ae60', '#e74c3c', '#3498db', '#9b59b6', '#f39c12', '#16a085'];

export default function AnalyticsDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/analytics/dashboard');
        setAnalytics(response.data);
        if (response.data.departments && response.data.departments.length > 0) {
          setSelectedDept(response.data.departments[0].name);
        }
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return <div className="analytics-dashboard" style={{ padding: '20px', color: '#1a3a52' }}>Loading analytics data...</div>;
  }

  if (!analytics) {
    return <div className="analytics-dashboard" style={{ padding: '20px' }}>No analytics data available</div>;
  }

  // 1. Filter out "Maharashtra" (state-wide indicator) from districts list
  const districtData = (analytics.districts || [])
    .filter(d => d.name && d.name.toLowerCase() !== 'maharashtra' && d.name.trim() !== '')
    .slice(0, 8);

  // 2. Filter trend data to only keep years between 2000 and 2026
  const trendData = (analytics.yearlyTrend || [])
    .filter(item => {
      const yr = parseInt(item.year);
      return yr >= 2000 && yr <= 2026;
    })
    .sort((a, b) => parseInt(a.year) - parseInt(b.year));

  // Prepare standard data sets
  const deptData = analytics.departments || [];
  const budgetData = analytics.budgetByDepartment || [];

  // Calculate totals
  const totalGRs = deptData.reduce((sum, d) => sum + d.count, 0);
  const totalBudget = budgetData.reduce((sum, b) => sum + b.budget, 0);

  return (
    <div className="analytics-dashboard">
      <div className="breadcrumb">
        <span>Home</span> / <span>Analytics</span>
      </div>

      <div className="dashboard-header" style={{ marginBottom: '24px' }}>
        <h2 style={{ color: '#1a3a52' }}><BarChartIcon size={24} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Analytics & Insights</h2>
        <p style={{ color: '#666' }}>Government Resolution trends and budget statistics</p>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-label">Total GRs</div>
          <div className="kpi-value">{totalGRs.toLocaleString()}</div>
          <div className="kpi-change">Across all departments</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Total Budget</div>
          <div className="kpi-value">₹{(totalBudget / 10000000).toFixed(2)} Cr</div>
          <div className="kpi-change">Allocated funds (2021-2026)</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Active Departments</div>
          <div className="kpi-value">{deptData.length}</div>
          <div className="kpi-change">Out of 33 total</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-label">Districts Tracked</div>
          <div className="kpi-value">{analytics.districts?.filter(d => d.name.toLowerCase() !== 'maharashtra').length || 0}</div>
          <div className="kpi-change">Exclusive of state-wide resolutions</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="charts-container">
        {/* Departmental Volume Bar Chart (Fixed label cut-off and adjusted margins) */}
        <div className="chart-card">
          <h3>GRs by Department (Top 10)</h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={deptData.slice(0, 10)} margin={{ top: 20, right: 20, left: 10, bottom: 90 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={100} 
                interval={0}
                style={{ fontSize: '10px', fontWeight: 'bold' }}
                tickFormatter={(name) => name.replace(/_Department/g, '').replace(/_/g, ' ')}
              />
              <YAxis />
              <Tooltip formatter={(value) => [`${value} Resolutions`, 'Count']} />
              <Bar dataKey="count" fill="#1a3a52" radius={[4, 4, 0, 0]}>
                {deptData.slice(0, 10).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Budget Allocation Pie Chart (Fixed overlapping text using a side Legend) */}
        <div className="chart-card">
          <h3>Budget Allocation by Department</h3>
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={budgetData.slice(0, 8)}
                cx="50%"
                cy="45%"
                labelLine={true}
                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                outerRadius={95}
                fill="#8884d8"
                dataKey="budget"
              >
                {budgetData.slice(0, 8).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `₹${(value / 10000000).toFixed(2)} Cr`} />
              <Legend 
                layout="horizontal" 
                align="center" 
                verticalAlign="bottom" 
                wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }}
                formatter={(value, entry) => {
                  const dept = entry.payload.payload.department || '';
                  return dept.replace(/_Department/g, '').replace(/_/g, ' ').substring(0, 16) + '...';
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Policy Evolution Timeline (Filtered to 2000-2026 range) */}
        <div className="chart-card full-width">
          <h3>GR Issuance Trend (2000-2026)</h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" style={{ fontWeight: 'bold' }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#ff9933"
                strokeWidth={3}
                dot={{ fill: '#ff9933', r: 5 }}
                activeDot={{ r: 8 }}
                name="Resolutions Count"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Top Districts (Excluding Maharashtra) */}
        <div className="chart-card">
          <h3>Top Districts by GR Count</h3>
          <div className="top-list">
            {districtData.length === 0 ? (
              <p style={{ color: '#777', fontStyle: 'italic' }}>No district-specific data found.</p>
            ) : (
              districtData.map((district, idx) => (
                <div key={idx} className="list-item">
                  <div className="list-rank">{idx + 1}</div>
                  <div className="list-name">{district.name.replace(/_/g, ' ')}</div>
                  <div className="list-value">{district.count.toLocaleString()} GRs</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Department Filter & Details */}
        <div className="chart-card">
          <h3>Department Deep Dive</h3>
          <div className="dept-selector">
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#1a3a52' }}>
              Select Department to Inspect
            </label>
            <select
              value={selectedDept || ''}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              {deptData.map(dept => (
                <option key={dept.name} value={dept.name}>
                  {dept.name.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {selectedDept && deptData.find(d => d.name === selectedDept) && (
            <div className="dept-details" style={{ marginTop: '16px' }}>
              {(() => {
                const dept = deptData.find(d => d.name === selectedDept);
                const budgetItem = budgetData.find(b => b.department === selectedDept);
                const deptBudget = budgetItem ? budgetItem.budget : 0;
                return (
                  <>
                    <div className="detail-row">
                      <span>Total Resolutions:</span>
                      <strong>{dept.count.toLocaleString()}</strong>
                    </div>
                    <div className="detail-row">
                      <span>Cumulative Budget:</span>
                      <strong>₹{(deptBudget / 10000000).toFixed(2)} Cr</strong>
                    </div>
                    <div className="detail-row">
                      <span>Average Budget per GR:</span>
                      <strong>₹{(dept.count > 0 ? (deptBudget / dept.count) / 100000 : 0).toFixed(2)} Lakh</strong>
                    </div>
                    <div className="detail-row">
                      <span>System Representation:</span>
                      <strong>{((dept.count / totalGRs) * 100).toFixed(2)}% of total</strong>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
