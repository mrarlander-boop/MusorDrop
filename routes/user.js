const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Личный кабинет пользователя
router.get('/profile', requireAuth, (req, res) => {
  const userId = req.session.user.id;

  // Купленные скины пользователя
  const purchasedSkins = db.prepare(`
    SELECT s.*, p.created_at as purchased_at, p.price_paid, p.source 
    FROM purchases p 
    JOIN skins s ON p.skin_id = s.id 
    WHERE p.user_id = ? 
    ORDER BY p.id DESC
  `).all(userId);

  // История покупок
  const purchaseHistory = db.prepare(`
    SELECT p.*, s.title as skin_title, s.image_url as skin_image 
    FROM purchases p 
    JOIN skins s ON p.skin_id = s.id 
    WHERE p.user_id = ? 
    ORDER BY p.id DESC 
    LIMIT 20
  `).all(userId);

  // История открытий кейсов
  const caseHistory = db.prepare(`
    SELECT co.*, c.title as case_title, s.title as skin_title, s.image_url as skin_image 
    FROM case_openings co 
    JOIN cases c ON co.case_id = c.id 
    JOIN skins s ON co.won_skin_id = s.id 
    WHERE co.user_id = ? 
    ORDER BY co.id DESC 
    LIMIT 20
  `).all(userId);

  res.render('profile', {
    title: 'Личный кабинет',
    purchasedSkins,
    purchaseHistory,
    caseHistory
  });
});

// Тестовое пополнение баланса для удобной проверки функционала
router.post('/profile/topup', requireAuth, (req, res) => {
  const userId = req.session.user.id;
  const amount = parseInt(req.body.amount, 10) || 500;

  if (amount <= 0 || amount > 10000) {
    req.session.alert = { type: 'error', message: 'Некорректная сумма пополнения.' };
    return res.redirect('/profile');
  }

  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(amount, userId);

  req.session.alert = { type: 'success', message: `Баланс успешно пополнен на +${amount} монет!` };
  res.redirect('/profile');
});

module.exports = router;
