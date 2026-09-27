const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { skinUpload, caseUpload, postUpload } = require('../middleware/upload');

// Все маршруты в этом роутере защищены требованием роли admin
router.use(requireAdmin);

// Главный дашборд администратора
router.get('/', (req, res) => {
  const stats = {
    usersCount: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    skinsCount: db.prepare('SELECT COUNT(*) as c FROM skins').get().c,
    casesCount: db.prepare('SELECT COUNT(*) as c FROM cases').get().c,
    postsCount: db.prepare('SELECT COUNT(*) as c FROM posts').get().c,
    purchasesCount: db.prepare('SELECT COUNT(*) as c FROM purchases').get().c
  };

  const skins = db.prepare('SELECT * FROM skins ORDER BY id DESC').all();
  const cases = db.prepare('SELECT * FROM cases ORDER BY id DESC').all();
  const posts = db.prepare('SELECT * FROM posts ORDER BY id DESC').all();

  res.render('admin/index', {
    title: 'Панель администратора',
    stats,
    skins,
    cases,
    posts
  });
});

// Страница добавления скина
router.get('/skins/add', (req, res) => {
  res.render('admin/add_skin', {
    title: 'Добавить скин - Админ-панель'
  });
});

// Обработка добавления скина
router.post('/skins/add', (req, res) => {
  skinUpload(req, res, (err) => {
    if (err) {
      req.session.alert = { type: 'error', message: 'Ошибка загрузки файлов: ' + err.message };
      return res.redirect('/admin/skins/add');
    }

    const { title, description, price, preview_url } = req.body;

    if (!title || price === undefined) {
      req.session.alert = { type: 'error', message: 'Заполните название и цену скина.' };
      return res.redirect('/admin/skins/add');
    }

    let imageUrl = preview_url ? preview_url.trim() : '';
    if (req.files && req.files.image && req.files.image[0]) {
      imageUrl = '/uploads/skins/' + req.files.image[0].filename;
    }

    if (!imageUrl) {
      imageUrl = 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80';
    }

    let skinFileUrl = '/uploads/skins/sample_steve_skin.png';
    if (req.files && req.files.skin_file && req.files.skin_file[0]) {
      skinFileUrl = '/uploads/skins/' + req.files.skin_file[0].filename;
    }

    try {
      db.prepare(`
        INSERT INTO skins (title, description, price, image_url, skin_file_url, author_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        description ? description.trim() : '',
        parseInt(price, 10) || 0,
        imageUrl,
        skinFileUrl,
        req.session.user.id
      );

      req.session.alert = { type: 'success', message: `Скин "${title}" успешно добавлен в каталог!` };
      res.redirect('/admin');
    } catch (dbErr) {
      console.error('Ошибка добавления скина:', dbErr);
      req.session.alert = { type: 'error', message: 'Ошибка базы данных при сохранении скина.' };
      res.redirect('/admin/skins/add');
    }
  });
});

// Удаление скина
router.post('/skins/:id/delete', (req, res) => {
  const skin = db.prepare('SELECT * FROM skins WHERE id = ?').get(req.params.id);
  if (skin) {
    // Удаляем локальные файлы, если это не дефолтные образцы
    if (skin.skin_file_url && skin.skin_file_url.startsWith('/uploads/') && !skin.skin_file_url.includes('sample_steve_skin.png')) {
      const fullPath = path.join(__dirname, '..', 'public', skin.skin_file_url);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    if (skin.image_url && skin.image_url.startsWith('/uploads/')) {
      const fullPath = path.join(__dirname, '..', 'public', skin.image_url);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    db.prepare('DELETE FROM skins WHERE id = ?').run(req.params.id);
    req.session.alert = { type: 'success', message: 'Скин успешно удален.' };
  }
  res.redirect('/admin');
});

// Страница добавления кейса
router.get('/cases/add', (req, res) => {
  const allSkins = db.prepare('SELECT id, title, price, image_url FROM skins ORDER BY id DESC').all();
  res.render('admin/add_case', {
    title: 'Добавить кейс - Админ-панель',
    skins: allSkins
  });
});

// Обработка добавления кейса
router.post('/cases/add', (req, res) => {
  caseUpload(req, res, (err) => {
    if (err) {
      req.session.alert = { type: 'error', message: 'Ошибка загрузки иконки: ' + err.message };
      return res.redirect('/admin/cases/add');
    }

    const { title, description, price, image_url, items } = req.body;

    if (!title || !price) {
      req.session.alert = { type: 'error', message: 'Заполните название и стоимость кейса.' };
      return res.redirect('/admin/cases/add');
    }

    let finalImageUrl = image_url ? image_url.trim() : '';
    if (req.file) {
      finalImageUrl = '/uploads/cases/' + req.file.filename;
    }

    if (!finalImageUrl) {
      finalImageUrl = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80';
    }

    // Собираем массив выбранных ID скинов
    let selectedItems = [];
    if (items) {
      if (Array.isArray(items)) {
        selectedItems = items.map(id => parseInt(id, 10)).filter(Boolean);
      } else {
        selectedItems = [parseInt(items, 10)].filter(Boolean);
      }
    }

    try {
      db.prepare(`
        INSERT INTO cases (title, description, price, image_url, possible_items)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        description ? description.trim() : '',
        parseInt(price, 10) || 100,
        finalImageUrl,
        JSON.stringify(selectedItems)
      );

      req.session.alert = { type: 'success', message: `Кейс "${title}" успешно создан!` };
      res.redirect('/admin');
    } catch (dbErr) {
      console.error('Ошибка добавления кейса:', dbErr);
      req.session.alert = { type: 'error', message: 'Ошибка базы данных при создании кейса.' };
      res.redirect('/admin/cases/add');
    }
  });
});

// Удаление кейса
router.post('/cases/:id/delete', (req, res) => {
  const c = db.prepare('SELECT * FROM cases WHERE id = ?').get(req.params.id);
  if (c) {
    if (c.image_url && c.image_url.startsWith('/uploads/')) {
      const fullPath = path.join(__dirname, '..', 'public', c.image_url);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);
    req.session.alert = { type: 'success', message: 'Кейс успешно удален.' };
  }
  res.redirect('/admin');
});

// Страница создания публикации блога
router.get('/posts/add', (req, res) => {
  res.render('admin/add_post', {
    title: 'Создать публикацию в блог - Админ-панель'
  });
});

// Обработка добавления публикации блога
router.post('/posts/add', (req, res) => {
  postUpload(req, res, (err) => {
    if (err) {
      req.session.alert = { type: 'error', message: 'Ошибка загрузки файла: ' + err.message };
      return res.redirect('/admin/posts/add');
    }

    const { title, content, media_url_input } = req.body;

    if (!title || !content) {
      req.session.alert = { type: 'error', message: 'Заполните заголовок и текст публикации.' };
      return res.redirect('/admin/posts/add');
    }

    let mediaUrl = media_url_input ? media_url_input.trim() : null;
    let mediaType = 'none';

    if (req.file) {
      mediaUrl = '/uploads/posts/' + req.file.filename;
      const mime = req.file.mimetype || '';
      if (mime.startsWith('image/')) {
        mediaType = 'image';
      } else if (mime.startsWith('video/')) {
        mediaType = 'video';
      } else {
        mediaType = 'file';
      }
    } else if (mediaUrl) {
      const lower = mediaUrl.toLowerCase();
      if (lower.match(/\.(jpg|jpeg|png|webp|gif|svg)$/) || lower.includes('unsplash')) {
        mediaType = 'image';
      } else if (lower.match(/\.(mp4|webm|ogg|mov)$/)) {
        mediaType = 'video';
      } else {
        mediaType = 'file';
      }
    }

    try {
      db.prepare(`
        INSERT INTO posts (title, content, media_url, media_type, author_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        title.trim(),
        content.trim(),
        mediaUrl,
        mediaType,
        req.session.user.id
      );

      req.session.alert = { type: 'success', message: 'Публикация успешно опубликована в блоге!' };
      res.redirect('/admin');
    } catch (dbErr) {
      console.error('Ошибка добавления публикации:', dbErr);
      req.session.alert = { type: 'error', message: 'Ошибка базы данных при публикации.' };
      res.redirect('/admin/posts/add');
    }
  });
});

// Удаление публикации блога
router.post('/posts/:id/delete', (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (post) {
    if (post.media_url && post.media_url.startsWith('/uploads/') && !post.media_url.includes('skin_install_guide.txt')) {
      const fullPath = path.join(__dirname, '..', 'public', post.media_url);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    req.session.alert = { type: 'success', message: 'Публикация успешно удалена.' };
  }
  res.redirect('/admin');
});

module.exports = router;
