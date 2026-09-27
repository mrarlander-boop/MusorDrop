// Главный клиентский скрипт

document.addEventListener('DOMContentLoaded', () => {
  // 1. Автоматическое скрытие уведомлений через 5 секунд
  const alerts = document.querySelectorAll('.alert-box');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      alert.style.opacity = '0';
      alert.style.transform = 'translateY(-10px)';
      setTimeout(() => alert.remove(), 500);
    }, 5000);
  });

  // 2. Отображение имени выбранного файла в кастомных инпутах
  const fileInputs = document.querySelectorAll('input[type="file"]');
  fileInputs.forEach(input => {
    input.addEventListener('change', (e) => {
      const parent = input.closest('.form-file-box') || input.parentElement;
      const label = parent.querySelector('.file-name-display');
      if (label && input.files && input.files.length > 0) {
        label.textContent = 'Выбран файл: ' + input.files[0].name;
        label.style.color = '#4ade80';
        label.style.fontWeight = 'bold';
      }
    });
  });

  // 3. Подтверждение удаления материалов
  const deleteForms = document.querySelectorAll('form[action*="/delete"]');
  deleteForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      if (!confirm('Вы уверены, что хотите удалить этот элемент? Это действие необратимо.')) {
        e.preventDefault();
      }
    });
  });

  // 4. Подтверждение покупки скина
  const buyForms = document.querySelectorAll('form[action*="/buy"]');
  buyForms.forEach(form => {
    form.addEventListener('submit', (e) => {
      const price = form.getAttribute('data-price') || '';
      const title = form.getAttribute('data-title') || 'этот скин';
      if (!confirm(`Подтвердите покупку скина "${title}" за ${price} монет?`)) {
        e.preventDefault();
      }
    });
  });
});
