export type BillingPlan = 'free' | 'pro' | 'team';
export type BillingStatus = 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

export interface PlanDefinition {
  id: BillingPlan;
  label: string;
  monthlyPriceLabel: string;
  maxInvoicesPerMonth: number | null;
  analyticsEnabled: boolean;
  csvExportEnabled: boolean;
  usersTabEnabled: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    id: 'free',
    label: 'Free',
    monthlyPriceLabel: '0 € / mois',
    maxInvoicesPerMonth: 5,
    analyticsEnabled: false,
    csvExportEnabled: false,
    usersTabEnabled: false,
  },
  {
    id: 'pro',
    label: 'Pro',
    monthlyPriceLabel: '10 € / mois',
    maxInvoicesPerMonth: null,
    analyticsEnabled: true,
    csvExportEnabled: true,
    usersTabEnabled: false,
  },
];

export const parsePlan = (value: string | null | undefined): BillingPlan => {
  if (value === 'pro') return 'pro';
  if (value === 'team') return 'team';
  return 'free';
};

export const parseBillingStatus = (value: string | null | undefined): BillingStatus => {
  if (value === 'trialing') return 'trialing';
  if (value === 'active') return 'active';
  if (value === 'past_due') return 'past_due';
  if (value === 'canceled') return 'canceled';
  if (value === 'unpaid') return 'unpaid';
  return 'inactive';
};

export const getPlanDefinition = (plan: BillingPlan): PlanDefinition => {
  return PLAN_DEFINITIONS.find((value) => value.id === plan) || PLAN_DEFINITIONS[0];
};
