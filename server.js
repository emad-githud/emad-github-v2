const express = require("express");
const session = require("express-session");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "12345678";

const RECOVERY_CONTACT =
    process.env.RECOVERY_CONTACT || "با ادمین تماس بگیرید";

// ======================================================
// APP
// ======================================================

app.disable("x-powered-by");

app.use(express.json({
    limit: "512kb"
}));

app.use(express.urlencoded({
    extended: false,
    limit: "512kb"
}));

app.use(session({
    secret:
        process.env.SESSION_SECRET ||
        "emadnet-change-this-secret",

    resave: false,

    saveUninitialized: false,

    cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
}));

// ======================================================
// DATA
// ======================================================

const users = new Map();
const recoveryRequests = [];
const orders = [];

const plans = [
    {
        id: 1,
        name: "Starter",
        gb: 50,
        days: 30,
        price: 120000
    },
    {
        id: 2,
        name: "Pro",
        gb: 150,
        days: 90,
        price: 300000
    },
    {
        id: 3,
        name: "Max",
        gb: 400,
        days: 180,
        price: 520000
    }
];

// ======================================================
// HELPERS
// ======================================================

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");

    const hash = crypto.scryptSync(
        password,
        salt,
        64
    ).toString("hex");

    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored) {
        return false;
    }

    const parts = stored.split(":");

    if (parts.length !== 2) {
        return false;
    }

    const salt = parts[0];
    const original = parts[1];

    const hash = crypto.scryptSync(
        password,
        salt,
        64
    ).toString("hex");

    return crypto.timingSafeEqual(
        Buffer.from(hash, "hex"),
        Buffer.from(original, "hex")
    );
}

function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({
            error: "ابتدا وارد حساب خود شوید."
        });
    }

    next();
}

function requireAdmin(req, res, next) {
    if (
        !req.session.user ||
        req.session.user.role !== "admin"
    ) {
        return res.status(403).json({
            error: "دسترسی ادمین ندارید."
        });
    }

    next();
}

function safeUser(user) {
    return {
        id: user.id,
        username: user.username,
        role: user.role
    };
}

// ======================================================
// ADMIN
// ======================================================

if (!users.has(ADMIN_USER)) {
    users.set(ADMIN_USER, {
        id: "admin",
        username: ADMIN_USER,
        password: hashPassword(ADMIN_PASSWORD),
        role: "admin",
        createdAt: new Date().toISOString()
    });
}

// ======================================================
// AUTH - REGISTER
// ======================================================

app.post("/api/register", (req, res) => {
    const username = String(req.body.username || "")
        .trim()
        .toLowerCase();

    const password = String(req.body.password || "");

    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(username)) {
        return res.status(400).json({
            error: "نام کاربری باید ۳ تا ۳۲ کاراکتر باشد."
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            error: "رمز عبور حداقل باید ۶ کاراکتر باشد."
        });
    }

    if (users.has(username)) {
        return res.status(409).json({
            error: "این نام کاربری قبلاً ثبت شده است."
        });
    }

    const user = {
        id: crypto.randomUUID(),
        username,
        password: hashPassword(password),
        role: "customer",
        createdAt: new Date().toISOString()
    };

    users.set(username, user);

    req.session.user = safeUser(user);

    res.json({
        ok: true,
        user: safeUser(user)
    });
});

// ======================================================
// AUTH - LOGIN
// ======================================================

app.post("/api/login", (req, res) => {
    const username = String(req.body.username || "")
        .trim()
        .toLowerCase();

    const password = String(req.body.password || "");

    const user = users.get(username);

    if (
        !user ||
        !verifyPassword(password, user.password)
    ) {
        return res.status(401).json({
            error: "نام کاربری یا رمز عبور اشتباه است."
        });
    }

    req.session.user = safeUser(user);

    res.json({
        ok: true,
        user: safeUser(user)
    });
});

// ======================================================
// LOGOUT
// ======================================================

app.post("/api/logout", (req, res) => {
    req.session.destroy(() => {
        res.json({
            ok: true
        });
    });
});

// ======================================================
// CURRENT USER
// ======================================================

app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({
            loggedIn: false
        });
    }

    res.json({
        loggedIn: true,
        user: req.session.user
    });
});

// ======================================================
// RECOVERY
// ======================================================

app.post("/api/recovery", (req, res) => {
    const username = String(req.body.username || "")
        .trim()
        .toLowerCase();

    if (!username) {
        return res.status(400).json({
            error: "نام کاربری را وارد کنید."
        });
    }

    recoveryRequests.push({
        id: crypto.randomUUID(),
        username,
        status: "pending",
        createdAt: new Date().toISOString()
    });

    res.json({
        ok: true,
        message: "درخواست بازیابی برای ادمین ارسال شد.",
        contact: RECOVERY_CONTACT
    });
});

// ======================================================
// PLANS
// ======================================================

app.get("/api/plans", (req, res) => {
    res.json(plans);
});

// ======================================================
// ORDERS
// ======================================================

app.post(
    "/api/orders",
    requireLogin,
    (req, res) => {

        const planId = Number(req.body.planId);

        const plan = plans.find(
            item => item.id === planId
        );

        if (!plan) {
            return res.status(404).json({
                error: "این پلن پیدا نشد."
            });
        }

        const order = {
            id: crypto.randomUUID(),
            userId: req.session.user.id,
            username: req.session.user.username,
            planId: plan.id,
            planName: plan.name,
            price: plan.price,
            status: "pending",
            createdAt: new Date().toISOString()
        };

        orders.push(order);

        res.json({
            ok: true,
            order
        });
    }
);

// ======================================================
// CUSTOMER DASHBOARD
// ======================================================

app.get(
    "/api/dashboard",
    requireLogin,
    (req, res) => {

        const myOrders = orders.filter(
            order =>
                order.userId === req.session.user.id
        );

        res.json({
            user: req.session.user,
            orders: myOrders
        });
    }
);

// ======================================================
// ADMIN SUMMARY
// ======================================================

app.get(
    "/api/admin/summary",
    requireAdmin,
    (req, res) => {

        res.json({

            users:
                [...users.values()]
                    .filter(
                        u => u.role === "customer"
                    ).length,

            orders:
                orders.length,

            recovery:
                recoveryRequests.filter(
                    r => r.status === "pending"
                ).length
        });
    }
);

// ======================================================
// ADMIN USERS
// ======================================================

app.get(
    "/api/admin/users",
    requireAdmin,
    (req, res) => {

        const result =
            [...users.values()]
                .filter(
                    u => u.role === "customer"
                )
                .map(safeUser);

        res.json(result);
    }
);

// ======================================================
// ADMIN ORDERS
// ======================================================

app.get(
    "/api/admin/orders",
    requireAdmin,
    (req, res) => {

        res.json(orders);
    }
);

// ======================================================
// ADMIN RECOVERY
// ======================================================

app.get(
    "/api/admin/recovery",
    requireAdmin,
    (req, res) => {

        res.json(recoveryRequests);
    }
);

// ======================================================
// ADMIN RESET PASSWORD
// ======================================================

app.post(
    "/api/admin/reset-password",
    requireAdmin,
    (req, res) => {

        const username =
            String(req.body.username || "")
                .trim()
                .toLowerCase();

        const newPassword =
            String(req.body.newPassword || "");

        const user =
            users.get(username);

        if (!user) {
            return res.status(404).json({
                error: "کاربر پیدا نشد."
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                error: "رمز جدید حداقل ۶ کاراکتر باشد."
            });
        }

        user.password =
            hashPassword(newPassword);

        const request =
            recoveryRequests.find(
                r =>
                    r.username === username &&
                    r.status === "pending"
            );

        if (request) {
            request.status = "completed";
        }

        res.json({
            ok: true,
            message: "رمز کاربر با موفقیت تغییر کرد."
        });
    }
);

// ======================================================
// HOME PAGE
// ======================================================

app.get("/", (req, res) => {

    res.send(`
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>EmadNet</title>

<style>

* {
box-sizing:border-box;
}

body {

margin:0;

font-family:
Tahoma,
Arial,
sans-serif;

background:
radial-gradient(
circle at top,
#17396b,
#070c16 60%
);

color:white;

min-height:100vh;

}

header {

height:75px;

display:flex;

align-items:center;

justify-content:space-between;

padding:
0 7%;

border-bottom:
1px solid rgba(255,255,255,.08);

background:
rgba(5,10,20,.7);

backdrop-filter:
blur(10px);

}

.logo {

font-size:25px;

font-weight:bold;

}

nav {

display:flex;

gap:10px;

}

nav button {

background:
transparent;

border:
1px solid #2d4367;

color:white;

padding:
10px 17px;

border-radius:
10px;

cursor:pointer;

}

.hero {

max-width:1100px;

margin:auto;

padding:
80px 20px 40px;

text-align:center;

}

.hero h1 {

font-size:
clamp(35px,6vw,65px);

margin:0;

}

.hero p {

color:#a9b6ca;

font-size:18px;

line-height:2;

}

.primary {

border:0;

background:
linear-gradient(
135deg,
#367dff,
#754dff
);

color:white;

padding:
14px 28px;

border-radius:12px;

cursor:pointer;

font-weight:bold;

font-size:16px;

}

.section {

max-width:1100px;

margin:auto;

padding:
30px 20px 80px;

}

.section h2 {

text-align:center;

margin-bottom:30px;

}

.plans {

display:grid;

grid-template-columns:
repeat(
auto-fit,
minmax(230px,1fr)
);

gap:20px;

}

.plan {

background:
rgba(14,24,43,.95);

border:
1px solid #273d60;

border-radius:20px;

padding:25px;

transition:
transform .2s,
border .2s;

}

.plan:hover {

transform:
translateY(-5px);

border-color:
#4e7dce;

}

.plan h3 {

font-size:23px;

margin-top:0;

}

.info {

color:#aebbd0;

line-height:2;

}

.price {

font-size:25px;

font-weight:bold;

margin:
20px 0;

}

.buy {

width:100%;

padding:13px;

border:0;

border-radius:10px;

background:
linear-gradient(
135deg,
#3478ff,
#704cff
);

color:white;

cursor:pointer;

font-weight:bold;

}

.modal {

position:fixed;

inset:0;

background:
rgba(0,0,0,.7);

display:none;

align-items:center;

justify-content:center;

padding:20px;

z-index:20;

}

.modal.show {

display:flex;

}

.box {

width:100%;

max-width:420px;

background:#101a2c;

border:
1px solid #2c4366;

border-radius:20px;

padding:25px;

}

.box h2 {

margin-top:0;

}

input {

width:100%;

padding:14px;

margin:
7px 0;

background:#080f1d;

border:
1px solid #2b4165;

border-radius:10px;

color:white;

outline:none;

}

.action {

width:100%;

padding:13px;

margin-top:10px;

border:0;

border-radius:10px;

background:
linear-gradient(
135deg,
#3478ff,
#704cff
);

color:white;

font-weight:bold;

cursor:pointer;

}

.link {

display:block;

text-align:center;

margin-top:15px;

color:#75a5ff;

cursor:pointer;

}

.close {

float:left;

cursor:pointer;

color:#aab6ca;

}

.message {

margin-top:12px;

padding:10px;

border-radius:8px;

display:none;

}

.success {

display:block;

background:#103321;

color:#6fe0a1;

}

.error {

display:block;

background:#35151a;

color:#ff8d99;

}

</style>

</head>

<body>

<header>

<div class="logo">
⚡ EmadNet
</div>

<nav>

<button onclick="openLogin()">
ورود
</button>

<button onclick="openRegister()">
ساخت حساب
</button>

</nav>

</header>

<section class="hero">

<h1>
EmadNet
</h1>

<p>
سرویس VPN خودت را انتخاب کن
</p>

<button
class="primary"
onclick="scrollToShop()"
>
مشاهده پلن‌ها
</button>

</section>

<section
class="section"
id="shop"
>

<h2>
پلن‌های VPN
</h2>

<div
class="plans"
id="plans"
>

</div>

</section>

<div
class="modal"
id="loginModal"
>

<div class="box">

<span
class="close"
onclick="closeModals()"
>
✕
</span>

<h2>
ورود به EmadNet
</h2>

<input
id="loginUser"
placeholder="نام کاربری"
>

<input
id="loginPass"
type="password"
placeholder="رمز عبور"
>

<button
class="action"
onclick="login()"
>
ورود به حساب
</button>

<div
class="link"
onclick="openRegister()"
>
ساخت حساب جدید
</div>

<div
class="link"
onclick="openRecovery()"
>
رمز عبورم را فراموش کردم
</div>

<div
id="loginMsg"
class="message"
></div>

</div>

</div>

<div
class="modal"
id="registerModal"
>

<div class="box">

<span
class="close"
onclick="closeModals()"
>
✕
</span>

<h2>
ساخت حساب
</h2>

<input
id="registerUser"
placeholder="نام کاربری"
>

<input
id="registerPass"
type="password"
placeholder="رمز عبور"
>

<input
id="registerPass2"
type="password"
placeholder="تکرار رمز عبور"
>

<button
class="action"
onclick="register()"
>
ساخت حساب
</button>

<div
class="link"
onclick="openLogin()"
>
قبلاً حساب دارم
</div>

<div
id="registerMsg"
class="message"
></div>

</div>

</div>

<div
class="modal"
id="recoveryModal"
>

<div class="box">

<span
class="close"
onclick="closeModals()"
>
✕
</span>

<h2>
بازیابی حساب
</h2>

<p class="info">
نام کاربری خود را وارد کنید.
درخواست برای ادمین ارسال می‌شود
و ادمین می‌تواند رمز شما را ریست کند.
</p>

<input
id="recoveryUser"
placeholder="نام کاربری"
>

<button
class="action"
onclick="recovery()"
>
ارسال درخواست
</button>

<div
id="recoveryMsg"
class="message"
></div>

</div>

</div>

<script>

let selectedPlan = null;

async function loadPlans() {

    try {

        const response =
            await fetch("/api/plans");

        const plans =
            await response.json();

        const container =
            document.getElementById("plans");

        container.innerHTML = "";

        plans.forEach(function(plan) {

            const card =
                document.createElement("div");

            card.className = "plan";

            card.innerHTML =
                "<h3>" +
                    escapeHtml(plan.name) +
                "</h3>" +

                '<div class="info">' +

                    "حجم: " +
                    escapeHtml(String(plan.gb)) +
                    "GB<br>" +

                    "مدت: " +
                    escapeHtml(String(plan.days)) +
                    " روز" +

                "</div>" +

                '<div class="price">' +

                    Number(plan.price).toLocaleString() +
                    " تومان" +

                "</div>" +

                '<button class="buy" onclick="buy(' +
                    Number(plan.id) +
                ')">' +

                    "خرید این پلن" +

                "</button>";

            container.appendChild(card);

        });

    } catch (error) {

        console.error(error);

        document.getElementById("plans").textContent =
            "خطا در دریافت پلن‌ها.";

    }

}

async function buy(planId) {

    selectedPlan = planId;

    try {

        const me =
            await fetch("/api/me");

        if (!me.ok) {

            openLogin();

            return;

        }

        const data =
            await me.json();

        if (!data.loggedIn) {

            openLogin();

            return;

        }

        createOrder(planId);

    } catch (error) {

        alert(
            "خطا در بررسی حساب کاربری."
        );

    }

}

async function createOrder(planId) {

    try {

        const response =
            await fetch(
                "/api/orders",
                {

                    method:"POST",

                    headers:{
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            planId: planId
                        })

                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            alert(
                data.error ||
                "خطا در ثبت سفارش"
            );

            return;

        }

        alert(
            "سفارش با موفقیت ثبت شد. شماره سفارش: " +
            data.order.id
        );

    } catch (error) {

        alert(
            "خطا در ارتباط با سرور."
        );

    }

}

async function login() {

    const username =
        document.getElementById(
            "loginUser"
        ).value.trim();

    const password =
        document.getElementById(
            "loginPass"
        ).value;

    const response =
        await fetch(
            "/api/login",
            {

                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        username: username,
                        password: password
                    })

            }
        );

    const data =
        await response.json();

    const msg =
        document.getElementById(
            "loginMsg"
        );

    if (!response.ok) {

        showMessage(
            msg,
            data.error,
            false
        );

        return;

    }

    showMessage(
        msg,
        "ورود موفق بود.",
        true
    );

    setTimeout(function() {

        closeModals();

        if (
            data.user.role ===
            "admin"
        ) {

            window.location =
                "/admin";

        } else {

            window.location =
                "/account";

        }

    }, 500);

}

async function register() {

    const username =
        document.getElementById(
            "registerUser"
        ).value.trim();

    const password =
        document.getElementById(
            "registerPass"
        ).value;

    const password2 =
        document.getElementById(
            "registerPass2"
        ).value;

    const msg =
        document.getElementById(
            "registerMsg"
        );

    if (password !== password2) {

        showMessage(
            msg,
            "رمزهای عبور یکسان نیستند.",
            false
        );

        return;

    }

    const response =
        await fetch(
            "/api/register",
            {

                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        username: username,
                        password: password
                    })

            }
        );

    const data =
        await response.json();

    if (!response.ok) {

        showMessage(
            msg,
            data.error,
            false
        );

        return;

    }

    showMessage(
        msg,
        "حساب با موفقیت ساخته شد.",
        true
    );

    setTimeout(function() {

        closeModals();

        window.location =
            "/account";

    }, 500);

}

async function recovery() {

    const username =
        document.getElementById(
            "recoveryUser"
        ).value.trim();

    const msg =
        document.getElementById(
            "recoveryMsg"
        );

    const response =
        await fetch(
            "/api/recovery",
            {

                method:"POST",

                headers:{
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify({
                        username: username
                    })

            }
        );

    const data =
        await response.json();

    if (!response.ok) {

        showMessage(
            msg,
            data.error,
            false
        );

        return;

    }

    showMessage(
        msg,
        data.message +
        " " +
        data.contact,
        true
    );

}

function escapeHtml(value) {

    return String(value)

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}

function showMessage(
    element,
    text,
    success
) {

    element.textContent =
        text;

    element.className =
        "message " +
        (
            success
                ? "success"
                : "error"
        );

}

function openLogin() {

    closeModals();

    document
        .getElementById(
            "loginModal"
        )
        .classList.add("show");

}

function openRegister() {

    closeModals();

    document
        .getElementById(
            "registerModal"
        )
        .classList.add("show");

}

function openRecovery() {

    closeModals();

    document
        .getElementById(
            "recoveryModal"
        )
        .classList.add("show");

}

function closeModals() {

    document
        .querySelectorAll(".modal")
        .forEach(function(modal) {

            modal.classList.remove(
                "show"
            );

        });

}

function scrollToShop() {

    document
        .getElementById("shop")
        .scrollIntoView({
            behavior:"smooth"
        });

}

loadPlans();

</script>

</body>

</html>
`);

});

// ======================================================
// ACCOUNT PAGE
// ======================================================

app.get(
    "/account",
    requireLogin,
    (req, res) => {

        res.send(`
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>
حساب من | EmadNet
</title>

<style>

body {

margin:0;

background:#080d18;

color:white;

font-family:
Tahoma,
Arial,
sans-serif;

padding:25px;

}

.container {

max-width:900px;

margin:auto;

}

.card {

background:#101a2d;

border:
1px solid #263d60;

border-radius:18px;

padding:25px;

margin-bottom:20px;

}

button {

padding:12px 20px;

border:0;

border-radius:10px;

background:#3478ff;

color:white;

cursor:pointer;

}

.order {

padding:15px;

background:#0a1323;

border-radius:12px;

margin-top:10px;

}

</style>

</head>

<body>

<div class="container">

<div class="card">

<h1>
⚡ حساب EmadNet
</h1>

<div id="user"></div>

<br>

<button onclick="logout()">
خروج
</button>

</div>

<div class="card">

<h2>
سفارش‌های من
</h2>

<div id="orders">
در حال بارگذاری...
</div>

</div>

</div>

<script>

function escapeHtml(value) {

return String(value)

.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}

async function load() {

const response =
await fetch("/api/dashboard");

if (!response.ok) {

location.href="/";

return;

}

const data =
await response.json();

document.getElementById(
"user"
).textContent =
"نام کاربری: " +
data.user.username;

const container =
document.getElementById(
"orders"
);

if (!data.orders.length) {

container.textContent =
"هنوز سفارشی ندارید.";

return;

}

container.innerHTML =
data.orders.map(function(order) {

return (

'<div class="order">' +

"<b>" +
escapeHtml(order.planName) +
"</b>" +

"<br>" +

"مبلغ: " +
Number(order.price).toLocaleString() +
" تومان" +

"<br>" +

"وضعیت: " +
escapeHtml(order.status) +

"</div>"

);

}).join("");

}

async function logout() {

await fetch(
"/api/logout",
{
method:"POST"
}
);

location.href="/";

}

load();

</script>

</body>

</html>
`);

    }
);

// ======================================================
// ADMIN PAGE
// ======================================================

app.get(
    "/admin",
    requireAdmin,
    (req, res) => {

        res.send(`
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta
name="viewport"
content="width=device-width,initial-scale=1"
>

<title>
Admin | EmadNet
</title>

<style>

body {

margin:0;

background:#080d18;

color:white;

font-family:
Tahoma,
Arial,
sans-serif;

padding:25px;

}

.container {

max-width:1000px;

margin:auto;

}

.grid {

display:grid;

grid-template-columns:
repeat(
auto-fit,
minmax(180px,1fr)
);

gap:15px;

}

.card {

background:#101a2d;

border:
1px solid #263d60;

border-radius:18px;

padding:22px;

margin-bottom:20px;

}

.number {

font-size:32px;

font-weight:bold;

color:#70a3ff;

}

button {

padding:12px 18px;

border:0;

border-radius:10px;

background:#3478ff;

color:white;

cursor:pointer;

}

input {

padding:12px;

background:#080f1d;

border:
1px solid #2c4365;

border-radius:8px;

color:white;

margin:5px;

}

.item {

padding:12px 0;

border-bottom:
1px solid #263d60;

}

</style>

</head>

<body>

<div class="container">

<h1>
⚡ پنل مدیریت EmadNet
</h1>

<div class="grid">

<div class="card">

کاربران

<div
class="number"
id="users"
>
-
</div>

</div>

<div class="card">

سفارش‌ها

<div
class="number"
id="orders"
>
-
</div>

</div>

<div class="card">

درخواست بازیابی

<div
class="number"
id="recovery"
>
-
</div>

</div>

</div>

<div class="card">

<h2>
درخواست‌های بازیابی
</h2>

<div id="recoveryList">
در حال بارگذاری...
</div>

</div>

<div class="card">

<h2>
ریست رمز کاربر
</h2>

<input
id="resetUser"
placeholder="نام کاربری"
>

<input
id="resetPass"
type="password"
placeholder="رمز جدید"
>

<button
onclick="resetPassword()"
>
تغییر رمز
</button>

</div>

<div class="card">

<h2>
سفارش‌ها
</h2>

<div id="ordersList">
در حال بارگذاری...
</div>

</div>

<button onclick="logout()">
خروج از پنل
</button>

</div>

<script>

function escapeHtml(value) {

return String(value)

.replace(/&/g,"&amp;")
.replace(/</g,"&lt;")
.replace(/>/g,"&gt;")
.replace(/"/g,"&quot;")
.replace(/'/g,"&#039;");

}

async function loadAdmin() {

try {

const summary =
await fetch(
"/api/admin/summary"
);

if (!summary.ok) {

location.href="/";

return;

}

const s =
await summary.json();

document.getElementById(
"users"
).textContent =
s.users;

document.getElementById(
"orders"
).textContent =
s.orders;

document.getElementById(
"recovery"
).textContent =
s.recovery;

const recovery =
await fetch(
"/api/admin/recovery"
);

const recoveryData =
await recovery.json();

document.getElementById(
"recoveryList"
).innerHTML =

recoveryData.length

?

recoveryData.map(function(item) {

return (

'<div class="item">' +

"👤 " +
escapeHtml(item.username) +

"<br>" +

"وضعیت: " +
escapeHtml(item.status) +

"<br>" +

"زمان: " +
escapeHtml(item.createdAt) +

"</div>"

);

}).join("")

:

"درخواستی وجود ندارد.";

const orders =
await fetch(
"/api/admin/orders"
);

const ordersData =
await orders.json();

document.getElementById(
"ordersList"
).innerHTML =

ordersData.length

?

ordersData.map(function(order) {

return (

'<div class="item">' +

escapeHtml(order.username) +

" - " +

escapeHtml(order.planName) +

"<br>" +

Number(order.price).toLocaleString() +

" تومان" +

"<br>" +

"وضعیت: " +

escapeHtml(order.status) +

"</div>"

);

}).join("")

:

"هنوز سفارشی وجود ندارد.";

} catch (error) {

console.error(error);

alert(
"خطا در دریافت اطلاعات پنل مدیریت."
);

}

}

async function resetPassword() {

const username =
document.getElementById(
"resetUser"
).value.trim();

const newPassword =
document.getElementById(
"resetPass"
).value;

const response =
await fetch(
"/api/admin/reset-password",
{

method:"POST",

headers:{
"Content-Type":
"application/json"
},

body:
JSON.stringify({
username:username,
newPassword:newPassword
})

}
);

const data =
await response.json();

alert(
data.message ||
data.error ||
"عملیات انجام شد."
);

if (response.ok) {

document.getElementById(
"resetPass"
).value = "";

}

loadAdmin();

}

async function logout() {

await fetch(
"/api/logout",
{
method:"POST"
}
);

location.href="/";

}

loadAdmin();

</script>

</body>

</html>
`);

    }
);

// ======================================================
// HEALTH
// ======================================================

app.get(
    "/health",
    (req, res) => {

        res.status(200).json({

            status:"ok",

            app:"EmadNet",

            version:"2.0",

            cpu:"2 Core",

            ram:"1GB",

            uptime:
                Math.floor(
                    process.uptime()
                )

        });

    }
);

// ======================================================
// 404
// ======================================================

app.use(
    (req, res) => {

        res.status(404).json({
            error:"صفحه پیدا نشد"
        });

    }
);

// ======================================================
// ERROR HANDLER
// ======================================================

app.use(
    (err, req, res, next) => {

        console.error(err);

        res.status(500).json({
            error:
                "خطای داخلی سرور"
        });

    }
);

// ======================================================
// START
// ======================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `EmadNet started on port ${PORT}`
        );

    }
);
