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
