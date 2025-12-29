import type { Id } from "../../../convex/_generated/dataModel";
import type { YearlySectionKey, YearlySubsectionSectionKey } from "@/lib/yearly-constants";

export type Frequency = "monthly" | "quarterly" | "biannual" | "annual";

export type YearlyLineItem = {
  _id: Id<"yearlyLineItems">;
  _creationTime: number;
  userId: Id<"users">;
  year: number;
  sectionKey: YearlySectionKey;
  subsectionId?: Id<"yearlySubsections">;
  label: string;
  amountCents: number;
  order: number;
  note?: string;
  paymentSource?: string;
  dueDate?: string;
  frequency?: Frequency;
  originalAmountCents?: number;
  balanceCents?: number;
  interestRate?: number;
  goalAmountCents?: number;
  currentAmountCents?: number;
  startMonth?: string;
  endMonth?: string;
  paymentDay?: string;
};

export type YearlySubsection = {
  _id: Id<"yearlySubsections">;
  _creationTime: number;
  userId: Id<"users">;
  year: number;
  sectionKey: YearlySubsectionSectionKey;
  title: string;
  order: number;
  items: YearlyLineItem[];
};

export type YearlyDataForYear = {
  subsections: YearlySubsection[];
  sectionItems: YearlyLineItem[];
};

// Form values for creating/editing line items
export type LineItemFormValues = {
  label: string;
  amountCents: number;
  note?: string;
  paymentSource?: string;
  dueDate?: string;
  frequency?: Frequency;
  originalAmountCents?: number;
  balanceCents?: number;
  interestRate?: number;
  goalAmountCents?: number;
  currentAmountCents?: number;
  startMonth?: string;
  endMonth?: string;
  paymentDay?: string;
};

// Form values for creating/editing subsections
export type SubsectionFormValues = {
  title: string;
};

export type { YearlySectionKey, YearlySubsectionSectionKey };

