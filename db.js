const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');

let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(dbPath);
  console.log('[DB] База данных подключена через better-sqlite3');
} catch (err) {
  const { DatabaseSync } = require('node:sqlite');
  db = new DatabaseSync(dbPath);
  console.log('[DB] База данных подключена через встроенный модуль node:sqlite');
}

// Включение поддержки внешних ключей и оптимизация
db.exec('PRAGMA foreign_keys = ON;');

// 1. Создание всех таблиц
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    balance INTEGER DEFAULT 1000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS skins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL,
    skin_file_url TEXT NOT NULL,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL DEFAULT 100,
    image_url TEXT NOT NULL,
    possible_items TEXT NOT NULL, -- JSON массив ID скинов
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    media_url TEXT,
    media_type TEXT DEFAULT 'none', -- 'image', 'video', 'file', 'none'
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skin_id INTEGER NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    price_paid INTEGER NOT NULL DEFAULT 0,
    source TEXT DEFAULT 'direct', -- 'direct' или 'case'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS case_openings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    case_id INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    won_skin_id INTEGER NOT NULL REFERENCES skins(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Создание необходимых директорий
const uploadDirs = [
  path.join(__dirname, 'public', 'uploads', 'skins'),
  path.join(__dirname, 'public', 'uploads', 'previews'),
  path.join(__dirname, 'public', 'uploads', 'cases'),
  path.join(__dirname, 'public', 'uploads', 'posts'),
  path.join(__dirname, 'public', 'images')
];

uploadDirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Автосидирование админа (admin / admin, баланс 5000)
const adminUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
let adminId = adminUser ? adminUser.id : null;

if (!adminUser) {
  const insertAdmin = db.prepare(`
    INSERT INTO users (username, password, role, balance)
    VALUES (?, ?, ?, ?)
  `);
  const info = insertAdmin.run('admin', 'admin', 'admin', 5000);
  adminId = info.lastInsertRowid;
  console.log('[DB] Создан администратор: admin / admin (Баланс: 5000 монет)');
}

// Создание файла скина по умолчанию для скачивания
const defaultSkinFile = '/uploads/skins/sample_steve_skin.png';
const sampleSkinPath = path.join(__dirname, 'public', 'uploads', 'skins', 'sample_steve_skin.png');
if (!fs.existsSync(sampleSkinPath)) {
  const minimalPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAA' +
    'B3RJTUUH5gMWEw0wH8XzkwAAAB1pVFh0Q29tbWVudAAAAAAAQ3JlYXRlZCB3aXRoIEdJTVBkLmUH' +
    'AAABXklEQVR42u3bQQrCMBAF0Ex7BfUKeil4BvUGegU33ngJFaW22hQ1k5D/4d00Zf4U5zAGAAAA' +
    'AAAAgK4y59w551zG2N57r2ufU2vfV0TE3mOMMUbvvffee133e3fW2rXWOsY455xzzt57Xfc/b7vd' +
    'rsdxrPfe+xgjAAAAAADgN733uuc8z7Pv+zrnHMexruvqnHMcxzrnPE3TdV3rusYYrfW1ruu6rnPO' +
    'ORlj1FrrusYYY4yxrut3/v4FAAAAAAAA4L/quh5j1FrrGGOMMebce78AAAAAAIDfeZ5nHMfecx5j' +
    'rLWWUmqMcRzHeZ7rfb8AAAAAAIDfLMtyHMd5nue+7/u+7+f5/mEYZp7nAAAAAADAL3rvfd/3vusY' +
    '47qu67qOMR7H8ff/AAAAAAAAP7PWttZaSunee0spvfceY8z5/wAAAAAAgL/KGLPWmufZOffce4+x' +
    '5pxzAAAAAACAn9bafwEAAADYzBfX128A3YqO2wAAAABJRU5ErkJggg==',
    'base64'
  );
  fs.writeFileSync(sampleSkinPath, minimalPng);
}

// Создаем памятку-документ для демонстрации скачивания файлов в блоге
const guideFilePath = path.join(__dirname, 'public', 'uploads', 'posts', 'skin_install_guide.txt');
if (!fs.existsSync(guideFilePath)) {
  fs.writeFileSync(guideFilePath, 'ИНСТРУКЦИЯ ПО УСТАНОВКЕ СКИНА В MINECRAFT:\n\n1. Скачайте файл .png с нашего сайта.\n2. Запустите официальный лаунчер Minecraft (или TLauncher / Prism Launcher).\n3. Перейдите во вкладку "Скины".\n4. Нажмите кнопку "Новый скин" (Browse Skin).\n5. Выберите скачанный файл скина и сохраните изменения.\n6. Заходите на любимый сервер с новым стильным образом!');
}

// Автосидирование тестовых скинов
const skinCount = db.prepare('SELECT COUNT(*) as count FROM skins').get().count;

if (skinCount === 0) {
  const insertSkin = db.prepare(`
    INSERT INTO skins (title, description, price, image_url, skin_file_url, author_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const initialSkins = [
    {
      title: 'Незеритовый Рыцарь',
      description: 'Тяжелая броня из древних обломков Нижнего мира с фиолетовым неоновым свечением магических рун.',
      price: 350,
      image_url: 'https://images.unsplash.com/photo-1627856014754-2907e2355d54?w=600&auto=format&fit=crop&q=80',
      skin_file_url: defaultSkinFile
    },
    {
      title: 'Кибер Стив 2077',
      description: 'Футуристический облик классического персонажа с неоновыми имплантами и кибер-очками ночного видения.',
      price: 250,
      image_url: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop&q=80',
      skin_file_url: defaultSkinFile
    },
    {
      title: 'Эндер Чародейка',
      description: 'Мистический облик владычицы измерений с мерцающими фиолетовыми частицами Края и темной мантией.',
      price: 450,
      image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      skin_file_url: defaultSkinFile
    },
    {
      title: 'Токсичный Крипер',
      description: 'Радиоактивная версия культового моба в стиле биохазард с ярким кислотно-зеленым свечением.',
      price: 200,
      image_url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=600&auto=format&fit=crop&q=80',
      skin_file_url: defaultSkinFile
    },
    {
      title: 'Алмазная Валькирия',
      description: 'Элитный доспех с мерцающими лазурными крыльями и боевым шлемом небесного стража.',
      price: 500,
      image_url: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
      skin_file_url: defaultSkinFile
    },
    {
      title: 'Стимпанк Механик',
      description: 'Шестерёнки, латунные трубы, винтажные гогглы и кожаный фартук мастера редстоун-схем.',
      price: 180,
      image_url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
      skin_file_url: defaultSkinFile
    }
  ];

  initialSkins.forEach(skin => {
    insertSkin.run(skin.title, skin.description, skin.price, skin.image_url, skin.skin_file_url, adminId);
  });

  console.log('[DB] Стартовые скины успешно добавлены');
}

// Автосидирование тестовых кейсов
const caseCount = db.prepare('SELECT COUNT(*) as count FROM cases').get().count;

if (caseCount === 0) {
  const insertCase = db.prepare(`
    INSERT INTO cases (title, description, price, image_url, possible_items)
    VALUES (?, ?, ?, ?, ?)
  `);

  const initialCases = [
    {
      title: 'Кейс Новичка',
      description: 'Отличный стартовый сундук! Содержит проверенные скины начального и среднего уровня.',
      price: 150,
      image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=80',
      possible_items: JSON.stringify([2, 4, 6])
    },
    {
      title: 'Эндер Кейс',
      description: 'Загадочный сундук из глубин Края. Шанс выбить редкие скины с частицами телепортации.',
      price: 300,
      image_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
      possible_items: JSON.stringify([1, 3, 5])
    },
    {
      title: 'Легендарный Незеритовый',
      description: 'Самый дорогой кейс. Включает в себя только первоклассные и мифические скины высшего ранга.',
      price: 450,
      image_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
      possible_items: JSON.stringify([1, 3, 5])
    }
  ];

  initialCases.forEach(c => {
    insertCase.run(c.title, c.description, c.price, c.image_url, c.possible_items);
  });

  console.log('[DB] Стартовые кейсы успешно добавлены');
}

// Автосидирование постов блога
const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get().count;

if (postCount === 0) {
  const insertPost = db.prepare(`
    INSERT INTO posts (title, content, media_url, media_type, author_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  const initialPosts = [
    {
      title: '🔥 Добро пожаловать на Minecraft SkinHub!',
      content: 'Мы рады открыть двери нашего маркетплейса для всех любителей Minecraft! У нас вы найдете уникальные авторские скины, систему интерактивных кейсов с моментальным выпадением и удобную загрузку образов в игру. Каждому новому зарегистрированному игроку мы дарим 1000 стартовых монет на покупки!',
      media_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
      media_type: 'image'
    },
    {
      title: '⚡ Большое обновление: новые Незеритовые доспехи и эффекты',
      content: 'В нашем каталоге пополнение — добавлены эксклюзивные скины с детализированными текстурами 64x64 в незеритовой и эндовской стилистике. Загляните в раздел "Кейсы", чтобы испытать удачу и выиграть их со скидкой!',
      media_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=80',
      media_type: 'image'
    },
    {
      title: '📄 Инструкция по установке скинов в игру (Java & Bedrock)',
      content: 'Для всех новичков мы подготовили подробное текстовое руководство по применению скачанных .png файлов в любой версии лаунчера Minecraft. Файл инструкции прикреплен ниже для скачивания.',
      media_url: '/uploads/posts/skin_install_guide.txt',
      media_type: 'file'
    }
  ];

  initialPosts.forEach(p => {
    insertPost.run(p.title, p.content, p.media_url, p.media_type, adminId);
  });

  console.log('[DB] Стартовые публикации блога добавлены');
}

module.exports = db;
