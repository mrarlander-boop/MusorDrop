const express = require('express');
const router = express.Router();
const db = require('../db');

// Страница входа
router.get('/login', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('login', { title: 'Вход в аккаунт' });
});

// Обработка входа
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    req.session.alert = { type: 'error', message: 'Пожалуйста, заполните все поля.' };
    return res.redirect('/login');
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());

  if (!user || user.password !== password) {
    req.session.alert = { type: 'error', message: 'Неверное имя пользователя или пароль.' };
    return res.redirect('/login');
  }

  // Записываем пользователя в сессию
  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    balance: user.balance
  };

  req.session.alert = { type: 'success', message: `С возвращением, ${user.username}!` };
  res.redirect('/');
});

// Страница регистрации
router.get('/register', (req, res) => {
  if (req.session.user) {
    return res.redirect('/');
  }
  res.render('register', { title: 'Регистрация' });
});

// Обработка регистрации
router.post('/register', (req, res) => {
  const { username, password, confirmPassword } = req.body;

  if (!username || !password) {
    req.session.alert = { type: 'error', message: 'Заполните логин и пароль.' };
    return res.redirect('/register');
  }

  if (password !== confirmPassword) {
    req.session.alert = { type: 'error', message: 'Введённые пароли не совпадают.' };
    return res.redirect('/register');
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existingUser) {
    req.session.alert = { type: 'error', message: 'Пользователь с таким логином уже существует.' };
    return res.redirect('/register');
  }

  try {
    const insert = db.prepare(`
      INSERT INTO users (username, password, role, balance)
      VALUES (?, ?, 'user', 1000)
    `);
    const info = insert.run(username.trim(), password);

    // Автоматическая авторизация нового пользователя
    req.session.user = {
      id: info.lastInsertRowid,
      username: username.trim(),
      role: 'user',
      balance: 1000
    };

    req.session.alert = { type: 'success', message: 'Регистрация успешна! Вам начислено 1000 стартовых монет.' };
    res.redirect('/profile');
  } catch (err) {
    console.error('Ошибка регистрации:', err);
    req.session.alert = { type: 'error', message: 'Ошибка при создании аккаунта.' };
    res.redirect('/register');
  }
});

// Выход из системы
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
