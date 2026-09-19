"use client";

import React from "react";
import { AnonAadhaarProvider } from "@anon-aadhaar/react";

/**
 * Client-side providers wrapper.
 * AnonAadhaarProvider must be a client component — it manages
 * browser-side ZK proving state and IndexedDB caching of artifacts.
 * 
 * _useTestAadhaar: enables test mode for hackathon demos
 * (accepts test Aadhaar QR data without real UIDAI signatures).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AnonAadhaarProvider
      _useTestAadhaar={true}
      _appName="GigVault"
    >
      {children}
    </AnonAadhaarProvider>
  );
}
