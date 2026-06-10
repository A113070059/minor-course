/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Course, Department, isCourseMatchMinorRequirements, isCourseRequiredForMinor } from "../types";
import { Award, BookOpen, AlertCircle, CheckCircle2, CircleDollarSign, Compass } from "lucide-react";

interface CreditCalculatorProps {
  userProfile: {
    completedCourseIds: string[];
    simulatedCourseIds: string[];
  };
  courses: Course[];
  activeMinor: Department;
  onToggleCompleted: (courseId: string) => void;
}

export default function CreditCalculator({
  userProfile,
  courses,
  activeMinor,
  onToggleCompleted,
}: CreditCalculatorProps) {
  // Helper to extract base code (e.g. "PRAD-109" from "PRAD-109-01")
  const getCourseBaseCode = (code: string): string => {
    const parts = code.split("-");
    if (parts.length >= 3) {
      return parts.slice(0, 2).join("-");
    }
    return code;
  };

  // Helper to deduplicate courses list by base code
  const getUniqueByBaseCode = (courseList: Course[]) => {
    const seen = new Set<string>();
    const result: Course[] = [];
    for (const c of courseList) {
      const base = getCourseBaseCode(c.code);
      if (!seen.has(base)) {
        seen.add(base);
        result.push(c);
      }
    }
    return result;
  };

  // Filter courses that belong to the active minor department and are allowed for the minor
  const minorCourses = courses.filter((c) => c.departmentId === activeMinor.id && isCourseMatchMinorRequirements(c, activeMinor.id));

  // Resolved list of all completed/simulated courses in the system to support equivalent checks
  const allCompletedCourses = courses.filter((c) => userProfile.completedCourseIds.includes(c.id));
  const allSimulatedCourses = courses.filter((c) => userProfile.simulatedCourseIds.includes(c.id));

  const isBaseCourseCompleted = (targetCourse: Course) => {
    const targetBase = getCourseBaseCode(targetCourse.code);
    return allCompletedCourses.some((c) => getCourseBaseCode(c.code) === targetBase);
  };

  const isBaseCourseSimulated = (targetCourse: Course) => {
    const targetBase = getCourseBaseCode(targetCourse.code);
    return allSimulatedCourses.some((c) => getCourseBaseCode(c.code) === targetBase);
  };

  // Group into Required vs. Elective
  const requiredMinorCourses = minorCourses.filter((c) => isCourseRequiredForMinor(c, activeMinor.id));
  const requiredMinorCoursesUnique = getUniqueByBaseCode(requiredMinorCourses);
  const electiveMinorCourses = minorCourses.filter((c) => !isCourseRequiredForMinor(c, activeMinor.id));

  // Calculate completed & simulated credits, deduplicating equivalent courses by base code
  const completedMinorCourses = minorCourses.filter((c) =>
    userProfile.completedCourseIds.includes(c.id)
  );

  const simulatedMinorCourses = minorCourses.filter(
    (c) =>
      userProfile.simulatedCourseIds.includes(c.id) &&
      !userProfile.completedCourseIds.includes(c.id)
  );

  const getDeduplicatedCreditsAndCourses = (
    completed: Course[],
    simulated: Course[]
  ) => {
    const seenBaseCodes = new Set<string>();
    
    // Process completed first
    const uniqueCompleted: Course[] = [];
    let completedCreditsSum = 0;
    for (const c of completed) {
      const base = getCourseBaseCode(c.code);
      if (!seenBaseCodes.has(base)) {
        seenBaseCodes.add(base);
        uniqueCompleted.push(c);
        completedCreditsSum += c.credits;
      }
    }

    // Process simulated
    const uniqueSimulated: Course[] = [];
    let simulatedCreditsSum = 0;
    for (const c of simulated) {
      const base = getCourseBaseCode(c.code);
      if (!seenBaseCodes.has(base)) {
        seenBaseCodes.add(base);
        uniqueSimulated.push(c);
        simulatedCreditsSum += c.credits;
      }
    }

    return {
      completedCreditsSum,
      simulatedCreditsSum,
    };
  };

  const {
    completedCreditsSum: completedCredits,
    simulatedCreditsSum: simulatedCredits,
  } = getDeduplicatedCreditsAndCourses(completedMinorCourses, simulatedMinorCourses);

  // If there is no active minor, show a simplified credits view for main course selections
  if (activeMinor.id === "none") {
    const totalSimulatedCredits = allSimulatedCourses.reduce((sum, c) => sum + c.credits, 0);
    const totalCompletedCredits = allCompletedCourses.reduce((sum, c) => sum + c.credits, 0);
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
            <Compass className="w-6 h-6 text-indigo-500" />
          </div>
          <h3 className="font-extrabold text-slate-850 text-sm">尚未選讀輔系</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            您目前的狀態為「無選讀輔系」，依規定每學期修課上限學分為 <strong className="text-indigo-600 font-bold">22 學分</strong>。
          </p>
          <p className="text-xs text-slate-400 mt-1">
            您隨時可以在「檔案同步」分頁中設置有興趣擬修的輔系。
          </p>

          <div className="grid grid-cols-2 gap-3 mt-5 text-left">
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-150">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">當前已修學分</span>
              <p className="text-lg font-black text-slate-700 mt-0.5">{totalCompletedCredits} 學分</p>
            </div>
            <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100">
              <span className="text-[10px] uppercase font-bold text-indigo-400 block">本次模擬預選</span>
              <p className="text-lg font-black text-indigo-700 mt-0.5">{totalSimulatedCredits} / 22 學分</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Totals
  const currentTotal = completedCredits + simulatedCredits;
  const targetCredits = activeMinor.totalRequiredCredits;
  const creditGap = Math.max(0, targetCredits - currentTotal);

  // Check required core completion using unique required courses
  const completedRequired = requiredMinorCoursesUnique.filter((c) =>
    isBaseCourseCompleted(c)
  );
  const simulatedRequired = requiredMinorCoursesUnique.filter(
    (c) =>
      isBaseCourseSimulated(c) &&
      !isBaseCourseCompleted(c)
  );

  // Percentages for beautiful visualization
  const completedPercent = targetCredits > 0 ? Math.min(100, (completedCredits / targetCredits) * 100) : 0;
  const simulatedPercent = targetCredits > 0 ? Math.min(
    100 - completedPercent,
    (simulatedCredits / targetCredits) * 100
  ) : 0;
  const missingPercent = Math.max(0, 100 - completedPercent - simulatedPercent);

  return (
    <div className="space-y-4">
      {/* Visual Progress Bar Card */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
            <Award className="w-4 h-4 text-indigo-500" />
            輔系學分平衡檢視
          </span>
          <span className="text-xs bg-indigo-50 text-indigo-700 py-1 px-2.5 rounded-full font-semibold">
            畢業門檻: {targetCredits} 學分
          </span>
        </div>

        {/* Progress Grid */}
        <div className="grid grid-cols-3 gap-2 text-center my-3">
          <div className="bg-emerald-50/50 rounded-xl p-2.5 border border-emerald-100">
            <p className="text-[10px] font-medium text-emerald-600">已修學分</p>
            <p className="text-xl font-black text-emerald-700">{completedCredits}</p>
          </div>
          <div className="bg-blue-50/55 rounded-xl p-2.5 border border-blue-100">
            <p className="text-[10px] font-medium text-blue-600">本次預選</p>
            <p className="text-xl font-black text-blue-700">+{simulatedCredits}</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200">
            <p className="text-[10px] font-medium text-slate-500">尚缺學分</p>
            <p className={`text-xl font-black ${creditGap > 0 ? "text-rose-500" : "text-emerald-600"}`}>
              {creditGap}
            </p>
          </div>
        </div>

        {/* Triple Color Horizontal Progress Bar */}
        <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden flex mt-4 mb-2">
          <div
            style={{ width: `${completedPercent}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`已修學分: ${completedPercent.toFixed(0)}%`}
          ></div>
          <div
            style={{ width: `${simulatedPercent}%` }}
            className="h-full bg-blue-500 transition-all duration-500"
            title={`預選學分: ${simulatedPercent.toFixed(0)}%`}
          ></div>
        </div>

        {/* Legend */}
        <div className="flex justify-between items-center text-[11px] text-slate-500 px-1">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 block"></span>
            <span>已修學分 ({completedCredits})</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 block"></span>
            <span>本次預選 ({simulatedCredits})</span>
          </div>
          <span className="font-semibold text-slate-700">
            總進度: {((completedCredits + simulatedCredits) / targetCredits * 100).toFixed(0)}%
          </span>
        </div>

        {creditGap === 0 ? (
          <div className="mt-3.5 bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-100 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium animate-pulse">🎉 恭喜！所選課程已達到輔系畢業學分數標準！</span>
          </div>
        ) : (
          <div className="mt-3.5 bg-amber-50 text-amber-800 p-2.5 rounded-xl border border-amber-100 text-xs flex items-center space-x-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>目前仍缺 <strong>{creditGap}</strong> 學分，請從下方選課清單中加選課程完成平衡。</span>
          </div>
        )}
      </div>

      {/* Graduation Checklist Rules */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center space-x-1.5">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <span>修業門檻清單比對 ({activeMinor.name})</span>
        </h3>

        <div className="space-y-2.5">
          {/* Rule 1: Total Credits */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-slate-800">1. 最低輔系學分數門檻</p>
              <p className="text-slate-400">畢業應修滿 {targetCredits} 學分</p>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className={`px-2 py-0.5 rounded-full font-bold ${currentTotal >= targetCredits ? "bg-emerald-100 text-emerald-800" : "bg-rose-50 text-rose-600"}`}>
                {currentTotal} / {targetCredits}
              </span>
            </div>
          </div>

          {/* Rule 2: Core Compulsory Courses */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="font-semibold text-slate-800">2. 輔系必修課程要求</p>
                <p className="text-slate-400">輔系必修課程必須全數修畢</p>
              </div>
              <span className={`px-2 py-0.5 rounded-full font-bold ${
                completedRequired.length + simulatedRequired.length === requiredMinorCoursesUnique.length
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}>
                {completedRequired.length + simulatedRequired.length} / {requiredMinorCoursesUnique.length} 門
              </span>
            </div>

            {/* List mini chip indicating compulsory progress */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {requiredMinorCoursesUnique.map((c) => {
                const isDone = isBaseCourseCompleted(c);
                const isSelected = isBaseCourseSimulated(c) && !isDone;
                return (
                  <div
                    key={c.id}
                    onClick={() => onToggleCompleted(c.id)}
                    className={`cursor-pointer px-2.5 py-1 rounded-lg flex items-center space-x-1 border transition-all text-[11px] font-medium ${
                      isDone
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : isSelected
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : c.isNotOfferedThisSemester
                        ? "bg-slate-50/70 border-slate-200 text-slate-400 border-dashed"
                        : "bg-slate-100 border-slate-200 text-slate-400 line-through decoration-slate-300"
                    }`}
                    title={
                      isDone
                        ? "模擬已修 / 點擊改為未修"
                        : isSelected
                        ? "已排入預選"
                        : c.isNotOfferedThisSemester
                        ? "此必修課程本學期未開設，此期無法加選，但可點擊模擬過去學期已修完狀態！"
                        : "未選修"
                    }
                  >
                    <span>{getCourseBaseCode(c.code)}</span>
                    <span className="text-[10px] scale-90">
                      ({isDone ? "已修" : isSelected ? "預選" : c.isNotOfferedThisSemester ? "本期未開" : "未修"})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Core Info Indicator */}
          <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100/30 text-[11px] text-slate-500 leading-relaxed">
            <span className="font-semibold text-indigo-700 block mb-0.5">💡 小撇步：</span>
            本表單支援<strong>直接點擊</strong>上方的必修課程標籤，可直接切換該科目的「已修完」狀態！模擬本系過去課業成果極為便利。
          </div>
        </div>
      </div>
    </div>
  );
}
