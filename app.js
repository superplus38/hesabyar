
const STORAGE_KEY = "personalManagerV2";

let data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
  budgets: [],
  savings: {
    balance: 0,
    goal: 0
  },
  smoking: {
    dailyCount: 0,
    packPrice: 0,
    cigarettesPerPack: 20
  },
  dollarRate: 0,
  transactions: []
};

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

function updateDashboard() {
  let income = 0;
  let expense = 0;

  data.transactions.forEach(t => {
    if (t.type === "income") income += Number(t.amount);
    else expense += Number(t.amount);
  });

  document.getElementById("totalIncome").textContent = money(income);
  document.getElementById("totalExpense").textContent = money(expense);
  document.getElementById("totalBalance").textContent = money(income - expense);
}

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

  body.innerHTML = modules[name]();
}

function closeModule() {
  document.getElementById("moduleContent").hidden = true;
  document.querySelector(".modules").hidden = false;
  document.querySelector(".welcome").hidden = false;
  document.querySelector(".total-dashboard").hidden = false;
}

function budgetModule() {
  return `
    <h2>💰 مدیریت بودجه</h2>
    <div class="module-form">
      <input id="budgetName" placeholder="نام حساب؛ مثلاً خوراک">
      <input id="budgetInitial" type="number" placeholder="موجودی اولیه (تومان)">
      <button onclick="addBudget()">ساخت حساب جدید</button>
    </div>
    <div id="budgetList"></div>
  `;
}

function addBudget() {
  const name = document.getElementById("budgetName").value.trim();
  const initial = Number(document.getElementById("budgetInitial").value);

  if (!name || initial < 0) return alert("اطلاعات حساب را درست وارد کن.");

  data.budgets.push({
    id: createId(),
    name,
    initial,
    transactions: []
  });

  saveData();
  openModule("budget");
}

function budgetBalance(budget) {
  return budget.initial + budget.transactions.reduce((sum, t) =>
    sum + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0
  );
}

function budgetCard(b) {
  return `
    <div class="total-item">
      <h3>${escapeHTML(b.name)}</h3>
      <p>موجودی: ${money(budgetBalance(b))}</p>
      <input id="amount-${b.id}" type="number" placeholder="مبلغ تراکنش">
      <select id="type-${b.id}">
        <option value="expense">هزینه</option>
        <option value="income">درآمد</option>
      </select>
      <input id="note-${b.id}" placeholder="توضیحات">
      <button onclick="addTransaction('${b.id}')">ثبت تراکنش</button>
      <button onclick="deleteBudget('${b.id}')">حذف حساب</button>
      <div>
        ${b.transactions.map(t => `
          <p>${t.type === "income" ? "درآمد" : "هزینه"}: ${money(t.amount)} — ${escapeHTML(t.note || "")}</p>
        `).join("")}
      </div>
    </div>
  `;
}

function renderBudgetList() {
  document.getElementById("budgetList").innerHTML =
    data.budgets.map(budgetCard).join("") || "<p>هنوز حسابی نساختی.</p>";
}

function addTransaction(id) {
  const b = data.budgets.find(x => x.id === id);
  const amount = Number(document.getElementById("amount-" + id).value);
  const type = document.getElementById("type-" + id).value;
  const note = document.getElementById("note-" + id).value.trim();

  if (!b || amount <= 0) return alert("مبلغ معتبر وارد کن.");

  b.transactions.push({ id: createId(), amount, type, note, date: new Date().toISOString() });

  data.transactions.push({ amount, type, budgetId: id });
  saveData();
  openModule("budget");
}

function deleteBudget(id) {
  if (!confirm("این حساب و تراکنش‌های آن حذف شود؟")) return;

  data.budgets = data.budgets.filter(b => b.id !== id);
  data.transactions = data.transactions.filter(t => t.budgetId !== id);
  saveData();
  openModule("budget");
}

function smokingModule() {
  return `
    <h2>🚬 مدیریت سیگار</h2>
    <input id="smokeCount" type="number" min="0" placeholder="تعداد سیگار امروز">
    <input id="smokePrice" type="number" min="0" placeholder="قیمت یک پاکت (تومان)">
    <input id="smokePack" type="number" min="1" value="${data.smoking.cigarettesPerPack}" placeholder="تعداد نخ در پاکت">
    <button onclick="saveSmoking()">ذخیره اطلاعات</button>
    <div class="total-item">
      <p>هزینه تخمینی روزانه:</p>
      <strong id="smokeCost">${money(data.smoking.dailyCount * data.smoking.packPrice / data.smoking.cigarettesPerPack)}</strong>
    </div>
  `;
}

function saveSmoking() {
  const dailyCount = Number(document.getElementById("smokeCount").value);
  const packPrice = Number(document.getElementById("smokePrice").value);
  const cigarettesPerPack = Number(document.getElementById("smokePack").value);

  if (dailyCount < 0 || packPrice < 0 || cigarettesPerPack <= 0) {
    return alert("مقادیر واردشده معتبر نیستند.");
  }

  data.smoking = { dailyCount, packPrice, cigarettesPerPack };
  saveData();
  openModule("smoking");
}

function savingsModule() {
  return `
    <h2>🐷 مدیریت پس‌انداز</h2>
    <input id="savingBalance" type="number" placeholder="موجودی پس‌انداز" value="${data.savings.balance}">
    <input id="savingGoal" type="number" placeholder="هدف پس‌انداز" value="${data.savings.goal}">
    <button onclick="saveSavings()">ذخیره</button>
    <p>موجودی فعلی: ${money(data.savings.balance)}</p>
    <p>هدف: ${money(data.savings.goal)}</p>
  `;
}

function saveSavings() {
  const balance = Number(document.getElementById("savingBalance").value);
  const goal = Number(document.getElementById("savingGoal").value);

  if (balance < 0 || goal < 0) return alert("مقادیر منفی قابل قبول نیستند.");

  data.savings = { balance, goal };
  saveData();
  openModule("savings");
}

function currencyModule() {
  return `
    <h2>💵 تبدیل دلار به تومان</h2>
    <input id="dollarRate" type="number" min="0" placeholder="قیمت هر دلار به تومان" value="${data.dollarRate || ""}">
    <input id="dollarAmount" type="number" min="0" placeholder="مبلغ به دلار" oninput="convertDollar()">
    <button onclick="saveDollarRate()">ذخیره نرخ دلار</button>
    <div class="total-item">
      <p>معادل تومانی:</p>
      <strong id="convertedAmount">۰ تومان</strong>
    </div>
  `;
}

function saveDollarRate() {
  const rate = Number(document.getElementById("dollarRate").value);
  if (rate <= 0) return alert("نرخ دلار معتبر وارد کن.");

  data.dollarRate = rate;
  saveData();
  convertDollar();
}

function convertDollar() {
  const amount = Number(document.getElementById("dollarAmount").value);
  const result = amount * data.dollarRate;

  document.getElementById("convertedAmount").textContent = money(result);
}

function reportsModule() {
  return `
    <h2>📊 گزارش و آمار</h2>
    <p>تعداد حساب‌ها: ${data.budgets.length}</p>
    <p>مجموع موجودی حساب‌ها: ${money(data.budgets.reduce((s,b) => s + budgetBalance(b), 0))}</p>
    <p>موجودی پس‌انداز: ${money(data.savings.balance)}</p>
    <p>هزینه تخمینی سیگار در روز: ${money(data.smoking.dailyCount * data.smoking.packPrice / data.smoking.cigarettesPerPack)}</p>
  `;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("today").textContent =
    new Date().toLocaleDateString("fa-IR");

  updateDashboard();

  const originalOpenModule = openModule;
  window.openModule = function(name) {
    originalOpenModule(name);
    if (name === "budget") renderBudgetList();
  };
});
