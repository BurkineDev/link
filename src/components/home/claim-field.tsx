"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Le champ « bio-lien.com/tonnom » qui envoie vers l'inscription avec l'adresse pré-remplie. */
export function ClaimField({ dark = false, id = "claim" }: { dark?: boolean; id?: string }) {
  const [username, setUsername] = useState("");
  const router = useRouter();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = username
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "")
      .slice(0, 30);
    router.push(
      clean.length >= 3 ? `/register?username=${encodeURIComponent(clean)}` : "/register",
    );
  };

  return (
    <form
      onSubmit={submit}
      className="mx-auto mt-8 flex max-w-[540px] flex-wrap items-stretch justify-center gap-2.5"
    >
      <div
        className="flex min-w-[250px] flex-1 items-center rounded-[var(--r-full)] py-1 pl-5 pr-1.5"
        style={{
          background: dark ? "rgba(255,255,255,0.1)" : "var(--b-paper)",
          border: `1px solid ${dark ? "rgba(255,255,255,0.22)" : "var(--b-line)"}`,
        }}
      >
        <span
          className="whitespace-nowrap text-[15.5px] font-semibold"
          style={{ color: dark ? "var(--b-on-dark-muted)" : "var(--b-faint)" }}
        >
          bio-lien.com/
        </span>
        <label htmlFor={id} className="sr-only">
          Ton adresse Bio-Lien
        </label>
        <input
          id={id}
          type="text"
          autoComplete="off"
          spellCheck={false}
          placeholder="tonnom"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="min-w-[60px] flex-1 border-none bg-transparent px-1.5 py-3 text-[15.5px] outline-none"
          style={{ color: dark ? "var(--b-on-dark)" : "var(--b-ink)" }}
        />
      </div>
      <button
        type="submit"
        className="cursor-pointer rounded-[var(--r-full)] px-6.5 py-3.5 text-[15.5px] font-bold transition-colors hover:bg-[var(--b-lime-deep)]"
        style={{ background: "var(--b-lime)", color: "var(--b-ink)" }}
      >
        Réserver ma page
      </button>
    </form>
  );
}
