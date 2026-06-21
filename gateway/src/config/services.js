module.exports = [
  { prefix: "/api/auth",  target: process.env.AUTH_SERVICE_URL  || "http://auth-service:4001",  public: true  },
  { prefix: "/api/posts", target: process.env.POSTS_SERVICE_URL || "http://posts-service:4003", public: false },
  // futurs services protégés :
  // { prefix: "/api/users", target: process.env.USERS_SERVICE_URL || "http://users-service:4002", public: false },
];
