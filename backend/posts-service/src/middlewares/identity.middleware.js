module.exports = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  req.user = { id: userId, role: req.headers["x-user-role"] || "user" };
  next();
};
