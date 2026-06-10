/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Course, Department, TimeSlot, UserProfile, isCourseMatchUserClass, isCourseMatchMinorRequirements, isCourseRequiredForMinor } from "../types";
import { Search, Filter, Calendar, BookOpen, AlertTriangle, Plus, CheckCircle, Minus, X, Sparkles, Lock } from "lucide-react";
import { DEPARTMENTS } from "../data";

interface CourseSelectorProps {
  courses: Course[];
  userProfile: UserProfile;
  activeMinor: Department;
  onAddCourse: (courseId: string) => void;
  onRemoveCourse: (courseId: string) => void;
  onSelectCourseDetails: (course: Course) => void;
}

const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五"];

export default function CourseSelector({
  courses,
  userProfile,
  activeMinor,
  onAddCourse,
  onRemoveCourse,
  onSelectCourseDetails,
}: CourseSelectorProps) {
  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("all"); // "all" or specific deptId
  const [selectedDay, setSelectedDay] = useState<number | null>(null); // null = Any, 1-5 = Mon-Fri
  const [creditsFilter, setCreditsFilter] = useState<number | null>(null); // null = Any, 2, 3, 4 = specific
  const [showOnlyRequired, setShowOnlyRequired] = useState(false);

  // Derive the user's chosen major and minor departments
  const userDepts = useMemo(() => {
    return DEPARTMENTS.filter(
      (dept) => dept.id === userProfile.majorDeptId || dept.id === userProfile.minorDeptId
    );
  }, [userProfile.majorDeptId, userProfile.minorDeptId]);

  // Quick reset for filters
  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedDeptId("all");
    setSelectedDay(null);
    setCreditsFilter(null);
    setShowOnlyRequired(false);
  };

  // Helper check: does Course A overlap with ANY active simulated courses?
  const checkPreCollision = (targetCourse: Course): { hasClash: boolean; conflictingCourseName?: string } => {
    // If it's already selected, it doesn't collide with itself
    if (userProfile.simulatedCourseIds.includes(targetCourse.id)) {
      return { hasClash: false };
    }
    // Also already completed courses shouldn't trigger active scheduling clash
    if (userProfile.completedCourseIds.includes(targetCourse.id)) {
      return { hasClash: false };
    }

    // Get active simulated course objects
    const simulatedObjects = courses.filter(
      (c) => userProfile.simulatedCourseIds.includes(c.id) && !userProfile.completedCourseIds.includes(c.id)
    );

    for (const simCourse of simulatedObjects) {
      for (const targetSlot of targetCourse.timeSlots) {
        for (const simSlot of simCourse.timeSlots) {
          if (targetSlot.day === simSlot.day) {
            // Find intersection of slots Array
            const intersection = targetSlot.slots.filter((s) => simSlot.slots.includes(s));
            if (intersection.length > 0) {
              return { hasClash: true, conflictingCourseName: simCourse.name };
            }
          }
        }
      }
    }
    return { hasClash: false };
  };

  // Filter the full catalog
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      // 0. Check if course is offered this semester
      if (course.isNotOfferedThisSemester) {
        return false;
      }

      // 1. Search Query
      if (searchQuery.trim() !== "") {
        const query = searchQuery.toLowerCase();
        const matchName = course.name.toLowerCase().includes(query);
        const matchCode = course.code.toLowerCase().includes(query);
        const matchTeacher = course.instructor.toLowerCase().includes(query);
        if (!matchName && !matchCode && !matchTeacher) return false;
      }

      // 2. Department filter
      if (selectedDeptId !== "all") {
        if (course.departmentId !== selectedDeptId) {
          return false;
        }
      } else {
        // Show only courses belonging to either the user's major dept or minor dept
        const matchesMajor = course.departmentId === userProfile.majorDeptId;
        const matchesMinor = course.departmentId === userProfile.minorDeptId;

        if (!matchesMajor && !matchesMinor) {
          return false;
        }
      }

      const treatedAsMajor = course.departmentId === userProfile.majorDeptId;
      const treatedAsMinor = course.departmentId === userProfile.minorDeptId;

      // Filter major courses based on Grade and Group/Class
      if (treatedAsMajor) {
        if (!isCourseMatchUserClass(course, userProfile.classGrade, userProfile.classGroup, courses, userProfile.studentId)) {
          return false;
        }
      }

      // Filter minor courses based on official curriculum guidelines
      if (treatedAsMinor) {
        if (!isCourseMatchMinorRequirements(course, userProfile.minorDeptId)) {
          return false;
        }
      }

      // 3. Day of week filter
      if (selectedDay !== null) {
        const hasDay = course.timeSlots.some((slot) => slot.day === selectedDay);
        if (!hasDay) return false;
      }

      // 4. Credits filter
      if (creditsFilter !== null && course.credits !== creditsFilter) {
        return false;
      }

      // 5. Compulsory Filter (for the active minor context - only keep minor compulsory/required courses)
      if (showOnlyRequired) {
        const isRequiredForMinor = isCourseRequiredForMinor(course, activeMinor.id);
        if (!treatedAsMinor || !isRequiredForMinor) {
          return false;
        }
      }

      return true;
    });
  }, [courses, searchQuery, selectedDeptId, selectedDay, creditsFilter, showOnlyRequired, userProfile.majorDeptId, userProfile.minorDeptId, userProfile.classGrade, userProfile.classGroup]);

  // Translate day number to text
  const formatTimeSlot = (slots: TimeSlot[]) => {
    return slots
      .map((slot) => {
        const dayWord = WEEKDAYS[slot.day - 1];
        const periods = slot.slots.join(",");
        return `${dayWord} (第 ${periods} 節)`;
      })
      .join(", ");
  };

  return (
    <div className="space-y-4">
      {/* Dynamic Filters panel */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3">
        {/* Search bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="course-search-input"
            type="text"
            placeholder="搜尋課名、代碼、教授關鍵字..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-slate-800"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Categories (Dept selector pills) */}
        <div className="relative">
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 select-none whitespace-nowrap scrollbar-none pr-12">
            <div className="sticky left-0 bg-white z-10 flex items-center pr-3 py-1 mr-1 shadow-[12px_0_16px_-6px_rgba(255,255,255,1)]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                主 / 輔開課:
              </span>
            </div>
            <button
              key="all"
              onClick={() => setSelectedDeptId("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                selectedDeptId === "all"
                  ? "bg-slate-900 border-slate-900 text-white shadow-3xs"
                  : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
              }`}
            >
              全部系所
            </button>
            {userDepts.map((dept) => {
              const isMajor = dept.id === userProfile.majorDeptId;
              return (
                <button
                  key={dept.id}
                  onClick={() => setSelectedDeptId(dept.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    selectedDeptId === dept.id
                      ? isMajor
                        ? "bg-teal-600 border-teal-600 text-white shadow-3xs"
                        : "bg-indigo-600 border-indigo-600 text-white shadow-3xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {isMajor ? "主修：" : "輔系："}{dept.name}
                </button>
              );
            })}
          </div>
          {/* Right edge feathering / fade out effect (lighter and narrower) */}
          <div className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-white to-transparent z-10" />
        </div>

        {/* Multi-Filter details line */}
        <div className="flex flex-wrap gap-2 items-center text-[11px] border-t border-slate-100 pt-3">
          {/* Weekday filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1 px-2">
            <span className="text-slate-400">星期:</span>
            <select
              id="filter-day-select"
              value={selectedDay || ""}
              onChange={(e) => setSelectedDay(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="">不限</option>
              <option value="1">週一</option>
              <option value="2">週二</option>
              <option value="3">週三</option>
              <option value="4">週四</option>
              <option value="5">週五</option>
            </select>
          </div>

          {/* Credits Filter */}
          <div className="flex items-center space-x-1 bg-slate-50 border border-slate-200 rounded-lg p-1 px-2">
            <span className="text-slate-400">學分:</span>
            <select
              id="filter-credits-select"
              value={creditsFilter || ""}
              onChange={(e) => setCreditsFilter(e.target.value ? parseInt(e.target.value, 10) : null)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="">不限</option>
              <option value="2">2 學分</option>
              <option value="3">3 學分</option>
              <option value="4">4 學分</option>
            </select>
          </div>

          {/* Core Compulsory Switch Toggle */}
          <button
            onClick={() => setShowOnlyRequired(!showOnlyRequired)}
            className={`py-1 px-2 rounded-lg border font-semibold transition-all flex items-center space-x-1.5 ${
              showOnlyRequired
                ? "bg-amber-50 border-amber-300 text-amber-700"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>⭐ 只看輔系必修</span>
          </button>

          {/* Quick Clear Indicator */}
          {(selectedDeptId !== "all" || selectedDay !== null || creditsFilter !== null || showOnlyRequired || searchQuery) && (
            <button
              onClick={handleResetFilters}
              className="ml-auto text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              自定條件清除 ×
            </button>
          )}
        </div>
      </div>

      {/* Courses List Grid */}
      <div className="space-y-3">
        <div className="flex justify-between items-center px-1">
          <p className="text-xs font-bold text-slate-400">
            搜尋結果：共計 <strong className="text-slate-700">{filteredCourses.length}</strong> 門課
          </p>
          {activeMinor && (
            <p className="text-[10px] text-slate-400">
              目標輔系開課比對：<strong className="text-indigo-600">{activeMinor.name}</strong>
            </p>
          )}
        </div>

        {filteredCourses.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">找不到符合規則的選課科目</p>
            <p className="text-xs text-slate-400 mt-1">請嘗試清除部分篩選關鍵字或學分數條件</p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors border border-indigo-100"
            >
              重置過濾條件
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" id="course-cards-list">
            {filteredCourses.map((c) => {
              const isSimulated = userProfile.simulatedCourseIds.includes(c.id);
              const isCompleted = userProfile.completedCourseIds.includes(c.id);
              const collisionInfo = checkPreCollision(c);
              const isMinorCourse = c.departmentId === activeMinor.id;

              const treatedAsMajor = c.departmentId === userProfile.majorDeptId;
              const treatedAsMinor = c.departmentId === userProfile.minorDeptId;

              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl border p-4 transition-all hover:shadow-md flex flex-col justify-between ${
                    isSimulated && !isCompleted
                      ? "border-blue-500 ring-1 ring-blue-100"
                      : isCompleted
                      ? "border-emerald-400 bg-emerald-50/15"
                      : "border-slate-200"
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header: Code & Action Badge / Compulsory Label */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-[10px] font-mono tracking-wider font-extrabold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm">
                          {c.code}
                        </span>
                        {((treatedAsMajor && c.isRequired) || (treatedAsMinor && isCourseRequiredForMinor(c, activeMinor.id))) && (
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                            treatedAsMajor
                              ? "bg-teal-50 text-teal-800 border-teal-200"
                              : "bg-amber-100 text-amber-800 border-amber-200"
                          }`}>
                            {treatedAsMajor ? "主修必修" : "輔系必修"}
                          </span>
                        )}
                        {!isMinorCourse && (
                          <span className="text-[9px] bg-slate-100 text-slate-500 font-medium px-1.5 py-0.5 rounded-full">
                            跨系支援
                          </span>
                        )}
                      </div>

                      <span className="text-xs font-bold text-indigo-600">
                        {c.credits} 學分
                      </span>
                    </div>

                    {/* Course Title and Professor */}
                    <div>
                      <h4
                        id={`course-title-${c.id}`}
                        onClick={() => onSelectCourseDetails(c)}
                        className="text-sm font-extrabold text-slate-800 hover:text-indigo-600 cursor-pointer flex items-center gap-1 leading-snug hover:underline"
                        title="點選查看詳細課程大綱與歷屆評價評價"
                      >
                        {c.name}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        授課教師：<strong className="text-slate-500">{c.instructor}</strong> | {c.location}
                      </p>
                    </div>

                    {/* Class Time Indicator */}
                    <div className="flex items-center space-x-1 text-[11px] text-slate-500 bg-slate-50 p-1 px-2 rounded-lg">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{formatTimeSlot(c.timeSlots)}</span>
                    </div>

                    {/* Collision warning before adding */}
                    {collisionInfo.hasClash && (
                      <div className="bg-rose-50 border border-rose-100 text-[10px] text-rose-700 p-1.5 rounded-lg flex items-center gap-1.5 leading-normal animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <span>
                          <strong>時段衝突！</strong>與已選的「
                          {collisionInfo.conflictingCourseName}」衝堂。
                        </span>
                      </div>
                    )}


                  </div>

                  {/* Actions Bar down below */}
                  <div className="border-t border-slate-50 mt-3 pt-3 flex items-center justify-between">
                    <button
                      onClick={() => onSelectCourseDetails(c)}
                      className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>詳情 & 評價</span>
                    </button>

                    <div>
                      {isCompleted ? (
                        <div className="flex items-center space-x-1 text-emerald-600 text-xs font-bold bg-emerald-50 py-1 px-2.5 rounded-lg border border-emerald-100">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                          <span>已修畢課業</span>
                        </div>
                      ) : isSimulated ? (
                        treatedAsMajor && c.isRequired ? (
                          <div className="flex items-center space-x-1 text-slate-500 text-xs font-bold bg-slate-100 py-1 px-2.5 rounded-lg border border-slate-200">
                            <Lock className="w-3 text-slate-400" />
                            <span>主修必修（不可退選）</span>
                          </div>
                        ) : (
                          <button
                            id={`remove-course-${c.id}`}
                            onClick={() => onRemoveCourse(c.id)}
                            className="flex items-center space-x-1 py-1 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg border border-blue-200 transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                            <span>移出預選</span>
                          </button>
                        )
                      ) : (
                        <button
                          id={`add-course-${c.id}`}
                          onClick={() => onAddCourse(c.id)}
                          className={`flex items-center space-x-1 py-1 px-2.5 text-xs font-semibold rounded-lg transition-all border ${
                            collisionInfo.hasClash
                              ? "bg-rose-100 hover:bg-rose-200 border-rose-200 text-rose-800"
                              : "bg-slate-950 hover:bg-indigo-600 hover:border-indigo-600 text-white border-slate-950 shadow-3xs"
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>{collisionInfo.hasClash ? "強制加選" : "排入模擬"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
