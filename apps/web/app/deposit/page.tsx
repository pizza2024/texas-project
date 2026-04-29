"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import "@/lib/i18n";
import api from "@/lib/api";
import {
  getStoredToken,
  getTokenPayload,
  handleExpiredSession,
  isTokenExpired,
} from "@/lib/auth";
import { UserAvatar } from "@/components/user-avatar";
import { setDepositConfirmedHandler } from "@/lib/socket";
import type { DepositConfirmedPayload } from "@texas/shared";
import { motion, AnimatePresence } from "framer-motion";

interface DepositAddress {
  address: string;
  network: string;
  token: string;
  rate: number;
}

interface DepositRecord {
  id: string;
  txHash: string;
  amount: number;
  chips: number;
  status: string;
  createdAt: string;
}

interface BonusStatus {
  eligible: boolean;
  claimed: boolean;
  bonusAmount: number;
  minDeposit: number;
  requirement?: string;
}

const pageBg: React.CSSProperties = {
  background:
    "radial-gradient(ellipse at 50% 20%, #0d2818 0%, #060e10 55%, #020406 100%)",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function shortTxHash(hash: string): string {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ?? "https://sepolia.etherscan.io";

function txUrl(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export default function DepositPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [depositInfo, setDepositInfo] = useState<DepositAddress | null>(null);
  const [history, setHistory] = useState<DepositRecord[]>([]);
  const [bonusStatus, setBonusStatus] = useState<BonusStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [nickname, setNickname] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [faucetMsg, setFaucetMsg] = useState<{
    type: "success" | "error";
    text: string;
    txHash?: string;
  } | null>(null);
  const [faucetCooldown, setFaucetCooldown] = useState(0);
  const [showDepositSuccess, setShowDepositSuccess] = useState(false);
  const [depositSuccessData, setDepositSuccessData] = useState<DepositConfirmedPayload | null>(null);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    if (isTokenExpired(token, 1000)) {
      void handleExpiredSession({ returnTo: "/deposit" });
      return;
    }

    const payload = getTokenPayload(token);
    setNickname(payload?.username ?? "");
    setUserId(payload?.sub ?? "");

    let cancelled = false;

    const loadData = async (retry = false) => {
      try {
        const [addrRes, histRes, bonusRes] = await Promise.all([
          api.get<DepositAddress>("/deposit/address"),
          api.get<DepositRecord[]>("/deposit/history"),
          api.get<BonusStatus>("/deposit/bonus/status"),
        ]);
        if (!cancelled) {
          setDepositInfo(addrRes.data);
          setHistory(histRes.data);
          setBonusStatus(bonusRes.data);
          setLoading(false);
        }
      } catch {
        if (!retry && !cancelled) {
          // Exponential backoff: 800ms → 1600ms → 3200ms → 6400ms (capped at 10s)
          const backoffDelay = Math.min(800 * 2 ** 1, 10_000);
          setTimeout(() => {
            if (!cancelled) void loadData(true);
          }, backoffDelay);
        } else if (!cancelled) {
          setError(t("deposit.loadError"));
          setLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [router, t]);

  useEffect(() => {
    setDepositConfirmedHandler((data: DepositConfirmedPayload) => {
      setDepositSuccessData(data);
      setShowDepositSuccess(true);
      // Prepend to history so user sees it immediately
      setHistory((prev) => [{
        id: 'new-' + data.txHash,
        txHash: data.txHash,
        amount: data.amount,
        chips: data.chips,
        status: 'CONFIRMED',
        createdAt: new Date().toISOString(),
      }, ...prev]);
      // Auto-dismiss after 3.5 seconds
      setTimeout(() => setShowDepositSuccess(false), 3500);
    });
  }, []);

  const handleCopy = async () => {
    if (!depositInfo) return;
    try {
      await navigator.clipboard.writeText(depositInfo.address);
    } catch {
      const el = document.createElement("textarea");
      el.value = depositInfo.address;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleFaucet = async () => {
    if (faucetLoading || faucetCooldown > 0) return;
    setFaucetLoading(true);
    setFaucetMsg(null);
    try {
      const res = await api.post<{ txHash: string; amount: number }>(
        "/deposit/faucet",
      );
      const { txHash, amount } = res.data;
      setFaucetMsg({
        type: "success",
        text: t("deposit.faucetSuccess", { amount }),
        txHash,
      });
      // 60s cooldown countdown
      setFaucetCooldown(60);
      const timer = setInterval(() => {
        setFaucetCooldown((v) => {
          if (v <= 1) {
            clearInterval(timer);
            return 0;
          }
          return v - 1;
        });
      }, 1000);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      setFaucetMsg({ type: "error", text: msg ?? "领取失败，请稍后重试" });
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-white" style={pageBg}>
      {/* Nav */}
      <header
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{
          borderColor: "rgba(74,222,128,0.2)",
          background: "rgba(0,0,0,0.4)",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/rooms")}
          className="text-sm font-medium transition-colors"
          style={{ color: "rgba(74,222,128,0.8)" }}
        >
          {t("common.backToLobby")}
        </button>

        <h1
          className="text-base font-bold tracking-widest uppercase"
          style={{ color: "#4ade80" }}
        >
          {t("common.deposit")}
        </h1>

        <div className="flex items-center gap-2">
          <UserAvatar userId={userId} size={28} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>
            {nickname}
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <span className="text-sm" style={{ color: "rgba(74,222,128,0.6)" }}>
              {t("common.loading")}
            </span>
          </div>
        )}

        {error && (
          <div
            className="rounded-xl p-4 text-sm text-center"
            style={{
              background: "rgba(248,113,113,0.12)",
              border: "1px solid rgba(248,113,113,0.25)",
              color: "#f87171",
            }}
          >
            {error}
          </div>
        )}

        {!loading && !error && bonusStatus && (
          <div
            className="rounded-2xl p-4 space-y-2"
            style={{
              background:
                "linear-gradient(135deg, rgba(251,191,36,0.10) 0%, rgba(245,158,11,0.05) 100%)",
              border: "1px solid rgba(251,191,36,0.30)",
              boxShadow: "0 0 24px rgba(251,191,36,0.06)",
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">🎁</span>
              <p className="text-sm font-semibold" style={{ color: "#fbbf24" }}>
                首充 bonus
              </p>
              {bonusStatus.claimed && (
                <span
                  className="ml-auto px-2 py-0.5 rounded text-xs font-bold"
                  style={{
                    background: "rgba(74,222,128,0.15)",
                    color: "#4ade80",
                    border: "1px solid rgba(74,222,128,0.30)",
                  }}
                >
                  ✅ 已领取
                </span>
              )}
            </div>
            <div className="text-xs space-y-1">
              <p style={{ color: "rgba(255,255,255,0.5)" }}>
                最低充值{" "}
                <span style={{ color: "#fbbf24" }}>
                  {bonusStatus.minDeposit} USDT
                </span>
                ，额外获得{" "}
                <span style={{ color: "#4ade80" }}>
                  +{bonusStatus.bonusAmount} 筹码
                </span>
              </p>
              {bonusStatus.requirement && (
                <p style={{ color: "rgba(255,255,255,0.35)" }}>
                  {bonusStatus.requirement}
                </p>
              )}
              {!bonusStatus.claimed && bonusStatus.eligible && (
                <p className="font-medium" style={{ color: "#a3e635" }}>
                  ✓ 您已满足首充条件，充值后bonus自动到账
                </p>
              )}
              {!bonusStatus.eligible && !bonusStatus.claimed && (
                <p style={{ color: "rgba(255,255,255,0.35)" }}>
                  首充完成后可领取
                </p>
              )}
            </div>
          </div>
        )}

        {!loading && !error && depositInfo && (
          <>
            {/* Deposit Address Card */}
            <div
              className="rounded-2xl p-5 space-y-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(74,222,128,0.08) 0%, rgba(16,185,129,0.05) 100%)",
                border: "1px solid rgba(74,222,128,0.25)",
                boxShadow: "0 0 40px rgba(74,222,128,0.05)",
              }}
            >
              <p
                className="text-xs uppercase tracking-widest font-semibold"
                style={{ color: "rgba(74,222,128,0.7)" }}
              >
                {t("deposit.yourAddress")}
              </p>

              {/* QR Code */}
              <div className="flex justify-center py-2">
                <div
                  className="rounded-2xl p-3"
                  style={{ background: "#ffffff", display: "inline-block" }}
                >
                  <QRCodeSVG
                    value={depositInfo.address}
                    size={160}
                    bgColor="#ffffff"
                    fgColor="#000000"
                    level="M"
                  />
                </div>
              </div>

              {/* Address row */}
              <div
                className="rounded-xl p-3 flex items-center gap-3 cursor-pointer group"
                style={{
                  background: "rgba(0,0,0,0.35)",
                  border: "1px solid rgba(74,222,128,0.15)",
                }}
                onClick={handleCopy}
              >
                <code
                  className="flex-1 text-sm break-all select-all"
                  style={{ color: "#a3e635", fontFamily: "monospace" }}
                >
                  {depositInfo.address}
                </code>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopy();
                  }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                  style={
                    copied
                      ? {
                          background: "rgba(74,222,128,0.25)",
                          color: "#4ade80",
                          border: "1px solid rgba(74,222,128,0.5)",
                        }
                      : {
                          background: "rgba(74,222,128,0.12)",
                          color: "rgba(74,222,128,0.8)",
                          border: "1px solid rgba(74,222,128,0.25)",
                        }
                  }
                >
                  {copied ? t("deposit.copied") : t("deposit.copy")}
                </button>
              </div>

              {/* Meta info */}
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(74,222,128,0.12)",
                  }}
                >
                  <p
                    className="text-xs mb-1"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("deposit.network")}
                  </p>
                  <p
                    className="font-semibold text-xs"
                    style={{ color: "#60a5fa" }}
                  >
                    🔵 Sepolia
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(74,222,128,0.12)",
                  }}
                >
                  <p
                    className="text-xs mb-1"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("deposit.token")}
                  </p>
                  <p
                    className="font-semibold text-xs"
                    style={{ color: "#facc15" }}
                  >
                    {depositInfo.token} (ERC-20)
                  </p>
                </div>
                <div
                  className="rounded-xl p-3 text-center"
                  style={{
                    background: "rgba(0,0,0,0.25)",
                    border: "1px solid rgba(74,222,128,0.12)",
                  }}
                >
                  <p
                    className="text-xs mb-1"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                  >
                    {t("deposit.rate")}
                  </p>
                  <p
                    className="font-semibold text-xs"
                    style={{ color: "#4ade80" }}
                  >
                    1 USDT = {depositInfo.rate} {t("deposit.chips")}
                  </p>
                </div>
              </div>
            </div>

            {/* Instructions */}
            <div
              className="rounded-xl px-4 py-3 space-y-1.5 text-xs"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                color: "rgba(255,255,255,0.4)",
              }}
            >
              <p>• {t("deposit.hint1")}</p>
              <p>• {t("deposit.hint2")}</p>
              <p>• {t("deposit.hint3")}</p>
            </div>

            {/* Faucet */}
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.25)",
              }}
            >
              <div>
                <p
                  className="text-sm font-semibold"
                  style={{ color: "rgba(165,180,252,0.9)" }}
                >
                  🚰 测试 USDT 水龙头
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "rgba(255,255,255,0.4)" }}
                >
                  每 60 秒可领取一次，100 USDT 自动到账
                </p>
              </div>
              <button
                type="button"
                disabled={faucetLoading || faucetCooldown > 0}
                onClick={() => void handleFaucet()}
                className="w-full py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all"
                style={
                  faucetLoading || faucetCooldown > 0
                    ? {
                        background: "rgba(99,102,241,0.15)",
                        color: "rgba(165,180,252,0.4)",
                        cursor: "not-allowed",
                        border: "1px solid rgba(99,102,241,0.15)",
                      }
                    : {
                        background: "rgba(99,102,241,0.25)",
                        color: "#a5b4fc",
                        cursor: "pointer",
                        border: "1px solid rgba(99,102,241,0.5)",
                      }
                }
              >
                {faucetLoading
                  ? "领取中..."
                  : faucetCooldown > 0
                    ? `${faucetCooldown}s 后可再次领取`
                    : "领取 100 测试 USDT"}
              </button>
              {faucetMsg && (
                <div className="text-xs text-center space-y-1">
                  <p
                    style={{
                      color:
                        faucetMsg.type === "success" ? "#4ade80" : "#f87171",
                    }}
                  >
                    {faucetMsg.text}
                  </p>
                  {faucetMsg.txHash && (
                    <a
                      href={txUrl(faucetMsg.txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono hover:underline"
                      style={{ color: "#60a5fa" }}
                    >
                      🔗 {shortTxHash(faucetMsg.txHash)} 在区块链浏览器查看 ↗
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* History */}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(74,222,128,0.15)" }}
            >
              <div
                className="px-4 py-3"
                style={{
                  background: "rgba(74,222,128,0.08)",
                  borderBottom: "1px solid rgba(74,222,128,0.15)",
                }}
              >
                <h2
                  className="text-sm font-semibold tracking-wide uppercase"
                  style={{ color: "#4ade80" }}
                >
                  {t("deposit.history")}
                </h2>
              </div>

              {history.length === 0 ? (
                <div
                  className="px-4 py-8 text-center text-sm"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {t("deposit.noHistory")}
                </div>
              ) : (
                <div
                  className="divide-y"
                  style={{ borderColor: "rgba(74,222,128,0.08)" }}
                >
                  {history.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center gap-2 px-4 py-3 text-xs flex-wrap"
                      style={{ background: "rgba(0,0,0,0.15)" }}
                    >
                      <span
                        style={{
                          color: "rgba(255,255,255,0.4)",
                          minWidth: "120px",
                        }}
                      >
                        {formatDateTime(record.createdAt)}
                      </span>
                      <a
                        href={txUrl(record.txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono transition-colors hover:underline"
                        style={{ color: "#60a5fa" }}
                      >
                        {shortTxHash(record.txHash)}
                      </a>
                      <span className="flex-1" />
                      <span style={{ color: "#facc15" }}>
                        +{record.amount} USDT
                      </span>
                      <span style={{ color: "#4ade80" }}>
                        +{record.chips} {t("deposit.chips")}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded font-bold"
                        style={{
                          background: "rgba(74,222,128,0.12)",
                          color: "#4ade80",
                          border: "1px solid rgba(74,222,128,0.25)",
                        }}
                      >
                        ✅ {t("deposit.confirmed")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <AnimatePresence>
        {showDepositSuccess && depositSuccessData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowDepositSuccess(false)}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="relative w-full max-w-sm rounded-2xl p-6 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(74,222,128,0.15) 0%, rgba(16,185,129,0.08) 100%)',
                border: '1px solid rgba(74,222,128,0.5)',
                boxShadow: '0 0 60px rgba(74,222,128,0.25), 0 0 120px rgba(74,222,128,0.1)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Animated checkmark circle */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 20 }}
                className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
                style={{ background: 'rgba(74,222,128,0.2)', border: '2px solid rgba(74,222,128,0.5)' }}
              >
                <span className="text-4xl">💰</span>
              </motion.div>
              <motion.h3
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="mb-2 text-xl font-bold"
                style={{ color: '#4ade80' }}
              >
                Deposit Confirmed!
              </motion.h3>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mb-1 text-sm"
                style={{ color: 'rgba(255,255,255,0.6)' }}
              >
                充值已到账
              </motion.p>
              <motion.div
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-4 inline-flex flex-col items-center gap-1 rounded-xl px-4 py-2"
                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(74,222,128,0.2)' }}
              >
                <p className="text-lg font-bold" style={{ color: '#facc15' }}>
                  +{depositSuccessData.amount} USDT
                </p>
                <p className="text-sm font-semibold" style={{ color: '#4ade80' }}>
                  → +{depositSuccessData.chips} Chips
                </p>
              </motion.div>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="mt-4 cursor-pointer text-xs underline"
                style={{ color: 'rgba(255,255,255,0.35)' }}
                onClick={() => setShowDepositSuccess(false)}
              >
                Tap to dismiss
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
