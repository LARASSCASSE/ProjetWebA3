module.exports = {
  "/api/auth": process.env.AUTH_SERVICE_URL || "http://auth-service:4001",
};