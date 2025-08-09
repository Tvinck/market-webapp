# Маркер — Modern UI v3.9
- Исправлен механизм тёмной темы: явный переключатель (Светлая/Тёмная), жёсткое сохранение в localStorage, авто‑применение при запуске.
- Новый набор **чистых минималистичных SVG‑иконок** для меток (без эмодзи), единый стиль.
- Остальное — как в v3.8 (пресеты карты, минимал/монохром, кастом‑зум, анти‑дубли).
- Проверка загружаемых фото: только изображения размером до 2 МБ.
- В профиле появился раздел «Мои метки» с карточками ваших добавленных точек.
- Введена система рейтинга пользователей и уровней: рейтинг растёт за публикации и подтверждения меток.

## Получение ключей

Перед запуском потребуется:

1. Ключ [Yandex Maps API](https://developer.tech.yandex.ru/).
2. URL развёрнутого Google Apps Script.
3. ID папки Google Drive для загрузки фотографий.

Полученные значения храните локально и **не публикуйте их в публичных VCS**.

## Установка

1. Установите PHP и клонируйте репозиторий.
2. Укажите ключ Yandex Maps API (в `index.html` установлен плейсхолдер `YOUR_YA_MAPS_KEY`):
   - через поле `YA_MAPS_KEY` объекта `window.MARKER_CONFIG`,
   - либо в мета‑теге `<meta name="ya-maps-key" content="ВАШ_КЛЮЧ">` в `<head>`.
3. В `index.html` замените `window.MARKER_CONFIG.GAS_ENDPOINT` на URL веб‑приложения Google Apps Script или путь к прокси (например `/server/api/marker_api.php`).
4. Задайте переменные окружения `MARKER_GAS_ENDPOINT`, `PHOTOS_FOLDER_ID` и `MARKER_ALLOWED_ORIGINS` (см. ниже) или измените их значения в `server/config.php`.
5. Запустите сервер: `php -S localhost:8000 -t server`.

## Деплой Google Apps Script

При публикации скрипта на Google Apps Script убедитесь, что общий модуль с функцией `escapeHTML` тоже добавлен в проект.

1. Скопируйте файл `src/utils.js` в проект GAS (например, рядом с `code.gs`).
2. При локальном запуске функция импортируется через `require('./src/utils.js')`, а в Apps Script файлы объединяются автоматически.
3. После копирования `escapeHTML` станет доступна в коде `code.gs` без изменений.

## Настройка переменных окружения

Эти переменные используются `server/config.php` и `server/api/marker_api.php`.

```bash
export MARKER_GAS_ENDPOINT="https://script.google.com/macros/s/AKfycbwhBNyiokWlf6ifcD7sG0oOhU_xFIQrGBW8ZBDpZa_PmyGdYlQ0HRN0Zqgrn2em6CgSWA/exec"
export PHOTOS_FOLDER_ID="1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU"
export MARKER_ALLOWED_ORIGINS="https://www.bazzarproject.ru,https://bazzarproject.ru,http://localhost:8000"
```

`MARKER_GAS_ENDPOINT` — URL Google Apps Script или локального прокси.  
`PHOTOS_FOLDER_ID` — ID папки Google Drive.  
`MARKER_ALLOWED_ORIGINS` — разрешённые Origin (через запятую).

## Локальный запуск и тестирование

1. Запустите PHP‑сервер:

   ```bash
   php -S localhost:8000 -t server
   ```

2. Проверьте работу прокси:

   ```bash
   curl http://localhost:8000/api/marker_api.php?action=ping
   ```

   Ожидаемый ответ — `{"ok":true,"pong":true}`.

3. Опубликуйте тестовую метку:

   ```bash
   curl -X POST http://localhost:8000/api/marker_api.php?action=add_marker \\
     -H "Content-Type: application/json" \\
     -d '{"lat":55.75,"lng":37.61,"title":"Test","description":"Demo","author":"local","client_id":"debug"}'
   ```

   В ответ должно вернуться `{"ok":true,"id":"m_..."}`.
## Серверное API

PHP‑прокси для Google Apps Script теперь расположен в `server/api/marker_api.php`.
Заголовок `Access-Control-Allow-Origin` больше не жёстко прописан: при отсутствии ограничений возвращается Origin клиента, либо проверяется белый список из `server/config.php` (переменная окружения `MARKER_ALLOWED_ORIGINS`).

Прокси передаёт HTTP‑код ответа от Google Apps Script и при сетевых сбоях отдаёт `502` с JSON `{ "ok": false, "error": "..." }`.
Клиенту следует проверять `response.ok` и поле `ok` в JSON:

```js
fetch('/server/api/marker_api.php?action=ping')
  .then(async (res) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.error('Proxy error:', data.error);
      return;
    }
    // обработка успешного ответа
  })
  .catch((err) => console.error('Network error', err));
```

## Рейтинг и уровни

Для каждого `client_id` хранится отдельный рейтинг и вычисляемый уровень.
Рейтинг увеличивается:

- при создании собственной метки — на 1;
- при подтверждении или опровержении чужой метки — на величину подтверждения (по умолчанию ±1) как автору, так и подтвердившему.

Шкала уровней:

- 0–9 — «Начинающий пользователь»;
- 10–49 — «Опытный»;
- 50+ — «Профи».

Рейтинг и уровень отображаются в профиле пользователя.

## Статистика пользователя

Для получения сведений о пользователе добавлен эндпоинт `get_user_stats`.  
Он возвращает рейтинг, количество созданных меток и префикс.

Пример запроса:

```
GET /server/api/marker_api.php?action=get_user_stats&client_id=123
```

Пример ответа:

```json
{
  "ok": true,
  "rating": 12,
  "markers": 3,
  "prefix": "Профи"
}
```

Поля:

- `rating` — текущий рейтинг пользователя;
- `markers` — число созданных им меток;
- `prefix` — текстовый префикс, который отображается рядом с именем.

## Тестирование

### Сброс полей модального окна

1. Запустите приложение и нажмите кнопку «+» для открытия модального окна.
2. Заполните поля «Заголовок», «Комментарий», выберите файл и измените значение «Автоистечение».
3. Закройте модальное окно кнопкой «Отмена».
4. Снова откройте модальное окно и убедитесь, что все поля очищены, а «Автоистечение» возвращено к значению по умолчанию (120 минут).

### Профиль: загрузка меток

1. Откройте приложение и сразу перейдите на вкладку «Профиль».
2. Убедитесь, что при первом переходе происходит загрузка меток и раздел «Мои метки» заполняется после завершения запроса.
3. Отключите сеть и снова перейдите на вкладку «Профиль». Должно появиться сообщение «Не удалось загрузить метки».

### Проверка JS-кода

Для статической проверки фронтенд-скриптов используется ESLint.
Установите зависимости и запустите проверку:

```bash
npm install
npm test
```
