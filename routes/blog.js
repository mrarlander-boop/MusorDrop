const express = require('express');
const router = express.Router();
const db = require('../db');

// Страница списка постов блога
router.get('/', (req, res) => {
  const posts = db.prepare(`
    SELECT p.*, u.username as author_name 
    FROM posts p 
    LEFT JOIN users u ON p.author_id = u.id 
    ORDER BY p.id DESC
  `).all();

  res.render('blog', {
    title: 'Блог и новости Minecraft',
    posts
  });
});

// Отдельная страница публикации
router.get('/:id', (req, res) => {
  const post = db.prepare(`
    SELECT p.*, u.username as author_name 
    FROM posts p 
    LEFT JOIN users u ON p.author_id = u.id 
    WHERE p.id = ?
  `).get(req.params.id);

  if (!post) {
    req.session.alert = { type: 'error', message: 'Публикация не найдена.' };
    return res.redirect('/blog');
  }

  // Другие недавние посты для сайдбара
  const recentPosts = db.prepare(`
    SELECT id, title, created_at, media_url, media_type 
    FROM posts 
    WHERE id != ? 
    ORDER BY id DESC 
    LIMIT 4
  `).all(post.id);

  res.render('blog_details', {
    title: `${post.title} - Блог Minecraft`,
    post,
    recentPosts
  });
});

module.exports = router;
