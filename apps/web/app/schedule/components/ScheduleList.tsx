"use client";

import { useState, useEffect, useRef } from "react";
import api from "@/lib/api";
import { TournamentCard, type ScheduleEntry } from "./TournamentCard";

interface ScheduleListProps {
  registeredOnly?: boolean;
}

export function ScheduleList({ registeredOnly = false }: ScheduleListProps) {
  const [entries, setEntries] = useState<ScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;
  const registeredOnlyRef = useRef(registeredOnly);
  registeredOnlyRef.current = registeredOnly;

  const fetchEntries = async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: limit.toString(),
      });
      if (registeredOnlyRef.current) {
        params.set("status", "SCHEDULED"); // Show registered (upcoming)
      }
      const res = await api.get(`/tournament-schedule?${params.toString()}`);
      setEntries(res.data.entries);
      setTotal(res.data.total);
      setPage(pageNum);
    } catch {
      setError("Failed to load tournaments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntries(1);
  }, [registeredOnly]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div
          className="w-10 h-10 border-2 border-t-green-500 rounded-full animate-spin"
          style={{
            borderColor: "rgba(34,197,94,0.2)",
            borderTopColor: "#22c55e",
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={() => fetchEntries(page)}
          className="px-4 py-2 rounded-lg border border-green-800 text-green-400 text-sm hover:bg-green-900/20 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg mb-2">No tournaments found</p>
        <p className="text-gray-500 text-sm">
          {registeredOnly
            ? "You haven't registered for any upcoming tournaments yet."
            : "Check back later for upcoming tournaments."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-4">
        {entries.map((entry) => (
          <TournamentCard key={entry.id} tournament={entry} />
        ))}
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button
            onClick={() => fetchEntries(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 rounded-lg border border-green-900/40 text-green-400 text-sm hover:bg-green-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-gray-400 text-sm">
            Page {page} of {Math.ceil(total / limit)}
          </span>
          <button
            onClick={() => fetchEntries(page + 1)}
            disabled={page >= Math.ceil(total / limit)}
            className="px-4 py-2 rounded-lg border border-green-900/40 text-green-400 text-sm hover:bg-green-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
