const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/books?search=term  - any logged-in user (student or admin)
router.get("/", requireAuth, (req, res) => {
  const search = (req.query.search || "").trim();

  const rows = search
    ? db
        .prepare(
          "SELECT * FROM books WHERE title LIKE ? OR author LIKE ? OR category LIKE ? ORDER BY title"
        )
        .all(`%${search}%`, `%${search}%`, `%${search}%`)
    : db.prepare("SELECT * FROM books ORDER BY title").all();

  res.json(rows);
});

// POST /api/books - admin only
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { title, author, category, total_qty } = req.body || {};

  if (!title || !author || !total_qty || Number(total_qty) < 1) {
    return res.status(400).json({ error: "Title, author and a valid quantity are required." });
  }

  const info = db
    .prepare(
      "INSERT INTO books (title, author, category, total_qty, available_qty) VALUES (?, ?, ?, ?, ?)"
    )
    .run(title.trim(), author.trim(), (category || "General").trim(), Number(total_qty), Number(total_qty));

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(info.lastInsertRowid);
  res.status(201).json(book);
});

// PUT /api/books/:id - admin only
router.put("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found." });

  const { title, author, category, total_qty } = req.body || {};
  const issuedCount = book.total_qty - book.available_qty;

  const newTotal = total_qty !== undefined ? Number(total_qty) : book.total_qty;
  if (newTotal < issuedCount) {
    return res.status(400).json({
      error: `Can't set quantity below ${issuedCount} - that many copies are currently issued.`,
    });
  }

  db.prepare(
    "UPDATE books SET title = ?, author = ?, category = ?, total_qty = ?, available_qty = ? WHERE id = ?"
  ).run(
    title ? title.trim() : book.title,
    author ? author.trim() : book.author,
    category ? category.trim() : book.category,
    newTotal,
    newTotal - issuedCount,
    book.id
  );

  res.json(db.prepare("SELECT * FROM books WHERE id = ?").get(book.id));
});

// DELETE /api/books/:id - admin only
router.delete("/:id", requireAuth, requireRole("admin"), (req, res) => {
  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(req.params.id);
  if (!book) return res.status(404).json({ error: "Book not found." });

  const activeIssue = db
    .prepare("SELECT id FROM issues WHERE book_id = ? AND status = 'issued'")
    .get(book.id);

  if (activeIssue) {
    return res.status(400).json({ error: "Can't delete a book that currently has copies issued." });
  }

  db.prepare("DELETE FROM books WHERE id = ?").run(book.id);
  res.json({ success: true });
});

module.exports = router;
