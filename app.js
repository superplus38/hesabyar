
(() => {
    const $ = id => document.getElementById(id);

    const fmt = n =>
        new Intl.NumberFormat('fa-IR').format(Math.round(Number(n) || 0)) + ' تومان';

    const today = new Date().toISOString().slice(0, 10);

    $('expenseDate').value = today;

    let expenses = JSON.parse(
        localStorage.getItem('hesabyar_expenses') || '[]'
    );

    let budget = Number(
        localStorage.getItem('hesabyar_budget') || 0
    );

    let smoking = JSON.parse(
        localStorage.getItem('hesabyar_smoking') ||
        '{"dailyCount":10,"packPrice":50000,"sticksPerPack":20,"baselineCount":15}'
    );

    let client = null;
    let user = null;

    let categoryChart;
    let trendChart;

    const cfg = window.APP_CONFIG || {};

    if (
        cfg.SUPABASE_URL &&
        cfg.SUPABASE_ANON_KEY &&
        window.supabase
    ) {
        client = window.supabase.createClient(
            cfg.SUPABASE_URL,
            cfg.SUPABASE_ANON_KEY
        );

        $('setupNotice').classList.add('hidden');

        client.auth.getSession().then(({ data }) => {
            user = data.session?.user || null;
            authUI();

            if (user) syncLoad();
        });

        client.auth.onAuthStateChange((_event, session) => {
            user = session?.user || null;
            authUI();

            if (user) syncLoad();
        });
    }

    function authUI() {
        $('logoutBtn').classList.toggle('hidden', !user);
        $('loginBtn').classList.toggle('hidden', !!user);
        $('signupBtn').classList.toggle('hidden', !!user);

        $('syncStatus').textContent = user
            ? 'حساب کاربری متصل است؛ اطلاعات با فضای ابری همگام می‌شود.'
            : 'اطلاعات فعلاً روی همین دستگاه ذخیره می‌شود.';
    }

    function persist() {
        localStorage.setItem(
            'hesabyar_expenses',
            JSON.stringify(expenses)
        );

        localStorage.setItem(
            'hesabyar_budget',
            String(budget)
        );

        render();

        if (user) syncSave();
    }

    function weekStart() {
        const d = new Date();

        const day = (d.getDay() + 6) % 7;

        d.setDate(d.getDate() - day);
        d.setHours(0, 0, 0, 0);

        return d;
    }

    function weekItems() {
        const start = weekStart();

        return expenses.filter(e =>
            new Date(e.date + 'T00:00:00') >= start
        );
    }

    function render() {
        $('budget').value = budget || '';

        const weekly = weekItems();

        const spent = weekly.reduce(
            (s, e) => s + e.amount, 0
        );

        $('weekSpent').textContent = fmt(spent);

        $('remaining').textContent = fmt(
            Math.max(0, budget - spent)
        );

        const cig = weekly
            .filter(e => e.category === 'سیگار')
            .reduce((s, e) => s + e.amount, 0);

        $('cigaretteCost').textContent = fmt(cig);

        const daily =
            smoking.packPrice /
            smoking.sticksPerPack *
            smoking.dailyCount;

        const saving = Math.max(
            0,
            (smoking.baselineCount - smoking.dailyCount) *
            smoking.packPrice /
            smoking.sticksPerPack
        );

        $('saved').textContent = fmt(saving * 7);

        $('dailyCost').textContent = fmt(daily);
        $('dailySaving').textContent = fmt(saving);
        $('monthlySaving').textContent = fmt(saving * 30);

        $('dailyCount').value = smoking.dailyCount;
        $('packPrice').value = smoking.packPrice;
        $('sticksPerPack').value = smoking.sticksPerPack;
        $('baselineCount').value = smoking.baselineCount;

        $('expenseRows').innerHTML =
            expenses
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(e => `
                    <tr>
                        <td>${e.date}</td>
                        <td>${escapeHTML(e.title)}</td>
                        <td>${e.category}</td>
                        <td>${fmt(e.amount)}</td>
                        <td>
                            <button class="delete" data-id="${e.id}">
                                حذف
                            </button>
                        </td>
                    </tr>
                `)
                .join('') ||
            '<tr><td colspan="5">هنوز هزینه‌ای ثبت نشده است.</td></tr>';

        document.querySelectorAll('[data-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                expenses = expenses.filter(
                    e => e.id !== btn.dataset.id
                );

                persist();
            });
        });

        charts();
    }

    function escapeHTML(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[c]));
    }

    function charts() {
        if (!window.Chart) return;

        const cats = {};

        weekItems().forEach(e => {
            cats[e.category] =
                (cats[e.category] || 0) + e.amount;
        });

        if (categoryChart) categoryChart.destroy();

        categoryChart = new Chart(
            $('categoryChart'),
            {
                type: 'doughnut',

                data: {
                    labels: Object.keys(cats),

                    datasets: [{
                        data: Object.values(cats)
                    }]
                },

                options: {
                    responsive: true,

                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            }
        );

        const days = {};

        weekItems().forEach(e => {
            days[e.date] =
                (days[e.date] || 0) + e.amount;
        });

        const labels = Object.keys(days).sort();

        if (trendChart) trendChart.destroy();

        trendChart = new Chart(
            $('trendChart'),
            {
                type: 'bar',

                data: {
                    labels,

                    datasets: [{
                        label: 'هزینه (تومان)',
                        data: labels.map(k => days[k])
                    }]
                },

                options: {
                    responsive: true,

                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            }
        );
    }

    $('saveBudget').onclick = () => {
        budget = Math.max(
            0,
            Number($('budget').value) || 0
        );

        persist();
    };

    $('addExpense').onclick = () => {
        const title = $('expenseTitle').value.trim();
        const amount = Number($('expenseAmount').value);
        const date = $('expenseDate').value;

        if (!title || amount <= 0 || !date) {
            alert('عنوان، مبلغ معتبر و تاریخ را وارد کن.');
            return;
        }

        expenses.push({
            id: crypto.randomUUID(),
            title,
            amount,
            category: $('expenseCategory').value,
            date
        });

        $('expenseTitle').value = '';
        $('expenseAmount').value = '';

        persist();
    };

    $('saveSmoking').onclick = () => {
        smoking = {
            dailyCount: Math.max(
                0, Number($('dailyCount').value) || 0
            ),

            packPrice: Math.max(
                0, Number($('packPrice').value) || 0
            ),

            sticksPerPack: Math.max(
                1, Number($('sticksPerPack').value) || 20
            ),

            baselineCount: Math.max(
                0, Number($('baselineCount').value) || 0
            )
        };

        localStorage.setItem(
            'hesabyar_smoking',
            JSON.stringify(smoking)
        );

        render();
    };

    $('signupBtn').onclick = async () => {
        if (!client) {
            alert('ابتدا Supabase را در config.js تنظیم کن.');
            return;
        }

        const { error } = await client.auth.signUp({
            email: $('email').value,
            password: $('password').value
        });

        if (error) alert(error.message);
        else alert('ثبت‌نام انجام شد.');
    };

    $('loginBtn').onclick = async () => {
        if (!client) {
            alert('ابتدا Supabase را در config.js تنظیم کن.');
            return;
        }

        const { error } = await client.auth.signInWithPassword({
            email: $('email').value,
            password: $('password').value
        });

        if (error) alert(error.message);
    };

    $('logoutBtn').onclick = () => client?.auth.signOut();

    async function syncLoad() {
        const { data, error } = await client
            .from('user_data')
            .select('payload')
            .eq('user_id', user.id)
            .maybeSingle();

        if (error) {
            $('syncStatus').textContent =
                'خطا در دریافت اطلاعات ابری.';
            return;
        }

        if (data?.payload) {
            expenses = data.payload.expenses || [];
            budget = data.payload.budget || 0;
            smoking = data.payload.smoking || smoking;

            localStorage.setItem(
                'hesabyar_expenses',
                JSON.stringify(expenses)
            );

            localStorage.setItem(
                'hesabyar_budget',
                String(budget)
            );

            localStorage.setItem(
                'hesabyar_smoking',
                JSON.stringify(smoking)
            );

            render();
        }
    }

    async function syncSave() {
        const payload = {
            expenses,
            budget,
            smoking
        };

        const { error } = await client
            .from('user_data')
            .upsert({
                user_id: user.id,
                payload,
                updated_at: new Date().toISOString()
            }, {
                onConflict: 'user_id'
            });

        $('syncStatus').textContent = error
            ? 'ذخیره ابری ناموفق بود.'
            : 'اطلاعات روی دستگاه و فضای ابری ذخیره شد.';
    }

    $('exportBtn').onclick = () => {
        const rows = [
            ['date', 'title', 'category', 'amount'],

            ...expenses.map(e => [
                e.date,
                e.title,
                e.category,
                e.amount
            ])
        ];

        const csv = '\uFEFF' + rows
            .map(r =>
                r.map(v =>
                    '"' + String(v).replace(/"/g, '""') + '"'
                ).join(',')
            )
            .join('\n');

        const a = document.createElement('a');

        a.href = URL.createObjectURL(
            new Blob([csv], {
                type: 'text/csv;charset=utf-8'
            })
        );

        a.download = 'hesabyar-expenses.csv';
        a.click();

        URL.revokeObjectURL(a.href);
    };

    render();

})();
