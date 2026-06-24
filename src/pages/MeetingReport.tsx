import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Printer, Download, Clock, Users, Star, Heart, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getRepository } from "../lib/data/repository";
import { MeetingReport as ReportData } from "../lib/types/database";
import missionControlLogo from "../assets/branding/mission-control-full.jpeg";

export const MeetingReport: React.FC = () => {
  const { classId, meetingId } = useParams<{ classId: string, meetingId: string }>();
  const [report, setReport] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!classId || !meetingId) return;
      try {
        setIsLoading(true);
        const repo = getRepository();
        const data = await repo.getMeetingReport(classId, meetingId);
        if (!data) {
          setError("Meeting report not found.");
        } else {
          setReport(data);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load meeting report.");
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [classId, meetingId]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!report) return;
    
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

    const rows = report.students.map(s => [
      report.meeting.class_name_snapshot,
      report.meeting.level_name_snapshot,
      report.meeting.meeting_number,
      new Date(report.meeting.started_at).toLocaleDateString(),
      s.student_name,
      s.final_rank || 'N/A',
      s.points_before,
      s.points_earned,
      s.points_deducted,
      s.net_points,
      s.points_after,
      s.starting_lives,
      s.lives_lost,
      s.lives_restored,
      s.final_lives,
      "Participated"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const safeClassName = report.meeting.class_name_snapshot.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.setAttribute("download", `${safeClassName}-meeting-${report.meeting.meeting_number}-report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  if (error || !report) {
    return (
      <div className="py-8 text-center">
        <div className="text-mission-danger mb-4">{error || "Report not found."}</div>
        <Link to={`/teacher/classes/${classId}/history`} className="text-radar-green hover:underline">
          Back to Meeting History
        </Link>
      </div>
    );
  }

  const { meeting, students } = report;
  const durationMins = meeting.ended_at 
    ? Math.round((new Date(meeting.ended_at).getTime() - new Date(meeting.started_at).getTime()) / 60000)
    : 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 py-8 print:py-0 print:space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link
              to={`/teacher/classes/${classId}/history`}
              className="text-mission-secondary-text hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white">
              Meeting Report
            </h1>
          </div>
          <p className="text-mission-secondary-text">
            {meeting.class_name_snapshot} • {meeting.level_name_snapshot}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportCsv}
            className="px-4 py-2 bg-mission-panel-elevated hover:bg-mission-bg border border-mission-border text-white rounded-xl transition-colors flex items-center gap-2"
          >
            <Download size={18} />
            Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-mission-panel-elevated hover:bg-mission-bg border border-mission-border text-white rounded-xl transition-colors flex items-center gap-2"
          >
            <Printer size={18} />
            Print Report
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
          <h2 className="text-xl text-gray-800 mb-1">{meeting.class_name_snapshot} • {meeting.level_name_snapshot}</h2>
          <div className="text-sm text-gray-600">
            Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-mission-panel border border-mission-border rounded-2xl p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Clock size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Duration</span>
          </div>
          <div className="text-2xl font-bold text-white print:text-black">
            {durationMins} <span className="text-sm font-normal text-mission-muted-text print:text-gray-500">mins</span>
          </div>
          <div className="text-xs text-mission-muted-text mt-1 print:text-gray-500">
            {new Date(meeting.started_at).toLocaleDateString()}
          </div>
        </div>

        <div className="bg-mission-panel border border-mission-border rounded-2xl p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Users size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Students</span>
          </div>
          <div className="text-2xl font-bold text-white print:text-black">
            {meeting.participant_count}
          </div>
          <div className="text-xs text-mission-muted-text mt-1 print:text-gray-500">
            Participated
          </div>
        </div>

        <div className="bg-mission-panel border border-mission-border rounded-2xl p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Star size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Net Points</span>
          </div>
          <div className={`text-2xl font-bold ${meeting.net_points > 0 ? 'text-radar-green print:text-green-700' : meeting.net_points < 0 ? 'text-mission-danger print:text-red-700' : 'text-white print:text-black'}`}>
            {meeting.net_points > 0 ? '+' : ''}{meeting.net_points}
          </div>
          <div className="text-xs text-mission-muted-text mt-1 flex gap-2 print:text-gray-500">
            <span className="text-radar-green print:text-green-600">+{meeting.points_awarded}</span>
            <span className="text-mission-danger print:text-red-600">-{meeting.points_deducted}</span>
          </div>
        </div>

        <div className="bg-mission-panel border border-mission-border rounded-2xl p-5 print:border-gray-300 print:bg-white print:text-black">
          <div className="flex items-center gap-2 text-mission-secondary-text mb-2 print:text-gray-600">
            <Heart size={16} />
            <span className="text-sm font-semibold uppercase tracking-wider">Lives Lost</span>
          </div>
          <div className="text-2xl font-bold text-mission-danger print:text-red-700">
            {meeting.lives_lost}
          </div>
          <div className="text-xs text-mission-muted-text mt-1 print:text-gray-500">
            Max lives: {meeting.max_lives_snapshot}
          </div>
        </div>
      </div>

      {/* Student Results */}
      <div className="bg-mission-panel rounded-2xl border border-mission-border overflow-hidden print:border-gray-300 print:bg-white">
        <div className="p-5 border-b border-mission-border bg-mission-bg-secondary print:bg-gray-100 print:border-gray-300">
          <h2 className="text-lg font-bold text-white print:text-black">Student Results</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm print:text-black">
            <thead className="bg-mission-bg-secondary text-mission-secondary-text text-xs uppercase tracking-wider print:bg-gray-50 print:text-gray-600">
              <tr>
                <th className="px-6 py-4 font-semibold">Rank</th>
                <th className="px-6 py-4 font-semibold">Student</th>
                <th className="px-6 py-4 font-semibold text-right">Points Before</th>
                <th className="px-6 py-4 font-semibold text-right">Net Change</th>
                <th className="px-6 py-4 font-semibold text-right text-radar-green">Points After</th>
                <th className="px-6 py-4 font-semibold text-right">Starting Lives</th>
                <th className="px-6 py-4 font-semibold text-right text-mission-danger">Final Lives</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mission-border print:divide-gray-200">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-mission-muted-text print:text-gray-500">
                    No students participated in this meeting.
                  </td>
                </tr>
              ) : (
                students.map((student) => (
                  <tr key={student.student_id} className="hover:bg-mission-panel-elevated transition-colors print:hover:bg-transparent">
                    <td className="px-6 py-4 font-bold text-mission-primary-text print:text-black">
                      {student.final_rank ? `#${student.final_rank}` : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-white print:text-black">{student.student_name}</div>
                      <div className="text-xs text-mission-muted-text print:text-gray-500">Participated</div>
                    </td>
                    <td className="px-6 py-4 text-right text-mission-secondary-text print:text-gray-600">
                      {student.points_before}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`font-bold flex items-center justify-end gap-1 ${
                        student.net_points > 0 ? 'text-radar-green print:text-green-700' : 
                        student.net_points < 0 ? 'text-mission-danger print:text-red-700' : 
                        'text-mission-muted-text print:text-gray-500'
                      }`}>
                        {student.net_points > 0 && <TrendingUp size={14} />}
                        {student.net_points < 0 && <TrendingDown size={14} />}
                        {student.net_points === 0 && <Minus size={14} />}
                        {student.net_points > 0 ? '+' : ''}{student.net_points}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-radar-green print:text-blue-700">
                      {student.points_after}
                    </td>
                    <td className="px-6 py-4 text-right text-mission-secondary-text print:text-gray-600">
                      {student.starting_lives}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-white print:text-black">
                      <div className="flex items-center justify-end gap-1">
                        {student.final_lives}
                        <Heart size={14} className={student.final_lives > 0 ? 'text-mission-danger' : 'text-mission-muted-text'} />
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
