const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const SAFE_COLUMNS = "id, name, email, role, reg_no, course, created_at";

// GET /api/users - admin only
router.get("/", requireAuth, requireRole("admin"), (req, res) => {
  res.json(db.prepare(`SELECT ${SAFE_COLUMNS} FROM users ORDER BY name`).all());
});

// POST /api/users - admin only. Creates a student/faculty/admin login.
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { name, email, password, role, reg_no, course } = req.body || {};

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: "Name, email, password and role are required." });
  }
  if (!["student", "faculty", "admin"].includes(role)) {
    return res.status(400).json({ error: "Role must be student, faculty or admin." });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim().toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "A user with that email already exists." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password, role, reg_no, course) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(name.trim(), email.trim().toLowerCase(), hash, role, reg_no || null, course || null);

  res.status(201).json(
    db.prepare(`SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`).get(info.lastInsertRowid)
  );
});

// DELETE /api/users/:id - admin only
router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const activeIssue = db
    .prepare("SELECT id FROM issues WHERE user_id = ? AND status = 'issued'")
    .get(user.id);
  if (activeIssue) {
    return res.status(400).json({ error: "This user still has a book issued - return it first." });
  }

  db.prepare("DELETE FROM users WHERE id = ?").run(user.id);
  res.json({ success: true });
});

module.exports = router;
