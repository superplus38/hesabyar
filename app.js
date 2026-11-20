
"use strict";

/* =========================================
   PERSONAL MANAGER
   Local storage + weekly budget + archive
========================================= */

const STORAGE_KEY = "personalManagerV4";

let data = loadData();
let activeCharts = [];

/* ---------- DATA ---------- */

function defaultData() {
  return {
    currentWeek: {
      startDate: todayISO(),
      accounts: []
    },
    archive: [],
    smoking: {
      packPrice: 0,
      cigarettesPerPack: 20,
      dailyRecords: []
    },
    dollarRate: 0
  };
}

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...defaultData(),
        ...parsed,
        currentWeek: {
          ...defaultData().currentWeek,
          ...(parsed.currentWeek || {})
        },
        archive: Array.isArray(parsed.archive) ? parsed.archive : [],
        smoking: {
          ...defaultData().smoking,
          ...(parsed.smoking || {}),
          dailyRecords: Array.isArray(parsed.smoking?.dailyRecords)
            ? parsed.smoking.dailyRecords
            : []
        }
      };
    }

    // Import compatible data from the previous V3 version.
    const old = localStorage.getItem("personalManagerV3");
    if (old) {
      const oldData = JSON.parse(old);
      const migrated = defaultData();

      if (Array.isArray(oldData.budgets)) {
        migrated.currentWeek.accounts = oldData.budgets.map(account => ({
          id: account.id || createId(),
          name: account.name || "حساب جدید",
          budget: Number(account.initial) || 0,
          transactions: Array.isArray(account.transactions)
            ? account.transactions.map(t => ({
                id: t.id || createId(),
                title: t.title || t.note || "تراکنش قبلی",
                amount: Number(t.amount) || 0,
                type: t.type || "expense",
                date: t.date || todayISO()
              }))
            : []
        }));
      }

      if (oldData.smoking) {
        migrated.smoking.packPrice = Number(oldData.smoking.packPrice) || 0;
        migrated.smoking.cigarettesPerPack =
          Number(oldData.smoking.cigarettesPerPack) || 20;
      }

      migrated.dollarRate = Number(oldData.dollarRate) || 0;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch (error) {
    console.error("خطا در خواندن اطلاعات:", error);
  }

  return defaultData();
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  updateDashboard();
}

function createId() {
  return "id-" + Date.now().toString(36) +
    Math.random().toString(36).slice(2, 8);
}

function money(value) {
  return Math.round(Number(value) || 0).toLocaleString("fa-IR");
}

function number(value) {
  return Number(value) || 0;
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function formatDate(date) {
  if (!date) return "—";
  return new Date(date + "T12:00:00").toLocaleDateString("fa-IR");
}

function toDollar(amount) {
  const rate = number(data.dollarRate);
  if (!rate) return "نرخ دلار ثبت نشده";
  return `$${(number(amount) / rate).toFixed(2)}`;
}

/* ---------- ACCOUNT CALCULATIONS ---------- */

function accountSpent(account) {
  return account.transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + number(t.amount), 0);
}

function accountIncome(account) {
  return account.transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + number(t.amount), 0);
}

function accountBalance(account) {
  return number(account.budget) +
    accountIncome(account) -
    accountSpent(account);
}

function totalBudget() {
  return data.currentWeek.accounts.reduce(
    (sum, a) => sum + number(a.budget), 0
  );
}

function totalExpenses() {
  return data.currentWeek.accounts.reduce(
    (sum, a) => sum + accountSpent(a), 0
  );
}

function totalBalances() {
  return data.currentWeek.accounts.reduce(
    (sum, a) => sum + accountBalance(a), 0
  );
}

/* ---------- DASHBOARD ---------- */

function updateDashboard() {
  const incomeEl = document.getElementById("totalIncome");
  const expenseEl = document.getElementById("totalExpense");
  const balanceEl = document.getElementById("totalBalance");

  if (incomeEl) incomeEl.textContent = money(totalBudget());
  if (expenseEl) expenseEl.textContent = money(totalExpenses());
  if (balanceEl) balanceEl.textContent = money(totalBalances());

  const incomeCaption = document.querySelector(".income-card .summary-caption");
  if (incomeCaption) incomeCaption.textContent = "بودجه اختصاص‌یافته";

  const dateEl = document.getElementById("today");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("fa-IR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  }
}

/* ---------- NAVIGATION ---------- */

function setActiveNav(module) {
  document.querySelectorAll(".nav-item").forEach(button => {
    button.classList.remove("active");
  });

  const navButtons = document.querySelectorAll(".nav-item");
  const index = {
    dashboard: 0,
    budget: 1,
    smoking: 2,
    savings: 3,
    currency: 4,
    reports: 5,
    archive: 6
  }[module];

  if (index !== undefined && navButtons[index]) {
    navButtons[index].classList.add("active");
  }
}

function openModule(module) {
  const dashboard = document.getElementById("dashboard");
  const content = document.getElementById("moduleContent");
  const body = document.getElementById("moduleBody");

  if (!dashboard || !content || !body) return;

  dashboard.style.display = "none";
  content.style.display = "block";

  destroyCharts();
  setActiveNav(module);

  const renderers = {
    budget: renderBudget,
    smoking: renderSmoking,
    savings: renderSavings,
    currency: renderCurrency,
    reports: renderReports,
    archive: renderArchive
  };

  if (renderers[module]) renderers[module]();
}

function closeModule() {
  destroyCharts();

  const dashboard = document.getElementById("dashboard");
  const content = document.getElementById("moduleContent");

  if (dashboard) dashboard.style.display = "block";
  if (content) content.style.display = "none";

  setActiveNav("dashboard");
  updateDashboard();
}

/* ---------- CHARTS ---------- */

function destroyCharts() {
  activeCharts.forEach(chart => {
    try {
      chart.destroy();
    } catch (error) {
      console.warn(error);
    }
  });
  activeCharts = [];
}

function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  const chart = new Chart(canvas, config);
  activeCharts.push(chart);
  return chart;
}

function chartOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#cbd5e1",
          font: { family: "Vazirmatn" }
        }
      }
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(148,163,184,.08)" }
      },
      y: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(148,163,184,.08)" }
      }
    }
  };
}

/* =========================================
   BUDGET MODULE
========================================= */

function renderBudget() {
  const body = document.getElementById("moduleBody");
  const accounts = data.currentWeek.accounts;

  body.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>مدیریت بودجه هفتگی</h2>
        <p>برای هر حساب بودجه مستقل تعیین کن و خریدها را ثبت کن.</p>
      </div>
      <span class="section-tag">هفته جاری</span>
    </div>

    <div class="summary-grid">
      <div class="summary-card income-card">
        <div class="summary-caption">کل بودجه</div>
        <div class="summary-value">${money(totalBudget())}</div>
        <div class="summary-unit">تومان</div>
      </div>
      <div class="summary-card expense-card">
        <div class="summary-caption">هزینه‌شده</div>
        <div class="summary-value">${money(totalExpenses())}</div>
        <div class="summary-unit">تومان</div>
      </div>
      <div class="summary-card balance-card">
        <div class="summary-caption">مانده خالص</div>
        <div class="summary-value">${money(totalBalances())}</div>
        <div class="summary-unit">تومان</div>
      </div>
    </div>

    <div class="panel">
      <h3>ایجاد حساب جدید</h3>
      <form onsubmit="addAccount(event)">
        <div class="form-group">
          <label for="accountName">نام حساب</label>
          <input id="accountName" required maxlength="40"
            placeholder="مثلاً خوراک، رفت‌وآمد، تفریح">
        </div>
        <div class="form-group">
          <label for="accountBudget">بودجه این هفته (تومان)</label>
          <input id="accountBudget" type="number" min="1" required
            placeholder="مثلاً ۲۰۰۰۰۰۰">
        </div>
        <button class="primary" type="submit">＋ ایجاد حساب</button>
      </form>
    </div>

    <div class="section-heading">
      <div>
        <h2>حساب‌های این هفته</h2>
        <p>بودجه، هزینه و مانده هر حساب به‌صورت مستقل</p>
      </div>
    </div>

    <div class="budget-list" id="budgetList"></div>

    <div class="panel" style="margin-top:18px;">
      <h3>پایان هفته</h3>
      <p style="line-height:2;margin-bottom:14px;">
        با تأیید پایان هفته، وضعیت تمام حساب‌ها و تراکنش‌ها در بایگانی ثبت می‌شود.
        پس از آن باید برای هفته جدید دوباره بودجه تعیین کنی.
      </p>
      <button class="danger" onclick="finishWeek()">
        ثبت پایان هفته و بستن هفته
      </button>
    </div>
  `;

  renderAccountCards();
}

function addAccount(event) {
  event.preventDefault();

  const name = document.getElementById("accountName").value.trim();
  const budget = number(document.getElementById("accountBudget").value);

  if (!name || budget <= 0) {
    alert("نام حساب و بودجه معتبر وارد کن.");
    return;
  }

  const duplicate = data.currentWeek.accounts.some(
    a => a.name.trim().toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    alert("این حساب در هفته جاری وجود دارد.");
    return;
  }

  data.currentWeek.accounts.push({
    id: createId(),
    name,
    budget,
    transactions: []
  });

  saveData();
  renderBudget();
}

function renderAccountCards() {
  const list = document.getElementById("budgetList");
  if (!list) return;

  if (!data.currentWeek.accounts.length) {
    list.innerHTML = `
      <div class="panel">
        هنوز حسابی ایجاد نکردی. برای شروع، یک حساب با بودجه مشخص بساز.
      </div>
    `;
    return;
  }

  list.innerHTML = data.currentWeek.accounts.map(account => {
    const spent = accountSpent(account);
    const income = accountIncome(account);
    const balance = accountBalance(account);
    const budget = number(account.budget);
    const percent = budget > 0
      ? Math.min(100, Math.round(spent / budget * 100))
      : 0;

    const balanceClass = balance >= 0 ? "positive" : "negative";

    return `
      <div class="budget-card">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center;">
          <h3>${escapeHTML(account.name)}</h3>
          <button class="danger" onclick="deleteAccount('${account.id}')">حذف</button>
        </div>

        <div class="stat-row">
          <span>بودجه</span>
          <strong>${money(budget)} تومان</strong>
        </div>
        <div class="stat-row">
          <span>هزینه</span>
          <strong class="negative">${money(spent)} تومان</strong>
        </div>
        <div class="stat-row">
          <span>درآمد ثبت‌شده</span>
          <strong class="positive">${money(income)} تومان</strong>
        </div>
        <div class="stat-row">
          <span>مانده / کسری</span>
          <strong class="${balanceClass}">${money(balance)} تومان</strong>
        </div>

        <div style="height:7px;background:#26354d;border-radius:10px;margin:14px 0;overflow:hidden;">
          <div style="height:100%;width:${percent}%;background:${percent >= 100 ? "#ff7185" : "#36d6d0"};border-radius:10px;"></div>
        </div>
        <p class="muted">${percent}% از بودجه اولیه مصرف شده</p>

        <div class="chart-container" style="height:190px;margin:12px 0;">
          <canvas id="accountChart-${account.id}"></canvas>
        </div>

        <form onsubmit="addTransaction(event,'${account.id}')">
          <div class="form-group">
            <label>عنوان خرید یا درآمد</label>
            <input name="title" required maxlength="70" placeholder="مثلاً خرید ناهار">
          </div>
          <div class="form-group">
            <label>مبلغ (تومان)</label>
            <input name="amount" type="number" min="1" required placeholder="مبلغ">
          </div>
          <div class="form-group">
            <label>نوع تراکنش</label>
            <select name="type">
              <option value="expense">هزینه / خرید</option>
              <option value="income">درآمد / اضافه‌شدن پول</option>
            </select>
          </div>
          <button class="primary" type="submit">ثبت تراکنش</button>
        </form>

        <div style="margin-top:18px;">
          <h3>تراکنش‌های حساب</h3>
          <div class="transaction-list">
            ${account.transactions.length
              ? account.transactions.slice().reverse().map(t => `
                <div class="transaction-item">
                  <div>
                    <strong>${escapeHTML(t.title)}</strong>
                    <div class="muted">${formatDate(t.date)}</div>
                  </div>
                  <div style="text-align:left;">
                    <div class="amount ${t.type === "income" ? "positive" : "negative"}">
                      ${t.type === "income" ? "+" : "−"}${money(t.amount)}
                    </div>
                    <button class="danger" style="margin-top:5px;" onclick="deleteTransaction('${account.id}','${t.id}')">حذف</button>
                  </div>
                </div>
              `).join("")
              : `<p class="muted">هنوز تراکنشی ثبت نشده.</p>`
            }
          </div>
        </div>
      </div>
    `;
  }).join("");

  data.currentWeek.accounts.forEach(account => {
    createChart(`accountChart-${account.id}`, {
      type: "doughnut",
      data: {
        labels: ["هزینه‌شده", "مانده مثبت"],
        datasets: [{
          data: [
            accountSpent(account),
            Math.max(0, accountBalance(account))
          ],
          backgroundColor: ["#ff7185", "#36d6d0"],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#cbd5e1",
              font: { family: "Vazirmatn" }
            }
          }
        }
      }
    });
  });
}

function addTransaction(event, accountId) {
  event.preventDefault();

  const account = data.currentWeek.accounts.find(a => a.id === accountId);
  if (!account) return;

  const form = event.target;
  const title = form.elements.title.value.trim();
  const amount = number(form.elements.amount.value);
  const type = form.elements.type.value;

  if (!title || amount <= 0) {
    alert("عنوان و مبلغ معتبر وارد کن.");
    return;
  }

  account.transactions.push({
    id: createId(),
    title,
    amount,
    type,
    date: todayISO()
  });

  saveData();
  renderBudget();
}

function deleteTransaction(accountId, transactionId) {
  if (!confirm("این تراکنش حذف شود؟")) return;

  const account = data.currentWeek.accounts.find(a => a.id === accountId);
  if (!account) return;

  account.transactions = account.transactions.filter(
    t => t.id !== transactionId
  );

  saveData();
  renderBudget();
}

function deleteAccount(accountId) {
  const account = data.currentWeek.accounts.find(a => a.id === accountId);
  if (!account) return;

  if (!confirm(`حساب «${account.name}» و تراکنش‌های این هفته حذف شوند؟`)) {
    return;
  }

  data.currentWeek.accounts = data.currentWeek.accounts.filter(
    a => a.id !== accountId
  );

  saveData();
  renderBudget();
}

/* ---------- WEEK END / ARCHIVE ---------- */

function finishWeek() {
  if (!data.currentWeek.accounts.length) {
    alert("برای بستن هفته، ابتدا حداقل یک حساب ایجاد کن.");
    return;
  }

  const unbudgeted = data.currentWeek.accounts.some(
    a => number(a.budget) <= 0
  );

  if (unbudgeted) {
    alert("برای تمام حساب‌ها باید بودجه تعیین شده باشد.");
    return;
  }

  const ok = confirm(
    "هفته جاری بسته و اطلاعات آن بایگانی شود؟ این عملیات هفته جدید را آغاز می‌کند."
  );

  if (!ok) return;

  const accountsSnapshot = data.currentWeek.accounts.map(account => {
    const spent = accountSpent(account);
    const income = accountIncome(account);
    const balance = accountBalance(account);

    return {
      id: account.id,
      name: account.name,
      budget: number(account.budget),
      expenses: spent,
      income,
      balance,
      savings: Math.max(0, balance),
      deficit: Math.max(0, -balance),
      transactions: JSON.parse(JSON.stringify(account.transactions))
    };
  });

  data.archive.push({
    id: createId(),
    startDate: data.currentWeek.startDate,
    endDate: todayISO(),
    closedAt: new Date().toISOString(),
    accounts: accountsSnapshot
  });

  // Keep the account names, but require a fresh budget for the next week.
  data.currentWeek = {
    startDate: todayISO(),
    accounts: data.currentWeek.accounts.map(account => ({
      id: createId(),
      name: account.name,
      budget: 0,
      transactions: []
    }))
  };

  saveData();
  alert("هفته با موفقیت بایگانی شد. حالا بودجه حساب‌ها را برای هفته جدید تعیین کن.");
  renderBudget();
}

/* =========================================
   SMOKING MODULE
========================================= */

function getTodaySmokingRecord() {
  let record = data.smoking.dailyRecords.find(
    r => r.date === todayISO()
  );

  if (!record) {
    record = {
      date: todayISO(),
      personal: 0,
      free: 0
    };
    data.smoking.dailyRecords.push(record);
  }

  return record;
}

function cigarettePrice() {
  const packSize = Math.max(1, number(data.smoking.cigarettesPerPack));
  return number(data.smoking.packPrice) / packSize;
}

function renderSmoking() {
  const body = document.getElementById("moduleBody");
  const record = getTodaySmokingRecord();
  const unitPrice = cigarettePrice();

  const totalPersonal = data.smoking.dailyRecords.reduce(
    (sum, r) => sum + number(r.personal), 0
  );

  const totalFree = data.smoking.dailyRecords.reduce(
    (sum, r) => sum + number(r.free), 0
  );

  const todayCost = record.personal * unitPrice;

  body.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>مدیریت سیگار</h2>
        <p>ثبت تک‌تک نخ‌ها و محاسبه هزینه مصرف شخصی</p>
      </div>
      <span class="section-tag">مصرف روزانه</span>
    </div>

    <div class="summary-grid">
      <div class="summary-card expense-card">
        <div class="summary-caption">هزینه امروز</div>
        <div class="summary-value">${money(todayCost)}</div>
        <div class="summary-unit">تومان</div>
      </div>
      <div class="summary-card balance-card">
        <div class="summary-caption">مصرف شخصی امروز</div>
        <div class="summary-value">${money(record.personal)}</div>
        <div class="summary-unit">نخ</div>
      </div>
      <div class="summary-card income-card">
        <div class="summary-caption">مفت‌کشی امروز</div>
        <div class="summary-value">${money(record.free)}</div>
        <div class="summary-unit">نخ</div>
      </div>
    </div>

    <div class="panel">
      <h3>تنظیمات قیمت</h3>
      <div class="form-group">
        <label>قیمت هر بسته (تومان)</label>
        <input id="packPrice" type="number" min="0"
          value="${number(data.smoking.packPrice)}">
      </div>
      <div class="form-group">
        <label>تعداد نخ در هر بسته</label>
        <input id="packSize" type="number" min="1"
          value="${number(data.smoking.cigarettesPerPack)}">
      </div>
      <div class="stat-row">
        <span>قیمت محاسبه‌شده هر نخ</span>
        <strong class="positive">${money(unitPrice)} تومان</strong>
      </div>
      <button class="primary" onclick="saveSmokingSettings()">ذخیره قیمت‌ها</button>
    </div>

    <div class="panel">
      <h3>ثبت مصرف امروز</h3>
      <p style="line-height:2;margin-bottom:14px;">
        هر بار که یک نخ مصرف می‌کنی، دکمه مربوطه رو یک بار بزن.
      </p>
      <div class="report-grid">
        <div>
          <button class="primary" style="width:100%;min-height:65px;"
            onclick="addCigarette('personal')">
            ＋ یک نخ کشیدم
          </button>
          <p class="muted" style="margin-top:8px;text-align:center;">
            هزینه: ${money(unitPrice)} تومان
          </p>
        </div>
        <div>
          <button class="secondary" style="width:100%;min-height:65px;"
            onclick="addCigarette('free')">
            ＋ مفت کشیدم
          </button>
          <p class="muted" style="margin-top:8px;text-align:center;">
            بدون هزینه شخصی
          </p>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;gap:10px;margin-top:20px;">
        <button class="danger" onclick="undoCigarette('personal')">لغو یک نخ شخصی</button>
        <button class="danger" onclick="undoCigarette('free')">لغو یک مفت‌کشی</button>
      </div>
    </div>

    <div class="chart-card">
      <h3>نمودار مصرف روزانه</h3>
      <div class="chart-container">
        <canvas id="smokingChart"></canvas>
      </div>
    </div>

    <div class="panel">
      <h3>آمار کلی ثبت‌شده</h3>
      <div class="stat-row">
        <span>کل نخ شخصی</span>
        <strong>${money(totalPersonal)} نخ</strong>
      </div>
      <div class="stat-row">
        <span>کل مفت‌کشی</span>
        <strong>${money(totalFree)} نخ</strong>
      </div>
      <div class="stat-row">
        <span>هزینه کل مصرف شخصی</span>
        <strong class="negative">${money(totalPersonal * unitPrice)} تومان</strong>
      </div>
      <div class="stat-row">
        <span>ارزش تقریبی مفت‌کشی</span>
        <strong>${money(totalFree * unitPrice)} تومان</strong>
      </div>
    </div>
  `;

  renderSmokingChart();
}

function saveSmokingSettings() {
  const price = number(document.getElementById("packPrice").value);
  const size = number(document.getElementById("packSize").value);

  if (price < 0 || size < 1) {
    alert("قیمت بسته و تعداد نخ معتبر وارد کن.");
    return;
  }

  data.smoking.packPrice = price;
  data.smoking.cigarettesPerPack = size;

  saveData();
  renderSmoking();
}

function addCigarette(type) {
  const record = getTodaySmokingRecord();

  if (type === "personal") record.personal++;
  if (type === "free") record.free++;

  saveData();
  renderSmoking();
}

function undoCigarette(type) {
  const record = getTodaySmokingRecord();

  if (type === "personal" && record.personal > 0) {
    record.personal--;
  } else if (type === "free" && record.free > 0) {
    record.free--;
  } else {
    alert("موردی برای لغو وجود ندارد.");
    return;
  }

  saveData();
  renderSmoking();
}

function renderSmokingChart() {
  const records = data.smoking.dailyRecords.slice(-14);

  createChart("smokingChart", {
    type: "bar",
    data: {
      labels: records.map(r => formatDate(r.date)),
      datasets: [
        {
          label: "مصرف شخصی",
          data: records.map(r => number(r.personal)),
          backgroundColor: "#36d6d0",
          borderRadius: 6
        },
        {
          label: "مفت‌کشی",
          data: records.map(r => number(r.free)),
          backgroundColor: "#ffb86b",
          borderRadius: 6
        }
      ]
    },
    options: chartOptions()
  });
}

/* =========================================
   SAVINGS MODULE
========================================= */

function savingsByAccount() {
  const result = {};

  data.archive.forEach(week => {
    (week.accounts || []).forEach(account => {
      if (!result[account.name]) {
        result[account.name] = {
          name: account.name,
          total: 0,
          weeks: []
        };
      }

      const saved = Math.max(0, number(account.savings));
      result[account.name].total += saved;

      result[account.name].weeks.push({
        date: week.endDate,
        amount: saved
      });
    });
  });

  return Object.values(result);
}

function renderSavings() {
  const body = document.getElementById("moduleBody");
  const savings = savingsByAccount();
  const total = savings.reduce((sum, a) => sum + a.total, 0);

  body.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>پس‌اندازها</h2>
        <p>پس‌انداز هر حساب مستقل و بر اساس هفته‌های بایگانی‌شده</p>
      </div>
      <span class="section-tag">پس‌انداز تجمعی</span>
    </div>

    <div class="summary-card balance-card" style="margin-bottom:18px;">
      <div class="summary-caption">مجموع پس‌اندازهای ثبت‌شده</div>
      <div class="summary-value">${money(total)}</div>
      <div class="summary-unit">تومان</div>
      <div class="summary-unit">${escapeHTML(toDollar(total))}</div>
    </div>

    <div class="budget-list">
      ${savings.length ? savings.map(account => `
        <div class="budget-card">
          <h3>${escapeHTML(account.name)}</h3>
          <div class="summary-value positive">${money(account.total)}</div>
          <div class="summary-unit">تومان پس‌انداز</div>
          <div class="summary-unit">${escapeHTML(toDollar(account.total))}</div>
          <div class="stat-row">
            <span>تعداد هفته‌های ثبت‌شده</span>
            <strong>${money(account.weeks.length)}</strong>
          </div>
          <div class="chart-container" style="height:190px;margin-top:12px;">
            <canvas id="saving-${safeId(account.name)}"></canvas>
          </div>
        </div>
      `).join("") : `
        <div class="panel">
          هنوز هفته‌ای بایگانی نشده؛ پس‌اندازها پس از پایان اولین هفته اینجا نمایش داده می‌شوند.
        </div>
      `}
    </div>
  `;

  savings.forEach(account => {
    createChart(`saving-${safeId(account.name)}`, {
      type: "line",
      data: {
        labels: account.weeks.map(w => formatDate(w.date)),
        datasets: [{
          label: "پس‌انداز هفتگی",
          data: account.weeks.map(w => w.amount),
          borderColor: "#36d6d0",
          backgroundColor: "rgba(54,214,208,.12)",
          fill: true,
          tension: .35
        }]
      },
      options: chartOptions()
    });
  });
}

function safeId(value) {
  return Array.from(String(value))
    .map(char => char.codePointAt(0).toString(16))
    .join("-");
}

/* =========================================
   CURRENCY MODULE
========================================= */

function renderCurrency() {
  const body = document.getElementById("moduleBody");

  const accounts = data.currentWeek.accounts;
  const archivedAccounts = data.archive.flatMap(w => w.accounts || []);

  body.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>تبدیل ارز</h2>
        <p>نرخ دلار را دستی وارد کن تا مقادیر مالی به دلار نمایش داده شوند.</p>
      </div>
      <span class="section-tag">USD / IRR</span>
    </div>

    <div class="panel">
      <h3>تنظیم نرخ دلار</h3>
      <div class="form-group">
        <label>قیمت یک دلار به تومان</label>
        <input id="dollarRateInput" type="number" min="1"
          value="${number(data.dollarRate)}" placeholder="مثلاً ۱۰۰۰۰۰">
      </div>
      <button class="primary" onclick="saveDollarRate()">ذخیره نرخ دلار</button>
    </div>

    ${!number(data.dollarRate) ? `
      <div class="panel">
        نرخ دلار هنوز تعیین نشده. بعد از ثبت نرخ، تبدیل‌ها نمایش داده می‌شوند.
      </div>
    ` : `
      <div class="panel">
        <h3>حساب‌های هفته جاری</h3>
        ${accounts.length ? accounts.map(a => `
          <div class="stat-row">
            <span>${escapeHTML(a.name)} — هزینه</span>
            <strong>${money(accountSpent(a))} تومان / ${toDollar(accountSpent(a))}</strong>
          </div>
          <div class="stat-row">
            <span>${escapeHTML(a.name)} — مانده یا کسری</span>
            <strong>${money(accountBalance(a))} تومان / ${toDollar(accountBalance(a))}</strong>
          </div>
        `).join("") : `<p class="muted">هنوز حسابی در هفته جاری وجود ندارد.</p>`}
      </div>

      <div class="panel">
        <h3>پس‌انداز و کسری بایگانی‌شده</h3>
        ${archivedAccounts.length ? archivedAccounts.map(a => `
          <div class="stat-row">
            <span>${escapeHTML(a.name)} — پس‌انداز</span>
            <strong class="positive">${money(a.savings)} تومان / ${toDollar(a.savings)}</strong>
          </div>
          <div class="stat-row">
            <span>${escapeHTML(a.name)} — کسری</span>
            <strong class="negative">${money(a.deficit)} تومان / ${toDollar(a.deficit)}</strong>
          </div>
        `).join("") : `<p class="muted">هنوز اطلاعاتی در بایگانی نیست.</p>`}
      </div>
    `}
  `;
}

function saveDollarRate() {
  const rate = number(document.getElementById("dollarRateInput").value);

  if (rate <= 0) {
    alert("نرخ دلار باید عددی بزرگ‌تر از صفر باشد.");
    return;
  }

  data.dollarRate = rate;
  saveData();
  renderCurrency();
}

/* =========================================
   REPORTS MODULE
========================================= */

function renderReports() {
  const body = document.getElementById("moduleBody");

  const archived = data.archive;
  const totalSaved = archived.reduce(
    (sum, week) => sum + (week.accounts || []).reduce(
      (s, a) => s + number(a.savings), 0
    ), 0
  );

  const totalDeficit = archived.reduce(
    (sum, week) => sum + (week.accounts || []).reduce(
      (s, a) => s + number(a.deficit), 0
    ), 0
  );

  const smokingTotal = data.smoking.dailyRecords.reduce(
    (sum, r) => sum + number(r.personal), 0
  );

  const smokingCost = smokingTotal * cigarettePrice();

  body.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>گزارش‌ها و نمودارها</h2>
        <p>نمای کلی عملکرد مالی و مصرف سیگار</p>
      </div>
      <span class="section-tag">تحلیل اطلاعات</span>
    </div>

    <div class="summary-grid">
      <div class="summary-card balance-card">
        <div class="summary-caption">پس‌انداز ثبت‌شده</div>
        <div class="summary-value">${money(totalSaved)}</div>
        <div class="summary-unit">تومان</div>
      </div>
      <div class="summary-card expense-card">
        <div class="summary-caption">کسری بایگانی</div>
        <div class="summary-value">${money(totalDeficit)}</div>
        <div class="summary-unit">تومان</div>
      </div>
      <div class="summary-card income-card">
        <div class="summary-caption">هزینه مصرف شخصی سیگار</div>
        <div class="summary-value">${money(smokingCost)}</div>
        <div class="summary-unit">تومان</div>
      </div>
    </div>

    <div class="chart-card">
      <h3>مقایسه بودجه، هزینه و مانده هفته‌ها</h3>
      <div class="chart-container">
        <canvas id="weeklyChart"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <h3>پس‌انداز و کسری هر هفته</h3>
      <div class="chart-container">
        <canvas id="savingDeficitChart"></canvas>
      </div>
    </div>

    <div class="chart-card">
      <h3>مصرف سیگار</h3>
      <div class="chart-container">
        <canvas id="smokingReportChart"></canvas>
      </div>
    </div>

    <div class="panel">
      <h3>گزارش حساب‌های هفته جاری</h3>
      ${data.currentWeek.accounts.length
        ? data.currentWeek.accounts.map(a => `
          <div class="stat-row">
            <span>${escapeHTML(a.name)}</span>
            <strong>${money(accountSpent(a))} تومان هزینه</strong>
          </div>
        `).join("")
        : `<p class="muted">حسابی در هفته جاری وجود ندارد.</p>`
      }
    </div>
  `;

  const labels = archived.map((w, i) => `هفته ${i + 1}`);

  const budgets = archived.map(w =>
    (w.accounts || []).reduce((s, a) => s + number(a.budget), 0)
  );

  const expenses = archived.map(w =>
    (w.accounts || []).reduce((s, a) => s + number(a.expenses), 0)
  );

  const balances = archived.map(w =>
    (w.accounts || []).reduce((s, a) => s + number(a.balance), 0)
  );

  createChart("weeklyChart", {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "بودجه", data: budgets, backgroundColor: "#6197ff" },
        { label: "هزینه", data: expenses, backgroundColor: "#ff7185" },
        { label: "مانده خالص", data: balances, backgroundColor: "#36d6d0" }
      ]
    },
    options: chartOptions()
  });

  const savedPerWeek = archived.map(w =>
    (w.accounts || []).reduce((s, a) => s + number(a.savings), 0)
  );

  const deficitPerWeek = archived.map(w =>
    (w.accounts || []).reduce((s, a) => s + number(a.deficit), 0)
  );

  createChart("savingDeficitChart", {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "پس‌انداز",
          data: savedPerWeek,
          borderColor: "#35d49a",
          backgroundColor: "rgba(53,212,154,.12)",
          fill: true,
          tension: .3
        },
        {
          label: "کسری",
          data: deficitPerWeek,
          borderColor: "#ff7185",
          backgroundColor: "rgba(255,113,133,.10)",
          fill: true,
          tension: .3
        }
      ]
    },
    options: chartOptions()
  });

  const records = data.smoking.dailyRecords.slice(-14);

  createChart("smokingReportChart", {
    type: "bar",
    data: {
      labels: records.map(r => formatDate(r.date)),
      datasets: [
        {
          label: "مصرف شخصی",
          data: records.map(r => number(r.personal)),
          backgroundColor: "#36d6d0"
        },
        {
          label: "مفت‌کشی",
          data: records.map(r => number(r.free)),
          backgroundColor: "#ffb86b"
        }
      ]
    },
    options: chartOptions()
  });
}

/* =========================================
   ARCHIVE MODULE
========================================= */

function renderArchive() {
  const body = document.getElementById("moduleBody");

  body.innerHTML = `
    <div class="section-heading">
      <div>
        <h2>بایگانی هفته‌ها</h2>
        <p>اطلاعات هفته‌های بسته‌شده و نتیجه هر حساب</p>
      </div>
      <span class="section-tag">${money(data.archive.length)} هفته</span>
    </div>

    ${data.archive.length ? data.archive.slice().reverse().map((week, index) => {
      const weekNo = data.archive.length - index;
      const saved = (week.accounts || []).reduce(
        (sum, a) => sum + number(a.savings), 0
      );
      const deficit = (week.accounts || []).reduce(
        (sum, a) => sum + number(a.deficit), 0
      );

      return `
        <div class="panel">
          <h3>هفته ${money(weekNo)}</h3>
          <p class="muted" style="margin-bottom:12px;">
            از ${formatDate(week.startDate)} تا ${formatDate(week.endDate)}
          </p>

          <div class="stat-row">
            <span>پس‌انداز مجموع حساب‌ها</span>
            <strong class="positive">${money(saved)} تومان</strong>
          </div>
          <div class="stat-row">
            <span>کسری مجموع حساب‌ها</span>
            <strong class="negative">${money(deficit)} تومان</strong>
          </div>

          ${(week.accounts || []).map(a => `
            <div class="archive-item">
              <h4>${escapeHTML(a.name)}</h4>
              <div class="stat-row">
                <span>بودجه</span>
                <strong>${money(a.budget)} تومان</strong>
              </div>
              <div class="stat-row">
                <span>هزینه</span>
                <strong>${money(a.expenses)} تومان</strong>
              </div>
              <div class="stat-row">
                <span>مانده / کسری</span>
                <strong class="${number(a.balance) >= 0 ? "positive" : "negative"}">
                  ${money(a.balance)} تومان
                </strong>
              </div>
              <div class="stat-row">
                <span>پس‌انداز این حساب</span>
                <strong class="positive">${money(a.savings)} تومان</strong>
              </div>
              <div class="stat-row">
                <span>کسری این حساب</span>
                <strong class="negative">${money(a.deficit)} تومان</strong>
              </div>
              <p class="muted" style="margin-top:8px;">
                ${money((a.transactions || []).length)} تراکنش ثبت‌شده
              </p>
            </div>
          `).join("")}
        </div>
      `;
    }).join("") : `
      <div class="panel">
        هنوز هفته‌ای بسته و بایگانی نشده است.
      </div>
    `}
  `;
}

/* ---------- START ---------- */

document.addEventListener("DOMContentLoaded", () => {
  updateDashboard();
});

// Make functions available to HTML onclick handlers.
Object.assign(window, {
  openModule,
  closeModule,
  addAccount,
  addTransaction,
  deleteTransaction,
  deleteAccount,
  finishWeek,
  saveSmokingSettings,
  addCigarette,
  undoCigarette,
  saveDollarRate
});
