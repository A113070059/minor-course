/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { UserProfile, Department, Course } from "../types";
import { DEPARTMENTS } from "../data";
import { User, ShieldAlert, BadgeCheck, Download, Upload, RefreshCw, Smartphone, Copy, CheckCircle } from "lucide-react";
import { parseShuStudentId } from "./SchoolLogin";

interface AccountProfileProps {
  userProfile: UserProfile;
  activeMinor: Department;
  activeMajor: Department;
  simulatedCourses: Course[];
  completedCourses: Course[];
  onUpdateProfile: (newProfile: UserProfile) => void;
  onResetAll: () => void;
  onLogout?: () => void;
}

export default function AccountProfile({
  userProfile,
  activeMinor,
  activeMajor,
  simulatedCourses,
  completedCourses,
  onUpdateProfile,
  onResetAll,
  onLogout,
}: AccountProfileProps) {
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState(userProfile.name);
  const [studentId, setStudentId] = useState(userProfile.studentId);
  const [classGrade, setClassGrade] = useState(userProfile.classGrade || "二年級");
  const [classGroup, setClassGroup] = useState(userProfile.classGroup || "甲");
  const [isEditing, setIsEditing] = useState(false);

  // Switch Major
  const handleMajorChange = (newMajorId: string) => {
    const updatedMinor = userProfile.minorDeptId === newMajorId ? "none" : userProfile.minorDeptId;
    onUpdateProfile({
      ...userProfile,
      majorDeptId: newMajorId,
      minorDeptId: updatedMinor,
      simulatedCourseIds: updatedMinor === "none" ? [] : userProfile.simulatedCourseIds,
    });
  };

  // Switch Minor
  const handleMinorChange = (newMinorId: string) => {
    if (newMinorId === userProfile.majorDeptId) return; // Prevent same department
    onUpdateProfile({
      ...userProfile,
      minorDeptId: newMinorId,
      // Clear simulations to prevent cross-dept conflicts
      simulatedCourseIds: [],
    });
  };

  const handleSaveInfo = () => {
    onUpdateProfile({
      ...userProfile,
      name: username,
      studentId,
      classGrade,
      classGroup,
    });
    setIsEditing(false);
  };

  // Generate an elegant, human-readable ASCII / Text academic report for exporting of timetable & credits requirements
  const handleExportTextReport = () => {
    const timeDivider = "==================================================";
    const report = `
🎓 【大學輔系智慧選課與學分平衡報告】
${timeDivider}
👤 學生姓名: ${userProfile.name}
🔢 學生學號: ${userProfile.studentId}
🏫 班級組別: ${userProfile.classGrade || ""}${userProfile.classGroup || ""}班
學院主修: ${activeMajor.name} (${activeMajor.code})
心儀輔修: ${activeMinor.name} (${activeMinor.code})
報告產出時間: ${new Date().toLocaleString()}

🚀 輔系修課進度分析 (${activeMinor.name})
--------------------------------------------------
門檻畢業學分要求: ${activeMinor.totalRequiredCredits} 學分
當前已修畢必備學分: ${completedCourses.reduce((sum, c) => sum + c.credits, 0)} 學分
模擬預選加選學分: ${simulatedCourses.reduce((sum, c) => sum + c.credits, 0)} 學分
目前總模擬完成度: ${completedCourses.reduce((sum, c) => sum + c.credits, 0) + simulatedCourses.reduce((sum, c) => sum + c.credits, 0)} / ${activeMinor.totalRequiredCredits} 學分

📅 模擬已就緒個人課表一覽
--------------------------------------------------
${simulatedCourses.length === 0 ? "⚠️ 尚未預選任何課程，課表為空！" : ""}
${simulatedCourses
  .map(
    (c) =>
      `• [${c.code}] ${c.name} (${c.credits} 學分) - 授課: ${c.instructor} | 教室: ${c.location}`
  )
  .join("\n")}

💡 備註說明：此選課與防衝堂排課規劃成功，學分比對已歸檔。
特別提醒，每學期選課仍請以校務系統公告為準。
${timeDivider}
`;

    // Trigger basic txt download
    const element = document.createElement("a");
    const file = new Blob([report], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `${userProfile.studentId}_輔系選課規律報告.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // Trigger JSON Export to copy or import on another device
  const handleExportJSON = () => {
    const dataStr = JSON.stringify(userProfile, null, 2);
    navigator.clipboard.writeText(dataStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-4">
      {/* Account Profile Details Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-4">
          <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-indigo-500 to-indigo-700 flex items-center justify-center text-white shrink-0 shadow-md">
            <User className="w-7 h-7" />
          </div>
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">學生姓名</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 text-xs rounded-lg w-full"
                    placeholder="姓名"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 block mb-0.5">學生學號</label>
                  <input
                    type="text"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="px-2 py-1.5 border border-slate-200 text-xs rounded-lg w-full"
                    placeholder="學號"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">本系年級</label>
                    <select
                      value={classGrade}
                      onChange={(e) => setClassGrade(e.target.value)}
                      className="px-2 py-1 border border-slate-200 text-xs rounded-lg w-full bg-white text-slate-800"
                    >
                      <option value="一年級">一年級</option>
                      <option value="二年級">二年級</option>
                      <option value="三年級">三年級</option>
                      <option value="四年級">四年級</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 block mb-0.5">班級組別</label>
                    <select
                      value={classGroup}
                      onChange={(e) => setClassGroup(e.target.value)}
                      className="px-2 py-1 border border-slate-200 text-xs rounded-lg w-full bg-white text-slate-800"
                    >
                      <option value="甲">甲</option>
                      <option value="乙">乙</option>
                      <option value="丙">丙</option>
                      <option value="丁">丁</option>
                    </select>
                  </div>
                </div>
                <div className="flex space-x-2 pt-1">
                  <button
                    onClick={handleSaveInfo}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg px-3 py-1 font-semibold text-xs transition-colors"
                  >
                    保存
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-3 py-1 font-semibold text-xs transition-colors"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold text-slate-800 leading-none">
                    {userProfile.name}
                  </h3>
                  <span className="flex items-center text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-bold">
                    <BadgeCheck className="w-3 h-3 text-emerald-500 mr-0.5" />
                    已驗證學籍
                  </span>
                </div>
                 <p className="text-[11px] text-slate-600 mt-1">
                  學號：<strong className="font-mono text-slate-800 tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-sm">{userProfile.studentId}</strong>
                </p>
                {(() => {
                  const p = parseShuStudentId(userProfile.studentId);
                  if (!p) return null;
                  return (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 uppercase">
                        {p.system}
                      </span>
                      <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                        {p.year.split(" ")[0]}
                      </span>
                      {p.deptName && !p.deptName.includes("未知") && (
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                          {p.deptName}
                        </span>
                      )}
                      {(userProfile.classGrade || userProfile.classGroup) && (
                        <span className="text-[9px] font-bold text-teal-750 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                          {userProfile.classGrade || ""}{userProfile.classGroup || ""}班
                        </span>
                      )}
                    </div>
                  );
                })()}
                {userProfile.email && (
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    信箱：<span className="font-mono text-xs">{userProfile.email}</span>
                  </p>
                )}
                <div className="flex items-center space-x-2 mt-1.5">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-indigo-600 hover:text-indigo-800 font-bold text-[10px]"
                  >
                    編輯學籍資料
                  </button>
                  {onLogout && (
                    <>
                      <span className="text-slate-300 text-[10px]">|</span>
                      <button
                        onClick={onLogout}
                        className="text-rose-600 hover:text-rose-800 font-bold text-[10px]"
                      >
                        登出學校帳號
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Major & Minor Toggles */}
        <div className="grid grid-cols-2 gap-4 mt-5 border-t border-slate-100 pt-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
              本系主修開課 (Major)
            </label>
            <select
              id="major-dept-select"
              value={userProfile.majorDeptId}
              onChange={(e) => handleMajorChange(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500"
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1.5 uppercase">
              志願擬修輔系 (Minor)
            </label>
            <select
              id="minor-dept-select"
              value={userProfile.minorDeptId}
              onChange={(e) => handleMinorChange(e.target.value)}
              className="w-full bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold rounded-xl p-2 focus:ring-2 focus:ring-indigo-500"
            >
              <option value="none">無輔系 (上限22學分)</option>
              {DEPARTMENTS.filter((dept) => dept.id !== userProfile.majorDeptId).map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name} ({dept.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Persistence and Action report cards */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          報告導出與備份機制 (離線持久運作)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <button
            id="export-text-report-btn"
            onClick={handleExportTextReport}
            className="flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 px-4 font-bold transition-transform shadow-xs hover:-translate-y-0.5 active:translate-y-0"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>匯出修課規劃報告 (.txt)</span>
          </button>

          <button
            id="copy-json-config-btn"
            onClick={handleExportJSON}
            className={`flex items-center justify-center space-x-1.5 rounded-xl py-3 px-4 border font-bold transition-all shadow-3xs hover:-translate-y-0.5 active:translate-y-0 ${
              copied
                ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {copied ? (
              <>
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>學籍設定已拷貝 JSON !</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>複製離線備份 JSON</span>
              </>
            )}
          </button>
        </div>

        <div className="border-t border-slate-100 pt-3.5">
          <button
            id="reset-all-system-btn"
            onClick={() => {
              if (confirm("您確認要清除所有的模擬排課與自選課程，完全重設系統為預設值嗎？")) {
                onResetAll();
              }
            }}
            className="w-full flex items-center justify-center space-x-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl py-2.5 font-bold text-xs transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 shrink-0" />
            <span>清除所有快取・完全重設系統</span>
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-3 border border-slate-150 text-[11px] text-slate-400 leading-normal flex items-start gap-1.5">
          <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>本系統支援 <strong>即時自動儲存 (Auto-Save)</strong>。即使重整瀏覽器、或者是切換到手機模擬介面，所有選取的擬定功課表和學籍紀錄都將安全儲存在您電腦本地 (Local Storage)！</span>
        </div>
      </div>
    </div>
  );
}
