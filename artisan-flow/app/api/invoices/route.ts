import { NextResponse } from 'next/server';
import { countInvoicesByUserSince, createInvoice, listInvoicesByUser, type StoredInvoiceItem } from '@/lib/invoice-store';
import { getSessionUserOrNull } from '@/lib/auth-server';
import { geocodeAddress } from '@/lib/geocoding';
import { findUserById } from '@/lib/user-store';
import { getPlanDefinition } from '@/lib/plans';

export async function GET() {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  const invoices = await listInvoicesByUser(sessionUser.id);
  return NextResponse.json({ invoices });
}

export async function POST(request: Request) {
  const sessionUser = await getSessionUserOrNull();

  if (!sessionUser) {
    return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const persistedUser = await findUserById(sessionUser.id);

    if (!persistedUser) {
      return NextResponse.json({ error: 'Utilisateur introuvable.' }, { status: 404 });
    }

    const currentPlan = persistedUser.plan ?? 'free';
    const planDefinition = getPlanDefinition(currentPlan);

    if (planDefinition.maxInvoicesPerMonth !== null) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const currentMonthDocuments = await countInvoicesByUserSince(sessionUser.id, monthStart);

      if (currentMonthDocuments >= planDefinition.maxInvoicesPerMonth) {
        return NextResponse.json(
          { error: `Limite atteinte: ${planDefinition.maxInvoicesPerMonth} documents / mois sur le plan Free.` },
          { status: 403 }
        );
      }
    }

    const body = await request.json();

    const clientName = typeof body.clientName === 'string' ? body.clientName.trim() : '';
    const clientId = typeof body.clientId === 'string' ? body.clientId : '';
    const quoteNumber = typeof body.quoteNumber === 'string' ? body.quoteNumber : '0000';
    const issueDate = typeof body.issueDate === 'string' ? body.issueDate : new Intl.DateTimeFormat('fr-FR').format(new Date());
    const signatureName = typeof body.signatureName === 'string' ? body.signatureName.trim() : '';
    const vatRateRaw = typeof body.vatRate === 'number' && Number.isFinite(body.vatRate)
      ? body.vatRate
      : 20;
    const vatRate = Math.min(100, Math.max(0, vatRateRaw));
    const locationAddress = typeof body.locationAddress === 'string' ? body.locationAddress.trim() : '';
    const locationLat = typeof body.locationLat === 'number' && Number.isFinite(body.locationLat)
      ? body.locationLat
      : null;
    const locationLng = typeof body.locationLng === 'number' && Number.isFinite(body.locationLng)
      ? body.locationLng
      : null;

    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];
    const items: StoredInvoiceItem[] = rawItems
      .map((item: unknown): StoredInvoiceItem => {
        const value = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;

        return {
          designation: typeof value.designation === 'string' ? value.designation.trim() : '',
          prix: Number(value.prix) || 0,
          qty: Number(value.qty) || 0,
        };
      })
      .filter((item: StoredInvoiceItem) => item.designation);

    if (!clientName || items.length === 0) {
      return NextResponse.json({ error: 'Données de devis invalides.' }, { status: 400 });
    }

    const total = items.reduce((accumulator: number, item: StoredInvoiceItem) => accumulator + item.prix * item.qty, 0);
    const coordinates = locationLat !== null && locationLng !== null
      ? { lat: locationLat, lng: locationLng }
      : await geocodeAddress(locationAddress);

    const invoice = {
      id: crypto.randomUUID(),
      userId: sessionUser.id,
      clientId,
      clientName,
      items,
      total,
      vatRate,
      quoteNumber,
      issueDate,
      status: 'sent' as const,
      documentType: 'quote' as const,
      locationAddress,
      locationLat: coordinates?.lat,
      locationLng: coordinates?.lng,
      signatureName,
      createdAt: new Date().toISOString(),
    };

    await createInvoice(invoice);

    return NextResponse.json({ invoice }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur pendant la sauvegarde du devis.' }, { status: 500 });
  }
}
