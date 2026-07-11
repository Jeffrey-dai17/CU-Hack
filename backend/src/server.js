const express = require("express");
const cors = require("cors");
require("dotenv").config();

const goalRoutes = require("./routes/goalRoutes");
const recipeRoutes = require("./routes/recipeRoutes");
const swipeRoutes = require("./routes/swipeRoutes");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", goalRoutes);
app.use("/api", recipeRoutes);
app.use("/api", swipeRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({ error: error.message || "Unexpected server error" });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
  });
}

module.exports = app;
