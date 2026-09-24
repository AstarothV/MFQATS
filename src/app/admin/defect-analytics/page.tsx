'use client';

import React, { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { AlertTriangle, Loader2, BarChart3, TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import StatusBadge from '@/components/ui/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,  } from 'recharts';
import Icon from '@/components/ui/AppIcon';


interface DefectStat {
  defect_type: string;
  count: number;
  avg_confidence: number;
}

interface StageStat {
  stage_name: string;
  count: number;
}

const COLORS = ['#7C3AED', '#EF4444', '#F59E0B', '#22C55E', '#38BDF8', '#EC4899', '#14B8A6', '#F97316'];

export default function AdminDefectAnalyticsPage() {
  const supabase = createClient();
  const [defects, setDefects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [defectStats, setDefectStats] = useState<DefectStat[]>([]);
  const [stageStats, setStageStats] = useState<StageStat[]>([]);
  const [totalDefects, setTotalDefects] = useState(0);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [avgConfidence, setAvgConfidence] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('defects')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDefects(data);
        setTotalDefects(data.length);
        setResolvedCount(data.filter((d) => d.is_resolved).length);
        setCriticalCount(data.filter((d) => d.severity === 'critical' || d.severity === 'high').length);
        const avgConf = data.length > 0 ? data.reduce((s, d) => s + (d.confidence_score || 0), 0) / data.length : 0;
        setAvgConfidence(Math.round(avgConf * 10) / 10);

        // Aggregate by defect type
        const typeMap: Record<string, { count: number; totalConf: number }> = {};
        data.forEach((d) => {
          if (!typeMap[d.defect_type]) typeMap[d.defect_type] = { count: 0, totalConf: 0 };
          typeMap[d.defect_type].count++;
          typeMap[d.defect_type].totalConf += d.confidence_score || 0;
        });
        setDefectStats(
          Object.entries(typeMap)
            .map(([type, stats]) => ({
              defect_type: type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              count: stats.count,
              avg_confidence: Math.round((stats.totalConf / stats.count) * 10) / 10,
            }))
            .sort((a, b) => b.count - a.count)
        );

        // Aggregate by stage
        const stageMap: Record<string, number> = {};
        data.forEach((d) => {
          if (d.stage_name) {
            stageMap[d.stage_name] = (stageMap[d.stage_name] || 0) + 1;
          }
        });
        setStageStats(
          Object.entries(stageMap).map(([stage, count]) => ({
            stage_name: stage.charAt(0).toUpperCase() + stage.slice(1),
            count,
          }))
        );
      }
      setLoading(false);
    };
    fetchData();
  }, [supabase]);

  return (
    <AppLayout role="admin" currentPath="/admin/defect-analytics">
      <div className="space-y-6">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-[0.3em] mb-2">Quality Intelligence</p>
          <h1 className="text-3xl font-bold text-foreground">Defect Analytics</h1>
          <p className="text-sm text-muted-foreground mt-2">AI-powered defect frequency analysis, confidence scores, and quality trends.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Defects', value: totalDefects, color: 'text-danger', icon: AlertTriangle },
                { label: 'Resolved', value: resolvedCount, color: 'text-success', icon: BarChart3 },
                { label: 'High/Critical', value: criticalCount, color: 'text-warning', icon: TrendingUp },
                { label: 'Avg Confidence', value: `${avgConfidence}%`, color: 'text-accent', icon: BarChart3 },
              ].map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div key={kpi.label} className="card-dark p-5 rounded-3xl border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <Icon size={18} className={kpi.color} />
                      <span className="text-xs text-muted-foreground">{kpi.label}</span>
                    </div>
                    <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Defect Frequency Chart */}
              <div className="card-dark rounded-3xl border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Defect Frequency by Type</h3>
                {defectStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No defect data available</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={defectStats} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="defect_type" tick={{ fill: '#A3A3A3', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#A3A3A3', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#1F1F1F', borderColor: '#383838' }} labelStyle={{ color: '#F5F5F5' }} />
                        <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Defects by Stage */}
              <div className="card-dark rounded-3xl border border-border p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Defects by Production Stage</h3>
                {stageStats.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No stage data available</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stageStats} dataKey="count" nameKey="stage_name" innerRadius={50} outerRadius={90} paddingAngle={4} stroke="transparent">
                          {stageStats.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: '#1F1F1F', borderColor: '#383838' }} />
                        <Legend formatter={(v) => <span className="text-xs text-muted-foreground">{v}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Defects Table */}
            <div className="card-dark rounded-3xl border border-border p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Recent Defects</h3>
              {defects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No defects recorded</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Stage</th>
                        <th className="px-4 py-3">Severity</th>
                        <th className="px-4 py-3">Confidence</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {defects.slice(0, 20).map((d) => (
                        <tr key={d.id} className="hover:bg-muted/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-foreground capitalize">{d.defect_type?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 text-muted-foreground capitalize">{d.stage_name?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3">
                            <StatusBadge
                              variant={d.severity === 'critical' || d.severity === 'high' ? 'danger' : d.severity === 'medium' ? 'warning' : 'info'}
                              label={d.severity?.charAt(0).toUpperCase() + d.severity?.slice(1)}
                            />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{d.confidence_score ? `${d.confidence_score}%` : '—'}</td>
                          <td className="px-4 py-3">
                            <StatusBadge variant={d.is_resolved ? 'ok' : 'warning'} label={d.is_resolved ? 'Resolved' : 'Open'} />
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">
                            {new Date(d.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
