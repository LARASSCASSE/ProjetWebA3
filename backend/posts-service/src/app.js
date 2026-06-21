const express = require("express");
const postRoutes = require("./routes/post.routes");

const app = express();
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/posts", postRoutes);

module.exports = app;
