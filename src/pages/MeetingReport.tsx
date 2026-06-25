import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, Download, Clock, Users, Star, Heart, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { MeetingReport as ReportData } from "../lib/types/database";
import missionControlLogo from "../assets/branding/mission-control-full.jpeg";
import { PageHeader, Panel, Button, EmptyState, LoadingSkeleton, StatCard } from "../components/ui";

export const MeetingReport: React.FC = () => {
  const { classId, meetingId } = useParams<{ classId: string, meetingId: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!classId || !meetingId) return;
    setIsLoading(true);
    setError(null);
    try {
      const repo = getRepository();
      const data = await repo.getMeetingReport(classId, meetingId);
      if (!data || !data.meeting) {
        setError("Meeting report not found.");
        setReport(null);
      } else {
        setReport(data);
      }
    } catch (err) {
      console.error(err);
      setError("Failed to load meeting report. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [classId, meetingId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!report || !report.meeting) return;
    
    const headers = [
      "Class Name",
      "Class Level",
      "Meeting Number",
      "Meeting Date",
      "Student Name",
      "Final Rank",
      "Points Before",
      "Points Earned",
      "Points Deducted",
      "Net Point Change",
      "Points After",
      "Starting Lives",
      "Lives Lost",
      "Lives Restored",
      "Final Lives",
      "Participation Status"
    ];

    const rows = (report.students || []).map(s => [
      report.meeting.class_name_snapshot || 'Unknown Class',
      report.meeting.level_name_snapshot || '',
      report.meeting.meeting_number || '',
      report.meeting.started_at ? new Date(report.meeting.started_at).toLocaleDateString() : 'Unknown Date',
      s.student_name || 'Unknown Student',
      s.final_rank || 'Not recorded',
      s.points_before ?? 'Not recorded',
      s.points_earned ?? 0,
      s.points_deducted ?? 0,
      s.net_points ?? 0,
      s.points_after ?? 'Not recorded',
      s.starting_lives ?? 'Not recorded',
      s.lives_lost ?? 0,
      s.lives_restored ?? 0,
      s.final_lives ?? 'Not recorded',
      "Participated"
    ]);

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(escapeCsv).join(","))
    ].join("\n");

    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeClassName = (report.meeting.class_name_snapshot || 'class').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.setAttribute("download", `${safeClassName}-meeting-${report.meeting.meeting_number || 'report'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500 py-6">
        <LoadingSkeleton />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <LoadingSkeleton key={i} />)}
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !report || !report.meeting) {
    return (
      <div className="max-w-6xl mx-auto py-12">
        <EmptyState
          icon={AlertTriangle}
          title="Report Unavailable"
          description={error || "The report you are looking for could not be found."}
          action={{
            label: "Retry",
            onClick: loadData
          }}
          className="border-mission-danger/20 bg-mission-danger/5"
        />
        <div className="mt-8 flex justify-center">
          <Link to={`/teacher/classes/${classId}/history`}>
            <Button variant="ghost"><ArrowLeft size={16} className="mr-2" /> Back to History</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { meeting, students } = report;
  const isInvalidDate = (dStr: string | null) => !dStr || isNaN(new Date(dStr).getTime());

  const durationMins = (!isInvalidDate(meeting.ended_at) && !isInvalidDate(meeting.started_at))
    ? Math.round((new Date(meeting.ended_at!).getTime() - new Date(meeting.started_at!).getTime()) / 60000)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 py-6 px-4 sm:px-0 print:py-0 print:space-y-6 print:max-w-none">
      
      <div className="print:hidden">
        <Link
          to={`/teacher/classes/${classId}/history`}
          className="inline-flex items-center gap-2 text-sm text-mission-secondary-text hover:text-white transition-colors mb-2 font-medium"
        >
          <ArrowLeft size={16} />
          Back to History
        </Link>
        <PageHeader
          eyebrow="COMPLETED SESSION"
          title={`Meeting #${meeting.meeting_number || 'Report'}`}
          subtitle={`${meeting.class_name_snapshot || 'Unknown Class'} ${meeting.level_name_snapshot ? `• ${meeting.level_name_snapshot}` : ''}`}
          actions={
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={handleExportCsv}
                className="w-full sm:w-auto"
              >
                <Download size={16} className="mr-2" />
                Export CSV
              </Button>
              <Button
                variant="secondary"
                onClick={handlePrint}
                className="w-full sm:w-auto"
              >
                <Printer size={16} className="mr-2" />
                Print
              </Button>
            </div>
          }
        />
      </div>

      {/* Print Header */}
      <div className="hidden print:flex mb-8 items-center gap-4 border-b border-gray-300 pb-4">
        <div className="w-16 h-16 shrink-0 bg-white">
          <img src={missionControlLogo} alt="Mission Control" className="w-full h-full object-contain grayscale" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-black mb-1 uppercase">Mission Control</h1>
          <p className="text-sm font-semibold text-gray-500 mb-2 uppercase tracking-wider">By GYTama EDU</p>
          <h2 className="text-xl text-gray-800 mb-1">{meeting.class_name_snapshot} {meeting.level_name_snapshot && `• ${meeting.level_name_snapshot}`}</h2>
          <div className="text-sm text-gray-600">
            Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <StatCard
          title="Duration"
          value={durationMins !== null ? durationMins : '—'}
          icon={Clock}
          trend={!isInvalidDate(meeting.started_at) ? new Date(meeting.started_at!).toLocaleDateString() : 'Unknown Date'}
          accentColor="border-cyan-400/30"
          iconColor="text-cyan-400"
          bgColor="bg-cyan-400/10"
          className="print:border-gray-300 print:bg-white print:text-black"
        />
        <StatCard
          title="Participants"
          value={meeting.participant_count || 0}
          icon={Users}
          trend="Students"
          accentColor="border-blue-400/30"
          iconColor="text-blue-400"
          bgColor="bg-blue-400/10"
          className="print:border-gray-300 print:bg-white print:text-black"
        />
        <StatCard
          title="Net Points"
          value={
            <div className="flex items-center gap-1">
              {(meeting.net_points || 0) > 0 ? '+' : ''}{meeting.net_points || 0}
            </div>
          }
          icon={Star}
          valueColor={(meeting.net_points || 0) > 0 ? "success" : (meeting.net_points || 0) < 0 ? "danger" : "default"}
          trend={`+${meeting.points_awarded || 0} / -${meeting.points_deducted || 0}`}
          accentColor="border-radar-green/30"
          iconColor="text-radar-green"
          bgColor="bg-radar-green/10"
          className="print:border-gray-300 print:bg-white print:text-black"
        />
        <StatCard
          title="Lives Lost"
          value={meeting.lives_lost || 0}
          icon={Heart}
          valueColor="danger"
          trend={`Max: ${meeting.max_lives_snapshot ?? '—'}`}
          accentColor="border-mission-danger/30"
          iconColor="text-mission-danger"
          bgColor="bg-mission-danger/10"
          className="print:border-gray-300 print:bg-white print:text-black"
        />
      </div>

      {/* Student Results Table */}
      <Panel className="p-0 border-mission-border/50 overflow-hidden print:border-gray-300 print:bg-white">
        <div className="p-4 sm:p-5 border-b border-mission-border/50 bg-mission-panel-strong print:bg-gray-100 print:border-gray-300">
          <h2 className="text-lg font-display font-bold text-white print:text-black">Student Results</h2>
        </div>
        
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto hide-scrollbar">
          <table className="w-full text-left text-sm print:text-black">
            <thead className="bg-mission-bg-secondary text-mission-secondary-text text-xs uppercase tracking-wider print:bg-gray-50 print:text-gray-600 sticky top-0 z-10 shadow-sm border-b border-mission-border/50">
              <tr>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Rank</th>
                <th className="px-6 py-4 font-semibold whitespace-nowrap">Student</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Before</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap text-radar-green">Earned</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap text-mission-danger">Lost</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Net Change</th>
                <th className="px-6 py-4 font-semibold text-right text-radar-green whitespace-nowrap">After</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap">Start Lives</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap text-mission-danger">Lives Lost</th>
                <th className="px-6 py-4 font-semibold text-right whitespace-nowrap text-cyan-400">Lives Restored</th>
                <th className="px-6 py-4 font-semibold text-right text-white whitespace-nowrap print:text-black">Final Lives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mission-border/50 print:divide-gray-200">
              {(!students || students.length === 0) ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-mission-muted-text print:text-gray-500">
                    No students participated in this meeting.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.student_id} className="hover:bg-mission-panel-elevated/30 transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-4 font-mono font-bold text-mission-secondary-text print:text-black whitespace-nowrap">
                      {student.final_rank ? `#${student.final_rank}` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-white print:text-black">{student.student_name || 'Unknown Student'}</div>
                    </td>
                    <td className="px-6 py-4 text-right text-mission-secondary-text print:text-gray-600 font-mono">
                      {student.points_before ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-radar-green font-mono">
                      {student.points_earned ? `+${student.points_earned}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-mission-danger font-mono">
                      {student.points_deducted ? `-${student.points_deducted}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className={`font-mono font-bold flex items-center justify-end gap-1 ${
                        (student.net_points || 0) > 0 ? 'text-radar-green print:text-green-700' : 
                        (student.net_points || 0) < 0 ? 'text-mission-danger print:text-red-700' : 
                        'text-mission-muted-text print:text-gray-500'
                      }`}>
                        {(student.net_points || 0) > 0 ? '+' : ''}{student.net_points || 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold font-mono text-radar-green print:text-blue-700 whitespace-nowrap">
                      {student.points_after ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-mission-secondary-text print:text-gray-600 font-mono">
                      {student.starting_lives ?? '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-mission-danger font-mono">
                      {student.lives_lost ? `-${student.lives_lost}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right text-cyan-400 font-mono">
                      {student.lives_restored ? `+${student.lives_restored}` : '—'}
                    </td>
                    <td className="px-6 py-4 text-right font-bold font-mono text-white print:text-black whitespace-nowrap">
                      {student.final_lives ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-mission-border/50">
           {(!students || students.length === 0) ? (
             <div className="px-6 py-12 text-center text-mission-muted-text">
                No students participated in this meeting.
             </div>
           ) : (
             students.map((student) => (
               <div key={student.student_id} className="p-4 space-y-4">
                 <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                       <span className="font-mono text-mission-muted-text text-xs">
                         {student.final_rank ? `#${student.final_rank}` : ''}
                       </span>
                       <span className="font-bold text-white">{student.student_name || 'Unknown Student'}</span>
                    </div>
                    <div className={`font-mono font-bold text-sm ${
                        (student.net_points || 0) > 0 ? 'text-radar-green' : 
                        (student.net_points || 0) < 0 ? 'text-mission-danger' : 
                        'text-mission-muted-text'
                      }`}>
                        {(student.net_points || 0) > 0 ? '+' : ''}{student.net_points || 0} pts
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4 text-sm bg-mission-bg-secondary rounded-lg p-3 border border-mission-border/30">
                    <div>
                       <div className="text-mission-secondary-text text-[10px] uppercase mb-1">Points (Before → After)</div>
                       <div className="font-mono text-white">
                         <span className="text-mission-muted-text">{student.points_before ?? '—'}</span>
                         <span className="mx-1 text-mission-muted-text">→</span>
                         <span className="text-radar-green font-bold">{student.points_after ?? '—'}</span>
                       </div>
                    </div>
                    <div>
                       <div className="text-mission-secondary-text text-[10px] uppercase mb-1">Lives (Start → Final)</div>
                       <div className="font-mono text-white">
                         <span className="text-mission-muted-text">{student.starting_lives ?? '—'}</span>
                         <span className="mx-1 text-mission-muted-text">→</span>
                         <span className={student.final_lives === 0 ? "text-mission-danger font-bold" : "text-white font-bold"}>{student.final_lives ?? '—'}</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="flex flex-wrap gap-2 text-xs font-mono">
                    {student.lives_lost ? <span className="px-2 py-1 bg-mission-danger/10 text-mission-danger rounded border border-mission-danger/20">-{student.lives_lost} Lives</span> : null}
                    {student.lives_restored ? <span className="px-2 py-1 bg-cyan-400/10 text-cyan-400 rounded border border-cyan-400/20">+{student.lives_restored} Lives</span> : null}
                    {student.points_earned ? <span className="px-2 py-1 bg-radar-green/10 text-radar-green rounded border border-radar-green/20">+{student.points_earned} Pts</span> : null}
                    {student.points_deducted ? <span className="px-2 py-1 bg-mission-danger/10 text-mission-danger rounded border border-mission-danger/20">-{student.points_deducted} Pts</span> : null}
                 </div>
               </div>
             ))
           )}
        </div>
      </Panel>
    </div>
  );
};

