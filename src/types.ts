import { Timestamp } from "firebase/firestore";

export interface UserProfile {
  name: string;
  phone: string;
  status: string; // "active" or other
  subscriptionEnd: Timestamp;
  createdAt: Timestamp;
  photoURL?: string;
}

export type AccountType = "suppliers" | "customers" | "employees" | "well_customers" | "qat_fields";


export interface Well {
  id: string;
  userId: string;
  name: string;
  location?: string;
  owner?: string;
  wellNumber?: string;
  note?: string;
  createdAt: Timestamp;
}

export interface Person {
  id: string;
  userId: string;
  type: AccountType;
  name: string;
  phone: string;
  balance: number; // positive = عليه (debt), negative = له (credit)
  createdAt: Timestamp;
  company?: string;      // Suppliers only
  salary?: number;       // Employees only
  region?: string;       // Well/Qat fields
  fieldsCount?: string;  // Well/Qat fields
  wellId?: string;       // ID of the specific well
}

export type TransactionType =
  | "debt"          // Standard: عليه
  | "credit"        // Standard: له
  | "salary"        // Employee: راتب (له)
  | "withdrawal"    // Employee: سحب/سلفية (عليه)
  | "deduction"     // Employee: خصم (عليه)
  | "bonus"         // Employee: مكافأة (له)
  | "well_watering" // Well: سقاية (عليه)
  | "well_payment"  // Well: تسديد (له)
  | "qat_expense"   // Qat: خرج (عليه)
  | "qat_sale";     // Qat: مبيعات (له)

export interface Transaction {
  id: string;
  userId: string;
  personId: string;
  type: TransactionType;
  amount: number;
  note: string;
  section: AccountType;
  createdAt: Timestamp;
  wellId?: string;
}

export interface Expense {
  id: string;
  userId: string;
  category: string;
  amount: number;
  note: string;
  section: "expenses" | "well_expenses";
  wellId?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface InventoryItem {
  id: string;
  userId: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  cost: number;
  price: number;
  barcode: string;
  createdAt: Timestamp;
}

export type MovementType = "in" | "out" | "return";

export interface InventoryMovement {
  id: string;
  userId: string;
  itemId: string;
  itemName: string;
  type: MovementType;
  quantity: number;
  note: string;
  createdAt: Timestamp;
}

export interface CashTransaction {
  id: string;
  userId: string;
  type: "in" | "out" | "transfer";
  amount: number;
  note: string;
  source: string; // e.g. "cash", "bank1"
  destination?: string; // used for transfer
  createdAt: Timestamp;
}
