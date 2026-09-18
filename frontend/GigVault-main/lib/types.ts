export type TabId =
  | "overview"
  | "issue"
  | "present"
  | "verify"
  | "forged";

export interface TabDef {
  id: TabId;
  label: string;
  index: string;
}

export interface PassportData {
  riderId: string;
  tenureMonths: number;
  weeksPaidTotal: number;
  weeksPaidRequired: number;
  incomeThreshold: number;
  passportHash: string;
  bankVerified: boolean;
}
