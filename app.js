
const STORAGE_KEY = "personalManagerV3";

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved && Array.isArray(saved.budgets)) {
      return {
        budgets: saved.budgets.map(b => ({
          ...b,
          transactions: Array.isArray(b.transactions) ? b.transactions : []
        })),
        savings: saved.savings || { balance: 0, goal: 0 },
        smoking: saved.smoking || {
          dailyCount: 0,
          packPrice: 0,
          cigarettesPerPack: 20,
          history: []
        },
        dollarRate: Number(saved.dollarRate) || 0
      };
    }
  } catch (e) {
    console.error(e);
  }

  return {
    budgets: [],
    savings: { balance: 0, goal: 0 },
    smoking: {
      dailyCount: 0,
      packPrice: 0,
      cigarettesPerPack: 20,
      history: []
    },
    dollarRate: 0
  };
}

let data = loadData();
let activeCharts = [];

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  updateDashboard();
}

function money(value) {
  return Math.round(Number(value) || 0).toLocaleString("fa-IR") + " تومان";
}

function number(value) {
  return Number(value || 0).toLocaleString("fa-IR");
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function budgetBalance(budget) {
  return Number(budget.initial || 0) +
    budget.transactions.reduce((sum, t) => {
      return sum + (
        t.type === "income"
          ? Number(t.amount)
          : -Number(t.amount)
      );
    }, 0);
}

function getTotals() {
  let income = 0;
  let expense = 0;

  data.budgets.forEach(b => {
    b.transactions.forEach(t => {
      if (t.type === "income") income += Number(t.amount);
      if (t.type === "expense") expense += Number(t.amount);
    });
  });

  const initial = data.budgets.reduce(
    (sum, b) => sum + Number(b.initial || 0), 0
  );

  return {
    income,
    expense,
    initial,
    balance: initial + income - expense
  };
}

function updateDashboard() {
  const totals = getTotals();

  document.getElementById("totalIncome").textContent = money(totals.income);
  document.getElementById("totalExpense").textContent = money(totals.expense);
  document.getElementById("totalBalance").textContent = money(totals.balance);
}

// مدیریت ماژول‌ها

function openModule(name) {
  destroyCharts();

  document.querySelector(".modules").hidden = true;
  document.querySelector(".welcome").hidden = true;
  document.querySelector(".total-dashboard").hidden = true;

  document.getElementById("moduleContent").hidden = false;

  const body = document.getElementById("moduleBody");

  const modules = {
    budget: budgetModule,
    smoking: smokingModule,
    savings: savingsModule,
    currency: currencyModule,
    reports: reportsModule
  };

  body.innerHTML = modules[name] ? modules[name]() : "";

  if (name === "budget") renderBudgetList();
  if (name === "reports") renderMainChart();
}

function closeModule() {
  destroyCharts();

  document.getElementById("moduleContent").hidden = true;
  document.querySelector(".modules").hidden = false;
  document.querySelector(".welcome").hidden = false;
  document.querySelector(".total-dashboard").hidden = false;
}

function destroyCharts() {
  activeCharts.forEach(chart => chart.destroy());
  activeCharts = [];
}

function createChart(id, config) {
  const canvas = document.getElementById(id);

  if (!canvas || typeof Chart === "undefined") return;

  const chart = new Chart(canvas, config);
  activeCharts.push(chart);
}

// مدیریت بودجه

function budgetModule() {
  return `
    <h2>💰 مدیریت بودجه</h2>

    <div class="module-form">
      <input id="budgetName" placeholder="نام حساب؛ مثلاً خوراک">
      <input id="budgetInitial" type="number" min="0"
        placeholder="موجودی اولیه (تومان)">
      <button onclick="addBudget()">ساخت حساب جدید</button>
    </div>

    <div id="budgetList"></div>
  `;
}

function addBudget() {
  const name = document.getElementById("budgetName").value.trim();
  const initial = Number(document.getElementById("budgetInitial").value);

  if (!name || !Number.isFinite(initial) || initial < 0) {
    return alert("نام و موجودی معتبر وارد کن.");
  }

  data.budgets.push({
    id: createId(),
    name,
    initial,
    transactions: []
  });

  saveData();
  openModule("budget");
}

function budgetCard(b) {
  const income = b.transactions
    .filter(t => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);

  const expense = b.transactions
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);

  return `
    <div class="total-item budget-box">
      <h3>${escapeHTML(b.name)}</h3>

      <p>موجودی اولیه: ${money(b.initial)}</p>
      <p>درآمد: ${money(income)}</p>
      <p>هزینه: ${money(expense)}</p>
      <p><strong>موجودی فعلی: ${money(budgetBalance(b))}</strong></p>

      <canvas id="chart-${b.id}"></canvas>

      <h4>ثبت تراکنش</h4>

      <input id="amount-${b.id}" type="number" min="1"
        placeholder="مبلغ">

      <select id="type-${b.id}">
        <option value="expense">هزینه</option>
        <option value="income">درآمد</option>
      </select>

      <input id="note-${b.id}" placeholder="توضیحات">

      <button onclick="addTransaction('${b.id}')">
        ثبت تراکنش
      </button>

      <button onclick="deleteBudget('${b.id}')">
        حذف حساب
      </button>

      <h4>تاریخچه</h4>

      ${
        b.transactions.length
        ? b.transactions.slice().reverse().map(t => `
          <p>
            ${t.type === "income" ? "🟢 درآمد" : "🔴 هزینه"}
            ${money(t.amount)}
            ${escapeHTML(t.note || "")}
            <button onclick="deleteTransaction('${b.id}','${t.id}')">
              حذف
            </button>
          </p>
        `).join("")
        : "<p>تراکنشی ثبت نشده است.</p>"
      }
    </div>
  `;
}

function renderBudgetList() {
  const list = document.getElementById("budgetList");
  if (!list) return;

  list.innerHTML = data.budgets.map(budgetCard).join("") ||
    "<p>هنوز حسابی نساختی.</p>";

  data.budgets.forEach(b => {
    createChart("chart-" + b.id, {
      type: "doughnut",
      data: {
        labels: ["درآمد", "هزینه"],
        datasets: [{
          data: [
            b.transactions.filter(t => t.type === "income")
              .reduce((s, t) => s + Number(t.amount), 0),
            b.transactions.filter(t => t.type === "expense")
              .reduce((s, t) => s + Number(t.amount), 0)
          ],
          backgroundColor: ["#22c55e", "#ef4444"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: "#f1f5f9" } }
        }
      }
    });
  });
}

function addTransaction(id) {
  const budget = data.budgets.find(b => b.id === id);
  if (!budget) return;

  const amount = Number(document.getElementById("amount-" + id).value);
  const type = document.getElementById("type-" + id).value;
  const note = document.getElementById("note-" + id).value.trim();

  if (!Number.isFinite(amount) || amount <= 0) {
    return alert("مبلغ معتبر وارد کن.");
  }

  if (type === "expense" && amount > budgetBalance(budget)) {
    return alert("موجودی حساب کافی نیست.");
  }

  budget.transactions.push({
    id: createId(),
    amount,
    type,
    note,
    date: new Date().toISOString()
  });

  saveData();
  openModule("budget");
}

function deleteTransaction(budgetId, transactionId) {
  const budget = data.budgets.find(b => b.id === budgetId);
  if (!budget) return;

  if (!confirm("این تراکنش حذف شود؟")) return;

  budget.transactions = budget.transactions.filter(
    t => t.id !== transactionId
  );

  saveData();
  openModule("budget");
}

function deleteBudget(id) {
  if (!confirm("حساب و تمام تراکنش‌های آن حذف شود؟")) return;

  data.budgets = data.budgets.filter(b => b.id !== id);

  saveData();
  openModule("budget");
}

// مدیریت سیگار

function smokingModule() {
  const s = data.smoking;

  return `
    <h2>🚬 مدیریت سیگار</h2>

    <input id="smokeCount" type="number" min="0"
      value="${s.dailyCount}" placeholder="تعداد نخ امروز">

    <input id="smokePrice" type="number" min="0"
      value="${s.packPrice}" placeholder="قیمت پاکت">

    <input id="smokePack" type="number" min="1"
      value="${s.cigarettesPerPack}" placeholder="تعداد نخ در پاکت">

    <button onclick="saveSmoking()">ذخیره اطلاعات امروز</button>

    <div class="total-item">
      <p>هزینه تخمینی روزانه</p>
      <strong>${money(
        s.dailyCount * s.packPrice / s.cigarettesPerPack
      )}</strong>
    </div>

    <h3>تاریخچه مصرف</h3>
    <div id="smokingHistory"></div>
  `;
}

function saveSmoking() {
  const dailyCount = Number(document.getElementById("smokeCount").value);
  const packPrice = Number(document.getElementById("smokePrice").value);
  const cigarettesPerPack = Number(document.getElementById("smokePack").value);

  if (
    !Number.isFinite(dailyCount) || dailyCount < 0 ||
    !Number.isFinite(packPrice) || packPrice < 0 ||
    !Number.isFinite(cigarettesPerPack) || cigarettesPerPack <= 0
  ) return alert("اطلاعات معتبر وارد کن.");

  if (!Array.isArray(data.smoking.history)) {
    data.smoking.history = [];
  }

  const today = new Date().toLocaleDateString("en-CA");

  const record = {
    date: today,
    count: dailyCount,
    price: packPrice,
    packSize: cigarettesPerPack
  };

  const index = data.smoking.history.findIndex(x => x.date === today);

  if (index >= 0) data.smoking.history[index] = record;
  else data.smoking.history.push(record);

  data.smoking = {
    ...data.smoking,
    dailyCount,
    packPrice,
    cigarettesPerPack,
    history: data.smoking.history
  };

  saveData();
  openModule("smoking");
  renderSmokingHistory();
}

function renderSmokingHistory() {
  const el = document.getElementById("smokingHistory");
  if (!el) return;

  el.innerHTML = data.smoking.history.slice().reverse().map(h => `
    <div class="total-item">
      <p>تاریخ: ${escapeHTML(h.date)}</p>
      <p>مصرف: ${number(h.count)} نخ</p>
      <p>هزینه: ${money(h.count * h.price / h.packSize)}</p>
    </div>
  `).join("") || "<p>هنوز سابقه‌ای ثبت نشده است.</p>";
}

// پس‌انداز

function savingsModule() {
  return `
    <h2>🐷 مدیریت پس‌انداز</h2>

    <input id="savingBalance" type="number" min="0"
      value="${data.savings.balance}" placeholder="موجودی">

    <input id="savingGoal" type="number" min="0"
      value="${data.savings.goal}" placeholder="هدف">

    <button onclick="saveSavings()">ذخیره</button>

    <div class="total-item">
      <p>موجودی: ${money(data.savings.balance)}</p>
      <p>هدف: ${money(data.savings.goal)}</p>
      <canvas id="savingChart"></canvas>
    </div>
  `;
}

function saveSavings() {
  const balance = Number(document.getElementById("savingBalance").value);
  const goal = Number(document.getElementById("savingGoal").value);

  if (
    !Number.isFinite(balance) || balance < 0 ||
    !Number.isFinite(goal) || goal < 0
  ) return alert("مقادیر معتبر وارد کن.");

  data.savings = { balance, goal };

  saveData();
  openModule("savings");

  createChart("savingChart", {
    type: "doughnut",
    data: {
      labels: ["پس‌انداز شده", "باقی‌مانده تا هدف"],
      datasets: [{
        data: [Math.min(balance, goal), Math.max(goal - balance, 0)],
        backgroundColor: ["#22c55e", "#334155"]
      }]
    },
    options: { responsive: true }
  });
}

// تبدیل ارز

function currencyModule() {
  return `
    <h2>💵 تبدیل دلار به تومان</h2>

    <input id="dollarRate" type="number" min="1"
      value="${data.dollarRate || ""}"
      placeholder="قیمت هر دلار به تومان">

    <button onclick="saveDollarRate()">ذخیره نرخ دلار</button>

    <input id="dollarAmount" type="number" min="0"
      placeholder="مبلغ دلاری" oninput="convertDollar()">

    <div class="total-item">
      <p>نرخ فعلی: ${money(data.dollarRate)}</p>
      <p>معادل تومانی:</p>
      <strong id="convertedAmount">۰ تومان</strong>
    </div>
  `;
}

function saveDollarRate() {
  const rate = Number(document.getElementById("dollarRate").value);

  if (!Number.isFinite(rate) || rate <= 0) {
    return alert("نرخ معتبر وارد کن.");
  }

  data.dollarRate = rate;
  saveData();

  const amount = document.getElementById("dollarAmount");
  const previousAmount = amount ? amount.value : "";

  openModule("currency");

  document.getElementById("dollarAmount").value = previousAmount;
  convertDollar();
}

function convertDollar() {
  const amount = Number(document.getElementById("dollarAmount").value);
  const output = document.getElementById("convertedAmount");

  if (!output) return;

  output.textContent = money(amount * data.dollarRate);
}

// گزارش کلی

function reportsModule() {
  const totals = getTotals();

  return `
    <h2>📊 گزارش و آمار</h2>

    <div class="total-grid">
      <div class="total-item">
        <p>درآمد کل</p>
        <strong>${money(totals.income)}</strong>
      </div>

      <div class="total-item">
        <p>هزینه کل</p>
        <strong>${money(totals.expense)}</strong>
      </div>

      <div class="total-item">
        <p>موجودی کل</p>
        <strong>${money(totals.balance)}</strong>
      </div>
    </div>

    <canvas id="mainChart"></canvas>

    <h3>وضعیت حساب‌ها</h3>

    ${data.budgets.map(b => `
      <div class="total-item">
        <p>${escapeHTML(b.name)}</p>
        <strong>${money(budgetBalance(b))}</strong>
      </div>
    `).join("") || "<p>حسابی وجود ندارد.</p>"}

    <p>پس‌انداز مستقل: ${money(data.savings.balance)}</p>
    <p>هزینه تخمینی روزانه سیگار:
      ${money(
        data.smoking.dailyCount *
        data.smoking.packPrice /
        data.smoking.cigarettesPerPack
      )}
    </p>
  `;
}

function renderMainChart() {
  const totals = getTotals();

  createChart("mainChart", {
    type: "bar",
    data: {
      labels: ["درآمد", "هزینه", "موجودی"],
      datasets: [{
        label: "مبلغ (تومان)",
        data: [totals.income, totals.expense, totals.balance],
        backgroundColor: ["#22c55e", "#ef4444", "#38bdf8"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: "#f1f5f9" }
        }
      },
      scales: {
        x: {
          ticks: { color: "#f1f5f9" },
          grid: { color: "#29354a" }
        },
        y: {
          ticks: { color: "#f1f5f9" },
          grid: { color: "#29354a" }
        }
      }
    }
  });
}

// راه‌اندازی اولیه

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("today").textContent =
    new Date().toLocaleDateString("fa-IR");

  updateDashboard();
});
