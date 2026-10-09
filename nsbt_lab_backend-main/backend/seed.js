// Seeds the database with an admin login, a couple of sample student
// accounts, and a starter catalog - so the portal isn't empty on first run.
// Safe to re-run: it skips anything that already exists.

const bcrypt = require("bcryptjs");
const db = require("./db");

function upsertUser({ name, email, password, role, reg_no, course }) {
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return existing.id;
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      "INSERT INTO users (name, email, password, role, reg_no, course) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(name, email, hash, role, reg_no || null, course || null);
  return info.lastInsertRowid;
}

function upsertBook({ title, author, category, total_qty }) {
  const existing = db.prepare("SELECT id FROM books WHERE title = ? AND author = ?").get(title, author);
  if (existing) return existing.id;
  const info = db
    .prepare(
      "INSERT INTO books (title, author, category, total_qty, available_qty) VALUES (?, ?, ?, ?, ?)"
    )
    .run(title, author, category, total_qty, total_qty);
  return info.lastInsertRowid;
}

console.log("Seeding NSBT Library database...");

upsertUser({
  name: "Library Admin",
  email: "admin@nsbtmgmu.edu.in",
  password: "Admin@123",
  role: "admin",
});

upsertUser({
  name: "Kulbhushan",
  email: "student@nsbtmgmu.edu.in",
  password: "Student@123",
  role: "student",
  reg_no: "NSBT-BCA-001",
  course: "BCA (Cybersecurity & Cloud)",
});

[
  { title: "Python Programming", author: "Reema Thareja", category: "Programming", total_qty: 6 },
  { title: "Web Technology", author: "Uttam K. Roy", category: "Web Development", total_qty: 5 },
  { title: "Computer Networks", author: "Andrew S. Tanenbaum", category: "Networking", total_qty: 4 },
  { title: "Database Management Systems", author: "Raghu Ramakrishnan", category: "Databases", total_qty: 5 },
  { title: "Cyber Security Essentials", author: "James Graham", category: "Cybersecurity", total_qty: 4 },
  { title: "Cloud Computing", author: "Rajkumar Buyya", category: "Cloud", total_qty: 3 },
  { title: "Data Structures Using C", author: "Reema Thareja", category: "Programming", total_qty: 5 },
  { title: "Operating System Concepts", author: "Abraham Silberschatz", category: "Systems", total_qty: 4 },
].forEach(upsertBook);

console.log("Done.");
console.log("");
console.log("Admin login   -> admin@nsbtmgmu.edu.in / Admin@123");
console.log("Student login -> student@nsbtmgmu.edu.in / Student@123");
