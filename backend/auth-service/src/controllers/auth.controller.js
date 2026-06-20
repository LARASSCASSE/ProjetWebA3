const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Account = require("../models/auth.model");

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email et mot de passe requis" });

    const existing = await Account.findOne({ where: { email } });
    if (existing)
      return res.status(409).json({ message: "Email déjà utilisé" });

    const passwordHash = await bcrypt.hash(password, 10);
    const account = await Account.create({ email, passwordHash });

    return res.status(201).json({ id: account.id, email: account.email, role: account.role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const account = await Account.findOne({ where: { email } });
    if (!account)
      return res.status(401).json({ message: "Identifiants invalides" });

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid)
      return res.status(401).json({ message: "Identifiants invalides" });

    const token = jwt.sign(
      { sub: account.id, role: account.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

exports.me = async (req, res) => {
  const account = await Account.findByPk(req.user.sub, {
    attributes: ["id", "email", "role", "status", "createdAt"],
  });
  if (!account) return res.status(404).json({ message: "Introuvable" });
  return res.json(account);
};