# Bug report S03

## Решение

**QA_PASS**

Прогон 1 (первый заход). Все пункты приёмки и D15 закрыты свидетельствами; блокеров нет. Статус стори, код и тесты QA не менял; добавлен только этот отчёт.

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| S1. PNG `320×200` (IHDR) | Разбор чанков PNG скриптом (`.temp/qa-S03/inspect-title.mjs`) | `320×200`, 8 бит, RGB, без interlace | `IHDR 320×200 bitDepth 8 colorType 2 compression 0 filter 0 interlace 0`, signature ok, чанки `IHDR IDAT IEND` | PASS |
| S2. Имя файла и ключ `title`, 320×200 | Код загрузчика + runtime `mkw.phaser.textures.get("title")` | `assets/title1.png` → текстура `title` 320×200 | `boot-scene.ts:23` без изменений; в браузере `texture.key="title"`, 320×200, canvas backing 320×200 | PASS |
| S3. Непрозрачный PNG, EGA-16, 1 px, без сглаживания | IHDR/чанки + уникальные цвета | Нет альфы; все цвета ∈ EGA; нет AA | colorType 2, `tRNS` нет; 10 цветов, `outsideEga: []` (`#000000` 46482, `#555555` 7152, `#AAAAAA` 4166, `#0000AA` 2481, `#FFFF55` 2001, `#AA0000` 890, `#AA5500` 564, `#FF5555` 240, `#FFFFFF` 21, `#00AA00` 3); у `tiles.png` тот же набор EGA-16. Жёлтые глифы 1989 px, по 663 на каждый остаток `mod 3` → блоки 3×3 (шрифт 5×9) + тень 1 px; 1× канвас = PNG попиксельно | PASS |
| S4. Содержание: ровно `MAN KILL WITCH`, силуэт Сайласа, лес/ведьма, без чужих надписей | Визуальный осмотр PNG/скриншотов (зум 3–4×) | Только эта надпись; шляпа/пальто/дробовик; проклятый лес/ведьма | Подтверждено на `title1x.png`, `shot-title-window.jpg`, `title-hero-3x.png`: шляпа, пальто, шарф, двустволка, фонарь; мёртвый лес, кладбище, ведьма на метле в луне; других надписей/логотипов/копирайтов нет | PASS |
| A1. В браузере на `title` — новый экран, консоль чистая | Playwright: `scenario.mjs` (1250×800) и `canvas-compare.mjs`; сцена `title` | Новый экран, 0 ошибок | `state: title`, видима только `Image texture "title"` (hero-sprite и тексты `visible:false`); console errors `[]`, page errors `[]`, failed requests `[]` (4 GL-warning — только от автоматических скриншотов canvas) | PASS |
| A2. Нет старых персонажей/`DANGEROUS DAVE`/`Softdisk`/`HAUNTED MANSION`/логотипов | Визуальное сравнение с артом из `HEAD` (`old-title1.png`) и старым скрином; поиск строк в `web/**/*.ts` и `index.html` | Ничего из старого | Новый экран полностью другой: старый герой в красной кепке, `DANGEROUS DAVE`, `Softdisk`, `HAUNTED MANSION` отсутствуют; строк в коде нет | PASS |
| A3. `MAN KILL WITCH` читается при 1× и 2× | Скрипт в браузере: viewport 320×200 и 640×400; кропы надписи 1×/2× просмотрены | Читается | 1×: `title-text-1x-crop.png` (резкий); 2×: `title-text-2x-crop.png` (CSS-билиней, но все буквы читаются) | PASS |
| A4. Фраза о провенансе | Проверка стори/отчёта Dev | «нарисовано с нуля, без трассировки и автоконвертации» | Есть в `docs/plan/S03-title-art.md:49` и в отчёте Dev; PR нет (изменения не закоммичены) | PASS |
| D15. «Без сглаживания» = ассет, CSS-масштаб вне scope | Runtime computed style + 2× скриншот | Ассет без сглаживания; 2× читается | `image-rendering: auto`, backing store 320×200, CSS 640×400; 2× текст читается; ассет без AA (S3). Подтверждает трактовку D15 | PASS |
| N1. Старый `title1/title2` не основа/слой/источник | Сравнение с `HEAD:web/public/assets/title1.png` (`reuse-check.mjs`) + визуально | Нет переиспользования | Старый арт: 13 цветов, 54773 «чернильных» px; новый: 10 цветов, 17518 px. Совпало 7816 px (12.2%): 6570 — чёрный фон, не-чёрных 1246 px (2%); общих фрагментов/элементов нет. `title2.png` в репозитории и `build/` нет | PASS |
| N2. Нет новых надписей, название игры не менялось | PNG-осмотр + `package.json`, `index.html` | Название прежнее | В PNG только `MAN KILL WITCH`; `package.json name: man-kill-witch`; `<title>Man Kill Witch</title>` | PASS |
| N3. Не трогать `BootScene`, HUD, `assets.ts` | `git diff` по файлам + mtime | S03 меняет только `title1.png` | Единственное изменение S03 — `web/public/assets/title1.png` (23:21:24). `git diff` `boot-scene.ts`/`assets.ts` содержит только HUD-строки S07; строка загрузки `title1.png` в текстуру `TITLE_TEXTURE` не изменена; `phaser-view.ts`/`character-view.ts`/`hud-view.ts` — S06/S07 (23:24+) | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `npm test` | 8 файлов / **111 тестов** passed (23:26; Dev сообщал 101 — к моменту QA S06 добавил тесты) |
| `npm run typecheck` | exit 0, ошибок нет |
| `npm run build` | exit 0; `SHA-256 build/assets/title1.png` = `SHA-256 web/public/assets/title1.png` = `c30da292…7526b1b` |
| `npm run test:e2e` | **10 passed** (chromium, включая `boots to the title screen without console errors`) |
| `node .temp/qa-S03/inspect-title.mjs web/public/assets/title1.png` | IHDR 320×200/8/RGB/0/0/0, 10 EGA-цветов, alpha отсутствует |
| `node .temp/qa-S03/canvas-compare.mjs` | 1× canvas `320×200`: **diff 0/64000, max 0** (при скрытом HTML-хинте); 2×: backing 320×200, CSS 640×400, `image-rendering:auto` |
| `node .temp/qa-S03/scenario.mjs` | 1250×800: `state=title`, текстура `title` 320×200, `Space` → `state=play`, титул скрыт; console errors `[]`, page errors `[]`, failed requests `[]` |
| `node .temp/qa-S03/reuse-check.mjs` | совпадение со старым артом 7816/64000 px, не-чёрных 1246; старый и новый арт визуально несвязаны |
| Ручной UI-сценарий | `npm run dev` (5173 занят чужим процессом → **5174**), открыт титул, сняты 1×/2×/окно, Space → уровень 1, консоль без ошибок |

Свидетельства — `.temp/qa-S03/`: JPG-копии `shot-title-window.jpg`, `shot-title-1x.jpg`, `shot-title-2x-canvas.jpg`;
PNG для попиксельной сверки `shot-title-1x-canvas.png`, `shot-title-2x-canvas.png`, кропы `title-text-1x-crop.png`,
`title-text-2x-crop.png`, `title-hero-3x.png`, `title-bottom-3x.png`, `old-title1.png`, `diff-1x.png`; скрипты и лог сервера.
`diff-1x.png` (y=171–192) — HTML-хинт `#hint` поверх канваса при viewport 320×200 (вне S03); без него 1× совпадает попиксельно.

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет (первый заход).

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| `npm run dev` (мой сервер, порт 5174) | Да, `taskkill /PID 12064 /T /F` | Порт 5174 свободен, процессов сборки/сервера не осталось |
| Playwright chromium (3 скрипта) | Да, `browser.close()` в каждом | Контексты/вкладки закрыты |
| Сервер Playwright на 4173 (`test:e2e`) | Да, остановлен раннером | После уборки порт был свободен; позже его занял параллельный прогон другого агента (PID 48720) — не мой |
| Сервер на порту 5173 (PID 43528, `node tools/serve.mjs`, запущен до QA) | Нет — чужой/pre-existing | Не мой процесс, не останавливал |
| Watchers / docker / туннели | Не запускал | — |
| `.temp/qa-S03/` | Сохранён | Свидетельства не удалялись |

## Некритичные

1. **Нет автотеста на IHDR титула:** `content.test.ts` проверяет только существование `title1.png`. QA доказал скриптом; рекомендация — 3 строки в `content.test.ts`, когда дерево освободится (папки S03 — только `title1.png`).
2. **HTML-хинт перекрывает нижние ~12 px канваса** при viewport 320×200 — существующее поведение `index.html`, вне S03; надпись не задевает.
3. **Тёплые акценты:** жёлтая надпись, оранжевый приклад, красный шарф; spec 03 §1 упоминает «один тёплый акцент (шарф героя)», приёмка S03 требует только EGA. Стилистическое замечание, не блокер.
4. **Провенанс — заявление Dev** (PNG не закоммичен, git-истории нет); при создании PR фразу перенести в описание.
5. **Общее дерево менялось параллельно:** S06/S07 правили `animation-catalog`, HUD, `boot-scene.ts`, `assets.ts`, `hud-view.ts`, `character-view.ts`, `content.test.ts` (23:24–23:31), S05 заменил спрайты героя/врагов (23:37, уже после проверок). Полный прогон в 23:26 зелёный; на титул эти правки не влияют.
6. **Цифра Dev «101 тест»** против фактических 111 — следствие параллельной S06, не дефект S03.
