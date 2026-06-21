const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer "))
    return res.status(401).json({ message: "Token manquant" });
  try {
    const payload = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    req.headers["x-user-id"] = String(payload.sub);
    req.headers["x-user-role"] = payload.role || "user";
    next();
  } catch {
    return res.status(401).json({ message: "Token invalide" });
  }
};
