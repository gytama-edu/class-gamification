import React, { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, Download, Clock, Users, Star, Heart, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { MeetingReport as ReportData } from "../lib/types/database";
import missionControlLogo from "../assets/branding/mission-control-full.jpeg";

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
      <div className="space-y-8 animate-pulse py-8">
        <div className="h-10 bg-mission-bg-secondary border border-mission-border rounded w-1/3 mb-4"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-mission-bg-secondary border border-mission-border rounded-2xl"></div>)}
        </div>
        <div className="h-64 bg-mission-bg-secondary border border-mission-border rounded-2xl w-full"></div>
      </div>
    );
  }

  if (error || !report || !report.meeting) {
    return (
      <div className="py-12 px-4 max-w-lg mx-auto text-center space-y-6">
        <div className="w-16 h-16 bg-mission-danger/10 text-mission-danger rounded-full flex items-center justify-center mx-auto mb-4 border border-mission-danger/20">
          <AlertTriangle size={32} />
        </div>
        <h2 className="text-xl font-bold text-white">Report Unavailable</h2>
        <p className="text-mission-secondary-text">{error || "The report you are looking for could not be found."}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-6 py-2 bg-mission-panel hover:bg-mission-panel-elevated border border-mission-border rounded-lg text-white font-medium transition-colors"
          >
            <RefreshCw size={18} />
            Retry
          </button>
          <Link to={`/teacher/classes/${classId}/history`} className="text-radar-green hover:underline font-medium">
            Back to Meeting History
          </Link>
        </div>
      </div>
    );
  }

  const { meeting, students } = report;
  const durationMins = (meeting.ended_at && meeting.started_at)
    ? Math.round((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 60000)
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8 px-4 sm:px-0 print:py-0 print:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/teacher/classes/${classId}/history`}
              className="text-mission-secondary-text hover:text-white transition-colors p-1"
              title="Back to Meeting History"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white truncate">
              Meeting Report
            </h1>
          </div>
          <p className="text-mission-secondary-text pl-9">
            {meeting.class_name_snapshot || 'Unknown Class'} {meeting.level_name_snapshot && `• ${meeting.level_name_snapshot}`}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportCsv}
            className="flex-1 sm:flex-none px-4 py-2 bg-mission-panel-elevated hover:bg-mission-bg border border-mission-border text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 sm:flex-none px-4 py-2 bg-mission-panel-elevated hover:bg-mission-bg border border-mission-border text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Printer size={18} />
            Print
          </button>
        </div>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-mission-panel border border-mission-border rounded-2xl p-4 sm:p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Clock size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Duration</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white print:text-black">
            {durationMins} <span className="text-sm font-normal text-mission-muted-text print:text-gray-500">mins</span>
          </div>
          <div className="text-xs text-mission-muted-text mt-1 print:text-gray-500">
            {meeting.started_at ? new Date(meeting.started_at).toLocaleDateString() : 'Unknown'}
          </div>
        </div>

        <div className="bg-mission-panel border border-mission-border rounded-2xl p-4 sm:p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Users size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Students</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-white print:text-black">
            {meeting.participant_count || 0}
          </div>
          <div className="text-xs text-mission-muted-text mt-1 print:text-gray-500">
            Participated
          </div>
        </div>

        <div className="bg-mission-panel border border-mission-border rounded-2xl p-4 sm:p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Star size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Net Points</span>
          </div>
          <div className={`text-xl sm:text-2xl font-bold ${(meeting.net_points || 0) > 0 ? 'text-radar-green print:text-green-700' : (meeting.net_points || 0) < 0 ? 'text-mission-danger print:text-red-700' : 'text-white print:text-black'}`}>
            {(meeting.net_points || 0) > 0 ? '+' : ''}{meeting.net_points || 0}
          </div>
          <div className="text-xs text-mission-muted-text mt-1 flex flex-wrap gap-2 print:text-gray-500">
            <span className="text-radar-green print:text-green-600">+{meeting.points_awarded || 0}</span>
            <span className="text-mission-danger print:text-red-600">-{meeting.points_deducted || 0}</span>
          </div>
        </div>

        <div className="bg-mission-panel border border-mission-border rounded-2xl p-4 sm:p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Heart size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Lives Lost</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-mission-danger print:text-red-700">
            {meeting.lives_lost || 0}
          </div>
          <div className="text-xs text-mission-muted-text mt-1 print:text-gray-500 truncate">
            Max: {meeting.max_lives_snapshot ?? 'N/A'}
          </div>
        </div>
      </div>

      {/* Student Results */}
      <div className="bg-mission-panel rounded-2xl border border-mission-border overflow-hidden print:border-gray-300 print:bg-white">
        <div className="p-4 sm:p-5 border-b border-mission-border bg-mission-bg-secondary print:bg-gray-100 print:border-gray-300">
          <h2 className="text-lg font-bold text-white print:text-black">Student Results</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm print:text-black">
            <thead className="bg-mission-bg-secondary text-mission-secondary-text text-xs uppercase tracking-wider print:bg-gray-50 print:text-gray-600">
              <tr>
                <th className="px-4 sm:px-6 py-4 font-semibold whitespace-nowrap">Rank</th>
                <th className="px-4 sm:px-6 py-4 font-semibold whitespace-nowrap">Student</th>
                <th className="px-4 sm:px-6 py-4 font-semibold text-right whitespace-nowrap">Before</th>
                <th className="px-4 sm:px-6 py-4 font-semibold text-right whitespace-nowrap">Net Change</th>
                <th className="px-4 sm:px-6 py-4 font-semibold text-right text-radar-green whitespace-nowrap">After</th>
                <th className="px-4 sm:px-6 py-4 font-semibold text-right whitespace-nowrap">Start Lives</th>
                <th className="px-4 sm:px-6 py-4 font-semibold text-right text-mission-danger whitespace-nowrap">Final Lives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mission-border print:divide-gray-200">
              {(!students || students.length === 0) ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-mission-muted-text print:text-gray-500">
                    No students participated in this meeting.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.student_id} className="hover:bg-mission-panel-elevated transition-colors print:hover:bg-transparent">
                    <td className="px-4 sm:px-6 py-4 font-bold text-mission-primary-text print:text-black whitespace-nowrap">
                      {student.final_rank ? `#${student.final_rank}` : <span className="text-mission-muted-text">N/A</span>}
                    </td>
                    <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-white print:text-black">{student.student_name || 'Unknown Student'}</div>
                      <div className="text-xs text-mission-muted-text print:text-gray-500">Participated</div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right text-mission-secondary-text print:text-gray-600 whitespace-nowrap">
                      {student.points_before ?? '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right whitespace-nowrap">
                      <div className={`font-bold flex items-center justify-end gap-1 ${
                        (student.net_points || 0) > 0 ? 'text-radar-green print:text-green-700' : 
                        (student.net_points || 0) < 0 ? 'text-mission-danger print:text-red-700' : 
                        'text-mission-muted-text print:text-gray-500'
                      }`}>
                        {(student.net_points || 0) > 0 && <TrendingUp size={14} />}
                        {(student.net_points || 0) < 0 && <TrendingDown size={14} />}
                        {(student.net_points || 0) === 0 && <Minus size={14} />}
                        {(student.net_points || 0) > 0 ? '+' : ''}{student.net_points || 0}
                      </div>
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-bold text-radar-green print:text-blue-700 whitespace-nowrap">
                      {student.points_after ?? '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right text-mission-secondary-text print:text-gray-600 whitespace-nowrap">
                      {student.starting_lives ?? '-'}
                    </td>
                    <td className="px-4 sm:px-6 py-4 text-right font-bold text-white print:text-black whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        {student.final_lives ?? '-'}
                        {student.final_lives !== null && student.final_lives !== undefined && (
                          <Heart size={14} className={student.final_lives > 0 ? 'text-mission-danger' : 'text-mission-muted-text'} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
