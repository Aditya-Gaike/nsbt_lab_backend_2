const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const SELECT_JOINED = `
  SELECT fines.*, users.name AS user_name, users.email AS user_email
  FROM fines
  JOIN users ON users.id = fines.user_id
`;

// GET /api/fines - admin: everything. student/faculty: only their own.
router.get("/", requireAuth, (req, res) => {
  if (req.user.role === "admin") {
    return res.json(db.prepare(`${SELECT_JOINED} ORDER BY fines.id DESC`).all());
  }
  res.json(
    db.prepare(`${SELECT_JOINED} WHERE fines.user_id = ? ORDER BY fines.id DESC`).all(req.user.id)
  );
});

// POST /api/fines - admin only. Manual fine, e.g. for a damaged/misused book.
// Body: { user_id, book_title, reason, amount } OR { user_id, book_title, days_late }
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { user_id, book_title, reason, amount, days_late } = req.body || {};

  if (!user_id || !book_title || !reason) {
    return res.status(400).json({ error: "User, book title and reason are required." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const computedAmount =
    reason === "Late" ? Number(days_late || 0) * 5 : Number(amount || 200);

  const info = db
    .prepare(
      "INSERT INTO fines (user_id, book_title, reason, amount, paid) VALUES (?, ?, ?, ?, 0)"
    )
    .run(user.id, book_title.trim(), reason, computedAmount);

  res.status(201).json(db.prepare(`${SELECT_JOINED} WHERE fines.id = ?`).get(info.lastInsertRowid));
});

// PUT /api/fines/:id/pay - admin only. Marks a fine as paid/collected.
router.put("/:id/pay", requireAuth, requireRole("admin"), (req, res) => {
  const fine = db.prepare("SELECT * FROM fines WHERE id = ?").get(req.params.id);
  if (!fine) return res.status(404).json({ error: "Fine not found." });

  db.prepare("UPDATE fines SET paid = 1 WHERE id = ?").run(fine.id);
  res.json(db.prepare(`${SELECT_JOINED} WHERE fines.id = ?`).get(fine.id));
});

// DELETE /api/fines/:id - admin only.
router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const fine = db.prepare("SELECT * FROM fines WHERE id = ?").get(req.params.id);
  if (!fine) return res.status(404).json({ error: "Fine not found." });
  db.prepare("DELETE FROM fines WHERE id = ?").run(fine.id);
  res.json({ success: true });
});

module.exports = router;
