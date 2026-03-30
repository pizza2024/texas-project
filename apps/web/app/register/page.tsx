"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import { showSystemMessage } from "@/lib/system-message";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";

type Step = "email" | "otp" | "details";

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
  message?: string;
}

export default function RegisterPage() {
  const { t } = useTranslation();
  const router = useRouter();

  // Step 1 - Email
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Step 2 - OTP
  const [step, setStep] = useState<Step>("email");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailVerifyToken, setEmailVerifyToken] = useState("");

  // Step 3 - Account details
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  // Countdown
  const [countdown, setCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Error states
  const [emailError, setEmailError] = useState("");
  const [otpError, setOtpError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setIsSendingCode(true);
    try {
      await api.post("/auth/request-email-code", { email });
      await showSystemMessage({
        title: t("auth.codeSent") || "Code Sent",
        message:
          t("auth.codeSentMsg") ||
          `Verification code sent to ${email}. Check your inbox or spam folder.`,
        confirmText: t("common.iGotIt") || "OK",
      });
      setStep("otp");
      startCountdown(60);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const msg =
        apiErr?.response?.data?.message ||
        apiErr?.message ||
        "Failed to send code";
      if (
        msg.includes("already registered") ||
        msg.includes("already registered")
      ) {
        setEmailError("This email is already registered");
      } else if (msg.includes("wait")) {
        setEmailError(msg);
      } else {
        setEmailError("Failed to send code. Please try again.");
      }
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError("");

    // Auto-advance
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newOtp.every((d) => d !== "") && newOtp.join("").length === 6) {
      handleVerifyCode(newOtp.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (!pasted) return;
    const newOtp = pasted.split("").concat(Array(6 - pasted.length).fill(""));
    setOtp(newOtp);
    if (pasted.length === 6) {
      handleVerifyCode(pasted);
    }
  };

  const handleVerifyCode = async (code?: string) => {
    const finalCode = code || otp.join("");
    if (finalCode.length !== 6) {
      setOtpError("Please enter the 6-digit code");
      return;
    }

    setIsVerifying(true);
    setOtpError("");
    try {
      const res = await api.post("/auth/verify-email-code", {
        email,
        code: finalCode,
      });
      setEmailVerifyToken(res.data.emailVerifyToken);
      setStep("details");
      if (countdownRef.current) clearInterval(countdownRef.current);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const msg = apiErr?.response?.data?.message || "Invalid or expired code";
      setOtpError(msg);
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;
    await handleSendCode({ preventDefault: () => {} } as React.FormEvent);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetailsError("");

    if (password.length < 6) {
      setDetailsError("Password must be at least 6 characters");
      return;
    }
    if (nickname.length < 2) {
      setDetailsError("Nickname must be at least 2 characters");
      return;
    }

    setIsRegistering(true);
    try {
      await api.post("/auth/register-with-email", {
        email,
        emailVerifyToken,
        username,
        nickname,
        password,
      });
      await showSystemMessage({
        title: t("auth.registerSuccess"),
        message: t("auth.registerSuccessMsg"),
        confirmText: t("auth.confirmGoLogin"),
      });
      router.push("/login");
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      const msg = apiErr?.response?.data?.message || "Registration failed";
      setDetailsError(msg);
    } finally {
      setIsRegistering(false);
    }
  };

  const stepIndicator = () => {
    const steps: { num: number; label: string }[] = [
      { num: 1, label: t("auth.stepEmail") || "Email" },
      { num: 2, label: t("auth.stepVerify") || "Verify" },
      { num: 3, label: t("auth.stepAccount") || "Account" },
    ];
    const current = step === "email" ? 1 : step === "otp" ? 2 : 3;

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border"
              style={{
                background:
                  current >= s.num ? "rgba(234,179,8,0.2)" : "transparent",
                borderColor:
                  current >= s.num ? "#d97706" : "rgba(234,179,8,0.2)",
                color: current >= s.num ? "#fcd34d" : "rgba(234,179,8,0.3)",
              }}
            >
              {current > s.num ? "✓" : s.num}
            </div>
            <span
              className="text-[10px] tracking-widest uppercase"
              style={{
                color:
                  current >= s.num
                    ? "rgba(245,158,11,0.7)"
                    : "rgba(245,158,11,0.25)",
              }}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <div
                className="w-8 h-px"
                style={{
                  background:
                    current > s.num
                      ? "rgba(234,179,8,0.4)"
                      : "rgba(234,179,8,0.1)",
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div
      className="flex items-center justify-center min-h-screen relative overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 35%, #0d2818 0%, #060e10 55%, #020406 100%)",
      }}
    >
      <div className="absolute inset-0 pointer-events-none select-none overflow-hidden">
        <span className="absolute top-10 left-10 text-[9rem] font-serif opacity-[0.04] text-yellow-400 -rotate-12">
          ♠
        </span>
        <span className="absolute top-16 right-14 text-[11rem] font-serif opacity-[0.04] text-yellow-400 rotate-6">
          ♥
        </span>
        <span className="absolute bottom-14 left-20 text-[10rem] font-serif opacity-[0.04] text-yellow-400 rotate-3">
          ♦
        </span>
        <span className="absolute bottom-10 right-10 text-[9rem] font-serif opacity-[0.04] text-yellow-400 -rotate-6">
          ♣
        </span>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(234,179,8,0.04) 0%, transparent 70%)",
          }}
        />
      </div>

      <div
        className="relative z-10 w-[400px] rounded-2xl px-10 py-10"
        style={{
          background:
            "linear-gradient(160deg, rgba(12,22,16,0.97) 0%, rgba(6,12,9,0.99) 100%)",
          border: "1px solid rgba(234,179,8,0.25)",
          boxShadow:
            "0 0 0 1px rgba(234,179,8,0.08), 0 0 60px rgba(234,179,8,0.07), 0 25px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-3 leading-none">🃏</div>
          <h1
            className="text-3xl font-black tracking-[0.12em] uppercase"
            style={{
              background:
                "linear-gradient(135deg, #d97706 0%, #fcd34d 45%, #d97706 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            CHIPS
          </h1>
          <p className="text-[10px] tracking-[0.35em] text-yellow-700/60 mt-2 uppercase">
            ♠ &nbsp; ♥ &nbsp; {t("auth.createAccountSubtitle")} &nbsp; ♦ &nbsp;
            ♣
          </p>
        </div>

        {stepIndicator()}

        <div className="flex items-center gap-3 mb-6">
          <div
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(234,179,8,0.25))",
            }}
          />
          <span className="text-yellow-700/40 text-xs">◆</span>
          <div
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(90deg, rgba(234,179,8,0.25), transparent)",
            }}
          />
        </div>

        {/* ── STEP 1: Email ── */}
        {step === "email" && (
          <form onSubmit={handleSendCode} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="email"
                className="block text-[10px] font-bold tracking-[0.25em] uppercase"
                style={{ color: "rgba(245,158,11,0.7)" }}
              >
                {t("auth.email") || "Email"}
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                placeholder="you@example.com"
                required
                className="h-11 rounded-lg text-white placeholder:text-gray-700"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: emailError
                    ? "1px solid #ef4444"
                    : "1px solid rgba(234,179,8,0.2)",
                  outline: "none",
                }}
              />
              {emailError && (
                <p className="text-xs mt-1" style={{ color: "#f87171" }}>
                  {emailError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="username-step1"
                className="block text-[10px] font-bold tracking-[0.25em] uppercase"
                style={{ color: "rgba(245,158,11,0.7)" }}
              >
                {t("auth.username")}
              </label>
              <Input
                id="username-step1"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t("auth.username")}
                required
                minLength={3}
                className="h-11 rounded-lg text-white placeholder:text-gray-700"
                style={{
                  background: "rgba(0,0,0,0.4)",
                  border: "1px solid rgba(234,179,8,0.2)",
                  outline: "none",
                }}
              />
            </div>

            <Button
              type="submit"
              disabled={isSendingCode}
              className="w-full h-12 font-black tracking-[0.2em] text-sm uppercase rounded-lg mt-2 transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                color: "#000",
                border: "none",
                boxShadow:
                  "0 0 24px rgba(245,158,11,0.25), 0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              {isSendingCode
                ? t("auth.sending") || "Sending…"
                : t("auth.sendCode") || "Send Verification Code"}
            </Button>
          </form>
        )}

        {/* ── STEP 2: OTP ── */}
        {step === "otp" && (
          <div className="space-y-4">
            <p
              className="text-center text-sm leading-relaxed"
              style={{ color: "rgba(245,158,11,0.6)" }}
            >
              {t("auth.otpSentTo") || `Code sent to`}{" "}
              <span className="font-semibold" style={{ color: "#fcd34d" }}>
                {email}
              </span>
            </p>

            {/* OTP inputs */}
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    otpRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className="w-10 h-12 rounded-lg text-center text-xl font-bold text-white"
                  style={{
                    background: "rgba(0,0,0,0.5)",
                    border: otpError
                      ? "1px solid #ef4444"
                      : "1px solid rgba(234,179,8,0.25)",
                    outline: "none",
                  }}
                />
              ))}
            </div>

            {otpError && (
              <p className="text-center text-xs" style={{ color: "#f87171" }}>
                {otpError}
              </p>
            )}

            {isVerifying ? (
              <p
                className="text-center text-sm"
                style={{ color: "rgba(245,158,11,0.6)" }}
              >
                {t("common.loading") || "Verifying…"}
              </p>
            ) : (
              <Button
                onClick={() => handleVerifyCode()}
                disabled={otp.join("").length < 6}
                className="w-full h-12 font-black tracking-[0.2em] text-sm uppercase rounded-lg transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
                style={{
                  background:
                    "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                  color: "#000",
                  border: "none",
                  boxShadow:
                    "0 0 24px rgba(245,158,11,0.25), 0 4px 12px rgba(0,0,0,0.4)",
                }}
              >
                {t("auth.verifyCode") || "Verify Code"}
              </Button>
            )}

            <div className="text-center">
              {countdown > 0 ? (
                <p
                  className="text-xs"
                  style={{ color: "rgba(245,158,11,0.4)" }}
                >
                  {t("auth.resendIn") || `Resend in`} {countdown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResendCode}
                  className="text-xs underline transition-colors"
                  style={{ color: "rgba(245,158,11,0.6)" }}
                >
                  {t("auth.resendCode") || "Resend Code"}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep("email");
                if (countdownRef.current) clearInterval(countdownRef.current);
              }}
              className="w-full text-center text-xs transition-colors"
              style={{ color: "rgba(245,158,11,0.4)" }}
            >
              ← {t("auth.backToEmail") || "Back to Email"}
            </button>
          </div>
        )}

        {/* ── STEP 3: Account Details ── */}
        {step === "details" && (
          <form onSubmit={handleRegister} className="space-y-4">
            <p
              className="text-center text-sm"
              style={{ color: "rgba(245,158,11,0.6)" }}
            >
              {t("auth.emailVerifiedMsg") ||
                "Email verified! Set up your account."}
            </p>

            {[
              {
                id: "username",
                label: t("auth.username"),
                value: username,
                setter: setUsername,
                type: "text",
                disabled: true,
              },
              {
                id: "nickname",
                label: t("auth.nickname"),
                value: nickname,
                setter: (v: string) => {
                  setNickname(v);
                  setDetailsError("");
                },
                type: "text",
                disabled: false,
              },
              {
                id: "password",
                label: t("auth.password"),
                value: password,
                setter: (v: string) => {
                  setPassword(v);
                  setDetailsError("");
                },
                type: "password",
                disabled: false,
              },
            ].map(({ id, label, value, setter, type, disabled }) => (
              <div key={id} className="space-y-1.5">
                <label
                  htmlFor={id}
                  className="block text-[10px] font-bold tracking-[0.25em] uppercase"
                  style={{ color: "rgba(245,158,11,0.7)" }}
                >
                  {label}
                </label>
                <Input
                  id={id}
                  type={type}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  required
                  disabled={disabled}
                  minLength={id === "nickname" ? 2 : 6}
                  className="h-11 rounded-lg text-white placeholder:text-gray-700 disabled:opacity-50"
                  style={{
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid rgba(234,179,8,0.2)",
                    outline: "none",
                  }}
                />
              </div>
            ))}

            {detailsError && (
              <p className="text-xs text-center" style={{ color: "#f87171" }}>
                {detailsError}
              </p>
            )}

            <Button
              type="submit"
              disabled={isRegistering}
              className="w-full h-12 font-black tracking-[0.2em] text-sm uppercase rounded-lg mt-2 transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                background:
                  "linear-gradient(135deg, #92400e 0%, #b45309 30%, #d97706 65%, #f59e0b 100%)",
                color: "#000",
                border: "none",
                boxShadow:
                  "0 0 24px rgba(245,158,11,0.25), 0 4px 12px rgba(0,0,0,0.4)",
              }}
            >
              {isRegistering
                ? t("auth.registering") || "Creating Account…"
                : t("auth.registerBtn")}
            </Button>

            <button
              type="button"
              onClick={() => setStep("otp")}
              className="w-full text-center text-xs transition-colors"
              style={{ color: "rgba(245,158,11,0.4)" }}
            >
              ← {t("auth.backToVerify") || "Back to Verify"}
            </button>
          </form>
        )}

        <div className="flex items-center gap-3 mt-6 mb-4">
          <div
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(234,179,8,0.2))",
            }}
          />
          <span className="text-yellow-800/40 text-xs">◆</span>
          <div
            className="flex-1 h-px"
            style={{
              background:
                "linear-gradient(90deg, rgba(234,179,8,0.2), transparent)",
            }}
          />
        </div>

        <p
          className="text-center text-sm"
          style={{ color: "rgba(107,114,128,0.8)" }}
        >
          {t("auth.haveAccount")}{" "}
          <Link
            href="/login"
            className="font-semibold transition-colors hover:text-yellow-300"
            style={{ color: "rgba(245,158,11,0.85)" }}
          >
            {t("auth.goLogin")}
          </Link>
        </p>
      </div>
    </div>
  );
}
