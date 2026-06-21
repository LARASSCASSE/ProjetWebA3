"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, setAccessToken } from "@/lib/api";

function WaveLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10c5-6 12-6 18 0s13 6 18 0" stroke="#1565C0" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M3 21c5-6 12-6 18 0s13 6 18 0" stroke="#1565C0" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}

function Field({
  label, icon, error, ...props
}: {
  label?: string;
  icon?: React.ReactNode;
  error?: boolean;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      {label && (
        <label className="mb-1 block text-sm font-semibold text-[#1F2937]">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">{icon}</span>
        )}
        <input
          {...props}
          className={`w-full rounded-lg border px-3 py-3.5 text-[#1F2937] placeholder:text-[#9CA3AF] outline-none transition
            ${icon ? "pl-9" : ""}
            ${error
              ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              : "border-gray-300 focus:border-[#1565C0] focus:ring-2 focus:ring-[#1565C0]/20"}`}
        />
      </div>
    </div>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError("");
    if (!email || !password || (!isLogin && (!name || !username))) {
      setError("Veuillez remplir tous les champs.");
      return;
    }
    if (!isLogin && password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { data } = await api.post("/api/auth/login", { email, password });
        setAccessToken(data.accessToken);
      } else {
        const { data } = await api.post("/api/auth/register", {
          email,
          password,
          username: username.replace(/^@/, ""),
          displayName: name,
        });
        setAccessToken(data.accessToken);
      }
      router.push("/");
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          (isLogin ? "E-mail ou mot de passe incorrect." : "Une erreur est survenue.")
      );
    } finally {
      setLoading(false);
    }
  }

  const toggleBase = "rounded-md py-2.5 text-center text-sm transition";
  const active = "bg-[#1565C0] font-semibold text-white";
  const inactive = "font-medium text-[#1F2937] hover:bg-gray-200/60";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-10">
      <div className="w-full max-w-sm">

        {/* En-tête : centré (connexion) ou compact (inscription) */}
        {isLogin ? (
          <div className="mb-7 flex flex-col items-center">
            <WaveLogo className="h-9 w-12" />
            <h1 className="mt-3 text-2xl font-bold text-[#1F2937]">Breezy</h1>
            <p className="text-sm text-[#6B7280]">Des idées, en plus léger.</p>
          </div>
        ) : (
          <div className="mb-6 flex items-center gap-2">
            <WaveLogo className="h-5 w-8" />
            <span className="text-xl font-bold text-[#1565C0]">Breezy</span>
          </div>
        )}

        {/* Toggle segmenté */}
        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
          <Link href="/login" className={`${toggleBase} ${isLogin ? active : inactive}`}>
            Connexion
          </Link>
          <Link href="/register" className={`${toggleBase} ${!isLogin ? active : inactive}`}>
            Inscription
          </Link>
        </div>

        {/* Bandeau d'erreur */}
        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-3 text-sm font-semibold text-red-600">
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border border-red-400 text-[10px]">
              ✕
            </span>
            <span>{error}</span>
          </div>
        )}

        {/* Champs */}
        <div className="space-y-5">
          {!isLogin && (
            <>
              <Field
                label="Nom"
                placeholder="Camille Roy"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Field
                label="Identifiant"
                placeholder="@camille"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </>
          )}

          <Field
            label={isLogin ? undefined : "E-mail"}
            icon={<MailIcon />}
            type="email"
            placeholder={isLogin ? "Adresse e-mail" : "camille@mail.com"}
            value={email}
            error={isLogin && !!error}
            onChange={(e) => setEmail(e.target.value)}
          />

          <div>
            <Field
              label={isLogin ? undefined : "Mot de passe"}
              type="password"
              placeholder={isLogin ? "Mot de passe" : "8 caractères min."}
              value={password}
              error={isLogin && !!error}
              onChange={(e) => setPassword(e.target.value)}
            />
            {isLogin && error && (
              <p className="mt-1.5 text-xs text-red-500">Vérifiez vos identifiants</p>
            )}
          </div>
        </div>

        {/* Bouton principal */}
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-[#1565C0] py-3 font-semibold text-white transition hover:bg-[#0f4c93] disabled:opacity-60"
        >
          {loading ? "..." : isLogin ? "Se connecter" : "Créer mon compte"}
        </button>

        {/* Lien bas */}
        <p className="mt-5 text-center text-sm text-[#6B7280]">
          {isLogin ? "Pas de compte ? " : "Déjà inscrit ? "}
          <Link
            href={isLogin ? "/register" : "/login"}
            className="font-semibold text-[#1565C0]"
          >
            {isLogin ? "Créer un compte" : "Se connecter"}
          </Link>
        </p>
      </div>
    </div>
  );
}
