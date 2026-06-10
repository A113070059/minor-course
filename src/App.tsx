/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { UserProfile, Course, Department, CourseComment, isCourseMatchUserClass, isCourseMatchMinorRequirements } from "./types";
import { DEPARTMENTS, COURSES, INITIAL_COMMENTS, INITIAL_USER } from "./data";
import PhoneShell from "./components/PhoneShell";
import { collection, onSnapshot, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import CourseSelector from "./components/CourseSelector";
import Timetable from "./components/Timetable";
import CreditCalculator from "./components/CreditCalculator";
import LearningMap from "./components/LearningMap";
import AccountProfile from "./components/AccountProfile";
import CourseDetailModal from "./components/CourseDetailModal";
import SchoolLogin from "./components/SchoolLogin";

// Helper to auto-inject major required courses that match student class details
const autoSelectRequiredCourses = (
  currentSimulatedIds: string[],
  majorDeptId: string,
  classGrade: string | undefined,
  classGroup: string | undefined,
  studentId?: string
): string[] => {
  if (!classGrade || !classGroup) return currentSimulatedIds;
  
  const requiredIds = COURSES.filter(
    (c) => {
      const isDeptMatch = c.departmentId === majorDeptId;

      return (
        isDeptMatch &&
        c.isRequired &&
        !c.isNotOfferedThisSemester &&
        isCourseMatchUserClass(c, classGrade, classGroup, COURSES, studentId)
      );
    }
  ).map((c) => c.id);

  // Filter currentSimulatedIds to exclude any course not offered this semester
  const filteredCurrent = currentSimulatedIds.filter(
    (id) => !COURSES.find((c) => c.id === id)?.isNotOfferedThisSemester
  );

  const merged = [...filteredCurrent];
  requiredIds.forEach((id) => {
    if (!merged.includes(id)) {
      merged.push(id);
    }
  });
  return merged;
};

// Icons for App bottom navigation
import { BookMarked, CalendarDays, BarChart3, Map, UserCog, Sparkles, GraduationCap, AlertTriangle } from "lucide-react";

export default function App() {
  // 1. Core Reactive States loaded from persistent localStorage
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem("aux_user_profile");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.simulatedCourseIds)) {
          parsed.simulatedCourseIds = parsed.simulatedCourseIds.filter(
            (id: string) => !COURSES.find((c) => c.id === id)?.isNotOfferedThisSemester
          );
        }
        return parsed;
      } catch (e) {
        return INITIAL_USER;
      }
    }
    return INITIAL_USER;
  });

  const [comments, setComments] = useState<CourseComment[]>(() => {
    const saved = localStorage.getItem("aux_course_comments");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return INITIAL_COMMENTS;
      }
    }
    return INITIAL_COMMENTS;
  });

  // Navigation focus tabs ("courses", "timetable", "calculator", "map", "profile")
  const [activeTab, setActiveTab] = useState<string>("courses");

  // Selected course objects for Details Overlay
  const [selectedCourseDetails, setSelectedCourseDetails] = useState<Course | null>(null);

  // Global user alert/toast messages
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Synchronize dynamic profiles to storage whenever mutated
  useEffect(() => {
    localStorage.setItem("aux_user_profile", JSON.stringify(userProfile));
  }, [userProfile]);

  // Synchronize student comments whenever mutated
  useEffect(() => {
    localStorage.setItem("aux_course_comments", JSON.stringify(comments));
  }, [comments]);

  // Read comments from Firestore in real-time
  useEffect(() => {
    const commentsColRef = collection(db, "comments");
    const unsubscribe = onSnapshot(commentsColRef, (snapshot) => {
      const dbComments: CourseComment[] = [];
      snapshot.forEach((docSnap) => {
        dbComments.push(docSnap.data() as CourseComment);
      });

      // Combine with INITIAL_COMMENTS, deduplicating by ID
      const combined = [...dbComments];
      INITIAL_COMMENTS.forEach((seed) => {
        if (!combined.some((c) => c.id === seed.id)) {
          combined.push(seed);
        }
      });

      // Sort newer first
      combined.sort((a, b) => {
        const parseIdTime = (id: string) => {
          if (id.startsWith("comment_")) {
            const num = Number(id.replace("comment_", ""));
            return isNaN(num) ? 0 : num;
          }
          return 0;
        };
        const tA = parseIdTime(a.id);
        const tB = parseIdTime(b.id);
        if (tA !== tB) {
          return tB - tA;
        }
        return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
      });

      setComments(combined);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, "comments");
    });

    return () => unsubscribe();
  }, []);

  // Monitor Firebase Auth changes and sync local userProfile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserProfile((prev) => {
          let origName = user.displayName || "";
          let cleanedName = origName.replace(/世新(大學)?/g, "").trim() || "SHU 學生";
          const userEmail = user.email || "";
          let extractedStudentId = prev.studentId;
          let majorId = prev.majorDeptId;

          const isShuEmail = userEmail.toLowerCase().endsWith("@mail.shu.edu.tw");
          if (isShuEmail && !extractedStudentId) {
            const prefix = userEmail.split("@")[0].toUpperCase();
            extractedStudentId = prefix;
            // Simple inline parser for school department ID
            if (prefix.length >= 7) {
              const deptCode = prefix.substring(4, 7);
              const found = DEPARTMENTS.find((d) => d.code === deptCode);
              if (found) {
                majorId = found.id;
              }
            }
          }

          return {
            ...prev,
            name: prev.name && prev.name !== "SHU 學生" ? prev.name : cleanedName,
            email: userEmail,
            studentId: extractedStudentId || prev.studentId,
            majorDeptId: majorId,
            isLoggedIn: true,
          };
        });
      } else {
        // If not authenticated in Firebase, force local log out to prevent stale sessions
        setUserProfile((prev) => {
          if (prev.isLoggedIn) {
            return {
              ...prev,
              isLoggedIn: false,
            };
          }
          return prev;
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Alert dismiss timers
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Use Memo to resolve current departments
  const activeMinor = useMemo(() => {
    if (userProfile.minorDeptId === "none") {
      return {
        id: "none",
        name: "無輔系 (無選讀)",
        code: "NONE",
        totalRequiredCredits: 0,
        requiredCoreCredits: 0,
        electiveCredits: 0,
        intro: "尚未選讀輔系門檻。此模式下，您的每學期修課上限學分為 22 學分。"
      };
    }
    return DEPARTMENTS.find((d) => d.id === userProfile.minorDeptId) || DEPARTMENTS[0];
  }, [userProfile.minorDeptId]);

  const activeMajor = useMemo(() => {
    return DEPARTMENTS.find((d) => d.id === userProfile.majorDeptId) || DEPARTMENTS[1];
  }, [userProfile.majorDeptId]);

  // Memoize simulated objects enrolled in simulator list
  const simulatedCourses = useMemo(() => {
    return COURSES.filter((c) => userProfile.simulatedCourseIds.includes(c.id));
  }, [userProfile.simulatedCourseIds]);

  // Memoize historic finished courses list
  const completedCourses = useMemo(() => {
    return COURSES.filter((c) => userProfile.completedCourseIds.includes(c.id));
  }, [userProfile.completedCourseIds]);

  // Calculate accumulated minor credits from completed historical courses
  const completedMinorCredits = useMemo(() => {
    if (userProfile.minorDeptId === "none") return 0;
    
    const minorCourses = COURSES.filter((c) => 
      c.departmentId === userProfile.minorDeptId && 
      isCourseMatchMinorRequirements(c, userProfile.minorDeptId)
    );
    
    const completedMinorCourses = minorCourses.filter((c) =>
      userProfile.completedCourseIds.includes(c.id)
    );

    const getCourseBaseCode = (code: string): string => {
      const parts = code.split("-");
      if (parts.length >= 3) {
        return parts.slice(0, 2).join("-");
      }
      return code;
    };

    const seenBaseCodes = new Set<string>();
    let completedCreditsSum = 0;
    
    for (const c of completedMinorCourses) {
      const base = getCourseBaseCode(c.code);
      if (!seenBaseCodes.has(base)) {
        seenBaseCodes.add(base);
        completedCreditsSum += c.credits;
      }
    }
    
    return completedCreditsSum;
  }, [userProfile.minorDeptId, userProfile.completedCourseIds]);

  // ------------------------------------------------------------------------
  // 2. Action Callback Interfaces
  // ------------------------------------------------------------------------

  // Enrolling / Add Course
  const handleAddCourse = (courseId: string) => {
    if (!userProfile.simulatedCourseIds.includes(courseId)) {
      const course = COURSES.find((c) => c.id === courseId);
      if (course) {
        const simulatedCredits = simulatedCourses.reduce((sum, c) => sum + c.credits, 0);
        const hasMinor = userProfile.minorDeptId && userProfile.minorDeptId !== "none";
        const maxCredits = hasMinor ? 26 : 22;

        if (simulatedCredits + course.credits > maxCredits) {
          setNotification({
            message: `加選失敗！您目前為${hasMinor ? "「已選輔系」" : "「未選輔系」"}狀態，本學期最高修課上限為 ${maxCredits} 學分。目前已選 ${simulatedCredits} 學分，加選此門 ${course.credits} 學分之《${course.name}》將會超出上限。`,
            type: "error"
          });
          return;
        }
      }
      setUserProfile((prev) => ({
        ...prev,
        simulatedCourseIds: [...prev.simulatedCourseIds, courseId],
      }));
    }
  };

  // Dropping / Remove Course
  const handleRemoveCourse = (courseId: string) => {
    const course = COURSES.find((c) => c.id === courseId);
    if (course) {
      const isMajorRequired = course.departmentId === userProfile.majorDeptId && course.isRequired;

      if (isMajorRequired) {
        return; // Do not allow removal of major compulsory courses
      }
    }
    setUserProfile((prev) => ({
      ...prev,
      simulatedCourseIds: prev.simulatedCourseIds.filter((id) => id !== courseId),
    }));
  };

  // Check / Uncheck course from completed lists (Past semesters score)
  const handleToggleCompleted = (courseId: string) => {
    setUserProfile((prev) => {
      const isDone = prev.completedCourseIds.includes(courseId);
      const updatedCompleted = isDone
        ? prev.completedCourseIds.filter((id) => id !== courseId)
        : [...prev.completedCourseIds, courseId];

      // If marked compile, remove it from current active layout simulation to prevent redundancy
      const updatedSimulated = isDone
        ? prev.simulatedCourseIds
        : prev.simulatedCourseIds.filter((id) => id !== courseId);

      return {
        ...prev,
        completedCourseIds: updatedCompleted,
        simulatedCourseIds: updatedSimulated,
      };
    });
  };

  // Direct Update full account profiles (Trigger changing Major or target Minors)
  const handleUpdateProfile = (newProfile: UserProfile) => {
    const updatedSimulated = autoSelectRequiredCourses(
      newProfile.simulatedCourseIds,
      newProfile.majorDeptId,
      newProfile.classGrade,
      newProfile.classGroup,
      newProfile.studentId
    );
    setUserProfile({
      ...newProfile,
      simulatedCourseIds: updatedSimulated,
    });
  };

  // Log out action that sets isLoggedIn to false and logs out of Firebase
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Firebase signOut failed:", e);
    }
    setUserProfile((prev) => ({
      ...prev,
      isLoggedIn: false,
    }));
    setActiveTab("courses");
  };

  // Fully erase client storage to return seed settings
  const handleResetAll = () => {
    localStorage.removeItem("aux_user_profile");
    localStorage.removeItem("aux_course_comments");
    setUserProfile(INITIAL_USER);
    setComments(INITIAL_COMMENTS);
    setActiveTab("courses");
  };

  // Create & Append newly written comments by user and upload to Firestore
  const handleAddComment = async (newCommentDraft: Omit<CourseComment, "id" | "date">) => {
    if (!auth.currentUser) {
      setNotification({
        message: "⚠️ 同步失敗：您目前未處於 Google 帳號授權登入狀態。請至「個人學籍」點擊登出按鈕並重新以 Google 學校郵件登入！",
        type: "error"
      });
      return;
    }

    const freshComment: CourseComment = {
      ...newCommentDraft,
      id: "comment_" + Date.now(),
      date: new Date().toISOString().split("T")[0],
    };
    
    // Optimistically update local state
    setComments((prev) => {
      if (prev.some((c) => c.id === freshComment.id)) return prev;
      return [freshComment, ...prev];
    });

    try {
      await setDoc(doc(db, "comments", freshComment.id), freshComment);
      setNotification({
        message: "🎉 留言同步成功！所有使用者現在都能立即看見您的精彩分享。",
        type: "success"
      });
    } catch (error: any) {
      console.error("Firestore Comment Write Error: ", error);
      // Revert the optimistic comment update on UI
      setComments((prev) => prev.filter((c) => c.id !== freshComment.id));
      
      let errMsg = error.message || String(error);
      if (errMsg.includes("permission-denied") || errMsg.includes("Permissions")) {
        errMsg = "您的 Firebase 專案目前未開啟該 Firestore 資料表寫入權限，請檢查安全規則模式。";
      }
      setNotification({
        message: `⚠️ 留言保存失敗！雲端同步遭拒。(${errMsg})`,
        type: "error"
      });
    }
  };

  // Render Mobile Device Tab Content
  const renderTabContent = () => {
    switch (activeTab) {
      case "courses":
        return (
          <CourseSelector
            courses={COURSES}
            userProfile={userProfile}
            activeMinor={activeMinor}
            onAddCourse={handleAddCourse}
            onRemoveCourse={handleRemoveCourse}
            onSelectCourseDetails={setSelectedCourseDetails}
          />
        );
      case "timetable":
        return (
          <Timetable
            simulatedCourses={simulatedCourses}
            userProfile={userProfile}
            onRemoveCourse={handleRemoveCourse}
          />
        );
      case "calculator":
        return (
          <CreditCalculator
            userProfile={userProfile}
            courses={COURSES}
            activeMinor={activeMinor}
            onToggleCompleted={handleToggleCompleted}
          />
        );
      case "map":
        return (
          <LearningMap
            courses={COURSES}
            userProfile={userProfile}
            activeMinor={activeMinor}
            onSelectCourse={setSelectedCourseDetails}
          />
        );
      case "profile":
        return (
          <AccountProfile
            userProfile={userProfile}
            activeMajor={activeMajor}
            activeMinor={activeMinor}
            simulatedCourses={simulatedCourses}
            completedCourses={completedCourses}
            onUpdateProfile={handleUpdateProfile}
            onResetAll={handleResetAll}
            onLogout={handleLogout}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-slate-100">
      
      {/* Shell wrapped inside our Dual-Simulator Box */}
      <PhoneShell>
        
        {!userProfile.isLoggedIn ? (
          <SchoolLogin
            onLoginSuccess={(name, email, studentId, majorId, minorId, classGrade, classGroup) => {
              setUserProfile((prev) => {
                const updatedSimulated = autoSelectRequiredCourses(
                  prev.simulatedCourseIds,
                  majorId,
                  classGrade,
                  classGroup,
                  studentId
                );
                return {
                  ...prev,
                  name,
                  email,
                  studentId,
                  majorDeptId: majorId,
                  minorDeptId: minorId,
                  classGrade,
                  classGroup,
                  isLoggedIn: true,
                  simulatedCourseIds: updatedSimulated,
                };
              });
            }}
          />
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden h-full">
            
            {/* Native Mobile App Header Banner */}
            <div className="bg-slate-900 text-white p-4 pt-5 pb-5 px-5 shrink-0 border-b border-slate-800">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                    大學輔系選課系統 app
                  </p>
                  {userProfile.minorDeptId !== "none" ? (
                    <h2 className="text-sm font-black text-white mt-1 flex items-center gap-1.5 leading-none">
                      目標：輔 {activeMinor.name}
                      <span className="text-[9px] bg-indigo-500 font-bold px-1.5 py-0.5 rounded-sm shrink-0">
                        {activeMinor.code}
                      </span>
                    </h2>
                  ) : (
                    <h2 className="text-sm font-black text-white mt-1 flex items-center gap-1.5 leading-none">
                      學程：{activeMajor.name}主修
                      <span className="text-[9px] bg-teal-600 font-bold px-1.5 py-0.5 rounded-sm shrink-0">
                        {activeMajor.code}
                      </span>
                    </h2>
                  )}
                </div>
                
                <div className="flex space-x-1.5 shrink-0">
                  {/* Semester credit selection limit tracker */}
                  <div className="bg-slate-800/80 rounded-xl p-1 px-2.5 text-center text-[10px] min-w-[64px]">
                    <span className="text-slate-400 font-semibold block text-[8px] uppercase">本學期選課</span>
                    <strong className="text-indigo-400 font-black text-xs">
                      {simulatedCourses.reduce((sum, c) => sum + c.credits, 0)}
                    </strong>
                    <span className="text-slate-400">/{userProfile.minorDeptId !== "none" ? 26 : 22}</span>
                  </div>

                  {userProfile.minorDeptId !== "none" && (
                    /* Minor total progress indicator */
                    <div className="bg-slate-800/80 rounded-xl p-1 px-2.5 text-center text-[10px] min-w-[64px]">
                      <span className="text-slate-400 font-semibold block text-[8px] uppercase">輔系累計</span>
                      <strong className="text-emerald-400 font-black text-xs">
                        {completedMinorCredits}
                      </strong>
                      <span className="text-slate-400">/{activeMinor.totalRequiredCredits}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Mobile screen area */}
            <div className="flex-1 overflow-y-auto p-4 pb-12 relative" id="mobile-app-viewport">
              {notification && (
                <div id="school-alert-banner" className={`mb-3 p-3 rounded-xl border flex items-start gap-2.5 shadow-sm text-xs transition-all animate-bounce ${
                  notification.type === "error" 
                    ? "bg-rose-50 border-rose-200 text-rose-800" 
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}>
                  <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold">{notification.type === "error" ? "選課限制提示" : "提示"}</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{notification.message}</p>
                  </div>
                  <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600 font-bold px-1 text-sm leading-none shrink-0">
                    &times;
                  </button>
                </div>
              )}
              {renderTabContent()}
            </div>

            {/* Flutter-Style Tab Navigation Drawer bottom bar */}
            <div className="h-16 bg-white border-t border-slate-200 grid grid-cols-5 text-center shrink-0 shadow-lg relative z-40 select-none">
              
              <button
                id="tab-btn-courses"
                onClick={() => setActiveTab("courses")}
                className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold transition-all ${
                  activeTab === "courses" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <BookMarked className="w-5 h-5 shrink-0 transition-transform active:scale-90" />
                <span>選課中心</span>
              </button>

              <button
                id="tab-btn-timetable"
                onClick={() => setActiveTab("timetable")}
                className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold transition-all relative ${
                  activeTab === "timetable" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <CalendarDays className="w-5 h-5 shrink-0 transition-transform active:scale-90" />
                <span>模擬課表</span>
                {simulatedCourses.length > 0 && (
                  <span className="absolute top-2 right-4.5 w-4 h-4 bg-indigo-500 text-[10px] font-black text-white rounded-full flex items-center justify-center">
                    {simulatedCourses.length}
                  </span>
                )}
              </button>

              <button
                id="tab-btn-calculator"
                onClick={() => setActiveTab("calculator")}
                className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold transition-all ${
                  activeTab === "calculator" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <BarChart3 className="w-5 h-5 shrink-0 transition-transform active:scale-90" />
                <span>學分試算</span>
              </button>

              <button
                id="tab-btn-map"
                onClick={() => setActiveTab("map")}
                className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold transition-all ${
                  activeTab === "map" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <Map className="w-5 h-5 shrink-0 transition-transform active:scale-90" />
                <span>修課地圖</span>
              </button>

              <button
                id="tab-btn-profile"
                onClick={() => setActiveTab("profile")}
                className={`flex flex-col items-center justify-center space-y-1 text-[10px] font-bold transition-all ${
                  activeTab === "profile" ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                <UserCog className="w-5 h-5 shrink-0 transition-transform active:scale-90" />
                <span>檔案同步</span>
              </button>

            </div>

          </div>
        )}

      </PhoneShell>

      {/* 3. Global Full Screen Course details + Review Board Modal */}
      <CourseDetailModal
        course={selectedCourseDetails}
        comments={comments}
        userProfile={userProfile}
        onClose={() => setSelectedCourseDetails(null)}
        onAddComment={handleAddComment}
      />

    </div>
  );
}
