# Coin Guard — Personal Finance Dashboard

Coin Guard is a personal finance dashboard that helps you track income and expenses,
follow monthly KPIs and see where your money goes.

**Live demo:** https://alaa-hdaya.github.io/CoinGuard/

![Coin Guard dashboard](screenshots/dashboard.png)

## Features
- **Add income and expenses** with title, amount, category and date
- **KPIs:** total balance, income and expenses this month, net this month, savings rate
- **Charts:** spending by category (doughnut) and income vs expenses over the last 6 months (bar)
- **Transactions:** recent activity, full list with type filter and search, delete one or all
- **Saved in the browser** with `localStorage`, so data stays after a refresh
- **Demo data** for the last 6 months, so the dashboard is never empty on first visit
- **Responsive** on desktop and mobile

## KPI definitions
| KPI | Formula |
|---|---|
| Total balance | all income − all expenses |
| Income / Expenses this month | sum of transactions dated in the current month |
| Net this month | income this month − expenses this month |
| Savings rate | net this month ÷ income this month |

## Tech stack
HTML5 · CSS3 · JavaScript (vanilla) · [Chart.js](https://www.chartjs.org/) 4.4.1 (included in `vendor/`, MIT license) · localStorage

## Project structure
```
CoinGuard/
├── index.html          landing page
├── style.css
├── dashboard/
│   ├── index.html      the dashboard
│   ├── dashboard.css
│   └── dashboard.js    data, KPIs, charts, transactions
├── vendor/chart.umd.js
└── screenshots/
```

## Run it
Open `index.html` in a browser, or use the **Live Server** extension in VS Code.
No installation needed.

## What I learned
- Structuring transaction data and computing KPIs from it
- Building charts that answer a question ("where does my money go?")
- DOM manipulation, form validation and saving data in the browser

## Author
**Alaa Hdaya**, Business Intelligence & Data Analytics student
[LinkedIn](https://www.linkedin.com/in/alaa-hdaya-29354633b/) · [GitHub](https://github.com/alaa-hdaya)
