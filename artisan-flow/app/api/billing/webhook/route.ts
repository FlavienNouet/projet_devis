import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient, getPlanFromStripePriceId } from '@/lib/stripe';
import { findUserById, findUserByStripeCustomerId, findUserByStripeSubscriptionId, updateUserBillingById } from '@/lib/user-store';

type StripeBillingStatus = 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';

const mapStripeStatus = (status: string): StripeBillingStatus => {
  if (status === 'trialing') return 'trialing';
  if (status === 'active') return 'active';
  if (status === 'past_due') return 'past_due';
  if (status === 'canceled') return 'canceled';
  if (status === 'unpaid') return 'unpaid';
  return 'inactive';
};

const syncSubscriptionToUser = async (subscription: Stripe.Subscription) => {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const subscriptionId = subscription.id;
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const plan = getPlanFromStripePriceId(priceId);

  const userByCustomer = await findUserByStripeCustomerId(customerId);
  const userBySubscription = await findUserByStripeSubscriptionId(subscriptionId);
  const user = userByCustomer ?? userBySubscription;

  if (!user) {
    return;
  }

  await updateUserBillingById(user.id, {
    plan,
    billingStatus: mapStripeStatus(subscription.status),
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
  });
};

export async function POST(request: Request) {
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeWebhookSecret) {
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET manquant.' }, { status: 500 });
  }

  const stripe = getStripeClient();
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Signature Stripe manquante.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: 'Signature Stripe invalide.' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = typeof session.metadata?.userId === 'string' ? session.metadata.userId : null;
        const requestedPlan = session.metadata?.plan === 'team' ? 'team' : session.metadata?.plan === 'pro' ? 'pro' : null;
        const customerId = typeof session.customer === 'string' ? session.customer : null;
        const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

        if (!userId) {
          break;
        }

        const user = await findUserById(userId);
        if (!user) {
          break;
        }

        await updateUserBillingById(user.id, {
          plan: requestedPlan ?? user.plan ?? 'free',
          billingStatus: 'active',
          stripeCustomerId: customerId ?? user.stripeCustomerId ?? null,
          stripeSubscriptionId: subscriptionId,
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscriptionToUser(subscription);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const subscriptionId = subscription.id;
        const user = await findUserByStripeSubscriptionId(subscriptionId);

        if (!user) {
          break;
        }

        await updateUserBillingById(user.id, {
          plan: 'free',
          billingStatus: 'canceled',
          stripeSubscriptionId: null,
          stripePriceId: null,
        });
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: 'Erreur lors du traitement du webhook.' }, { status: 500 });
  }
}
