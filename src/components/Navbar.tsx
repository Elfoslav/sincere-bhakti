"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

function Hamburger({ open }: { open: boolean }) {
  return (
    <div className="flex flex-col gap-1.5 cursor-pointer">
      <span
        className={`block h-0.5 w-6 rounded bg-white transition-all duration-300 ${
          open ? "translate-y-2 rotate-45" : ""
        }`}
      />
      <span
        className={`block h-0.5 rounded bg-white transition-all duration-300 ${
          open ? "w-0 opacity-0" : "w-4"
        }`}
      />
      <span
        className={`block h-0.5 w-6 rounded bg-white transition-all duration-300 ${
          open ? "-translate-y-2 -rotate-45" : ""
        }`}
      />
    </div>
  );
}

export default function Navbar() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  function close() {
    setOpen(false);
  }

  return (
    <nav className="bg-deep text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2" onClick={close}>
            <span className="text-2xl">🪷</span>
            <span className="text-xl font-bold text-gold">Sincere Bhakti</span>
          </Link>

          <button
            className="md:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            <Hamburger open={open} />
          </button>

          <div className="hidden md:flex items-center gap-4">
            <Link
              href="/timeline"
              className="hover:text-gold-light transition-colors"
            >
              Timeline
            </Link>
            {session ? (
              <>
                <Link
                  href="/dashboard"
                  className="hover:text-gold-light transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/profile/${session.user.id}`}
                  className="hover:text-gold-light transition-colors"
                >
                  Profile
                </Link>
                <button
                  onClick={() => signOut()}
                  className="bg-saffron hover:bg-saffron-dark text-white px-4 py-1.5 rounded-md transition-colors font-medium"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hover:text-gold-light transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="bg-gold hover:bg-gold-light text-deep px-4 py-1.5 rounded-md transition-colors font-medium"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex flex-col gap-1 px-4 pb-4 pt-1 border-t border-white/10">
          <MobileLink href="/timeline" onClick={close}>
            Timeline
          </MobileLink>
          {session ? (
            <>
              <MobileLink href="/dashboard" onClick={close}>
                Dashboard
              </MobileLink>
              <MobileLink href={`/profile/${session.user.id}`} onClick={close}>
                Profile
              </MobileLink>
              <button
                onClick={() => { signOut(); close(); }}
                className="bg-saffron hover:bg-saffron-dark text-white px-4 py-2 rounded-md transition-colors font-medium text-left mt-1"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <MobileLink href="/login" onClick={close}>
                Login
              </MobileLink>
              <Link
                href="/register"
                onClick={close}
                className="bg-gold hover:bg-gold-light text-deep px-4 py-2 rounded-md transition-colors font-medium text-center mt-1"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="text-white/80 hover:text-white hover:bg-white/5 px-4 py-2 rounded-md transition-colors"
    >
      {children}
    </Link>
  );
}
