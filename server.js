const express = require("express");

const app = express();

const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).send(`
<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">

<title>EmadNet</title>

<style>

* {
    box-sizing: border-box;
}

body {
    margin: 0;
    min-height: 100vh;
    font-family: Tahoma, Arial, sans-serif;

    background:
        radial-gradient(
            circle at top,
            #183b70,
            #080d18 55%
        );

    color: white;

    display: flex;
    align-items: center;
    justify-content: center;

    padding: 20px;
}

.container {
    width: 100%;
    max-width: 480px;
}

.card {

    background: rgba(13, 22, 40, 0.95);

    border: 1px solid #263d62;

    border-radius: 24px;

    padding: 35px;

    text-align: center;

    box-shadow:
        0 25px 80px rgba(0,0,0,.45);
}

.logo {

    width: 80px;
    height: 80px;

    margin: 0 auto 20px;

    border-radius: 22px;

    display: flex;
    align-items: center;
    justify-content: center;

    font-size: 35px;
    font-weight: bold;

    background:
        linear-gradient(
            135deg,
            #3478ff,
            #704cff
        );

    box-shadow:
        0 15px 40px rgba(60,110,255,.35);
}

h1 {
    margin: 0 0 10px;
    font-size: 32px;
}

p {
    color: #9eabc1;
    line-height: 1.8;
}

.buttons {
    display: flex;
    gap: 12px;
    margin-top: 30px;
}

a {

    flex: 1;

    padding: 14px;

    border-radius: 12px;

    text-decoration: none;

    font-weight: bold;
}

.primary {

    color: white;

    background:
        linear-gradient(
            135deg,
            #3478ff,
            #704cff
        );
}

.secondary {

    color: #dce7ff;

    border: 1px solid #2b4165;

    background: #0b1424;
}

.status {

    margin-top: 25px;

    padding: 12px;

    border-radius: 10px;

    background: #0b241a;

    border: 1px solid #1b633e;

    color: #68e6a2;

    font-size: 14px;
}

</style>
</head>

<body>

<div class="container">

<div class="card">

<div class="logo">
⚡
</div>

<h1>EmadNet</h1>

<p>
فروشگاه سرویس‌های VPN
</p>

<div class="status">
● سرور آنلاین است
</div>

<div class="buttons">

<a class="primary" href="/login">
ورود
</a>

<a class="secondary" href="/shop">
فروشگاه
</a>

</div>

</div>

</div>

</body>
</html>
  `);
});

app.get("/login", (req, res) => {

    res.status(200).send(`
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>ورود | EmadNet</title>

<style>

body {

margin:0;

min-height:100vh;

background:#080d18;

color:white;

font-family:Tahoma;

display:flex;

align-items:center;

justify-content:center;

padding:20px;

}

.box {

width:100%;

max-width:400px;

background:#101a2d;

border:1px solid #263c60;

border-radius:20px;

padding:30px;

}

h1 {

text-align:center;

}

input {

width:100%;

padding:14px;

margin:8px 0;

border-radius:10px;

border:1px solid #2b4165;

background:#080f1d;

color:white;

outline:none;

}

button {

width:100%;

padding:14px;

margin-top:15px;

border:0;

border-radius:10px;

background:linear-gradient(135deg,#3478ff,#704cff);

color:white;

font-weight:bold;

cursor:pointer;

}

</style>

</head>

<body>

<div class="box">

<h1>⚡ EmadNet</h1>

<p style="text-align:center;color:#8e9bb0">
ورود به حساب کاربری
</p>

<input
type="text"
placeholder="نام کاربری"
>

<input
type="password"
placeholder="رمز عبور"
>

<button>
ورود به سایت
</button>

</div>

</body>

</html>
`);
});

app.get("/shop", (req, res) => {

    res.status(200).send(`
<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1">

<title>فروشگاه EmadNet</title>

<style>

body {

margin:0;

background:#080d18;

color:white;

font-family:Tahoma;

padding:30px;

}

.container {

max-width:1000px;

margin:auto;

}

h1 {

text-align:center;

margin-bottom:40px;

}

.plans {

display:grid;

grid-template-columns:
repeat(auto-fit,minmax(230px,1fr));

gap:20px;

}

.plan {

background:#101a2d;

border:1px solid #263c60;

border-radius:18px;

padding:25px;

}

.plan h2 {

margin-top:0;

}

.price {

font-size:28px;

font-weight:bold;

margin:20px 0;

}

button {

width:100%;

padding:13px;

border:0;

border-radius:10px;

background:linear-gradient(
135deg,
#3478ff,
#704cff
);

color:white;

font-weight:bold;

}

</style>

</head>

<body>

<div class="container">

<h1>⚡ پلن‌های EmadNet</h1>

<div class="plans">

<div class="plan">

<h2>Starter</h2>

<p>50GB</p>

<p>30 روز</p>

<div class="price">
120,000 تومان
</div>

<button>
انتخاب پلن
</button>

</div>

<div class="plan">

<h2>Pro</h2>

<p>150GB</p>

<p>90 روز</p>

<div class="price">
300,000 تومان
</div>

<button>
انتخاب پلن
</button>

</div>

<div class="plan">

<h2>Max</h2>

<p>400GB</p>

<p>180 روز</p>

<div class="price">
520,000 تومان
</div>

<button>
انتخاب پلن
</button>

</div>

</div>

</div>

</body>

</html>
`);
});

app.get("/health", (req, res) => {

    res.status(200).json({
        status: "ok",
        service: "EmadNet",
        uptime: Math.floor(process.uptime())
    });

});

app.use((req, res) => {

    res.status(404).json({
        error: "صفحه پیدا نشد"
    });

});

process.on("uncaughtException", (error) => {

    console.error("Unexpected error:", error);

});

process.on("unhandledRejection", (error) => {

    console.error("Unhandled rejection:", error);

});

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        `EmadNet running on port ${PORT}`
    );

});