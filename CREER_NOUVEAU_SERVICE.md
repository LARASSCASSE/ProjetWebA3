# Breezy — Playbook : `posts-service` + écran Feed

> Document destiné à **Claude Code**. Il décrit de bout en bout l'ajout du
> **posts-service** (MongoDB / Mongoose) et la construction de l'écran **Accueil / Feed**
> côté Next.js, conformément aux wireframes Breezy.
>
> Mêmes conventions que l'auth-service déjà en place. La nouveauté ici : base **MongoDB**,
> **vérification JWT** centralisée par la Gateway, contrôle de rôle (auteur / modérateur /
> admin) sur l'édition et la suppression, et une série de **composants React** pour le feed.

---

## 1. Objectif

1. Créer le **posts-service** : CRUD des posts courts (≤ 280 caractères), fil chronologique,
   recherche par tag. Base MongoDB dédiée.
2. L'**intégrer à la Gateway** (route protégée par JWT).
3. Construire l'**écran Feed** côté front avec ses états : composition, liste, **vide**,
   **chargement**.

---

## 2. Contexte & conventions (rappel)

- Architecture distribuée : front / API Gateway / microservices. **Database per service**.
- **auth-service** = PostgreSQL (exception). **Tous les autres services = MongoDB.**
- Authentification **stateless** par JWT. La **Gateway vérifie l'access token** et injecte
  l'identité (`x-user-id`, `x-user-role`) ; les services backend **ne re-vérifient pas** le
  JWT, ils lisent ces headers.
- Tout est conteneurisé (Docker / Docker Compose).

### Allocation des ports

| Composant              | Port  | Base        | Préfixe d'API        | Public ? |
|------------------------|-------|-------------|----------------------|----------|
| frontend               | 3000  | —           | —                    | —        |
| gateway                | 4000  | —           | —                    | —        |
| auth-service           | 4001  | PostgreSQL  | `/api/auth`          | partiel  |
| users-service          | 4002  | MongoDB     | `/api/users`         | non      |
| **posts-service**      | 4003  | **MongoDB** | **`/api/posts`**     | **non**  |
| social-service         | 4004  | MongoDB     | `/api/social`        | non      |
| comments-service       | 4005  | MongoDB     | `/api/comments`      | non      |
| notifications-service  | 4006  | MongoDB     | `/api/notifications` | non      |

### Structure interne d'un service (rappel)

```
posts-service/
├── src/
│   ├── config/db.js                  # connexion Mongoose
│   ├── models/post.model.js          # schéma Mongoose
│   ├── controllers/post.controller.js
│   ├── routes/post.routes.js
│   ├── middlewares/identity.middleware.js
│   └── app.js
├── server.js                         # POINT D'ENTRÉE — À LA RACINE, pas dans src/
├── Dockerfile
├── .dockerignore
└── package.json
```

Règles d'or (causes d'erreurs déjà rencontrées) : `server.js` **à la racine** avec
`require("./src/app")` ; `CMD ["node", "server.js"]` ; aucun fichier `.js` vide ;
noms de fichiers en minuscules (la casse compte sur alpine).

---

## 3. Architecture d'authentification (JWT) — à respecter

Le flux complet d'une requête protégée, par exemple `POST /api/posts` :

```
[Navigateur]
  Authorization: Bearer <access token (1h, localStorage)>
        │
        ▼
[Gateway :4000]
  1. CORS (credentials)
  2. requireAuth : jwt.verify(token, JWT_SECRET)
     → si invalide : 401, stop
     → si valide   : injecte les headers
         x-user-id   = payload.sub
         x-user-role = payload.role
  3. proxy vers posts-service (chemin complet conservé)
        │
        ▼
[posts-service :4003]
  4. identity.middleware lit x-user-id / x-user-role  →  req.user = { id, role }
     (le service NE re-vérifie PAS le JWT : il fait confiance à la Gateway,
      car il n'est pas exposé publiquement)
  5. controller : utilise req.user.id (auteur) et req.user.role (modération)
```

**Points clés :**
- Un seul composant connaît `JWT_SECRET` : la **Gateway**. Les services restent simples.
- Le contrôle de **rôle** (auteur vs modérateur/admin) se fait **dans le service**, à partir
  de `req.user.role`, sur les opérations sensibles (modifier / supprimer un post d'autrui).
- En production, ne pas mapper les ports des services vers l'hôte : seule la Gateway est exposée.

---

## 4. Backend : `posts-service`

### 4.1 Initialisation

```bash
cd backend/posts-service
npm init -y
npm install express mongoose jsonwebtoken dotenv
npm install -D nodemon
mkdir -p src/config src/models src/controllers src/routes src/middlewares
```

`package.json` → ajouter :
```json
"scripts": { "dev": "nodemon server.js", "start": "node server.js" }
```

### 4.2 `src/config/db.js` (Mongoose)

```js
const mongoose = require("mongoose");

async function connectDB() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connecté à MongoDB");
}

module.exports = connectDB;
```

### 4.3 `src/models/post.model.js`

> Champs issus du modèle de données du livrable (entité `Post`).
> `authorId` = id du compte (auth-service). On stocke l'id en chaîne (pas de clé étrangère
> cross-base). `content` limité à 280 caractères côté schéma.

```js
const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true, index: true },
    content:  { type: String, required: true, maxlength: 280, trim: true },
    tags:     { type: [String], default: [], index: true },
    imageUrl: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
  },
  { timestamps: true } // createdAt / updatedAt
);

module.exports = mongoose.model("Post", postSchema);
```

### 4.4 `src/middlewares/identity.middleware.js`

> Le service NE vérifie PAS le JWT : la Gateway l'a déjà fait et a injecté l'identité.

```js
module.exports = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  req.user = { id: userId, role: req.headers["x-user-role"] || "user" };
  next();
};
```

### 4.5 `src/controllers/post.controller.js`

```js
const Post = require("../models/post.model");

const STAFF = ["moderator", "admin"];

// POST /api/posts
exports.create = async (req, res) => {
  try {
    const { content, tags, imageUrl, videoUrl } = req.body;
    if (!content || !content.trim())
      return res.status(400).json({ message: "Le contenu est requis" });
    if (content.length > 280)
      return res.status(400).json({ message: "280 caractères maximum" });

    const post = await Post.create({
      authorId: req.user.id,
      content: content.trim(),
      tags: tags || [],
      imageUrl: imageUrl || "",
      videoUrl: videoUrl || "",
    });
    return res.status(201).json(post);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/posts  (fil chronologique global — MVP avant le feed personnalisé)
exports.list = async (req, res) => {
  try {
    const posts = await Post.find().sort({ createdAt: -1 }).limit(50);
    return res.json(posts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/posts/search?tag=xxx
exports.search = async (req, res) => {
  try {
    const { tag } = req.query;
    if (!tag) return res.status(400).json({ message: "Paramètre 'tag' requis" });
    const posts = await Post.find({ tags: tag }).sort({ createdAt: -1 }).limit(50);
    return res.json(posts);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// GET /api/posts/:id
exports.getById = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post introuvable" });
    return res.json(post);
  } catch (err) {
    return res.status(400).json({ message: "Identifiant invalide" });
  }
};

// PUT /api/posts/:id  (auteur OU modérateur/admin)
exports.update = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post introuvable" });

    const isOwner = post.authorId === req.user.id;
    const isStaff = STAFF.includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ message: "Action non autorisée" });

    if (typeof req.body.content === "string") {
      if (req.body.content.length > 280)
        return res.status(400).json({ message: "280 caractères maximum" });
      post.content = req.body.content.trim();
    }
    await post.save();
    return res.json(post);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// DELETE /api/posts/:id  (auteur OU modérateur/admin)
exports.remove = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "Post introuvable" });

    const isOwner = post.authorId === req.user.id;
    const isStaff = STAFF.includes(req.user.role);
    if (!isOwner && !isStaff)
      return res.status(403).json({ message: "Action non autorisée" });

    await post.deleteOne();
    return res.status(204).end();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
```

### 4.6 `src/routes/post.routes.js`

> ⚠️ Les routes spécifiques (`/search`) doivent être déclarées AVANT `/:id`,
> sinon Express interprète `search` comme un `:id`.

```js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/post.controller");
const identity = require("../middlewares/identity.middleware");

router.post("/", identity, ctrl.create);
router.get("/", identity, ctrl.list);
router.get("/search", identity, ctrl.search); // avant /:id
router.get("/:id", identity, ctrl.getById);
router.put("/:id", identity, ctrl.update);
router.delete("/:id", identity, ctrl.remove);

module.exports = router;
```

### 4.7 `src/app.js`

```js
const express = require("express");
const postRoutes = require("./routes/post.routes");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/posts", postRoutes);

module.exports = app;
```

### 4.8 `server.js` (À LA RACINE)

```js
require("dotenv").config();
const app = require("./src/app");
const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 4003;

(async () => {
  try {
    await connectDB();
    app.listen(PORT, () => console.log(`🚀 posts-service sur le port ${PORT}`));
  } catch (err) {
    console.error("❌ Échec connexion MongoDB:", err);
    process.exit(1);
  }
})();
```

### 4.9 `Dockerfile`

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4003
CMD ["node", "server.js"]
```

`.dockerignore` :
```
node_modules
.env
```

---

## 5. Intégration `docker-compose.yml`

Ajouter le service + sa base Mongo dédiée :

```yaml
  posts-service:
    build: ./backend/posts-service
    ports:
      - "4003:4003"
    environment:
      - PORT=4003
      - MONGO_URI=mongodb://mongo-posts:27017/posts_db
    depends_on:
      - mongo-posts
    restart: unless-stopped

  mongo-posts:
    image: mongo:7
    volumes:
      - mongo_posts_data:/data/db
    restart: unless-stopped
```

Et dans la section `volumes:` :

```yaml
volumes:
  postgres_auth_data:
  mongo_posts_data:        # <- ajouter
```

---

## 6. Intégration Gateway (version CORRIGÉE — `pathFilter`)

> IMPORTANT : ne PAS monter le proxy sur le préfixe avec `app.use(prefix, proxy)`.
> Express retire alors le préfixe, et le service reçoit un chemin tronqué → **404**.
> On utilise `pathFilter`, qui conserve le chemin complet (`/api/posts/...` reste intact).

### 6.1 `gateway/src/config/services.js`

```js
module.exports = [
  { prefix: "/api/auth",  target: process.env.AUTH_SERVICE_URL  || "http://auth-service:4001",  public: true  },
  { prefix: "/api/posts", target: process.env.POSTS_SERVICE_URL || "http://posts-service:4003", public: false },
];
```

### 6.2 `gateway/src/middlewares/auth.middleware.js`

```js
const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token manquant" });
  }
  try {
    const payload = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.headers["x-user-id"] = String(payload.sub);
    req.headers["x-user-role"] = payload.role || "user";
    next();
  } catch {
    return res.status(401).json({ message: "Token invalide" });
  }
};
```

### 6.3 `gateway/src/app.js`

```js
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const services = require("./config/services");
const requireAuth = require("./middlewares/auth.middleware");

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

app.get("/health", (req, res) => res.json({ status: "ok" }));

// NE PAS parser le JSON ici (casserait le corps des POST proxifiés).
// pathFilter conserve le chemin complet : /api/posts/... arrive intact au service.
for (const { prefix, target, public: isPublic } of services) {
  if (!isPublic) app.use(prefix, requireAuth);
  app.use(
    createProxyMiddleware({
      target,
      changeOrigin: true,
      pathFilter: `${prefix}/**`,
    })
  );
}

module.exports = app;
```

---

## 7. Front — écran Feed (Next.js + Tailwind)

### 7.1 Wireframes à respecter (Accueil / Feed)

Cinq états sont fournis :

- **A · Nav classique** : top bar (`≈ Breezy` + avatar), zone de composition inline
  (« Quoi de neuf ? » + compteur `0 / 280` + bouton **Publier**), liste de **PostCard**,
  barre de navigation inférieure (Feed actif, Notifs [3], Messages [2], Profil).
- **B · Bouton flottant** : variante où la composition se fait via un **FAB** `+` bleu
  centré en bas (au lieu du composer inline).
- **C · Modale de composition** : « Nouveau post », champ texte, compteur `248 / 280`,
  bouton Publier, icône photo.
- **D · État vide** : logo dans un cercle, **« Votre fil est calme »**,
  « Suivez quelques comptes pour voir leurs posts apparaître ici. »,
  bouton **Découvrir des comptes** (contour bleu).
- **E · État chargement** : **skeletons** (barres grises animées).

**Implémenter en priorité A + D + E** (composer inline, liste, vide, chargement).
B et C sont des variantes optionnelles décrites en 7.9.

### 7.2 Direction visuelle (design tokens)

- Mobile-first, conteneur `max-w-md` centré, fond blanc.
- Bleu primaire `#1565C0`. Texte `#1F2937`. Secondaire `#6B7280`. Bordures `gray-200`.
  Danger `#B23A48` / rouge pour dépassement de compteur.
- Coins arrondis ~12px (`rounded-xl`), séparateurs discrets entre posts.
- Cibles tactiles ≥ 44px.

### 7.3 `components/WaveLogo.tsx` (extrait depuis AuthForm pour réutilisation)

```tsx
export default function WaveLogo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 30" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 10c5-6 12-6 18 0s13 6 18 0" stroke="#1565C0" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M3 21c5-6 12-6 18 0s13 6 18 0" stroke="#1565C0" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
```

### 7.4 `components/feed/TopBar.tsx`

```tsx
import WaveLogo from "@/components/WaveLogo";

export default function TopBar() {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2">
        <WaveLogo className="h-5 w-8" />
        <span className="text-lg font-bold text-[#1F2937]">Breezy</span>
      </div>
      <div className="h-8 w-8 rounded-full bg-gray-200" />
    </header>
  );
}
```

### 7.5 `components/feed/Composer.tsx` (compteur 280)

```tsx
"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function Composer({ onPosted }: { onPosted?: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const MAX = 280;
  const over = content.length > MAX;
  const empty = !content.trim();

  async function publish() {
    if (empty || over) return;
    setLoading(true);
    try {
      await api.post("/api/posts", { content });
      setContent("");
      onPosted?.();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-b border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-none rounded-full bg-gray-200" />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Quoi de neuf ?"
          rows={2}
          className="w-full resize-none text-[#1F2937] placeholder:text-[#9CA3AF] outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between pl-12">
        <span className={`text-sm ${over ? "text-red-500" : "text-[#6B7280]"}`}>
          {content.length} / {MAX}
        </span>
        <button
          onClick={publish}
          disabled={loading || empty || over}
          className="rounded-lg bg-[#1565C0] px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Publier
        </button>
      </div>
    </div>
  );
}
```

### 7.6 `components/feed/PostCard.tsx`

```tsx
type Post = {
  _id: string;
  authorId: string;
  content: string;
  imageUrl?: string;
  createdAt: string;
  likes?: number;
  comments?: number;
  authorName?: string;
  authorHandle?: string;
};

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  return `${Math.floor(diff / 86400)} j`;
}

export default function PostCard({ post }: { post: Post }) {
  return (
    <article className="border-b border-gray-200 bg-white p-4">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-none rounded-full bg-gray-200" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-semibold text-[#1F2937]">
              {post.authorName || "Utilisateur"}
            </span>
            <span className="truncate text-[#6B7280]">@{post.authorHandle || "user"}</span>
            <span className="text-[#6B7280]">· {timeAgo(post.createdAt)}</span>
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-[#1F2937]">{post.content}</p>

          {post.imageUrl && (
            <img src={post.imageUrl} alt="" className="mt-2 w-full rounded-xl border border-gray-200" />
          )}

          <div className="mt-3 flex items-center gap-6 text-sm text-[#6B7280]">
            <button className="flex items-center gap-1 transition hover:text-red-500">
              ♥ <span>{post.likes ?? 0}</span>
            </button>
            <button className="flex items-center gap-1 transition hover:text-[#1565C0]">
              💬 <span>{post.comments ?? 0}</span>
            </button>
            <button className="transition hover:text-[#1565C0]">Répondre</button>
          </div>
        </div>
      </div>
    </article>
  );
}
```

> Note : `likes`, `comments`, `authorName`, `authorHandle` ne sont pas encore renvoyés par
> posts-service (ils viendront de social-service / users-service). Les valeurs par défaut
> (`0`, « Utilisateur ») évitent tout crash en attendant.

### 7.7 `components/feed/BottomNav.tsx`

```tsx
function NavItem({ label, active, badge }: { label: string; active?: boolean; badge?: number }) {
  return (
    <button className={`relative flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${active ? "text-[#1565C0]" : "text-[#6B7280]"}`}>
      <span className="h-5 w-5 rounded-full border-2 border-current" />
      {label}
      {badge ? (
        <span className="absolute right-1 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function BottomNav() {
  return (
    <nav className="sticky bottom-0 flex items-center justify-around border-t border-gray-200 bg-white py-1.5">
      <NavItem label="Feed" active />
      <NavItem label="Notifs" badge={3} />
      <NavItem label="Messages" badge={2} />
      <NavItem label="Profil" />
    </nav>
  );
}
```

> Les icônes sont stylisées en placeholders (cercles). Remplacer par `lucide-react`
> (`Home`, `Bell`, `Mail`, `User`) si la lib est ajoutée au front.

### 7.8 `components/feed/EmptyState.tsx` et `PostSkeleton.tsx`

```tsx
// components/feed/EmptyState.tsx
import WaveLogo from "@/components/WaveLogo";

export default function EmptyState() {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
        <WaveLogo className="h-7 w-11" />
      </div>
      <h2 className="mt-4 text-lg font-bold text-[#1F2937]">Votre fil est calme</h2>
      <p className="mt-1 text-sm text-[#6B7280]">
        Suivez quelques comptes pour voir leurs posts apparaître ici.
      </p>
      <button className="mt-5 rounded-lg border border-[#1565C0] px-4 py-2 text-sm font-semibold text-[#1565C0]">
        Découvrir des comptes
      </button>
    </div>
  );
}
```

```tsx
// components/feed/PostSkeleton.tsx
export default function PostSkeleton() {
  return (
    <div className="animate-pulse border-b border-gray-200 p-4">
      <div className="flex gap-3">
        <div className="h-9 w-9 flex-none rounded-full bg-gray-200" />
        <div className="flex-1 space-y-2 py-1">
          <div className="h-3 w-1/3 rounded bg-gray-200" />
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-2/3 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
```

### 7.9 Page Feed — `app/page.tsx` (assemble tous les états)

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import TopBar from "@/components/feed/TopBar";
import Composer from "@/components/feed/Composer";
import PostCard from "@/components/feed/PostCard";
import BottomNav from "@/components/feed/BottomNav";
import EmptyState from "@/components/feed/EmptyState";
import PostSkeleton from "@/components/feed/PostSkeleton";

export default function FeedPage() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/api/posts");
      setPosts(data);
    } catch {
      // si 401 non récupérable, l'intercepteur de lib/api redirige vers /login
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col bg-white">
      <TopBar />
      <Composer onPosted={load} />

      <div className="flex-1">
        {loading ? (
          <>
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </>
        ) : posts.length === 0 ? (
          <EmptyState />
        ) : (
          posts.map((p) => <PostCard key={p._id} post={p} />)
        )}
      </div>

      <BottomNav />
    </div>
  );
}
```

### 7.10 Variantes optionnelles (B et C)

- **FAB (B)** : remplacer `<Composer />` inline par un bouton flottant
  `fixed bottom-20 left-1/2 -translate-x-1/2 h-14 w-14 rounded-full bg-[#1565C0] text-white shadow-lg`
  qui ouvre la modale.
- **Modale (C)** : composant `ComposeModal` avec overlay, header
  (`✕  Nouveau post  [Publier]`), `<textarea>` plein écran, compteur `n / 280`, icône photo.
  Réutiliser la logique de `Composer` (état `content`, validation 280, `api.post("/api/posts")`).

---

## 8. Checklist de validation

Après `docker compose up --build` :

- [ ] `mongo-posts` démarré ; logs du service : `✅ Connecté à MongoDB` puis `🚀 posts-service sur le port 4003`.
- [ ] Pas de boucle `exited (restarting)`.
- [ ] Direct : `curl http://localhost:4003/health` → `{"status":"ok"}`.
- [ ] Via la Gateway, créer un post (token requis) :
  ```bash
  TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@breezy.fr","password":"12345678"}' | jq -r .accessToken)

  curl -X POST http://localhost:4000/api/posts \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"content":"Mon premier post Breezy"}'
  ```
  → `201` avec le post créé.
- [ ] `curl http://localhost:4000/api/posts -H "Authorization: Bearer $TOKEN"` liste les posts.
- [ ] Sans token : `401 Token manquant`.
- [ ] Front : `http://localhost:3000` affiche le feed ; publier un post le fait apparaître ;
  sans posts → état vide ; au chargement → skeletons.

---

## 9. Pièges connus (déjà rencontrés — à éviter)

1. **404 via la Gateway** → le proxy était monté sur le préfixe, Express retirait `/api/posts`.
   Utiliser `pathFilter` (section 6.3), pas `app.use(prefix, proxy)`.
2. **Body vide côté service** → ne pas appeler `express.json()` dans la Gateway avant le proxy.
3. **`Cannot find module './src/app'` / server.js introuvable** → `server.js` à la racine,
   `require("./src/app")`, `CMD ["node", "server.js"]`.
4. **`exited code 0 (restarting)`** → `server.js` sans `app.listen()` (fichier vide).
5. **`Cannot find module '../models/...'`** → fichier vide / mal nommé. `find src -name "*.js" -empty`.
6. **Route `/search` qui renvoie « Identifiant invalide »** → elle est déclarée APRÈS `/:id`.
   Mettre les routes spécifiques avant les routes paramétrées.
7. **Mongo : changement d'identifiants ignoré** → Mongo (comme Postgres) n'initialise qu'au
   premier démarrage du volume. Pour repartir propre : `docker compose down -v` (⚠️ efface les données).
8. **Le front n'atteint pas la Gateway** → appels Axios depuis le navigateur : `http://localhost:4000`,
   jamais le nom de service Docker. La Gateway, elle, route vers `posts-service:4003`.
9. **401 en boucle au front** → l'intercepteur de `lib/api.ts` tente un refresh puis redirige
   vers `/login`. Vérifier que l'access token est bien dans `localStorage` après login.

---

## 10. Après ce service

Tranche suivante recommandée : **social-service** (follow / likes / feed personnalisé,
port 4004, `/api/social`) — il permettra de remplacer le fil global par un vrai feed des
comptes suivis, et d'alimenter les compteurs de likes des PostCard. Réutiliser ce même
playbook en adaptant modèle, port et préfixe.
