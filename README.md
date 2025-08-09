# Маркер — Modern UI v3.9
- Исправлен механизм тёмной темы: явный переключатель (Светлая/Тёмная), жёсткое сохранение в localStorage, авто‑применение при запуске.
- Новый набор **чистых минималистичных SVG‑иконок** для меток (без эмодзи), единый стиль.
- Остальное — как в v3.8 (пресеты карты, минимал/монохром, кастом‑зум, анти‑дубли).
- Проверка загружаемых фото: только изображения размером до 2 МБ.
- В профиле появился раздел «Мои метки» с карточками ваших добавленных точек.
- Введена система рейтинга пользователей и уровней: рейтинг растёт за публикации и подтверждения меток.

## Установка

1. Установите PHP и клонируйте репозиторий.
2. Ключ [Yandex Maps API](https://developer.tech.yandex.ru/) уже прописан в `index.html` (`79bead93-8713-4de9-9dac-484d3aa0980d`); при необходимости замените на свой.
3. Разверните Google Apps Script:
   - откройте <https://script.google.com/>, создайте новый проект и вставьте содержимое `code.gs` (значение `PHOTOS_FOLDER_ID` уже указано: `1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU`);
   - при необходимости измените `SPREADSHEET_ID`;
   - через меню **Deploy → New deployment → Web app** получите URL веб‑приложения.
4. В файле `index.html` замените значение `window.MARKER_CONFIG.GAS_ENDPOINT` на полученный URL веб‑приложения или путь к прокси, например `/server/api/marker_api.php`.
5. В `server/config.php` уже заданы `PHOTOS_FOLDER_ID` и список `MARKER_ALLOWED_ORIGINS` (`https://www.bazzarproject.ru`); замените при необходимости или задайте через одноимённые переменные окружения.
6. Запустите сервер, например: `php -S localhost:8000 -t server`.


### Примеры конфигурации и деплоя

`server/config.php`:

```php
<?php
return [
    'gas_endpoint' => 'https://script.google.com/macros/s/AKfycbwhBNyiokWlf6ifcD7sG0oOhU_xFIQrGBW8ZBDpZa_PmyGdYlQ0HRN0Zqgrn2em6CgSWA/exec',
    'photos_folder_id' => '1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU',
    'allowed_origins' => ['https://www.bazzarproject.ru']
];
```

Команды:

```
export MARKER_GAS_ENDPOINT="https://script.google.com/macros/s/AKfycbwhBNyiokWlf6ifcD7sG0oOhU_xFIQrGBW8ZBDpZa_PmyGdYlQ0HRN0Zqgrn2em6CgSWA/exec"
export PHOTOS_FOLDER_ID="1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU"
export MARKER_ALLOWED_ORIGINS="https://www.bazzarproject.ru"
    'gas_endpoint' => 'https://script.google.com/macros/s/AKfycbyAl3VHgOygkgL6wt9OaG0_xMSZRg0j7kmfBlBeTlMVA6TkpwYAN0j61XggDLYwLqS0/exec',
    'photos_folder_id' => '1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU',
    'allowed_origins' => ['https://www.bazzarproject.ru','https://bazzarproject.ru','http://localhost:8000']
];
```

Команды:

```
export MARKER_GAS_ENDPOINT="https://script.google.com/macros/s/AKfycbyAl3VHgOygkgL6wt9OaG0_xMSZRg0j7kmfBlBeTlMVA6TkpwYAN0j61XggDLYwLqS0/exec"
export PHOTOS_FOLDER_ID="1CDe78tk-Urh35r0GxMHPVDPt9I-dvvrU"
export MARKER_ALLOWED_ORIGINS="https://www.bazzarproject.ru,https://bazzarproject.ru,http://localhost:8000"
php -S localhost:8000 -t server
RSYNC_DEST=user@host:/var/www/marker-webapp ./deploy.sh
```

## Серверное API

PHP‑прокси для Google Apps Script теперь расположен в `server/api/marker_api.php`.
Заголовок `Access-Control-Allow-Origin` больше не жёстко прописан: при отсутствии ограничений возвращается Origin клиента, либо проверяется белый список из `server/config.php` (переменная окружения `MARKER_ALLOWED_ORIGINS`).

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
