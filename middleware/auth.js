// Middleware для проверки авторизации и ролей

function requireAuth(req, res, next) {
  if (!req.session.user) {
    req.session.alert = { type: 'error', message: 'Для выполнения этого действия необходимо войти в аккаунт.' };
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.alert = { type: 'error', message: 'Доступ ограничен! Требуются права администратора.' };
    return res.redirect('/');
  }
  next();
}

function setUserLocals(db) {
  return (req, res, next) => {
    if (req.session.user) {
      // Обновляем свежие данные пользователя из БД (баланс и роль)
      const freshUser = db.prepare('SELECT id, username, role, balance FROM users WHERE id = ?').get(req.session.user.id);
      if (freshUser) {
        req.session.user = freshUser;
        res.locals.user = freshUser;
      } else {
        delete req.session.user;
        res.locals.user = null;
      }
    } else {
      res.locals.user = null;
    }

    // Передаем всплывающие сообщения и текущий путь в шаблоны
    res.locals.alert = req.session.alert || null;
    delete req.session.alert;
    res.locals.currentPath = req.path;
    next();
  };
}

module.exports = {
  requireAuth,
  requireAdmin,
  setUserLocals
};
