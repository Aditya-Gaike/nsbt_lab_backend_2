const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

const FINE_PER_DAY = 5; // Rs. 5 / day late, matches the original fine.html logic

const SELECT_JOINED = `
  SELECT issues.*, books.title AS book_title, books.author AS book_author,
         users.name AS user_name, users.email AS user_email
  FROM issues
  JOIN books ON books.id = issues.book_id
  JOIN users ON users.id = issues.user_id
`;

// GET /api/issues - admin: everything. student/faculty: only their own.
router.get("/", requireAuth, (req, res) => {
  if (req.user.role === "admin") {
    const rows = db.prepare(`${SELECT_JOINED} ORDER BY issues.id DESC`).all();
    return res.json(rows);
  }
  const rows = db
    .prepare(`${SELECT_JOINED} WHERE issues.user_id = ? ORDER BY issues.id DESC`)
    .all(req.user.id);
  res.json(rows);
});

// POST /api/issues - admin only. Body: { book_id, user_id, due_date }
router.post("/", requireAuth, requireRole("admin"), (req, res) => {
  const { book_id, user_id, due_date } = req.body || {};

  if (!book_id || !user_id || !due_date) {
    return res.status(400).json({ error: "Book, user and due date are all required." });
  }

  const book = db.prepare("SELECT * FROM books WHERE id = ?").get(book_id);
  if (!book) return res.status(404).json({ error: "Book not found." });
  if (book.available_qty < 1) {
    return res.status(400).json({ error: "No copies of this book are currently available." });
  }

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(user_id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const issueDate = new Date().toISOString().slice(0, 10);

  const insertIssue = db.transaction(() => {
    const info = db
      .prepare(
        "INSERT INTO issues (book_id, user_id, issue_date, due_date, status) VALUES (?, ?, ?, ?, 'issued')"
      )
      .run(book.id, user.id, issueDate, due_date);
    db.prepare("UPDATE books SET available_qty = available_qty - 1 WHERE id = ?").run(book.id);
    return info.lastInsertRowid;
  });

  const id = insertIssue();
  const row = db.prepare(`${SELECT_JOINED} WHERE issues.id = ?`).get(id);
  res.status(201).json(row);
});

// PUT /api/issues/:id/return - admin only. Auto-calculates a late fee if overdue.
router.put("/:id/return", requireAuth, requireRole("admin"), (req, res) => {
  const issue = db.prepare("SELECT * FROM issues WHERE id = ?").get(req.params.id);
  if (!issue) return res.status(404).json({ error: "Issue record not found." });
  if (issue.status === "returned") {
    return res.status(400).json({ error: "This book has already been returned." });
  }

  const returnDate = new Date().toISOString().slice(0, 10);
  const daysLate = Math.max(
    0,
    Math.ceil((new Date(returnDate) - new Date(issue.due_date)) / (1000 * 60 * 60 * 24))
  );

  const doReturn = db.transaction(() => {
    db.prepare("UPDATE issues SET status = 'returned', return_date = ? WHERE id = ?").run(
      returnDate,
      issue.id
    );
    db.prepare("UPDATE books SET available_qty = available_qty + 1 WHERE id = ?").run(issue.book_id);

    let fine = null;
    if (daysLate > 0) {
      const book = db.prepare("SELECT title FROM books WHERE id = ?").get(issue.book_id);
      const amount = daysLate * FINE_PER_DAY;
      const info = db
        .prepare(
          "INSERT INTO fines (issue_id, user_id, book_title, reason, amount, paid) VALUES (?, ?, ?, 'Late', ?, 0)"
        )
        .run(issue.id, issue.user_id, book.title, amount);
      fine = db.prepare("SELECT * FROM fines WHERE id = ?").get(info.lastInsertRowid);
    }
    return fine;
  });

  const fine = doReturn();
  const row = db.prepare(`${SELECT_JOINED} WHERE issues.id = ?`).get(issue.id);
  res.json({ issue: row, daysLate, fine });
});

module.exports = router;
