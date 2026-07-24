"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IdentityProvider } from "@/components/IdentityProvider";
import type { Session } from "next-auth";
import type { InitialIdentityState } from "@/types/identity";

export default function Providers({
  children,
  session,
  initialIdentityState,
  locale = "en",
}: {
  children: React.ReactNode;
  session: Session | null;
  initialIdentityState: InitialIdentityState | null;
  locale?: string;
}) {
  return (
    <SessionProvider session={session}>
      <IdentityProvider initialState={initialIdentityState} locale={locale}>
        <TooltipProvider>{children}</TooltipProvider>
      </IdentityProvider>
    </SessionProvider>
  );
}
