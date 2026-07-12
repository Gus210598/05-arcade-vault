"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  getStoredUserServerSnapshot,
  getStoredUserSnapshot,
  setStoredUser,
  subscribeStoredUser,
  type StoredUser,
} from "@/lib/auth";

export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const userJson = useSyncExternalStore(
    subscribeStoredUser,
    getStoredUserSnapshot,
    getStoredUserServerSnapshot
  );
  const user: StoredUser | null = userJson === "null" ? null : JSON.parse(userJson);

  const isBibliotecaActive = pathname === "/" || pathname.startsWith("/juego");
  const isSalonActive = pathname === "/salon";
  const isAuthActive = pathname === "/login";

  const close = () => setOpen(false);

  const handleSignOut = () => {
    setStoredUser(null);
  };

  return (
    <>
      <nav className="av-nav">
        <Link href="/" className="logo" onClick={close}>
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link href="/" className={isBibliotecaActive ? "active" : ""}>
            Biblioteca
          </Link>
          <Link href="/salon" className={isSalonActive ? "active" : ""}>
            Salón de la Fama
          </Link>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        {user ? (
          <button className="btn ghost auth-btn" onClick={handleSignOut}>
            {user.name} ▾
          </button>
        ) : (
          <Link href="/login" className="btn auth-btn">
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      />
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link href="/" className={isBibliotecaActive ? "active" : ""} onClick={close}>
          Biblioteca
        </Link>
        <Link href="/salon" className={isSalonActive ? "active" : ""} onClick={close}>
          Salón de la Fama
        </Link>
        <Link href="/login" className={isAuthActive ? "active" : ""} onClick={close}>
          {user ? "Cuenta" : "Iniciar Sesión"}
        </Link>
        <div style={{ flex: 1 }} />
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
