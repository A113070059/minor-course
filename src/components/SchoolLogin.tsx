/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { UserProfile } from "../types";
import { GraduationCap, ArrowRight, ShieldCheck, Mail, User, Key, HelpCircle, LogIn, LogOut } from "lucide-react";
import { DEPARTMENTS } from "../data";
import { signInWithPopup, signOut, User as FirebaseUser } from "firebase/auth";
import { auth, googleProvider } from "../firebase";

interface SchoolLoginProps {
  onLoginSuccess: (
    name: string,
    email: string,
    studentId: string,
    majorId: string,
    minorId: string,
    classGrade: string,
    classGroup: string
  ) => void;
}

/**
 * Shih Hsin University (世新大學) Student ID Decoder.
 * Based on rule: A113070059 where
 * - A represents study system (A: 日間制學士班, M: 碩士班, S/C: 進修學士班)
 * - 113 represents entry academic year (民國113年)
 * - 070 represents major/dept code (070: 資傳系, 221/222: 資管系, 270: 企管系, 050: 公廣系, 080: 數媒系, etc.)
 * - 059 represents student serial code
 */
export function parseShuStudentId(studentId: string) {
  if (!studentId || studentId.length < 2) return null;
  
  const cleanId = studentId.toUpperCase();
  const firstLetter = cleanId[0];
  
  // 1. Study System
  let system = "其他學制";
  if (firstLetter === "A") {
    system = "日間制學士班";
  } else if (firstLetter === "M") {
    system = "碩士班";
  } else if (firstLetter === "S" || firstLetter === "C") {
    system = "進修學士班";
  }

  // 2. Year (2nd, 3rd, 4th character)
  let yearStr = "";
  if (cleanId.length >= 4) {
    yearStr = cleanId.substring(1, 4);
  } else if (cleanId.length > 1) {
    yearStr = cleanId.substring(1);
  }
  const yearNum = parseInt(yearStr, 10);
  const isValidYear = !isNaN(yearNum) && yearNum >= 50 && yearNum <= 150;
  const yearInfo = isValidYear ? `${yearNum}學年度 (民國 ${yearNum} 年入學)` : yearStr ? `民國 ${yearStr} 年起` : "解析中";

  // 3. Dept Code (5th, 6th, 7th character)
  let deptCode = "";
  let deptName = "未知科系 (可於下方自訂)";
  let deptId = "";

  if (cleanId.length >= 7) {
    deptCode = cleanId.substring(4, 7);
  } else if (cleanId.length > 4) {
    deptCode = cleanId.substring(4);
  }

  if (deptCode && deptCode.length === 3) {
    const found = DEPARTMENTS.find((d) => d.code === deptCode);
    if (found) {
      deptName = found.name;
      deptId = found.id;
    }
  }

  // 4. Student Serial Code
  let serialCode = "";
  if (cleanId.length >= 8) {
    serialCode = cleanId.substring(7);
  }

  return {
    system,
    year: yearInfo,
    deptCode,
    deptName,
    deptId,
    serialCode: serialCode ? `第 ${serialCode} 號流水學生` : ""
  };
}

export default function SchoolLogin({ onLoginSuccess }: SchoolLoginProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedMajor, setSelectedMajor] = useState("270");
  const [selectedMinor, setSelectedMinor] = useState("221");
  const [selectedGrade, setSelectedGrade] = useState("二年級");
  const [selectedGroup, setSelectedGroup] = useState("甲");
  
  const [extractedStudentId, setExtractedStudentId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Google login states
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isGoogleLogged, setIsGoogleLogged] = useState(false);

  // Log in with Google Auth
  const handleGoogleLogin = async () => {
    setErrorMessage("");
    setIsLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      if (user) {
        setGoogleUser(user);
        setIsGoogleLogged(true);

        // 1. Clean name (detect and remove "世新" or "世新大學")
        let origName = user.displayName || "";
        let cleanedName = origName.replace(/世新(大學)?/g, "").trim();
        if (!cleanedName) {
          cleanedName = "SHU 學生";
        }
        setName(cleanedName);

        // 2. Extract email details
        const userEmail = user.email || "";
        setEmail(userEmail);

        // 3. Detect if the email domain is mail.shu.edu.tw
        const isShuEmail = userEmail.toLowerCase().endsWith("@mail.shu.edu.tw");
        if (isShuEmail) {
          const prefix = userEmail.split("@")[0].toUpperCase();
          setExtractedStudentId(prefix);
          const parsed = parseShuStudentId(prefix);
          if (parsed && parsed.deptId) {
            setSelectedMajor(parsed.deptId);
          }
        } else {
          setExtractedStudentId("");
        }
      }
    } catch (error: any) {
      console.error("Google sign in error: ", error);
      if (error.code === "auth/popup-blocked") {
        setErrorMessage("登入視窗被您的瀏覽器封鎖，請允許快顯/彈出視窗並重試。");
      } else if (error.code === "auth/unauthorized-domain" || (error.message && error.message.includes("unauthorized-domain"))) {
        setErrorMessage(
          `【網域授權未啟用通知 (Firebase Unauthorized Domain)】\n\n` +
          `此 Firebase 專案目前尚未將您的運行網域加入授權清單中。\n\n` +
          `👉 請將以下目前的網域複製並填寫至您的 Firebase 帳密後台：\n` +
          `　 ───\n` +
          `　 📌 點選進入 Firebase 網頁控制台 (Console)\n` +
          `　 📌 尋找本專案 ➔ 展開「Authentication」\n` +
          `　 📌 點擊上方頁籤「Settings」➔ 左欄選「Authorized domains」\n` +
          `　 📌 在「Authorized domains」清單中點選「Add domain」按鈕，並新增此網域：\n` +
          `　 　 ➔ ${window.location.hostname}\n` +
          `　 ───\n\n` +
          `設定儲存後無須重啟，直接在本頁面點擊 Google 一鍵登入即可正常運作！`
        );
      } else {
        setErrorMessage("Google 驗證失敗：" + (error.message || "未知錯誤"));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Log out warning:", e);
    }
    setGoogleUser(null);
    setIsGoogleLogged(false);
    setName("");
    setEmail("");
    setExtractedStudentId("");
  };

  // Dynamically auto-select major based on parsed student ID's department code
  useEffect(() => {
    if (extractedStudentId) {
      const parsed = parseShuStudentId(extractedStudentId);
      if (parsed && parsed.deptId) {
        setSelectedMajor(parsed.deptId);
      }
    }
  }, [extractedStudentId]);

  // Prevent minor being the same as major
  useEffect(() => {
    if (selectedMajor === selectedMinor) {
      setSelectedMinor("none");
    }
  }, [selectedMajor, selectedMinor]);

  return (
    <div className="flex-1 bg-gradient-to-b from-slate-900 via-slate-800 to-indigo-950 overflow-y-auto py-8 px-6 text-white flex flex-col items-center">
      <div className="w-full max-w-md my-auto bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/15 shadow-2xl space-y-6">
        
        {/* SHU Branding & Greeting */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-500 to-red-700 flex items-center justify-center shadow-lg border border-red-400">
            <GraduationCap className="w-9 h-9 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white tracking-tight">世新大學 SHU</h2>
            <p className="text-xs text-rose-300 font-bold tracking-wider">
              輔修與雙主修智慧預選選課系統
            </p>
          </div>
          <div className="h-0.5 w-12 bg-rose-500 mx-auto rounded-full"></div>
        </div>

        {/* Introduction Note */}
        <div className="text-[11px] bg-white/5 p-3 rounded-xl border border-white/5 leading-relaxed text-slate-300">
          歡迎使用世新智慧輔課管理大腦。在使用前，請先<strong>登入或註冊學校信箱帳號</strong>，系統將自動解析出您的專屬學籍學號，便於匯出個人客製化修課門檻排程。
        </div>

        {errorMessage && (
          <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-xs text-red-200 font-medium whitespace-pre-wrap leading-relaxed select-text">
            ⚠️ {errorMessage}
          </div>
        )}

        {isGoogleLogged ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onLoginSuccess(
                name.trim(),
                email,
                extractedStudentId || "GUEST-" + Math.floor(Math.random() * 100000),
                selectedMajor,
                selectedMinor,
                selectedGrade,
                selectedGroup
              );
            }}
            className="space-y-4 text-xs"
          >
            {/* Google Connected Card */}
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-3.5 rounded-2xl flex items-center gap-3">
              {googleUser?.photoURL ? (
                <img referrerPolicy="no-referrer" src={googleUser.photoURL} alt="Profile" className="w-10 h-10 rounded-full border border-emerald-400" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {name[0] || "G"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-emerald-300 text-xs flex items-center gap-1">
                  <span>Google 驗證成功</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </p>
                <div className="text-[10px] text-slate-350 truncate">{email}</div>
              </div>
              <button
                type="button"
                onClick={handleGoogleLogout}
                className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg font-bold border border-white/10 shrink-0 transition-all flex items-center gap-1"
                title="登出切換帳號"
              >
                <LogOut className="w-3 h-3 text-rose-300" />
                <span>切換</span>
              </button>
            </div>

            {/* Profile Config Information */}
            <div className="space-y-3.5 bg-slate-950/35 border border-white/10 rounded-2xl p-4 shadow-inner">
              <p className="font-bold text-[11px] text-rose-300 border-b border-white/5 pb-1 flex items-center justify-between">
                <span>確認學籍與選課設定</span>
                {email.toLowerCase().endsWith("@mail.shu.edu.tw") && (
                  <span className="text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 px-1 py-0.5 rounded font-bold">
                    世新官方信箱已對應
                  </span>
                )}
              </p>
              
              {/* Cleaned Name input */}
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-rose-400" />
                  您的姓名 (已自動偵測過濾 "世新")
                </label>
                <input
                  type="text"
                  required
                  placeholder="請確認或輸入您的真實姓名"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* If is SHU email, display customized decoded status */}
              {email.toLowerCase().endsWith("@mail.shu.edu.tw") ? (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                      智慧解析世新學籍 (Student ID)
                    </span>
                  </div>

                  {extractedStudentId && (
                    <div className="py-2.5 bg-black/35 rounded-xl border border-white/5 flex flex-col items-center">
                      <span className="text-base text-rose-400 tracking-widest font-black font-mono">
                        {extractedStudentId}
                      </span>
                      <span className="text-[9px] text-slate-400 font-semibold mt-1 flex items-center gap-1">
                        主修科系：
                        <strong className="text-white font-bold">
                          {parseShuStudentId(extractedStudentId)?.deptName || "分析中"}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                /* Non-SHU account manual entry */
                <div className="space-y-2 pt-1 border-t border-white/5 mt-2">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400">
                      輸入學號 (Student ID)
                    </label>
                    <input
                      type="text"
                      placeholder="例如: A113070059"
                      value={extractedStudentId}
                      onChange={(e) => setExtractedStudentId(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900/40 border border-white/10 rounded-xl p-2.5 text-xs text-white uppercase font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-slate-400">
                      本系主修科系 (Major)
                    </label>
                    <select
                      value={selectedMajor}
                      onChange={(e) => setSelectedMajor(e.target.value)}
                      className="w-full bg-slate-900/40 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                    >
                      {DEPARTMENTS.map((d) => (
                        <option key={d.id} value={d.id} className="bg-slate-850 text-white">
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Selection of minor academic details */}
              <div className="grid grid-cols-2 gap-3 pt-2.5 border-t border-white/5 mt-2.5">
                <div className="space-y-1 col-span-2 bg-rose-500/5 p-2.5 rounded-xl border border-rose-500/10">
                  <label className="block text-[10.5px] font-bold text-rose-300 flex items-center gap-1 mb-0.5">
                    <HelpCircle className="w-3.5 h-3.5 text-rose-450" />
                    選擇您的預選輔系 (Select Minor)
                  </label>
                  <select
                    value={selectedMinor}
                    onChange={(e) => setSelectedMinor(e.target.value)}
                    className="w-full bg-slate-900/70 border border-white/10 rounded-xl p-2.5 text-xs text-indigo-200 font-bold focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="none" className="bg-slate-850 text-white">無輔系 (不加選/最高上限22學分)</option>
                    {DEPARTMENTS.filter((d) => d.id !== selectedMajor).map((d) => (
                      <option key={d.id} value={d.id} className="bg-slate-850 text-white">
                        {d.name} （代碼：{d.code}）
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400">
                    本系年級 (Grade)
                  </label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="w-full bg-slate-900/40 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="一年級" className="bg-slate-850 text-white">一年級</option>
                    <option value="二年級" className="bg-slate-850 text-white">二年級</option>
                    <option value="三年級" className="bg-slate-850 text-white">三年級</option>
                    <option value="四年級" className="bg-slate-850 text-white">四年級</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-400">
                    班級組別 (Class)
                  </label>
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="w-full bg-slate-900/40 border border-white/10 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="甲" className="bg-slate-850 text-white">甲班</option>
                    <option value="乙" className="bg-slate-850 text-white">乙班</option>
                    <option value="丙" className="bg-slate-850 text-white">丙班</option>
                    <option value="丁" className="bg-slate-850 text-white">丁班</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl py-3.5 font-bold transition-all shadow-lg flex items-center justify-center space-x-2 text-xs cursor-pointer select-none"
            >
              <span>確認登入並開啟智慧選課大腦</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </form>
        ) : (
          /* Enforced Google login trigger only */
          <div className="space-y-4 pt-2">
            <div className="text-center py-2 text-slate-300 text-xs leading-relaxed font-semibold">
              為確保修課資料精準對接，智慧大腦已全面啟用安全驗證。請使用您的 
              <strong className="text-rose-400 px-1 font-extrabold">Google 學校郵件</strong> 或個人 Google 帳戶安全登入：
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full bg-white text-red-600 hover:bg-slate-50 rounded-2xl py-3.5 px-4 transition-all shadow-xl flex items-center justify-center gap-3 text-xs select-none cursor-pointer border border-slate-200 active:scale-98"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52v.01z"
                />
              </svg>
              {isLoading ? (
                <span className="text-red-600 font-black flex items-center gap-1.5 text-sm">
                  <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-red-600 border-t-transparent"></span>
                  <span>Google 驗證連線中...</span>
                </span>
              ) : (
                <span className="text-red-600 font-black tracking-wide text-sm">
                  使用Google賬號一鍵登入
                </span>
              )}
            </button>
          </div>
        )}

        {/* Footer info */}
        <div className="text-center font-medium text-[10px] text-slate-500 flex items-center justify-center space-x-1 select-none">
          <ShieldCheck className="w-3.5 h-3.5 text-rose-500/65" />
          <span>通訊全程採用校園內置 AES 密鑰加密保護</span>
        </div>

      </div>
    </div>
  );
}
