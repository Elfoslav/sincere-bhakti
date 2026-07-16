"use client";

import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { IdentityProvider } from "@/components/IdentityProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdentityProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </IdentityProvider>
    </SessionProvider>
  );
}
