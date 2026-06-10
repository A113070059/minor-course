/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Course, Department, isCourseMatchMinorRequirements, isCourseRequiredForMinor } from "../types";
import { Check, Compass, HelpCircle, Eye, Network, Milestone } from "lucide-react";

interface LearningMapProps {
  courses: Course[];
  userProfile: {
    completedCourseIds: string[];
    simulatedCourseIds: string[];
  };
  activeMinor: Department;
  onSelectCourse: (course: Course) => void;
}

export default function LearningMap({
  courses,
  userProfile,
  activeMinor,
  onSelectCourse,
}: LearningMapProps) {
  // If there is no active minor, show placeholder message
  if (activeMinor.id === "none") {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-3">
            <Network className="w-6 h-6 animate-pulse" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-sm">無輔系修課地圖</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            「無選讀輔系」狀態下無法提供輔系專屬的修課樹形地圖和擋修關係。
          </p>
          <p className="text-xs text-slate-400 mt-1">
            您隨時可以在「檔案同步」分頁中設置一個目標輔系，以查看該科系的樹形階層關係與修習地圖。
          </p>
        </div>
      </div>
    );
  }

  // Only courses in this minor and allowed under minor guidelines
  const minorCourses = courses.filter((c) => c.departmentId === activeMinor.id && isCourseMatchMinorRequirements(c, activeMinor.id));

  // Group by category to build a 3-tier custom progress hierarchy tree
  const foundationTier = minorCourses.filter((c) => c.category === "基礎工具" || (isCourseRequiredForMinor(c, activeMinor.id) && !c.prerequisites));
  const coreTier = minorCourses.filter((c) => c.category === "核心必修" && c.prerequisites);
  const electivesTier = minorCourses.filter((c) => c.category === "專業選修" || c.category === "進階應用" || (!isCourseRequiredForMinor(c, activeMinor.id) && c.prerequisites));

  // Render a single node
  const renderNode = (course: Course) => {
    const isCompleted = userProfile.completedCourseIds.includes(course.id);
    const isSimulated = userProfile.simulatedCourseIds.includes(course.id);
    const isRequired = isCourseRequiredForMinor(course, activeMinor.id);

    let statusStyle = "";
    let badgeText = "";
    
    if (isCompleted) {
      statusStyle = "bg-emerald-50 border-emerald-400 text-emerald-800 ring-4 ring-emerald-50";
      badgeText = "已修畢";
    } else if (isSimulated) {
      statusStyle = "bg-blue-50 border-blue-400 text-blue-800 ring-4 ring-blue-50";
      badgeText = "預選中";
    } else if (course.isNotOfferedThisSemester) {
      statusStyle = "bg-slate-50/60 border-slate-200 text-slate-450 border-dashed";
      badgeText = "本學期不開課";
    } else {
      statusStyle = "bg-white border-slate-200 text-slate-500 hover:border-slate-400 hover:bg-slate-50";
      badgeText = "未修";
    }

    return (
      <div
        key={course.id}
        onClick={() => onSelectCourse(course)}
        className={`cursor-pointer border-2 rounded-xl p-3 text-left transition-all duration-300 relative group h-24 flex flex-col justify-between shadow-2xs ${statusStyle}`}
      >
        <div>
          <div className="flex justify-between items-start">
            <span className="text-[9px] font-mono font-extrabold text-slate-400 bg-slate-100 p-0.5 px-1 rounded-sm uppercase tracking-tighter">
              {course.code}
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${
              isCompleted ? "bg-emerald-200 text-emerald-800" : isSimulated ? "bg-blue-200 text-blue-800" : "bg-slate-100 text-slate-400"
            }`}>
              {badgeText}
            </span>
          </div>
          <h5 className="text-xs font-extrabold mt-1 truncate pr-1 group-hover:text-indigo-600 group-hover:underline">
            {course.name}
          </h5>
        </div>
        
        <div className="flex justify-between items-center border-t border-slate-100/10 pt-1 text-[9px] text-slate-400">
          <span>{course.instructor} | {course.credits}學分</span>
          {isRequired && <span className="text-amber-500 font-bold">必修</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-5">
      
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1.5">
          <Milestone className="w-4 h-4 text-indigo-500" />
          輔修修課脈絡・可視化地圖
        </span>
        <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
          <Check className="w-3 h-3" />
          綠色為已修必過
        </span>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed max-w-lg">
        以下是 <strong>{activeMinor.name}</strong> 推薦的由底至頂（基礎 ➔ 核心 ➔ 進階）樹形演進學路。您可以直觀點擊地圖中任何課程，快速瀏覽期課程大綱與學長姐修課評價！
      </p>

      {/* Grid Flow Map */}
      <div className="space-y-4">
        
        {/* Level 1: Foundation (基礎/起手班) */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-slate-400 flex items-center space-x-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
            <span>階梯一：必備基礎與工具課程 (建議優先修畢)</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {foundationTier.length > 0 ? (
              foundationTier.map(renderNode)
            ) : (
              <p className="text-xs text-slate-350 italic">尚未配置基礎型課程</p>
            )}
          </div>
        </div>

        {/* Level Bridge Arrow 1 */}
        {foundationTier.length > 0 && coreTier.length > 0 && (
          <div className="flex justify-center py-2 select-none">
            <div className="flex flex-col items-center">
              <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                解鎖並指向核心 ⤓
              </span>
              <div className="w-0.5 h-4 border-l-2 border-dashed border-slate-300"></div>
            </div>
          </div>
        )}

        {/* Level 2: Core Compulsory (核心學理必修) */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-slate-400 flex items-center space-x-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-ping"></span>
            <span>階梯二：核心言專業必修 (衝堂必檢重點門檻)</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="learning-map-core-grid">
            {coreTier.length > 0 ? (
              coreTier.map(renderNode)
            ) : (
              <p className="text-xs text-slate-350 italic">無前置關聯的核心課程</p>
            )}
          </div>
        </div>

        {/* Level Bridge Arrow 2 */}
        {coreTier.length > 0 && electivesTier.length > 0 && (
          <div className="flex justify-center py-2 select-none">
            <div className="flex flex-col items-center">
              <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                進入高階選修 / 專業發展 ⤓
              </span>
              <div className="w-0.5 h-4 border-l-2 border-dashed border-slate-300"></div>
            </div>
          </div>
        )}

        {/* Level 3: Advanced Electives (高階選修與整合實踐) */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold text-slate-400 flex items-center space-x-1 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>階梯三：高階應用與專業選修</span>
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {electivesTier.length > 0 ? (
              electivesTier.map(renderNode)
            ) : (
              <p className="text-xs text-slate-350 italic">尚無進階選修規劃</p>
            )}
          </div>
        </div>

      </div>

      <div className="bg-slate-50 rounded-xl p-3 text-[11px] text-slate-400 border border-slate-100 flex items-start gap-1.5 leading-normal">
        <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <span>任何列在地圖中的課程，其課程碼已整合先導關係鏈。若你擁有良好的前置課，能顯著幫助您在此專業中獲取 A+ 成績！</span>
      </div>

    </div>
  );
}
