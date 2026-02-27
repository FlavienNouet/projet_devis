import { NextResponse } from 'next/server';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { findUserById } from '@/lib/user-store';
import { PLAN_DEFINITIONS } from '@/lib/plans';

export async function GET() {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const persistedUser = await findUserById(sessionUser.id);

    if (!persistedUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    return NextResponse.json({
      plan: persistedUser.plan ?? 'free',
      billingStatus: persistedUser.billingStatus ?? 'inactive',
      stripeCustomerId: persistedUser.stripeCustomerId ?? null,
      planDefinitions: PLAN_DEFINITIONS,
    });
  } catch {
    return NextResponse.json({
      plan: sessionUser.plan ?? 'free',
      billingStatus: sessionUser.billingStatus ?? 'inactive',
      stripeCustomerId: null,
      planDefinitions: PLAN_DEFINITIONS,
    });
  }
}
