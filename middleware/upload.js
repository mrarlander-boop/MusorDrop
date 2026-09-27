const multer = require('multer');
const path = require('path');

// Функция создания хранилища multer для конкретной папки
function createStorage(subfolder) {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, path.join(__dirname, '..', 'public', 'uploads', subfolder));
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
  });
}

// Загрузка для скинов: превью и сам .png файл скина
const skinUpload = multer({
  storage: createStorage('skins'),
  limits: { fileSize: 25 * 1024 * 1024 } // до 25MB
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'skin_file', maxCount: 1 }
]);

// Загрузка для кейсов: иконка кейса
const caseUpload = multer({
  storage: createStorage('cases'),
  limits: { fileSize: 10 * 1024 * 1024 }
}).single('image');

// Загрузка для блога: медиа-вложение (картинка, видео или файл)
const postUpload = multer({
  storage: createStorage('posts'),
  limits: { fileSize: 50 * 1024 * 1024 } // до 50MB для видео
}).single('media');

module.exports = {
  skinUpload,
  caseUpload,
  postUpload
};
