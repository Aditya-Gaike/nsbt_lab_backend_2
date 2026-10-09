require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");
const issueRoutes = require("./routes/issues");
const fineRoutes = require("./routes/fines");
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reports");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// --- API routes ---
app.use("/api/auth", authRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/fines", fineRoutes);
app.use("/api/users", userRoutes);
app.use("/api/reports", reportRoutes);

app.get("/api/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// --- Serve the frontend (student + admin portals) as static files ---
const FRONTEND_DIR = path.join(__dirname, "..", "frontend");
app.use(express.static(FRONTEND_DIR));
app.get("/", (req, res) => res.sendFile(path.join(FRONTEND_DIR, "login.html")));

// --- Central error handler ---
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, () => {
  console.log(`NSBT Library backend running at http://localhost:${PORT}`);
});
