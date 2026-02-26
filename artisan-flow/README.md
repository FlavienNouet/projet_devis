# Artisan Flow

Application Next.js pour créer des devis PDF avec authentification (inscription / connexion) et reprise automatique du nom de société sur le devis.

## Démarrage

1. Installer les dépendances :

```bash
npm install
```

2. Créer un fichier `.env.local` à la racine du projet :

```env
AUTH_SECRET=votre-cle-secrete-tres-longue-et-aleatoire
```

3. Lancer le serveur :

```bash
npm run dev
```

4. Ouvrir [http://localhost:3000](http://localhost:3000).

## Authentification (version sécurisée)

- Les mots de passe sont hashés côté serveur avec `bcryptjs`.
- La session est stockée dans un cookie `HttpOnly` signé (JWT via `jose`).
- Les utilisateurs sont stockés côté serveur dans `data/users.json`.
- Le nom de la société du compte connecté est injecté automatiquement dans le PDF du devis.

## API disponibles

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`

## Vérification code

```bash
npm run lint
```
