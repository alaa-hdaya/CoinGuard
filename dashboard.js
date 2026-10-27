// ===== Settings =====
const CURRENCY = "TND"; // change to "USD", "EUR"...
const STORAGE_KEY = "coin_guard_transactions_v2";

const CATEGORIES = {
  income: ["Salary", "Freelance", "Gift", "Other"],
  expense: ["Food", "Transport", "Bills", "Shopping", "Health", "Leisure", "Other"],
};

// ===== Utilities =====
const money = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const pad = (x) => String(x).padStart(2, "0");

// Dates are stored as "YYYY-MM-DD" strings.
// We read them as LOCAL dates (new Date("2025-01-08") would be UTC and can shift by one day).
const parseDate = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayISO = () => toISO(new Date());
const monthKey = (iso) => iso.slice(0, 7); // "YYYY-MM"
const currentMonthKey = () => monthKey(todayISO());

const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
};

// Last n month keys, oldest first
function lastMonths(n) {
  const now = new Date();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
  }
  return keys;
}

const sum = (list) => list.reduce((s, t) => s + Number(t.amount), 0);

// ===== Storage =====
function loadTx() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

function saveTx(txs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
  } catch {
    // Storage can be blocked (private mode); the app still works for this visit.
  }
}

// ===== Demo data (last 6 months, relative to today) =====
function demoData() {
  const today = todayISO();
  const tx = [];
  const add = (type, title, category, amount, monthsAgo, day) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day);
    const date = toISO(d);
    if (date > today) return; // no future transactions
    tx.push({ id: crypto.randomUUID(), type, title, category, amount, date });
  };

  for (let m = 5; m >= 0; m--) {
    add("income", "Salary", "Salary", 1200, m, 1);
    if (m % 2 === 0) add("income", "Freelance project", "Freelance", 250 + m * 20, m, 15);
    add("expense", "Rent & electricity", "Bills", 420, m, 3);
    add("expense", "Groceries", "Food", 140 + (m % 3) * 25, m, 6);
    add("expense", "Groceries", "Food", 95 + (m % 2) * 30, m, 20);
    add("expense", "Bus pass", "Transport", 45, m, 2);
    add("expense", "Taxi", "Transport", 18 + m * 2, m, 12);
    if (m % 2 === 1) add("expense", "Clothes", "Shopping", 120, m, 18);
    if (m % 3 === 0) add("expense", "Pharmacy", "Health", 35, m, 9);
    add("expense", "Cinema & café", "Leisure", 40 + (m % 3) * 15, m, 24);
  }
  return tx;
}

let transactions = loadTx() || demoData();

// ===== Elements =====
const $ = (id) => document.getElementById(id);

const elTotalBalance = $("totalBalance");
const elIncomeM = $("incomeM");
const elExpenseM = $("expenseM");
const elNetM = $("netM");
const elSavingsRate = $("savingsRate");

const elTxList = $("txList");
const elAllWrap = $("allWrap");
const elAllList = $("allList");

const filterType = $("filterType");
const searchText = $("searchText");

const overlay = $("overlay");
const modal = $("txModal");
const modalTitle = $("modalTitle");
const txForm = $("txForm");
const txType = $("txType");
const txTitle = $("txTitle");
const txAmount = $("txAmount");
const txCategory = $("txCategory");
const txDate = $("txDate");

// ===== KPIs =====
function computeSummary() {
  const income = transactions.filter((t) => t.type === "income");
  const expense = transactions.filter((t) => t.type === "expense");
  const month = currentMonthKey();

  const monthIncome = sum(income.filter((t) => monthKey(t.date) === month));
  const monthExpense = sum(expense.filter((t) => monthKey(t.date) === month));
  const monthNet = monthIncome - monthExpense;

  return {
    balance: sum(income) - sum(expense),
    monthIncome,
    monthExpense,
    monthNet,
    savingsRate: monthIncome > 0 ? (monthNet / monthIncome) * 100 : null,
  };
}

function renderSummary() {
  const s = computeSummary();
  elTotalBalance.textContent = money(s.balance);
  elIncomeM.textContent = money(s.monthIncome);
  elExpenseM.textContent = money(s.monthExpense);

  elNetM.textContent = money(s.monthNet);
  elNetM.className = `mini-value ${s.monthNet >= 0 ? "positive" : "negative"}`;

  elSavingsRate.textContent = s.savingsRate === null ? "–" : `${s.savingsRate.toFixed(0)}%`;
  elSavingsRate.className = `mini-value ${s.savingsRate === null ? "" : s.savingsRate >= 0 ? "positive" : "negative"}`;
}

// ===== Charts =====
const PALETTE = ["#111111", "#6d28d9", "#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#9ca3af"];
let categoryChart = null;
let monthlyChart = null;

function renderCharts() {
  if (!window.Chart) return; // chart library failed to load: the rest of the app still works

  // Spending by category (current month)
  const month = currentMonthKey();
  const byCategory = {};
  transactions
    .filter((t) => t.type === "expense" && monthKey(t.date) === month)
    .forEach((t) => (byCategory[t.category] = (byCategory[t.category] || 0) + Number(t.amount)));

  const cats = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]);
  $("categoryPeriod").textContent = monthLabel(month);
  $("categoryEmpty").classList.toggle("hidden", cats.length > 0);

  const catData = {
    labels: cats,
    datasets: [{ data: cats.map((c) => byCategory[c]), backgroundColor: PALETTE, borderWidth: 2, borderColor: "#fff" }],
  };

  if (categoryChart) {
    categoryChart.data = catData;
    categoryChart.update();
  } else {
    categoryChart = new Chart($("categoryChart"), {
      type: "doughnut",
      data: catData,
      options: {
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "right", labels: { boxWidth: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => ` ${c.label}: ${money(c.parsed)}` } },
        },
      },
    });
  }

  // Income vs expenses (last 6 months)
  const months = lastMonths(6);
  const totalFor = (type, key) => sum(transactions.filter((t) => t.type === type && monthKey(t.date) === key));

  const monthData = {
    labels: months.map(monthLabel),
    datasets: [
      { label: "Income", data: months.map((k) => totalFor("income", k)), backgroundColor: "#111111", borderRadius: 6 },
      { label: "Expenses", data: months.map((k) => totalFor("expense", k)), backgroundColor: "#c4b5fd", borderRadius: 6 },
    ],
  };

  if (monthlyChart) {
    monthlyChart.data = monthData;
    monthlyChart.update();
  } else {
    monthlyChart = new Chart($("monthlyChart"), {
      type: "bar",
      data: monthData,
      options: {
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: (v) => v.toLocaleString("en-US") } },
        },
        plugins: {
          legend: { position: "bottom", labels: { boxWidth: 12, usePointStyle: true } },
          tooltip: { callbacks: { label: (c) => ` ${c.dataset.label}: ${money(c.parsed.y)}` } },
        },
      },
    });
  }
}

// ===== Transactions list =====
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

function txRow(t) {
  const wrap = document.createElement("div");
  wrap.className = "tx";

  const left = document.createElement("div");
  left.className = "tx-left";

  const title = document.createElement("div");
  title.className = "tx-title";
  title.textContent = t.title;

  const meta = document.createElement("div");
  meta.className = "tx-meta";
  meta.textContent = `${t.category} • ${parseDate(t.date).toLocaleDateString("en-GB")}`;

  left.append(title, meta);

  const right = document.createElement("div");
  right.className = "tx-actions";

  const amt = document.createElement("div");
  amt.className = `tx-amt ${t.type}`;
  amt.textContent = `${t.type === "income" ? "+" : "−"} ${money(t.amount)}`;

  const del = document.createElement("button");
  del.className = "icon-btn-sm";
  del.title = "Delete";
  del.setAttribute("aria-label", `Delete ${t.title}`);
  del.textContent = "🗑";
  del.addEventListener("click", () => {
    transactions = transactions.filter((x) => x.id !== t.id);
    saveTx(transactions);
    renderAll();
  });

  right.append(amt, del);
  wrap.append(left, right);
  return wrap;
}

function renderList(container, data, emptyText) {
  container.innerHTML = "";
  if (data.length === 0) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }
  data.forEach((t) => container.appendChild(txRow(t)));
}

function renderRecent() {
  const recent = [...transactions].sort(byDateDesc).slice(0, 5);
  renderList(elTxList, recent, "No transactions yet. Add income or expense.");
}

function renderAllList() {
  let data = [...transactions].sort(byDateDesc);

  if (filterType.value !== "all") data = data.filter((t) => t.type === filterType.value);

  const q = searchText.value.trim().toLowerCase();
  if (q) data = data.filter((t) => t.title.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));

  renderList(elAllList, data, "No matching transactions.");
}

function renderAll() {
  renderSummary();
  renderCharts();
  renderRecent();
  if (!elAllWrap.classList.contains("hidden")) renderAllList();
}

// ===== Modal =====
function fillCategories(type) {
  txCategory.innerHTML = "";
  const placeholder = new Option("Select…", "");
  txCategory.add(placeholder);
  CATEGORIES[type].forEach((c) => txCategory.add(new Option(c, c)));
}

function openModal(type) {
  txType.value = type;
  modalTitle.textContent = type === "income" ? "Add Income" : "Add Expense";
  txTitle.placeholder = type === "income" ? "e.g. Salary" : "e.g. Groceries";
  fillCategories(type);

  txTitle.value = "";
  txAmount.value = "";
  txDate.value = todayISO();

  overlay.classList.remove("hidden");
  modal.classList.remove("hidden");
  setTimeout(() => txTitle.focus(), 0);
}

function closeModal() {
  overlay.classList.add("hidden");
  modal.classList.add("hidden");
}

overlay.addEventListener("click", closeModal);
$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !modal.classList.contains("hidden")) closeModal();
});

txForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = txTitle.value.trim();
  const amount = Number(txAmount.value);
  const category = txCategory.value;
  const date = txDate.value;

  if (!title || !category || !date || !Number.isFinite(amount) || amount <= 0) return;

  transactions.push({ id: crypto.randomUUID(), type: txType.value, title, category, amount, date });
  saveTx(transactions);
  closeModal();
  renderAll();
});

// ===== Events =====
$("btnAddIncome").addEventListener("click", () => openModal("income"));
$("btnAddExpense").addEventListener("click", () => openModal("expense"));

$("toggleAll").addEventListener("click", (e) => {
  const isHidden = elAllWrap.classList.toggle("hidden");
  e.currentTarget.textContent = isHidden ? "See all transactions →" : "Hide transactions ←";
  if (!isHidden) renderAllList();
});

filterType.addEventListener("change", renderAllList);
searchText.addEventListener("input", renderAllList);

$("btnReset").addEventListener("click", () => {
  if (!confirm("Replace your transactions with the demo data?")) return;
  transactions = demoData();
  saveTx(transactions);
  renderAll();
});

$("btnClearAll").addEventListener("click", () => {
  if (!confirm("Delete ALL transactions?")) return;
  transactions = [];
  saveTx(transactions);
  renderAll();
});

// ===== Init =====
renderAll();
