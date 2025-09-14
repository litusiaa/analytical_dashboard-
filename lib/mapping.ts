export const STAGES = {
  Leads: ['Lead', 'Lead in progress'],
  SalesCIS: ['E – Recognize', 'D – Evaluate', 'C – Select', 'B – Negotiate', 'A – Purchase'],
  ClientsCIS: ['Integration', 'Pilot', 'Active', 'Issued', 'Dormant', 'Lost'],
  Partner: ['Хочу!', 'Potential', 'Engaged', 'Active', 'Dormant'],
} as const;

export const KEY_STAGES = {
  SALES_A_PURCHASE: 'A – Purchase',
  INTEGRATION: 'Integration',
  PILOT: 'Pilot',
  ACTIVE: 'Active',
} as const;

export type OwnerFilter = {
  ownerName: string;
};

