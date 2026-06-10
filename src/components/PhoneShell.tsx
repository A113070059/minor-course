/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Smartphone, Laptop, Sparkles, BookOpen, Clock, Award } from "lucide-react";

interface PhoneShellProps {
  children: React.ReactNode;
}

export default function PhoneShell({ children }: PhoneShellProps) {
  return (
    <div className="h-screen w-full bg-slate-100 flex justify-center overflow-hidden">
      {/* Dynamic responsive mobile-first content layout wrapper */}
      <div 
        className="w-full md:max-w-[480px] h-full bg-white shadow-2xl flex flex-col relative border-x border-slate-200/50" 
        id="app-container-frame"
      >
        {/* Target application container */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
          {children}
        </div>
      </div>
    </div>
  );
}
