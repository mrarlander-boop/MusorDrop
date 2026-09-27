// Интерактивная рулетка открытия кейсов Minecraft

let audioCtx = null;

// Генерация звука тика рулетки через Web Audio API
function playTickSound() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    // аудио опционально
  }
}

// Звук фанфар при победе
function playWinSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.35);
    });
  } catch (e) {}
}

async function openCaseWithRoulette(caseId, caseTitle, price) {
  const modal = document.getElementById('rouletteModal');
  const track = document.getElementById('rouletteTrack');
  const resultDiv = document.getElementById('rouletteResult');
  const modalTitle = document.getElementById('rouletteModalTitle');
  const spinContainer = document.getElementById('rouletteContainer');

  if (!modal) return;

  modalTitle.textContent = `Открытие: ${caseTitle}`;
  resultDiv.classList.remove('show');
  resultDiv.style.display = 'none';
  spinContainer.style.display = 'block';
  track.style.transition = 'none';
  track.style.transform = 'translateX(0px)';
  track.innerHTML = '';
  modal.classList.add('active');

  try {
    // Отправляем AJAX запрос на открытие кейса
    const res = await fetch(`/cases/${caseId}/open`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const data = await res.json();

    if (!data.success) {
      alert(data.message || 'Ошибка при открытии кейса');
      modal.classList.remove('active');
      return;
    }

    // Обновляем отображение баланса в шапке
    const balanceEl = document.querySelector('.user-balance-badge span');
    if (balanceEl && data.newBalance !== undefined) {
      balanceEl.textContent = `${data.newBalance} 🟢`;
    }

    const wonSkin = data.wonSkin;

    // Генерируем ленту рулетки из 50 элементов
    const totalItems = 50;
    const winnerIndex = 42; // Индекс победного слота
    const itemWidth = 150; // Ширина одного элемента в px

    // Получаем массив скинов для заполнения ленты
    const candidateSkins = window.ALL_SKINS && window.ALL_SKINS.length > 0 
      ? window.ALL_SKINS 
      : [wonSkin];

    for (let i = 0; i < totalItems; i++) {
      let currentSkin;
      if (i === winnerIndex) {
        currentSkin = wonSkin;
      } else {
        currentSkin = candidateSkins[Math.floor(Math.random() * candidateSkins.length)];
      }

      const itemEl = document.createElement('div');
      itemEl.className = 'roulette-item';
      itemEl.innerHTML = `
        <img src="${currentSkin.image_url}" alt="${currentSkin.title}" onerror="this.src='https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=200&auto=format&fit=crop&q=80'">
        <span class="roulette-item-title">${currentSkin.title}</span>
      `;
      track.appendChild(itemEl);
    }

    // Смещение до центра победителя
    // Центр контейнера (ширина 800px - 60px padding = ~740px / 2 = 370px)
    const containerCenter = spinContainer.offsetWidth / 2;
    // Случайное микро-смещение внутри победителя [-40, +40]
    const randomJitter = Math.floor(Math.random() * 60) - 30;
    const targetOffset = (winnerIndex * itemWidth) + (itemWidth / 2) - containerCenter + randomJitter;

    // Запускаем вращение через requestAnimationFrame
    setTimeout(() => {
      track.style.transition = 'transform 6.5s cubic-bezier(0.12, 0.8, 0.25, 1)';
      track.style.transform = `translateX(-${targetOffset}px)`;

      // Звуковые клики во время прокрутки
      let tickCount = 0;
      const interval = setInterval(() => {
        tickCount++;
        playTickSound();
        if (tickCount > 40) clearInterval(interval);
      }, 150);

      // Завершение анимации
      setTimeout(() => {
        clearInterval(interval);
        playWinSound();

        // Показываем выигранный скин
        spinContainer.style.display = 'none';
        resultDiv.style.display = 'block';
        resultDiv.classList.add('show');

        document.getElementById('wonSkinTitle').textContent = wonSkin.title;
        document.getElementById('wonSkinImg').src = wonSkin.image_url;
        document.getElementById('wonSkinDesc').textContent = wonSkin.description || 'Редкий коллекционный скин!';
        
        const noteEl = document.getElementById('wonSkinNote');
        if (data.alreadyHad) {
          noteEl.textContent = 'У вас уже был этот скин, но победа все равно засчитана!';
        } else {
          noteEl.textContent = 'Скин успешно добавлен в ваш профиль и готов к загрузке!';
        }
      }, 6800);
    }, 100);

  } catch (err) {
    console.error('Ошибка рулетки:', err);
    alert('Произошла сетевая ошибка.');
    modal.classList.remove('active');
  }
}

function closeRouletteModal() {
  const modal = document.getElementById('rouletteModal');
  if (modal) modal.classList.remove('active');
}
