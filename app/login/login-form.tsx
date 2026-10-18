"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";

import CalumbiMark from "@/components/calumbi-mark";

export default function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      window.location.replace("/");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="card login-card">
        <span className="login-brand">
          <span className="login-logo-mark">
            <CalumbiMark size={38} />
          </span>
          <span>
            calumbi<small>FAZENDA · AGRESTE PERNAMBUCANO</small>
          </span>
        </span>
        <span className="section-eyebrow">ACESSO PRIVADO À FAZENDA</span>
        <h1>Bom ter você por aqui.</h1>
        <p>
          Entre com a senha da fazenda para acompanhar o rebanho e os
          investimentos.
        </p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Senha da fazenda</span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
            />
          </label>
          {error && (
            <div className="error-banner" role="alert">
              {error}
            </div>
          )}
          <button className="button primary full-width" disabled={busy}>
            {busy ? "Entrando…" : "Entrar na fazenda"} <ArrowRight size={16} />
          </button>
        </form>
        <small className="login-private">
          <LockKeyhole size={12} /> Acesso exclusivo aos participantes da
          fazenda.
        </small>
      </section>
    </main>
  );
}
