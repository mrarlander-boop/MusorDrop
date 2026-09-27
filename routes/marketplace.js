const express = require('express');
const router = express.Router();
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

// Главная страница
router.get('/', (req, res) => {
  const featuredSkins = db.prepare(`
    SELECT s.*, u.username as author_name 
    FROM skins s 
    LEFT JOIN users u ON s.author_id = u.id 
    ORDER BY s.id DESC 
    LIMIT 6
  `).all();

  const cases = db.prepare('SELECT * FROM cases ORDER BY price ASC LIMIT 3').all();

  const latestPosts = db.prepare(`
    SELECT p.*, u.username as author_name 
    FROM posts p 
    LEFT JOIN users u ON p.author_id = u.id 
    ORDER BY p.id DESC 
    LIMIT 3
  `).all();

  // Получаем список ID уже купленных скинов текущего пользователя
  let ownedSkinIds = [];
  if (req.session.user) {
    const rows = db.prepare('SELECT skin_id FROM purchases WHERE user_id = ?').all(req.session.user.id);
    ownedSkinIds = rows.map(r => r.skin_id);
  }

  res.render('index', {
    title: 'Главная - Minecraft SkinHub',
    featuredSkins,
    cases,
    latestPosts,
    ownedSkinIds
  });
});

// Каталог всех скинов с поиском и сортировкой
router.get('/skins', (req, res) => {
  const { q, sort } = req.query;

  let query = `
    SELECT s.*, u.username as author_name 
    FROM skins s 
    LEFT JOIN users u ON s.author_id = u.id 
  `;
  const params = [];

  if (q && q.trim()) {
    query += ` WHERE s.title LIKE ? OR s.description LIKE ? `;
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }

  if (sort === 'price_asc') {
    query += ` ORDER BY s.price ASC `;
  } else if (sort === 'price_desc') {
    query += ` ORDER BY s.price DESC `;
  } else {
    query += ` ORDER BY s.id DESC `;
  }

  const skins = db.prepare(query).all(...params);

  let ownedSkinIds = [];
  if (req.session.user) {
    const rows = db.prepare('SELECT skin_id FROM purchases WHERE user_id = ?').all(req.session.user.id);
    ownedSkinIds = rows.map(r => r.skin_id);
  }

  res.render('skins', {
    title: 'Каталог скинов Minecraft',
    skins,
    ownedSkinIds,
    searchQuery: q || '',
    currentSort: sort || 'newest'
  });
});

// Просмотр отдельного скина
router.get('/skins/:id', (req, res) => {
  const skin = db.prepare(`
    SELECT s.*, u.username as author_name 
    FROM skins s 
    LEFT JOIN users u ON s.author_id = u.id 
    WHERE s.id = ?
  `).get(req.params.id);

  if (!skin) {
    req.session.alert = { type: 'error', message: 'Скин не найден.' };
    return res.redirect('/skins');
  }

  let isOwned = false;
  if (req.session.user) {
    const purchase = db.prepare('SELECT id FROM purchases WHERE user_id = ? AND skin_id = ?').get(req.session.user.id, skin.id);
    if (purchase) isOwned = true;
  }

  res.render('skin_details', {
    title: `${skin.title} - Скин Minecraft`,
    skin,
    isOwned
  });
});

// Покупка скина
router.post('/skins/:id/buy', requireAuth, (req, res) => {
  const skinId = req.params.id;
  const userId = req.session.user.id;

  const skin = db.prepare('SELECT * FROM skins WHERE id = ?').get(skinId);
  if (!skin) {
    req.session.alert = { type: 'error', message: 'Скин не найден.' };
    return res.redirect('/skins');
  }

  // Проверка: куплен ли уже этот скин
  const alreadyOwned = db.prepare('SELECT id FROM purchases WHERE user_id = ? AND skin_id = ?').get(userId, skinId);
  if (alreadyOwned) {
    req.session.alert = { type: 'info', message: 'Этот скин уже есть в вашей коллекции!' };
    return res.redirect(`/skins/${skinId}`);
  }

  // Получаем актуальный баланс
  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  if (user.balance < skin.price) {
    req.session.alert = { type: 'error', message: `Недостаточно монет! Баланс: ${user.balance}, цена: ${skin.price}. Пополните баланс в профиле.` };
    return res.redirect(`/skins/${skinId}`);
  }

  // Транзакция покупки
  db.exec('BEGIN TRANSACTION;');
  try {
    // Списание баланса
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(skin.price, userId);
    // Добавление в покупки
    db.prepare('INSERT INTO purchases (user_id, skin_id, price_paid, source) VALUES (?, ?, ?, ?)').run(userId, skinId, skin.price, 'direct');
    db.exec('COMMIT;');

    req.session.alert = { type: 'success', message: `Поздравляем! Скин "${skin.title}" успешно приобретен и доступен для скачивания.` };
    res.redirect('/profile');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Ошибка при покупке скина:', err);
    req.session.alert = { type: 'error', message: 'Произошла ошибка при покупке.' };
    res.redirect(`/skins/${skinId}`);
  }
});

// Страница кейсов
router.get('/cases', (req, res) => {
  const casesRaw = db.prepare('SELECT * FROM cases ORDER BY price ASC').all();
  const allSkins = db.prepare('SELECT id, title, image_url, price FROM skins').all();
  const skinsMap = new Map(allSkins.map(s => [s.id, s]));

  // Декодируем возможные скины для каждого кейса
  const cases = casesRaw.map(c => {
    let itemIds = [];
    try {
      itemIds = JSON.parse(c.possible_items);
    } catch (e) {
      itemIds = [];
    }
    const possibleSkins = itemIds.map(id => skinsMap.get(id)).filter(Boolean);
    return {
      ...c,
      possibleSkins
    };
  });

  res.render('cases', {
    title: 'Кейсы со скинами Minecraft',
    cases,
    allSkins
  });
});

// Открытие кейса (поддержка AJAX и стандартного POST)
router.post('/cases/:id/open', requireAuth, (req, res) => {
  const caseId = req.params.id;
  const userId = req.session.user.id;
  const isAjax = req.xhr || req.headers['accept']?.includes('application/json');

  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId);
  if (!c) {
    if (isAjax) return res.status(404).json({ success: false, message: 'Кейс не найден' });
    req.session.alert = { type: 'error', message: 'Кейс не найден.' };
    return res.redirect('/cases');
  }

  const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);
  if (user.balance < c.price) {
    const msg = `Недостаточно монет для открытия! Цена кейса: ${c.price}, ваш баланс: ${user.balance}.`;
    if (isAjax) return res.status(400).json({ success: false, message: msg });
    req.session.alert = { type: 'error', message: msg };
    return res.redirect('/cases');
  }

  // Определение списка возможных скинов
  let itemIds = [];
  try {
    itemIds = JSON.parse(c.possible_items);
  } catch (e) {
    itemIds = [];
  }

  let candidates = [];
  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => '?').join(',');
    candidates = db.prepare(`SELECT * FROM skins WHERE id IN (${placeholders})`).all(...itemIds);
  }

  // Если в кейсе не указаны скины, берем любой скин из базы
  if (candidates.length === 0) {
    candidates = db.prepare('SELECT * FROM skins LIMIT 10').all();
  }

  if (candidates.length === 0) {
    const msg = 'В базе пока нет скинов для розыгрыша.';
    if (isAjax) return res.status(400).json({ success: false, message: msg });
    req.session.alert = { type: 'error', message: msg };
    return res.redirect('/cases');
  }

  // Случайный выбор выигранного скина
  const wonSkin = candidates[Math.floor(Math.random() * candidates.length)];

  // Транзакция открытия кейса
  db.exec('BEGIN TRANSACTION;');
  try {
    // Списание стоимости кейса
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(c.price, userId);
    
    // Запись в историю открытий кейсов
    db.prepare('INSERT INTO case_openings (user_id, case_id, won_skin_id) VALUES (?, ?, ?)').run(userId, c.id, wonSkin.id);

    // Добавляем скин в инвентарь (purchases), если его ещё нет
    const alreadyHas = db.prepare('SELECT id FROM purchases WHERE user_id = ? AND skin_id = ?').get(userId, wonSkin.id);
    if (!alreadyHas) {
      db.prepare('INSERT INTO purchases (user_id, skin_id, price_paid, source) VALUES (?, ?, ?, ?)').run(userId, wonSkin.id, 0, 'case');
    }

    db.exec('COMMIT;');

    const updatedUser = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId);

    if (isAjax) {
      return res.json({
        success: true,
        wonSkin,
        caseTitle: c.title,
        newBalance: updatedUser.balance,
        alreadyHad: !!alreadyHas
      });
    }

    req.session.alert = {
      type: 'success',
      message: `🎉 Вы открыли "${c.title}" и получили скин: "${wonSkin.title}"!`
    };
    res.redirect('/profile');
  } catch (err) {
    db.exec('ROLLBACK;');
    console.error('Ошибка при открытии кейса:', err);
    if (isAjax) return res.status(500).json({ success: false, message: 'Ошибка при открытии кейса.' });
    req.session.alert = { type: 'error', message: 'Ошибка при открытии кейса.' };
    res.redirect('/cases');
  }
});

module.exports = router;
