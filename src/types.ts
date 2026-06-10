/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface TimeSlot {
  day: number; // 1 = Monday, 2 = Tuesday, ..., 5 = Friday
  slots: number[]; // e.g. [3, 4] represents the 3rd and 4th periods (09:00 - 11:00 or similar)
}

export interface Course {
  id: string;
  code: string; // e.g. "CS101"
  name: string;
  departmentId: string; // The department offering this course
  credits: number;
  instructor: string;
  timeSlots: TimeSlot[];
  location: string;
  syllabus: string;
  isRequired: boolean; // Is it required for the minor in its department?
  category: "核心必修" | "專業選修" | "基礎工具" | "進階應用";
  prerequisites?: string[]; // Course codes that are helpful or required before this course
  isNotOfferedThisSemester?: boolean; // Added flag for courses not offered this semester
}

export interface Department {
  id: string;
  name: string;
  code: string; // e.g. "CS", "BA", "EE"
  totalRequiredCredits: number; // For MINOR (輔系門檻) e.g., 20 credits
  requiredCoreCredits: number;  // Required courses portion e.g., 9 credits
  electiveCredits: number;      // Elective courses portion e.g., 11 credits
  intro: string;
}

export interface CourseComment {
  id: string;
  courseId: string;
  reviewer: string;
  ratingDifficulty: number; // 1-5 star (1=簡單, 5=極難)
  ratingValue: number;      // 1-5 star (1=收穫低, 5=收穫極豐富)
  content: string;
  date: string;
}

export interface UserProfile {
  name: string;
  studentId: string;
  email?: string;
  isLoggedIn?: boolean;
  majorDeptId: string;
  minorDeptId: string;
  classGrade?: string; // e.g. "一年級", "二年級", "三年級", "四年級"
  classGroup?: string; // e.g. "甲", "乙", "丙", "丁"
  completedCourseIds: string[]; // Already finished in the past semesters
  simulatedCourseIds: string[]; // Course currently selected in simulator
}

export interface ConflictAlert {
  courseA: Course;
  courseB: Course;
  day: number;
  slots: number[];
}

/**
 * Checks if a course fits the user's registered grade and group (e.g. "二年級", "甲").
 * 
 * Rules:
 * 1. Grade check based on course code suffix pattern: xxx-1xx mapped to "一年級", xxx-2xx to "二年級", etc.
 * 2. Group/Class check: Match designated classes in syllabus/name or determine division through sibling group sections.
 */
export function isCourseMatchUserClass(
  course: Course,
  userGrade: string | undefined,
  userGroup: string | undefined,
  allCourses: Course[],
  studentId?: string
): boolean {
  if (!userGrade || !userGroup) return true;

  // 1. Grade Match
  let courseGradeNum = "";
  const gradeMatch = course.code.match(/[A-Z]+-(\d)\d\d/i);
  if (gradeMatch) {
    courseGradeNum = gradeMatch[1];
  }

  // Override rule: INFO-227-01-A1 (資訊圖表設計) is physically a 3rd year course (三年級)
  if (course.code.startsWith("INFO-227")) {
    courseGradeNum = "3";
  }

  const gradeMap: Record<string, string> = {
    "一年級": "1",
    "二年級": "2",
    "三年級": "3",
    "四年級": "4"
  };

  const targetGradeNum = gradeMap[userGrade];
  if (courseGradeNum && targetGradeNum && courseGradeNum !== targetGradeNum) {
    return false; // Grade mismatch
  }

  // Special Rule: 互動程式設計 (INFO-205) is divided based on student ID suffix
  if (course.code.startsWith("INFO-205") || course.name.includes("互動程式設計")) {
    if (studentId) {
      const trimmedId = studentId.trim();
      const lastChar = trimmedId.charAt(trimmedId.length - 1);
      const lastDigit = parseInt(lastChar, 10);
      if (!isNaN(lastDigit)) {
        // Extract section number from course code (e.g., INFO-205-01-A1 -> 1, INFO-205-02-A1 -> 2, INFO-205-03-A1 -> 3)
        const parts = course.code.split("-");
        const sectionNum = parts.length >= 3 ? parseInt(parts[2], 10) : 1;

        if ([1, 2, 3].includes(lastDigit)) {
          return sectionNum === 1;
        } else if ([4, 5, 6].includes(lastDigit)) {
          return sectionNum === 2;
        } else {
          return sectionNum === 3;
        }
      }
    } else {
      // In display/selector mode (no studentId argument passed), treat as matching to allow any section to be visible and selectable
      return true;
    }
  }

  // 2. Group/Class Match (A, B, C, D maps to 甲, 乙, 丙, 丁)
  const groups = ["甲", "乙", "丙", "丁"];
  let designatedGroup: string | null = null;

  for (const grp of groups) {
    const hasGroupKeyword = 
      course.syllabus.includes(`${grp}必修`) ||
      course.syllabus.includes(`${grp}選修`) ||
      course.syllabus.includes(`系${grp}`) ||
      course.syllabus.includes(`二${grp}`) ||
      course.syllabus.includes(`一${grp}`) ||
      course.syllabus.includes(`三${grp}`) ||
      course.syllabus.includes(`四${grp}`) ||
      course.name.includes(`(${grp})`) ||
      course.name.includes(`（${grp}）`);

    if (hasGroupKeyword) {
      designatedGroup = grp;
      break;
    }
  }

  if (designatedGroup) {
    return designatedGroup === userGroup;
  }

  // If no explicit visual label in name or syllabus, check if there are multiple class sections (-01, -02)
  const prefixMatch = course.code.match(/^([A-Z]+-\d\d\d)-(\d+)/i);
  if (prefixMatch) {
    const baseCode = prefixMatch[1]; // e.g., "INFO-107"
    const sectionNum = parseInt(prefixMatch[2], 10);

    const siblingCourses = allCourses.filter(c => c.code.startsWith(baseCode));
    if (siblingCourses.length > 1) {
      // Multiple division branches exist! Map: 1 -> 甲, 2 -> 乙, 3 -> 丙, 4 -> 丁
      const groupMap: Record<number, string> = {
        1: "甲",
        2: "乙",
        3: "丙",
        4: "丁"
      };
      const mappedGroup = groupMap[sectionNum];
      if (mappedGroup) {
        return mappedGroup === userGroup;
      }
    }
  }

  return true;
}

/**
 * Determines whether a course is considered "Compulsory/Required" for a given minor department.
 */
export function isCourseRequiredForMinor(course: Course, minorDeptId: string): boolean {
  if (minorDeptId === "010") {
    return false;
  }

  if (minorDeptId === "221") {
    return course.departmentId === "221" && course.isRequired;
  }

  if (minorDeptId === "222") {
    return course.departmentId === "222" && course.isRequired;
  }

  if (minorDeptId === "230") {
    return course.departmentId === "230" && course.isRequired;
  }

  if (minorDeptId === "340") {
    return course.departmentId === "340" && course.isRequired;
  }

  if (minorDeptId === "050") {
    const requiredPradCore = ["公共關係概論", "廣告學概論", "行銷學", "數位圖像製作實務"];
    let nameToCheck = course.name.replace(/^\d+\s*/, "").trim();
    const match = nameToCheck.match(/^([^\s[A-Za-z(（]+)/);
    const chinesePrefix = match ? match[1].trim() : nameToCheck;
    return course.departmentId === "050" && requiredPradCore.includes(chinesePrefix);
  }

  if (minorDeptId === "070") {
    // For INFO (070), the 8 official compulsory courses listed on the PDF are:
    const requiredInfoNames = [
      "資訊傳播概論",
      "資訊行銷",
      "網頁設計",
      "數位內容策展",
      "數位內容設計",
      "資料庫系統",
      "資料庫系統開發實務",
      "資訊資源組織"
    ];
    return course.departmentId === "070" && requiredInfoNames.some(reqName => course.name.includes(reqName));
  }

  // Fallback default: if the course belongs to the minor department and is marked as isRequired in the database
  return course.departmentId === minorDeptId && course.isRequired;
}

/**
 * Assesses whether a course is eligible/present in the official Minor Curriculum schedule/guidelines.
 * Returns true if allowed, otherwise false.
 */
export function isCourseMatchMinorRequirements(course: Course, minorDeptId: string): boolean {
  if (minorDeptId === "010") {
    return course.departmentId === "010";
  }

  if (minorDeptId === "221") {
    return course.departmentId === "221";
  }

  if (minorDeptId === "222") {
    return course.departmentId === "222";
  }

  if (minorDeptId === "230") {
    return course.departmentId === "230";
  }

  if (minorDeptId === "340") {
    return course.departmentId === "340";
  }

  if (minorDeptId === "050") {
    if (course.departmentId !== "050") {
      return true;
    }

    const ALLOWED_NAMES = [
      "公共關係概論",
      "廣告學概論",
      "行銷學",
      "數位圖像製作實務",
      "廣告創意",
      "媒體關係",
      "數位行銷傳播與實務",
      "數位行銷傳播",
      "全媒體與公關寫作",
      "品牌傳播",
      "研究方法",
      "廣告策略與企劃",
      "危機與議題管理",
      "消費行為",
      "社群媒體行銷",
      "廣告與社會",
      "統計分析與市場研究",
      "創新科技與廣告",
      "故事行銷理論與實作",
      "敘事理論與說故事",
      "公關策略與企劃",
      "進階公共關係",
      "廣告專題研討",
      "公關輿論管理與實作",
      "公關專題研討"
    ].map((n) => n.replace(/^\d+\s*/, "").trim());

    let nameToCheck = course.name;
    nameToCheck = nameToCheck.replace(/^\d+\s*/, "").trim();
    const match = nameToCheck.match(/^([^\s[A-Za-z(（]+)/);
    const chinesePrefix = match ? match[1].trim() : nameToCheck;

    return ALLOWED_NAMES.includes(chinesePrefix);
  }

  if (minorDeptId === "070") {
    if (course.departmentId !== "070") {
      return true;
    }

    // 8 Compulsory courses are always allowed for the minor
    if (isCourseRequiredForMinor(course, "070")) {
      return true;
    }

    // Elective courses: Only allowed if they are 2nd, 3rd, or 4th year electives (Grade >= 2)
    const gradeMatch = course.code.match(/[A-Z]+-(\d)\d\d/i);
    let courseGradeNum = gradeMatch ? gradeMatch[1] : "1";
    if (course.code.startsWith("INFO-227")) {
      courseGradeNum = "3";
    }

    const grade = parseInt(courseGradeNum, 10);
    return grade >= 2;
  }

  return true;
}

