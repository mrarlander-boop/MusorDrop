const express = require('express');
const session = require('express-session');
const path = require('path');
const db = require('./db');
const { setUserLocals } = require('./middleware/auth');

// Инициализация роутов
const authRoutes = require('./routes/auth');
const marketplaceRoutes = require('./routes/marketplace');
const blogRoutes = require('./routes/blog');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка шаблонизатора EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Парсинг тела запросов
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Раздача статических файлов
app.use(express.static(path.join(__dirname, 'public')));

// Настройка сессий
app.use(session({
  secret: 'minecraft-skin-hub-super-secret-key-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7 // 7 дней
  }
}));

// Передача пользователя и сообщений во все шаблоны
app.use(setUserLocals(db));

// Подключение роутов
app.use('/', authRoutes);
app.use('/', marketplaceRoutes);
app.use('/blog', blogRoutes);
app.use('/', userRoutes);
app.use('/admin', adminRoutes);

// Обработка 404
app.use((req, res) => {
  res.status(404).render('partials/header', { title: '404 - Страница не найдена' });
  res.send(`
    <div style="text-align:center; padding:100px 20px; color:#fff; font-family:sans-serif; background:#0d1117; min-height:100vh;">
      <h1 style="font-size:72px; color:#22c55e; margin-bottom:10px;">404</h1>
      <h2 style="margin-bottom:20px;">Блок не найден!</h2>
      <p style="color:#8b949e; margin-bottom:30px;">Кажется, крипер взорвал эту страницу или путь ведёт в лаву.</p>
      <a href="/" style="background:#22c55e; color:#0d1117; padding:12px 28px; text-decoration:none; font-weight:bold; border-radius:6px;">Вернуться на главную</a>
    </div>
  `);
});

// Запуск сервера
app.listen(PORT, () => {
  console.log('====================================================');
  console.log('  ⛏ MINECRAFT SKINS MARKETPLACE & BLOG ЗАПУЩЕН!');
  console.log(`  🌐 Локальный адрес: http://localhost:${PORT}`);
  console.log('  👑 Логин администратора: admin | Пароль: admin');
  console.log('====================================================');
});
