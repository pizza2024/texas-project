"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ExternalImg } from "@/components/ui/external-img";

function JoinPageContent() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";

  const [valid, setValid] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubAvatar, setClubAvatar] = useState<string | null>(null);
  const [clubDescription, setClubDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!code) {
      setError("Invalid invite link");
      setLoading(false);
      return;
    }
    api
      .get(`/clubs/validate-code?code=${encodeURIComponent(code)}`)
      .then((res) => {
        if (res.data.valid && res.data.club) {
          setValid(true);
          setClubName(res.data.club.name);
          setClubAvatar(res.data.club.avatar);
          // Fetch full club info
          return api.get(`/clubs/${res.data.club.id}`);
        } else {
          setError(
            t("club.invalidInviteCode") || "Invalid or expired invite code",
          );
        }
      })
      .then((res) => {
        if (res?.data) {
          setClubDescription(res.data.description ?? null);
        }
      })
      .catch(() => {
        setError(
          t("club.invalidInviteCode") || "Invalid or expired invite code",
        );
      })
      .finally(() => setLoading(false));
  }, [code, t]);

  const handleJoin = async () => {
    setJoining(true);
    setError("");
    try {
      await api.post("/clubs/join-by-code", { code });
      router.push("/club");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setError(String(msg || "Failed to join"));
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(160deg, #0c0a09 0%, #1c1917 100%)",
        }}
      >
        <div className="text-amber-200 font-black tracking-widest animate-pulse text-xl">
          LOADING...
        </div>
      </div>
    );
  }

  if (!valid) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(160deg, #0c0a09 0%, #1c1917 100%)",
        }}
      >
        <div className="text-center space-y-4">
          <div className="text-6xl">🚫</div>
          <h1 className="text-2xl font-black text-red-400">
            {t("club.invalidInviteCode") || "Invalid Invite Code"}
          </h1>
          <p className="text-gray-400">{error}</p>
          <Button onClick={() => router.push("/club")} className="mt-4">
            {t("club.browseClubs") || "Browse Clubs"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: "linear-gradient(160deg, #0c0a09 0%, #1c1917 100%)",
      }}
    >
      <div
        className="w-full max-w-sm mx-4 rounded-3xl p-8 space-y-6 text-center"
        style={{
          background:
            "linear-gradient(160deg, rgba(20,12,4,0.95) 0%, rgba(10,8,3,0.98) 100%)",
          border: "1px solid rgba(217,119,6,0.3)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
      >
        <div className="text-5xl">🎉</div>
        <p
          className="text-xs font-bold tracking-[0.3em] uppercase"
          style={{ color: "rgba(217,119,6,0.6)" }}
        >
          {t("club.youveBeenInvited") || "You've Been Invited!"}
        </p>

        <div className="flex justify-center">
          {clubAvatar ? (
            <ExternalImg
              src={clubAvatar}
              alt={clubName}
              className="w-20 h-20 rounded-2xl object-cover"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center font-black text-3xl text-white"
              style={{
                background:
                  "linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)",
              }}
            >
              {clubName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-black tracking-wide text-amber-200">
            {clubName}
          </h2>
          {clubDescription && (
            <p className="text-sm text-gray-400 mt-2">{clubDescription}</p>
          )}
        </div>

        <p className="text-xs text-gray-500">
          Use code:{" "}
          <span className="font-mono text-amber-300 tracking-widest">
            {code}
          </span>
        </p>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          onClick={handleJoin}
          loading={joining}
          className="w-full h-12 rounded-xl text-sm font-black uppercase tracking-widest"
          style={{
            background: joining
              ? "rgba(217,119,6,0.3)"
              : "linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)",
            color: "#fff",
            border: "none",
          }}
        >
          {joining
            ? "…"
            : t("club.joinThisClub") || "Join Club & Start Playing"}
        </Button>

        <button
          onClick={() => router.push("/club")}
          className="text-xs text-gray-500 hover:text-gray-300"
        >
          {t("club.browseClubs") || "Browse all clubs instead"}
        </button>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-screen flex items-center justify-center"
          style={{
            background: "linear-gradient(160deg, #0c0a09 0%, #1c1917 100%)",
          }}
        >
          <div className="text-amber-200 font-black tracking-widest animate-pulse text-xl">
            LOADING...
          </div>
        </div>
      }
    >
      <JoinPageContent />
    </Suspense>
  );
}
