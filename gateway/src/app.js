const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const services = require("./config/services");

const app = express();
app.use(cors());

app.get("/health", (req, res) => res.json({ status: "ok" }));

// un proxy par service (ne PAS parser le body avant : ça casserait le POST)
for (const [prefix, target] of Object.entries(services)) {
  app.use(prefix, createProxyMiddleware({ target, changeOrigin: true }));
}

module.exports = app;