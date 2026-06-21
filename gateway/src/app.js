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

// NE PAS monter le proxy sur le préfixe (Express retirerait le préfixe).
// pathFilter conserve le chemin complet : /api/auth/register reste intact.
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
