const express = require("express");
const db = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

// GET /api/reports/summary - admin-wide totals + recent issues
router.get("/summary", requireAuth, requireRole("admin"), (req, res) => {
  const totalBooks = db.prepare("SELECT COALESCE(SUM(total_qty), 0) AS n FROM books").get().n;
  const totalTitles = db.prepare("SELECT COUNT(*) AS n FROM books").get().n;
  const totalUsers = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role != 'admin'").get().n;
  const booksIssued = db.prepare("SELECT COUNT(*) AS n FROM issues WHERE status = 'issued'").get().n;
  const fineCollected = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM fines WHERE paid = 1")
    .get().n;
  const fineOutstanding = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM fines WHERE paid = 0")
    .get().n;

  const recentIssues = db
    .prepare(
      `SELECT issues.due_date, issues.status, books.title AS book_title, users.name AS user_name
       FROM issues
       JOIN books ON books.id = issues.book_id
       JOIN users ON users.id = issues.user_id
       ORDER BY issues.id DESC LIMIT 5`
    )
    .all();

  res.json({
    totalBooks,
    totalTitles,
    totalUsers,
    booksIssued,
    fineCollected,
    fineOutstanding,
    recentIssues,
  });
});

// GET /api/reports/mine - a student/faculty's own dashboard numbers
router.get("/mine", requireAuth, (req, res) => {
  const issued = db
    .prepare("SELECT COUNT(*) AS n FROM issues WHERE user_id = ? AND status = 'issued'")
    .get(req.user.id).n;

  const overdue = db
    .prepare(
      "SELECT COUNT(*) AS n FROM issues WHERE user_id = ? AND status = 'issued' AND due_date < date('now')"
    )
    .get(req.user.id).n;

  const fineDue = db
    .prepare("SELECT COALESCE(SUM(amount), 0) AS n FROM fines WHERE user_id = ? AND paid = 0")
    .get(req.user.id).n;

  const totalTitles = db.prepare("SELECT COUNT(*) AS n FROM books").get().n;

  res.json({ totalTitles, issued, overdue, fineDue });
});

module.exports = router;
