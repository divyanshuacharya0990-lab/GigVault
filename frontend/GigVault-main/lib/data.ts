import { PassportData, TabDef } from "./types";

export const TABS: TabDef[] = [
  { id: "overview", label: "Overview", index: "01" },
  { id: "issue", label: "Issue Passport", index: "02" },
  { id: "present", label: "Present QR", index: "03" },
  { id: "verify", label: "Verify", index: "04" },
  { id: "forged", label: "Forged Proof", index: "05" },
];

export const PASSPORT: PassportData = {
  riderId: "Rider #137",
  tenureMonths: 24,
  weeksPaidTotal: 156,
  weeksPaidRequired: 156,
  incomeThreshold: 18000,
  passportHash: "0x8F3A9B21D4E67C58A0F12B93D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C214",
  bankVerified: true,
};

export function shortHash(hash: string) {
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}
