# Bug report S01

Стори: `docs/plan/S01-view-modules.md` — разделить `phaser-view.ts` на view-модули.
Режим: первый заход. Решений `D…` по стори нет («нет»). Допущений и нестыковок, ждущих решения, нет.

## Решение

**QA_PASS**

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| A1 `npm test` | vitest run, дважды (до и после правок S04 в `game-scene.ts`) | зелёный | 7 файлов / 101 тест passed, 23:00:17 и 23:12:00 | PASS |
| A2 `npm run typecheck` | tsc ×2 конфига, дважды | exit 0 | без вывода, exit 0 | PASS |
| A3 `npm run test:e2e` | playright, дважды | зелёный | 10 passed (4.1 s; повтор 5.1 s), включая `e2e/physics.spec.ts` (S04) | PASS |
| A4 `npm run build` | esbuild | успех | OK; `build/bundle.js` 5 526 515 B, SHA256 `EFDE0150…F9FDF55`, воспроизведён байт-в-байт при повторной сборке | PASS |
| A5 Титул, HUD и уровень 1 визуально не изменились | A/B: HEAD-версия `phaser-view.ts` (без `view/`) vs рабочее дерево, одинаковые ассеты; 7 состояний; SHA256 canvas | картинки идентичны | 7/7 пар PNG совпали побайтно: title `c3c079fb…`, level1 `77fcae0e…`, running `7fc7a256…`, jumping `5110ef8f…`, shooting `5bb5de8c…`, message `eb732ca2…`, afterPatch `5bb5de8c…` (`.temp/qa-s01/ab-report.json`, `current-*.png`/`baseline-*.png`) | PASS |
| A6 Перенос один-в-один: кадры, координаты, глубины, строки HUD, тайминги | A/B-дамп display list в тех же 7 состояниях: type/texture/frame/x/y/depth/visible/flipX/alpha/origin/scrollFactor, TextStyle, полная матрица индексов tilemap, camera scroll, tick, player, HUD-текст | дампы идентичны | 7/7 дампов `same: true` (структурно 67 объектов в игре, порядок совпадает) | PASS |
| A7 В фасаде нет логики отрисовки, только композиция | чтение файла + `Select-String` по draw-API | ни одного вызова отрисовки | 58 строк; `add.`/`setTexture`/`setPosition`/`setDepth`/`tilemap`/`setScroll`/`fontFamily`/`setText`/`fillStyle` не найдены (только слова в комментариях 42/48); 7 методов — делегирование | PASS |
| A8 `game.tick` используется ровно там же | grep + сравнение с HEAD | чтение в `render`, как раньше | HEAD читал `game.tick` в `render` (drawPlayer/drawEnemies); сейчас единственное чтение — `phaser-view.ts:55` внутри `render`, передаётся в `CharacterView`; `game.ts` не тронут (mtime 19:31, нет в git status); формулы `/5`, `/8` и физические числа в дампах/тестах совпали | PASS |
| A9 Публичный API `PhaserView` сохранён | чтение + прогон | конструктор + `showTitle/hideTitle/showMessage/hideMessage/buildLevel/patchTiles/render` | все 8 присутствуют, сигнатуры прежние; в UI прогнаны `showTitle` (boot), `hideTitle` (старт), `showMessage/hideMessage` (GAME OVER + явный вызов), `buildLevel` (старт/цифры/повтор), `patchTiles`, `render` (каждый кадр) | PASS |
| A10 Только разрешённые папки S01 | `git status --porcelain` + mtime | изменения только `web/src/phaser-view.ts`, `web/src/view/**` | так и есть: ` M web/src/phaser-view.ts`, `?? web/src/view/`. Остальные изменения — чужие пути: `title1.png`/файлы ассетов (S02/S03), `assets.ts`+`tests/content.test.ts` (S02, уже в коммите 9385ca3), `game-scene.ts`+`AGENTS.md`+`e2e/physics.spec.ts` (S04) | PASS |
| A11 Не менять `game.ts`, `game-scene.ts`, ассеты, тесты поведения | git status/diff | S01 их не трогает | `game.ts` вне diff; `game-scene.ts` diff — только `mkw.tick` (S04); тесты поведения не менялись; S01 добавил только новые view-файлы | PASS |
| A12 Без новых зависимостей | `package.json`, lock | без изменений | оба файла не в git status; imports только `phaser`, `../assets`, `import type` из `../game` | PASS |
| A13 Архитектура: `game.ts` без Phaser; view не меняет состояние игры | grep по `web/src` и `view/*` | запреты соблюдены | `game.ts` не импортирует phaser/view/scenes; в `view/*` игра импортируется только `import type`; присваиваний `game.* =` нет (spec `01-architecture.md:31`) | PASS |
| A14 Повторные `buildLevel`/`patchTiles` | прогон в браузере | без утечек и ошибок | 9 перестроений уровня: children 67→67; `patchTiles` ставит тайл 7 и убирает его; `layer.depth = 0`; консоль пуста | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `npm test` | 7 files / 101 tests passed (23:00:17, 23:12:00) |
| `npm run typecheck` | exit 0 (23:00:19, 23:12:00) |
| `npm run test:e2e` | 10 passed (23:00:35, 23:12:09) |
| `npm run build` | OK; bundle SHA `EFDE0150…` 5 526 515 B; 4173 после тестов свободен |
| A/B-стенд `.temp/qa-s01/ab.mjs` | HEAD `79ca8ce` (файл `phaser-view.ts` не менялся с `567bc7c`) vs рабочее дерево; baseline-сервер 5201; заморозка `scene.sys.pause()` + seed `Math.random` только в стенде; 7/7 скриншотов и 7/7 дампов идентичны; ошибок консоли 0 на обеих сторонах |
| Ручной UI (chrome-devtools, `http://localhost:5173`, обычный режим, dev-флаги не использовались) | титул → Space → `play`; HUD `LVL 1/8   LIVES 3` / `AMMO 8   SCORE 0`; ArrowRight 700 мс: x 66→148; прыжок: y 537→505, vy −160, onGround false; выстрел: ammo 8→7; Digit2: уровень 2 (1280 px), HUD `LVL 2/8`; позже сам дошёл до GAME OVER — сообщение отрисовано; `list_console_messages` — 0 сообщений, `<pre>` ошибок 0 |
| Скриншоты | `.temp/qa-s01/manual-01-title.jpeg` … `manual-05-level2.jpeg` |

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет (первый заход).

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| Baseline-сервер `node tools/serve.mjs … 5201` (PID 45576) | да | порт 5201 свободен |
| Playwright/сборка на 4173 (два прогона) | да, автоматически | порт 4173 свободен |
| Chrome-страница `chrome-devtools` | да | закрыта через `close_page` |
| Копия HEAD `.temp/qa-s01-baseline` + junction `node_modules` | да | сначала `rmdir` junction, затем каталог; реальный `node_modules` цел |
| Dev-сервер 5173 (PID 43528, существовал до проверки) | нет | не мой, переиспользован; не трогал |
| Watchers / docker / туннели | нет | не запускались |

## Некритичные

- Внешнее: `web/public/assets/title1.png` менялся параллельной S03 дважды во время проверки (23:04:08 и 23:11:23). A/B снят на замороженном снимке (5225 B, SHA `1DE1A1FE…`), синхронизированном в обе сборки; после финального e2e в `build/` уже лежит более новый арт S03. На вердикт S01 не влияет.
- Bundle вырос на 1 357 B (5 525 158 → 5 526 515) из-за обёрток модулей; зависимостей не добавлено.
- `CharacterView.drawBullets` принимает `Bullet[]` вместо `Game` — внутренняя сигнатура, поведение идентично (A/B).
- `HudView.ensureCreated()` стал публичным методом модуля — внутренний API `view/`, фасад вызывает его из `buildLevel`.
- В `.temp/qa-s01/` лежат `diff-*.json` от первого, отброшенного прохода стенда (без заморозки и с гонкой по `title1.png`); итоговые данные — в `ab-report.json`.
