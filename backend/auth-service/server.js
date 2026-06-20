require("dotenv").config();
const app = require("./src/app");
const sequelize = require("./src/config/db");

const PORT = process.env.PORT || 4001;

(async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();            // crée la table "accounts" si absente
    console.log("✅ Connecté à PostgreSQL");
    app.listen(PORT, () => console.log(`🚀 auth-service sur le port ${PORT}`));
  } catch (err) {
    console.error("❌ Échec connexion DB:", err);
    process.exit(1);
  }
})();