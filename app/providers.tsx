"use client";

import { SessionProvider } from "next-auth/react";
import { WalletProvider } from "@/hooks/useWallet";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <WalletProvider>
        {children}
      </WalletProvider>
    </SessionProvider>
  );
}

 