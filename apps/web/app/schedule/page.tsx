"use client";

import { useState } from "react";
import Link from "next/link";
import { ScheduleList } from "./components/ScheduleList";

const pageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
};

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "registered">(
    "upcoming",
  );

  return (
    <div className="min-h-screen" style={pageBg}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 border-b border-green-900/30 backdrop-blur-md"
        style={{ background: "rgba(6, 14, 16, 0.9)" }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Tournament Schedule
              </h1>
              <p className="text-gray-400 text-sm mt-1">
                Upcoming tournaments and events
              </p>
            </div>
            <Link
              href="/rooms"
              className="px-4 py-2 rounded-xl border border-green-800/40 text-green-400 text-sm font-medium hover:bg-green-900/20 transition-colors"
            >
              Back to Rooms
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {[
              { key: "upcoming", label: "Upcoming Tournaments" },
              { key: "registered", label: "My Registrations" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all ${
                  activeTab === key
                    ? "text-white border-b-2 border-green-500"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <ScheduleList registeredOnly={activeTab === "registered"} />
      </div>
    </div>
  );
}
