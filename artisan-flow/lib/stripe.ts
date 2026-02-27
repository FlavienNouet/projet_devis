import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (stripeClient) {
    return stripeClient;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY est manquante.');
  }

  stripeClient = new Stripe(secretKey);

  return stripeClient;
};

export const getStripePriceIdForPlan = (plan: 'pro' | 'team', interval: 'month' | 'year') => {
  if (plan === 'team') {
    return interval === 'year'
      ? process.env.STRIPE_PRICE_TEAM_YEARLY
      : process.env.STRIPE_PRICE_TEAM_MONTHLY;
  }

  return interval === 'year'
    ? process.env.STRIPE_PRICE_PRO_YEARLY
    : process.env.STRIPE_PRICE_PRO_MONTHLY;
};

export const resolveStripePriceIdForPlan = async (
  stripe: Stripe,
  plan: 'pro',
  interval: 'month' | 'year'
): Promise<string | null> => {
  const configuredPriceId = getStripePriceIdForPlan(plan, interval);

  if (configuredPriceId) {
    return configuredPriceId;
  }

  const productId = process.env.STRIPE_PRODUCT_PRO;

  if (!productId) {
    return null;
  }

  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    type: 'recurring',
    limit: 100,
  });

  const matched = prices.data.find((price) => price.recurring?.interval === interval);

  return matched?.id ?? null;
};

export const getPlanFromStripePriceId = (priceId: string | null | undefined): 'free' | 'pro' | 'team' => {
  if (!priceId) {
    return 'free';
  }

  const proPrices = [process.env.STRIPE_PRICE_PRO_MONTHLY, process.env.STRIPE_PRICE_PRO_YEARLY].filter(Boolean);
  const teamPrices = [process.env.STRIPE_PRICE_TEAM_MONTHLY, process.env.STRIPE_PRICE_TEAM_YEARLY].filter(Boolean);

  if (teamPrices.includes(priceId)) {
    return 'team';
  }

  if (proPrices.includes(priceId)) {
    return 'pro';
  }

  return 'free';
};

export const resolvePlanFromStripePriceId = async (
  stripe: Stripe,
  priceId: string | null | undefined
): Promise<'free' | 'pro' | 'team'> => {
  const configuredPlan = getPlanFromStripePriceId(priceId);

  if (configuredPlan !== 'free' || !priceId) {
    return configuredPlan;
  }

  try {
    const price = await stripe.prices.retrieve(priceId, {
      expand: ['product'],
    });

    const productId = typeof price.product === 'string' ? price.product : price.product.id;

    if (productId && process.env.STRIPE_PRODUCT_PRO && productId === process.env.STRIPE_PRODUCT_PRO) {
      return 'pro';
    }

    if (productId && process.env.STRIPE_PRODUCT_TEAM && productId === process.env.STRIPE_PRODUCT_TEAM) {
      return 'team';
    }
  } catch {
    return 'free';
  }

  return 'free';
};

export const getAppUrlFromRequest = (request: Request) => {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_APP_URL est manquante en production.');
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};
