# Artisan Flow

Application Next.js pour créer des devis/factures PDF avec authentification (inscription / connexion) et reprise automatique du nom de société sur le devis.

## Démarrage

1. Installer les dépendances :

```bash
npm install
```

2. Créer un fichier `.env.local` à la racine du projet (vous pouvez partir de `.env.example`) :

```env
AUTH_SECRET=votre-cle-secrete-tres-longue-et-aleatoire
BOOTSTRAP_ADMIN_EMAIL=admin@example.com
BOOTSTRAP_ADMIN_PASSWORD=mot-de-passe-admin-fort
BOOTSTRAP_ADMIN_COMPANY=Administrateur
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRODUCT_PRO=prod_xxx
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`STRIPE_PRODUCT_PRO` est optionnel : s'il est défini, l'application peut retrouver automatiquement les prix Pro mensuel/annuel du produit Stripe.

`BOOTSTRAP_ADMIN_*` est optionnel : s'il est défini, l'application peut créer un compte admin initial au premier démarrage.

3. Initialiser la base SQLite (Prisma) :

```bash
npm run db:push
```

4. (Optionnel) Migrer les anciennes données JSON vers la base :

```bash
npm run db:migrate:json
```

5. Lancer le serveur :

```bash
npm run dev
```

6. Ouvrir [http://localhost:3000](http://localhost:3000).

## Authentification (version sécurisée)

- Les mots de passe sont hashés côté serveur avec `bcryptjs`.
- La session est stockée dans un cookie `HttpOnly` signé (JWT via `jose`).
- Les utilisateurs, clients, devis et factures sont stockés en base SQLite via Prisma.
- Le nom de la société du compte connecté est injecté automatiquement dans le PDF du devis.

## Base de données

- Schéma Prisma : `prisma/schema.prisma`
- Client Prisma partagé : `lib/prisma.ts`
- Base locale : `prisma/prisma/dev.db`
- Script migration JSON -> DB : `scripts/migrate-json-to-db.cjs`

## API disponibles

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `GET /api/billing/plan`
- `GET /api/billing/debug` (admin uniquement)
- `POST /api/billing/checkout`
- `POST /api/billing/portal`
- `POST /api/billing/webhook`

## Stripe Webhook local

Pour synchroniser automatiquement les abonnements vers la base :

```bash
stripe listen --forward-to localhost:3000/api/billing/webhook
```

## Vérification code

```bash
npm run lint
```

## Mode local uniquement

Ce projet est configuré pour un usage **local/dev** uniquement.

- URL locale recommandée : `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- Variables Stripe en mode test (`sk_test`, `whsec` du `stripe listen` local)
- Lancement : `npm run dev`
