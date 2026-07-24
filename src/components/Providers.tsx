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
}: {
  children: React.ReactNode;
  session: Session | null;
  initialIdentityState: InitialIdentityState | null;
}) {
  return (
    <SessionProvider session={session}>
      <IdentityProvider initialState={initialIdentityState}>
        <TooltipProvider>{children}</TooltipProvider>
      </IdentityProvider>
    </SessionProvider>
  );
}
