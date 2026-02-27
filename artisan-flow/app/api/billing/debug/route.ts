import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { findUserById } from '@/lib/user-store';
import { getStripeClient, resolveStripePriceIdForPlan } from '@/lib/stripe';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  }

  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const persistedUser = await findUserById(sessionUser.id);

  if (!persistedUser || persistedUser.role !== 'admin') {
    return NextResponse.json({ error: 'Accès réservé à l\'administrateur.' }, { status: 403 });
  }

  const stripeSecretConfigured = Boolean(process.env.STRIPE_SECRET_KEY);
  const stripeProductPro = process.env.STRIPE_PRODUCT_PRO || null;
  const stripePriceProMonthly = process.env.STRIPE_PRICE_PRO_MONTHLY || null;
  const stripePriceProYearly = process.env.STRIPE_PRICE_PRO_YEARLY || null;

  if (!stripeSecretConfigured) {
    return NextResponse.json({
      stripeSecretConfigured: false,
      stripeProductPro,
      configuredPrices: {
        monthly: stripePriceProMonthly,
        yearly: stripePriceProYearly,
      },
      resolvedPrices: {
        monthly: null,
        yearly: null,
      },
      pricesFromProduct: [],
      warning: 'STRIPE_SECRET_KEY manquante.',
    });
  }

  try {
    const stripe = getStripeClient();

    const [resolvedMonthly, resolvedYearly] = await Promise.all([
      resolveStripePriceIdForPlan(stripe, 'pro', 'month'),
      resolveStripePriceIdForPlan(stripe, 'pro', 'year'),
    ]);

    let pricesFromProduct: Array<{
      id: string;
      amount: number | null;
      currency: string;
      interval: string | null;
      active: boolean;
    }> = [];

    if (stripeProductPro) {
      const prices = await stripe.prices.list({
        product: stripeProductPro,
        active: true,
        limit: 100,
      });

      pricesFromProduct = prices.data.map((price) => ({
        id: price.id,
        amount: price.unit_amount,
        currency: price.currency,
        interval: price.recurring?.interval ?? null,
        active: price.active,
      }));
    }

    return NextResponse.json({
      stripeSecretConfigured: true,
      stripeProductPro,
      configuredPrices: {
        monthly: stripePriceProMonthly,
        yearly: stripePriceProYearly,
      },
      resolvedPrices: {
        monthly: resolvedMonthly,
        yearly: resolvedYearly,
      },
      pricesFromProduct,
    });
  } catch {
    return NextResponse.json({
      error: 'Impossible de lire la configuration Stripe. Vérifiez vos clés et votre produit.',
      stripeSecretConfigured: true,
      stripeProductPro,
      configuredPrices: {
        monthly: stripePriceProMonthly,
        yearly: stripePriceProYearly,
      },
    }, { status: 500 });
  }
}
