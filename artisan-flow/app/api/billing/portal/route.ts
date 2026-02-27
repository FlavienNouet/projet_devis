import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { findUserById } from '@/lib/user-store';
import { getAppUrlFromRequest, getStripeClient } from '@/lib/stripe';

export async function POST(request: Request) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const persistedUser = await findUserById(sessionUser.id);

  if (!persistedUser) {
    return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
  }

  if (!persistedUser.stripeCustomerId) {
    return NextResponse.json({ error: 'Aucun abonnement Stripe rattaché.' }, { status: 400 });
  }

  try {
    const stripe = getStripeClient();
    const appUrl = getAppUrlFromRequest(request);

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: persistedUser.stripeCustomerId,
      return_url: `${appUrl}/?tab=billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch {
    return NextResponse.json({ error: 'Impossible d\'ouvrir le portail de facturation.' }, { status: 500 });
  }
}
