
const STORAGE_KEY = "personalManagerV2";

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.budgets)) {
      return {
        budgets: saved.budgets,
        savings: saved.savings || { balance: 0, goal: 0 },
        smoking: saved.smoking || {
          dailyCount: 0,
          packPrice: 0,
          cigarettesPerPack: 20
        },
        dollarRate: saved.dollarRate || 0
      };
    }
  } catch (error) {
    console.error("Storage error:", error);
  }

  return {
    budgets: [],
    savings: { balance: 0, goal: 0 },
    smoking: {
      dailyCount: 0,
      packPrice: 0,
      cigarettesPerPack: 20
    },
    dollarRate: 0
  };
}

let data = loadData();

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  updateDashboard();
}

function money(value) {
  return Number(value || 0).toLocaleString("fa-IR") + " تومان";
}

function createId() {
  return Date.now().toString() + Math.random().toString(16).slice(2);
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

// محاسبه موجودی هر حساب
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

// جمع‌بندی مالی
function updateDashboard() {
  let income = 0;
  let expense = 0;
  let balance = 0;

  data.budgets.forEach(budget => {
    budget.transactions.forEach(t => {
      if (t.type === "income") income += Number(t.amount);
      if (t.type === "expense") expense += Number(t.amount);
    });

    balance += budgetBalance(budget);
  });

  document.getElementById("totalIncome").textContent = money(income);
  document.getElementById("totalExpense").textContent = money(expense);
  document.getElementById("totalBalance").textContent = money(balance);
}

// باز کردن ماژول‌ها
function openModule(name) {
  const content = document.getElementById("moduleContent");
  const body = document.getElementById("moduleBody");

  document.querySelector(".modules").hidden = true;
  document.querySelector(".welcome").hidden = true;
  document.querySelector(".total-dashboard").hidden = true;
  content.hidden = false;

  const modules = {
    budget: budgetModule,
    smoking: smokingModule,
    savings: savingsModule,
    currency: currencyModule,
    reports: reportsModule
  };

  body.innerHTML = modules[name] ? modules[name]() : "";

  if (name === "budget") renderBudgetList();
}

function closeModule() {
  document.getElementById("moduleContent").hidden = true;
  document.querySelector(".modules").hidden = false;
  document.querySelector(".welcome").hidden = false;
  document.querySelector(".total-dashboard").hidden = false;
}

// ماژول بودجه
function budgetModule() {
  return `
    <h2>💰 مدیریت بودجه</h2>

    <div class="module-form">
      <input id="budgetName" placeholder="نام حساب">
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
  return `
    <div class="total-item">
      <h3>${escapeHTML(b.name)}</h3>
      <p>موجودی اولیه: ${money(b.initial)}</p>
      <p>موجودی فعلی:
        <strong>${money(budgetBalance(b))}</strong>
      </p>

      <input id="amount-${b.id}" type="number" min="1"
        placeholder="مبلغ تراکنش">

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

      <h4>تاریخچه تراکنش‌ها</h4>

      ${
        b.transactions.length
          ? b.transactions.slice().reverse().map(t => `
              <p>
                ${t.type === "income" ? "🟢 درآمد" : "🔴 هزینه"}
                ${money(t.amount)}
                ${escapeHTML(t.note || "")}
              </p>
            `).join("")
          : "<p>هنوز تراکنشی ثبت نشده است.</p>"
      }
    </div>
  `;
}

function renderBudgetList() {
  const list = document.getElementById("budgetList");
  if (!list) return;

  list.innerHTML = data.budgets.map(budgetCard).join("") ||
    "<p>هنوز حسابی نساختی.</p>";
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

  if (!Array.isArray(budget.transactions)) {
    budget.transactions = [];
  }

  if (type === "expense" && amount > budgetBalance(budget)) {
    return alert("موجودی این حساب برای این هزینه کافی نیست.");
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

function deleteBudget(id) {
  if (!confirm("حساب و تمام تراکنش‌های آن حذف شود؟")) return;

  data.budgets = data.budgets.filter(b => b.id !== id);

  saveData();
  openModule("budget");
}

// ماژول سیگار
function smokingModule() {
  const s = data.smoking;

  return `
    <h2>🚬 مدیریت سیگار</h2>

    <input id="smokeCount" type="number" min="0"
      value="${s.dailyCount}" placeholder="تعداد نخ در روز">

    <input id="smokePrice" type="number" min="0"
      value="${s.packPrice}" placeholder="قیمت یک پاکت">

    <input id="smokePack" type="number" min="1"
      value="${s.cigarettesPerPack}" placeholder="تعداد نخ در پاکت">

    <button onclick="saveSmoking()">ذخیره اطلاعات</button>

    <div class="total-item">
      <p>هزینه تخمینی روزانه:</p>
      <strong>${money(
        s.dailyCount * s.packPrice / s.cigarettesPerPack
      )}</strong>
    </div>
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
  ) {
    return alert("مقادیر معتبر وارد کن.");
  }

  data.smoking = {
    dailyCount,
    packPrice,
    cigarettesPerPack
  };

  saveData();
  openModule("smoking");
}

// ماژول پس‌انداز
function savingsModule() {
  return `
    <h2>🐷 مدیریت پس‌انداز</h2>

    <input id="savingBalance" type="number" min="0"
      value="${data.savings.balance}" placeholder="موجودی پس‌انداز">

    <input id="savingGoal" type="number" min="0"
      value="${data.savings.goal}" placeholder="هدف پس‌انداز">

    <button onclick="saveSavings()">ذخیره</button>

    <p>موجودی: ${money(data.savings.balance)}</p>
    <p>هدف: ${money(data.savings.goal)}</p>
  `;
}

function saveSavings() {
  const balance = Number(document.getElementById("savingBalance").value);
  const goal = Number(document.getElementById("savingGoal").value);

  if (
    !Number.isFinite(balance) || balance < 0 ||
    !Number.isFinite(goal) || goal < 0
  ) {
    return alert("مقادیر معتبر وارد کن.");
  }

  data.savings = { balance, goal };

  saveData();
  openModule("savings");
}

// ماژول تبدیل ارز
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
      <p>نرخ فعلی دلار: ${money(data.dollarRate)}</p>
      <p>معادل تومانی:</p>
      <strong id="convertedAmount">۰ تومان</strong>
    </div>
  `;
}

function saveDollarRate() {
  const rate = Number(document.getElementById("dollarRate").value);

  if (!Number.isFinite(rate) || rate <= 0) {
    return alert("نرخ دلار معتبر وارد کن.");
  }

  data.dollarRate = rate;
  saveData();
  convertDollar();
  openModule("currency");
}

function convertDollar() {
  const amount = Number(document.getElementById("dollarAmount").value);
  const output = document.getElementById("convertedAmount");

  if (!output) return;

  output.textContent = money(amount * data.dollarRate);
}

// ماژول گزارش
function reportsModule() {
  const income = data.budgets.reduce((sum, b) =>
    sum + b.transactions.filter(t => t.type === "income")
      .reduce((s, t) => s + Number(t.amount), 0), 0);

  const expense = data.budgets.reduce((sum, b) =>
    sum + b.transactions.filter(t => t.type === "expense")
      .reduce((s, t) => s + Number(t.amount), 0), 0);

  const balance = data.budgets.reduce(
    (sum, b) => sum + budgetBalance(b), 0
  );

  return `
    <h2>📊 گزارش و آمار</h2>

    <div class="total-item">
      <p>تعداد حساب‌ها: ${data.budgets.length}</p>
      <p>مجموع درآمد: ${money(income)}</p>
      <p>مجموع هزینه: ${money(expense)}</p>
      <p>موجودی کل حساب‌ها: ${money(balance)}</p>
      <p>پس‌انداز ثبت‌شده: ${money(data.savings.balance)}</p>
      <p>هزینه روزانه سیگار:
        ${money(
          data.smoking.dailyCount *
          data.smoking.packPrice /
          data.smoking.cigarettesPerPack
        )}
      </p>
    </div>
  `;
}

// شروع برنامه
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("today").textContent =
    new Date().toLocaleDateString("fa-IR");

  updateDashboard();
});
