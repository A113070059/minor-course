/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { Course, TimeSlot, UserProfile } from "../types";
import { Clock, AlertTriangle, Trash2, CalendarRange, Trash, Lock } from "lucide-react";

interface TimetableProps {
  simulatedCourses: Course[];
  userProfile: UserProfile;
  onRemoveCourse: (courseId: string) => void;
}

const DAYS_CHINESE = ["週一", "週二", "週三", "週四", "週五"];

// Standard university class grid (14 periods)
const PERIODS = [
  { id: 1, name: "第 1 節", time: "08:10-09:00" },
  { id: 2, name: "第 2 節", time: "09:10-10:00" },
  { id: 3, name: "第 3 節", time: "10:10-11:00" },
  { id: 4, name: "第 4 節", time: "11:10-12:00" },
  { id: 5, name: "第 5 節", time: "12:10-13:00" },
  { id: 6, name: "第 6 節", time: "13:10-14:00" },
  { id: 7, name: "第 7 節", time: "14:10-15:00" },
  { id: 8, name: "第 8 節", time: "15:10-16:00" },
  { id: 9, name: "第 9 節", time: "16:10-17:00" },
  { id: 10, name: "第 10 節", time: "17:10-18:00" },
  { id: 11, name: "第 11 節", time: "18:10-19:00" },
  { id: 12, name: "第 12 節", time: "19:10-20:00" },
  { id: 13, name: "第 13 節", time: "20:10-21:00" },
  { id: 14, name: "第 14 節", time: "21:10-22:00" }
];

export default function Timetable({ simulatedCourses, userProfile, onRemoveCourse }: TimetableProps) {
  const [courseToRemove, setCourseToRemove] = useState<Course | null>(null);

  // Build mapping from [day][slot] -> Course[]
  const gridMap = useMemo(() => {
    // day represents index 1 to 5, slot index 1 to 14
    const map: Record<string, Course[]> = {};
    
    simulatedCourses.forEach((course) => {
      course.timeSlots.forEach((slotInfo) => {
        const day = slotInfo.day;
        slotInfo.slots.forEach((slotNum) => {
          const key = `${day}-${slotNum}`;
          if (!map[key]) {
            map[key] = [];
          }
          map[key].push(course);
        });
      });
    });
    
    return map;
  }, [simulatedCourses]);

  // Find all conflicts
  const conflicts = useMemo(() => {
    const list: { day: number; slot: number; courses: Course[] }[] = [];
    (Object.entries(gridMap) as [string, Course[]][]).forEach(([key, courses]) => {
      if (courses.length > 1) {
        const [dayStr, slotStr] = key.split("-");
        list.push({
          day: parseInt(dayStr, 10),
          slot: parseInt(slotStr, 10),
          courses,
        });
      }
    });
    return list;
  }, [gridMap]);

  // Flatten unique conflicting courses to show quick-delete alerts
  const conflictingCourses = useMemo(() => {
    const map = new Map<string, Course>();
    conflicts.forEach((c) => {
      c.courses.forEach((course) => {
        map.set(course.id, course);
      });
    });
    return Array.from(map.values());
  }, [conflicts]);

  // Color mapping generator helper based on course code
  const getCourseColor = (courseCode: string, hasConflict: boolean) => {
    if (hasConflict) {
      return "bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-400 animate-pulse";
    }
    // Fixed colors according to course department / code
    if (courseCode.startsWith("CSIE")) return "bg-indigo-50 border-indigo-200 text-indigo-800";
    if (courseCode.startsWith("BA")) return "bg-amber-50 border-amber-200 text-amber-800";
    if (courseCode.startsWith("FIN")) return "bg-cyan-50 border-cyan-200 text-cyan-800";
    if (courseCode.startsWith("FL")) return "bg-emerald-50 border-emerald-200 text-emerald-800";
    return "bg-teal-50 border-teal-200 text-teal-800";
  };

  return (
    <div className="space-y-4">
      {/* Conflict Alarm Header */}
      {conflicts.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm animate-bounce-slow">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <h4 className="text-sm font-extrabold text-rose-800">
                篩課警示：發現課程時間衝突 (衝堂)！
              </h4>
              <p className="text-xs text-rose-600 leading-normal">
                以下課程安排在同一個時間段，請選擇一門移出：
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">
                {conflictingCourses.map((c) => (
                  <div
                    key={c.id}
                    className="flex justify-between items-center bg-white p-2 rounded-lg border border-rose-100 shadow-3xs"
                  >
                    <div className="text-xs truncate">
                      <span className="font-bold text-rose-700 block text-[10px]">{c.code}</span>
                      <span className="font-semibold text-slate-700 text-xs">{c.name}</span>
                    </div>
                    {(c.departmentId === userProfile.majorDeptId && c.isRequired) ? (
                      <div className="p-1.5 text-slate-400" title="主修必修不允許退選">
                        <Lock className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <button
                        id={`remove-conflict-${c.id}`}
                        onClick={() => setCourseToRemove(c)}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-55 p-1.5 rounded-lg transition-transform hover:scale-105"
                        title="移出此課程解決衝堂"
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Course Schedule Grid */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3 shrink-0">
          <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
            <CalendarRange className="w-4 h-4 text-indigo-500" />
            自動生成・個人預選課表
          </span>
          <span className="text-xs text-slate-400 font-medium">一目了然本本系/輔系時段</span>
        </div>

        {/* Timetable Table */}
        <div className="overflow-x-auto select-none rounded-xl border border-slate-100 max-h-[650px]">
          <table className="min-w-[650px] w-full border-collapse table-fixed text-[11px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="w-20 p-2 text-slate-500 text-left font-bold border-r border-slate-100">
                  時段 / 節次
                </th>
                {DAYS_CHINESE.map((day, idx) => (
                  <th key={idx} className="p-2 text-slate-700 font-extrabold text-center border-r border-slate-100 last:border-r-0">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERIODS.map((period) => {
                return (
                  <tr
                    key={period.id}
                    className="border-b last:border-0 border-slate-150 hover:bg-slate-50/20"
                  >
                    {/* Period Label */}
                    <td className="p-2 border-r border-slate-100 font-medium text-slate-500 bg-slate-50/50">
                      <p className="font-extrabold text-slate-700">{period.name}</p>
                      <p className="text-[9px] text-slate-400 font-mono tracking-tighter">
                        {period.time}
                      </p>
                    </td>

                    {/* Day Grid Columns */}
                    {[1, 2, 3, 4, 5].map((dayNum) => {
                      const key = `${dayNum}-${period.id}`;
                      const coursesInCell = gridMap[key] || [];
                      const hasClash = coursesInCell.length > 1;

                      return (
                        <td
                          key={dayNum}
                          className="p-1.5 border-r border-slate-100 last:border-r-0 align-middle text-center h-16 min-h-[64px] relative"
                        >
                          {coursesInCell.length > 0 && (
                            <div className="flex flex-col gap-1 h-full justify-center">
                              {coursesInCell.map((c) => (
                                <div
                                  key={c.id}
                                  className={`rounded-lg border p-1 text-[10px] leading-tight text-center relative font-medium group select-none transition-all ${getCourseColor(
                                    c.code,
                                    hasClash
                                  )}`}
                                >
                                  {hasClash && (
                                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-sm ring-1 ring-white animate-pulse">
                                      ⚠️
                                    </span>
                                  )}
                                  <p className="font-bold tracking-tight">{c.code}</p>
                                  <p className="truncate block max-w-full font-semibold">{c.name}</p>
                                  <p className="opacity-75 text-[8px] truncate">{c.instructor}</p>

                                  {/* Quick Trash hover icon in tablet view */}
                                  {(c.departmentId === userProfile.majorDeptId && c.isRequired) ? (
                                    <div
                                      className="absolute inset-0 bg-slate-900/30 text-white flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity cursor-not-allowed"
                                      title="主修必修不可退選"
                                    >
                                      <Lock className="w-3.5 h-3.5" />
                                    </div>
                                  ) : (
                                    <button
                                      id={`quick-remove-${c.id}-${dayNum}-${period.id}`}
                                      onClick={() => setCourseToRemove(c)}
                                      className="absolute inset-0 bg-slate-900/10 hover:bg-rose-500/95 text-white flex items-center justify-center rounded-lg opacity-0 hover:opacity-100 transition-opacity"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-[10px] text-slate-400 leading-normal flex items-center space-x-1">
          <Clock className="w-3.5 h-3.5" />
          <span>滑鼠游標懸浮於課程之上，可顯示一鍵快速移出課程垃圾桶！</span>
        </div>
      </div>

      {/* Elegant Confirmation Modal */}
      {courseToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-150 shadow-2xl scale-100 transform transition-all flex flex-col space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3 text-rose-500">
              <div className="p-3 bg-rose-50 rounded-2xl border border-rose-100">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">
                  確認移出此課程？
                </h3>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase">課程代號</span>
                <span className="font-mono font-bold text-slate-600 bg-slate-200/50 px-1.5 py-0.5 rounded text-[10px]">{courseToRemove.code}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 font-bold block mb-0.5">課程名稱</span>
                <span className="font-extrabold text-slate-800 text-sm leading-normal">{courseToRemove.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60 leading-tight">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block mb-0.5">授課教師</span>
                  <span className="font-bold text-slate-700">{courseToRemove.instructor}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block mb-0.5">學分數</span>
                  <span className="font-bold text-slate-700">{courseToRemove.credits} 學分</span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-1">
              <button
                type="button"
                onClick={() => setCourseToRemove(null)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-600 rounded-xl py-3 text-xs font-bold transition-all border border-slate-200 cursor-pointer text-center select-none"
              >
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveCourse(courseToRemove.id);
                  setCourseToRemove(null);
                }}
                className="flex-1 bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 active:scale-98 text-white rounded-xl py-3 text-xs font-bold transition-all shadow-md cursor-pointer text-center select-none"
              >
                確認移出
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
