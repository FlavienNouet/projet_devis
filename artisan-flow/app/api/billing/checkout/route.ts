import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { findUserById, updateUserBillingById } from '@/lib/user-store';
import { getAppUrlFromRequest, getStripeClient, resolveStripePriceIdForPlan } from '@/lib/stripe';

export async function POST(request: Request) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const targetPlan = body.plan === 'pro' ? 'pro' : null;
    const interval = body.interval === 'year' ? 'year' : 'month';

    if (!targetPlan) {
      return NextResponse.json({ error: 'Plan invalide.' }, { status: 400 });
    }

    const stripe = getStripeClient();
    const priceId = await resolveStripePriceIdForPlan(stripe, targetPlan, interval);

    if (!priceId) {
      return NextResponse.json({
        error: `Price Stripe manquant pour ${targetPlan}/${interval}. Configurez STRIPE_PRICE_PRO_* (ou STRIPE_PRODUCT_PRO) dans .env.local.`,
      }, { status: 500 });
    }

    const persistedUser = await findUserById(sessionUser.id);

    if (!persistedUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    let stripeCustomerId = persistedUser.stripeCustomerId;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: persistedUser.email,
        name: persistedUser.companyName,
        metadata: {
          userId: persistedUser.id,
        },
      });

      stripeCustomerId = customer.id;

      await updateUserBillingById(persistedUser.id, {
        stripeCustomerId,
      });
    }

    const appUrl = getAppUrlFromRequest(request);

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{
        price: priceId,
        quantity: 1,
      }],
      success_url: `${appUrl}/?tab=billing&checkout=success`,
      cancel_url: `${appUrl}/?tab=billing&checkout=cancel`,
      allow_promotion_codes: true,
      metadata: {
        userId: persistedUser.id,
        plan: targetPlan,
      },
      subscription_data: {
        metadata: {
          userId: persistedUser.id,
          plan: targetPlan,
        },
      },
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Impossible de créer la session de paiement.';
    const status = message.includes('manquante') ? 500 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
