import { useState, useEffect } from 'react';
import { BarChart3, Activity, Users, DollarSign, TrendingUp, Clock, Layers, Database } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import { useAnalyticsDashboard } from '@/hooks/useContracts';

const txData = [
  { name: 'T1', tx: 120, users: 45 },
  { name: 'T2', tx: 180, users: 62 },
  { name: 'T3', tx: 250, users: 78 },
  { name: 'T4', tx: 310, users: 95 },
  { name: 'T5', tx: 280, users: 88 },
  { name: 'T6', tx: 420, users: 120 },
  { name: 'T7', tx: 380, users: 110 },
  { name: 'T8', tx: 510, users: 145 },
  { name: 'T9', tx: 460, users: 132 },
  { name: 'T10', tx: 580, users: 160 },
  { name: 'T11', tx: 620, users: 175 },
  { name: 'T12', tx: 700, users: 200 },
];

const moduleData = [
  { name: 'Token', value: 2500 },
  { name: 'Credentials', value: 1800 },
  { name: 'Payments', value: 1200 },
  { name: 'Governance', value: 800 },
  { name: 'Jobs', value: 600 },
  { name: 'Others', value: 1100 },
];

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

const gasData = [
  { name: 'Mon', avg: 25, max: 45 },
  { name: 'Tue', avg: 30, max: 52 },
  { name: 'Wed', avg: 22, max: 38 },
  { name: 'Thu', avg: 35, max: 60 },
  { name: 'Fri', avg: 28, max: 48 },
  { name: 'Sat', avg: 18, max: 30 },
  { name: 'Sun', avg: 15, max: 25 },
];

export default function AnalyticsPage() {
  const analytics = useAnalyticsDashboard();

  return (
    <div>
      <PageHeader title="Phân tích" description="Thống kê hệ thống, biểu đồ và metrics on-chain" lucideIcon={BarChart3} badge="Analytics" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Tổng giao dịch" value="8,000" icon={<Activity className="w-5 h-5" />} color="brand" change="12.5" trend="up" />
        <StatCard label="Người dùng" value="200" icon={<Users className="w-5 h-5" />} color="success" change="8.3" trend="up" />
        <StatCard label="Volume (VNDC)" value="1.2M" icon={<DollarSign className="w-5 h-5" />} color="warning" change="15.2" trend="up" />
        <StatCard label="Contracts" value="18" icon={<Layers className="w-5 h-5" />} color="info" />
      </div>

      <Tabs tabs={[
        { id: 'overview', label: 'Tổng quan', icon: <BarChart3 size={14} /> },
        { id: 'modules', label: 'Modules', icon: <Layers size={14} /> },
        { id: 'gas', label: 'Gas Usage', icon: <Activity size={14} /> },
      ]}>
        {(active) => active === 'overview' ? (
          <div className="space-y-6">
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">Giao dịch & Người dùng theo tháng</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={txData}>
                    <defs>
                      <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="userGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }} />
                    <Area type="monotone" dataKey="tx" stroke="#6366f1" fill="url(#txGrad)" strokeWidth={2} name="Giao dịch" />
                    <Area type="monotone" dataKey="users" stroke="#10b981" fill="url(#userGrad)" strokeWidth={2} name="Người dùng" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Avg. Block Time', value: '2.1s', icon: Clock },
                { label: 'Total Volume', value: '1,245,000 VNDC', icon: DollarSign },
                { label: 'Success Rate', value: '99.2%', icon: TrendingUp },
              ].map(m => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="card text-center">
                    <Icon size={20} className="text-brand-400 mx-auto mb-2" />
                    <p className="text-xl font-bold text-white">{m.value}</p>
                    <p className="text-xs text-surface-400">{m.label}</p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : active === 'modules' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">Giao dịch theo Module</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={moduleData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value">
                      {moduleData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-3 justify-center mt-2">
                {moduleData.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-surface-400">{m.name}: {m.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">Module Performance</h3>
              <div className="space-y-3">
                {moduleData.map((m, i) => (
                  <div key={m.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-surface-400">{m.name}</span>
                      <span className="text-white font-medium">{m.value} tx</span>
                    </div>
                    <div className="h-2 bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${(m.value / 2500) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card">
            <h3 className="text-base font-semibold text-white mb-4">Gas Usage (7 ngày)</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={gasData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px', color: '#fff' }} />
                  <Bar dataKey="avg" fill="#6366f1" radius={[4, 4, 0, 0]} name="Avg Gas (gwei)" />
                  <Bar dataKey="max" fill="#6366f130" radius={[4, 4, 0, 0]} name="Max Gas (gwei)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="p-3 rounded-xl bg-surface-800/30 text-center">
                <p className="text-lg font-bold text-white">24.7</p>
                <p className="text-xs text-surface-400">Avg Gas (gwei)</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-800/30 text-center">
                <p className="text-lg font-bold text-white">60</p>
                <p className="text-xs text-surface-400">Peak Gas (gwei)</p>
              </div>
              <div className="p-3 rounded-xl bg-surface-800/30 text-center">
                <p className="text-lg font-bold text-white">$12.50</p>
                <p className="text-xs text-surface-400">Total Gas Cost</p>
              </div>
            </div>
          </div>
        )}
      </Tabs>
    </div>
  );
}
