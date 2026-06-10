/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { Course, CourseComment, isCourseRequiredForMinor } from "../types";
import { X, Star, Calendar, MapPin, User, FileText, Send, MessageSquareText, ShieldAlert } from "lucide-react";

interface CourseDetailModalProps {
  course: Course | null;
  comments: CourseComment[];
  userProfile: {
    majorDeptId: string;
    minorDeptId: string;
  };
  onClose: () => void;
  onAddComment: (comment: Omit<CourseComment, "id" | "date">) => void;
}

export default function CourseDetailModal({
  course,
  comments,
  userProfile,
  onClose,
  onAddComment,
}: CourseDetailModalProps) {
  if (!course) return null;

  // New Comment form states
  const [reviewerName, setReviewerName] = useState("");
  const [ratingDifficulty, setRatingDifficulty] = useState(3);
  const [ratingValue, setRatingValue] = useState(4);
  const [content, setContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Filter comments for this course
  const courseComments = useMemo(() => {
    return comments.filter((c) => c.courseId === course.id);
  }, [comments, course.id]);

  // Calculations for average star ratings
  const averages = useMemo(() => {
    if (courseComments.length === 0) {
      return { difficulty: 0, value: 0 };
    }
    const sumDiff = courseComments.reduce((acc, curr) => acc + curr.ratingDifficulty, 0);
    const sumVal = courseComments.reduce((acc, curr) => acc + curr.ratingValue, 0);
    return {
      difficulty: parseFloat((sumDiff / courseComments.length).toFixed(1)),
      value: parseFloat((sumVal / courseComments.length).toFixed(1)),
    };
  }, [courseComments]);

  // Handle new submission
  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewerName.trim()) {
      setErrorMsg("請輸入稱呼或綽號（例如：資工三 小明）");
      return;
    }
    if (!content.trim()) {
      setErrorMsg("評論內容至少需要填寫一些心得感受。");
      return;
    }
    if (content.length < 5) {
      setErrorMsg("評論內容建議多寫幾字（至少 5 個字），方便其他學弟妹評估！");
      return;
    }

    onAddComment({
      courseId: course.id,
      reviewer: reviewerName.trim(),
      ratingDifficulty,
      ratingValue,
      content: content.trim(),
    });

    // Reset Form
    setReviewerName("");
    setRatingDifficulty(3);
    setRatingValue(4);
    setContent("");
    setErrorMsg("");
  };

  // Render yellow/blue helper stars
  const renderStars = (num: number, fillGold: boolean = true) => {
    return (
      <div className="flex items-center space-x-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star
            key={s}
            className={`w-3.5 h-3.5 ${
              s <= num
                ? fillGold
                  ? "text-amber-500 fill-amber-500"
                  : "text-blue-500 fill-blue-500"
                : "text-slate-200"
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs select-none">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header decoration */}
        <div className="bg-slate-900 px-6 py-4.5 text-white flex justify-between items-center">
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] bg-indigo-500 px-2 py-0.5 rounded-sm font-mono font-bold tracking-wider uppercase">
                {course.code}
              </span>
              {(() => {
                const isMajorRequired = course.departmentId === userProfile.majorDeptId && course.isRequired;
                const isMinorRequired = course.departmentId === userProfile.minorDeptId && isCourseRequiredForMinor(course, userProfile.minorDeptId);

                if (isMajorRequired) {
                  return (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-teal-600 text-white">
                      主修必修
                    </span>
                  );
                } else if (isMinorRequired) {
                  return (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-amber-500 text-slate-950">
                      輔系必修
                    </span>
                  );
                }
                return null;
              })()}
            </div>
            <h3 className="text-base font-extrabold text-white mt-1">{course.name}</h3>
          </div>
          <button
            id="close-course-modal-btn"
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Container */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div>
              <p className="text-slate-400 font-bold mb-1">授課教師</p>
              <p className="text-slate-800 font-semibold text-xs flex items-center gap-1">
                <User className="w-4 h-4 text-slate-500" />
                {course.instructor}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-bold mb-1">開課教室</p>
              <p className="text-slate-800 font-semibold text-xs flex items-center gap-1">
                <MapPin className="w-4 h-4 text-slate-500" />
                {course.location}
              </p>
            </div>
          </div>

          {/* Syllabus Section */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-indigo-500" />
              課程大綱
            </h4>
            <p className="text-xs text-slate-650 leading-relaxed bg-slate-50/40 p-4 rounded-xl border border-slate-100 whitespace-pre-line">
              {course.syllabus}
            </p>
          </div>

          {/* Peer Ratings Summary with detailed star boxes */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <MessageSquareText className="w-3.5 h-3.5 text-indigo-500" />
              歷屆學長姐評價評比
            </h4>

            {courseComments.length === 0 ? (
              <div className="bg-slate-50/50 rounded-xl p-6 text-center text-slate-400 border border-slate-100 text-xs">
                ⚠️ 本門課程尚未累積任何評價，歡迎在下方填寫您對本課的心得回饋！
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 bg-amber-50/30 border border-amber-100 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-extrabold text-amber-900">學科難度星級</p>
                    <p className="text-[10px] text-amber-600">越低越甜，高難度較硬</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-amber-700 leading-none">
                      {averages.difficulty} <span className="text-[10px] font-normal text-slate-400">/ 5</span>
                    </p>
                    <div className="mt-1">{renderStars(Math.round(averages.difficulty))}</div>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/30 border border-blue-100 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <p className="font-extrabold text-blue-900">收穫滿點度</p>
                    <p className="text-[10px] text-blue-600">理論與實踐紮實度</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-blue-700 leading-none">
                      {averages.value} <span className="text-[10px] font-normal text-slate-400">/ 5</span>
                    </p>
                    <div className="mt-1">{renderStars(Math.round(averages.value), false)}</div>
                  </div>
                </div>
              </div>
            )}

            {/* List of comments */}
            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
              {courseComments.map((comment) => (
                <div key={comment.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100/85 text-xs">
                  <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1.5">
                    <span className="font-bold text-slate-600">{comment.reviewer}</span>
                    <span>{comment.date}</span>
                  </div>
                  {/* Mini bullet metrics */}
                  <div className="flex space-x-3 text-[9px] text-slate-500 mb-2 font-medium">
                    <span className="flex items-center gap-0.5">
                      難易: {renderStars(comment.ratingDifficulty)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      收穫: {renderStars(comment.ratingValue, false)}
                    </span>
                  </div>
                  <p className="text-slate-650 leading-relaxed text-xs">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Write a review Form */}
          <div className="border-t border-slate-100 pt-4 bg-slate-50/35 p-4 rounded-2xl border border-slate-150">
            <h5 className="text-xs font-extrabold text-slate-700 mb-2">撰寫對於 {course.name} 的真實評論</h5>

            {errorMsg && (
              <div className="p-2.5 mb-3 bg-rose-50 border border-rose-100 text-xs text-rose-700 rounded-xl">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitComment} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Reviewer Name */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    稱呼學系或綽號:
                  </label>
                  <input
                    id="reviewer-name-input"
                    type="text"
                    required
                    placeholder="例如：資工三 小林"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Stars slider Difficulty */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    難度 (1=極易 / 5=極難):
                  </label>
                  <select
                    id="reviewer-difficulty-select"
                    value={ratingDifficulty}
                    onChange={(e) => setRatingDifficulty(parseInt(e.target.value, 15))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 font-semibold text-slate-700"
                  >
                    <option value="1">1星 - 極輕鬆</option>
                    <option value="2">2星 - 偏簡單</option>
                    <option value="3">3星 - 一般難度</option>
                    <option value="4">4星 - 考驗實力</option>
                    <option value="5">5星 - 非常硬課</option>
                  </select>
                </div>

                {/* Stars slider Value */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">
                    收穫 (1=空洞 / 5=滿點):
                  </label>
                  <select
                    id="reviewer-value-select"
                    value={ratingValue}
                    onChange={(e) => setRatingValue(parseInt(e.target.value, 15))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 font-semibold text-slate-700"
                  >
                    <option value="1">1星 - 照本宣科</option>
                    <option value="2">2星 - 學理有限</option>
                    <option value="3">3星 - 算有學到</option>
                    <option value="4">4星 - 實用非凡</option>
                    <option value="5">5星 - 實踐滿點</option>
                  </select>
                </div>
              </div>

              {/* Content textarea */}
              <div className="space-y-1">
                <input
                  id="reviewer-content-text"
                  type="text"
                  required
                  placeholder="寫下您對課程的真實期末筆試心得、分組報告、小考次數、給分甜不甜等大公開..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2 px-3 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400">
                  ⚠️ 請客觀表達您的言論，嚴禁人身攻擊等違規用詞。
                </span>
                <button
                  id="submit-comment-btn"
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-4.5 font-bold flex items-center space-x-1 border border-slate-900 transition-colors cursor-pointer text-xs"
                >
                  <Send className="w-3.5 h-3.5 shrink-0" />
                  <span>提交點評</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
