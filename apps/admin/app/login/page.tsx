"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, setToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await login(username, password);
      setToken(res.access_token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(
        err.message === "HTTP 401"
          ? "用户名或密码错误，或无管理员权限"
          : err.message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm mx-auto">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="text-4xl sm:text-5xl mb-3">🃏</div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Texas Hold&apos;em</h1>
          <p className="text-slate-400 text-sm mt-1">管理员控制台</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-[#161b27] rounded-2xl p-5 sm:p-8 border border-[#1e2535] space-y-4 sm:space-y-5"
        >
          <div>
            <label className="block text-sm text-slate-400 mb-2">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="管理员账号"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#0f1117] border border-[#1e2535] rounded-lg px-4 py-3 text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p className="text-center text-slate-600 text-xs mt-6">
          仅管理员账号可登录此控制台
        </p>
      </div>
    </div>
  );
}
