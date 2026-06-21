const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Account = require("../models/account.model");

const ACCESS_TTL = "1h";
const REFRESH_TTL = "7d";

const signAccess = (acc) =>
  jwt.sign({ sub: acc.id, role: acc.role }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });

const signRefresh = (acc) =>
  jwt.sign({ sub: acc.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TTL });

// le cookie refresh n'est envoyé que sur /api/auth/* et invisible au JS (httpOnly)
const refreshCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // false en dev (http)
  sameSite: "lax",
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
};

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });
    if (await Account.findOne({ where: { email } }))
      return res.status(409).json({ message: "Email déjà utilisé" });

    const passwordHash = await bcrypt.hash(password, 10);
    const account = await Account.create({ email, passwordHash });

    res.cookie("refreshToken", signRefresh(account), refreshCookie);
    return res.status(201).json({
      accessToken: signAccess(account),
      user: { id: account.id, email: account.email, role: account.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const account = await Account.findOne({ where: { email } });
    if (!account || !(await bcrypt.compare(password, account.passwordHash)))
      return res.status(401).json({ message: "Identifiants invalides" });

    res.cookie("refreshToken", signRefresh(account), refreshCookie);
    return res.json({
      accessToken: signAccess(account),
      user: { id: account.id, email: account.email, role: account.role },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// régénère un access token à partir du cookie refresh
exports.refresh = async (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ message: "Refresh token manquant" });
  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const account = await Account.findByPk(payload.sub);
    if (!account) return res.status(401).json({ message: "Compte introuvable" });
    return res.json({ accessToken: signAccess(account) });
  } catch {
    return res.status(401).json({ message: "Refresh token invalide ou expiré" });
  }
};

exports.logout = (req, res) => {
  res.clearCookie("refreshToken", { path: "/api/auth" });
  return res.json({ message: "Déconnecté" });
};

exports.me = async (req, res) => {
  const account = await Account.findByPk(req.user.sub, {
    attributes: ["id", "email", "role", "status", "createdAt"],
  });
  if (!account) return res.status(404).json({ message: "Introuvable" });
  return res.json(account);
};