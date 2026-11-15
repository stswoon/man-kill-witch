# Bug report S17

## Решение

QA_PASS

Решений `D…` по S17 нет. Допущений, ждущих решения, нет.

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| A1. `play`: HD-панель и bitmap-шрифт; значения обновляются на уровне, при выстреле, подборе и смерти | живой прогон Playwright (1920×1080), display list сцены + `mkw` | 3 объекта HUD, строки по спеке; значения меняются | panel `Image` `hud`, `(0,0)`, 680×120, depth 100, sf 0; два `BitmapText` `hud-font` 35 px, `(20,15)`/`(20,65)`, depth 101, h 40; тексты ровно `LVL 1/8   LIVES 3` / `AMMO 8   SCORE 0`. LVL 1→3→8; выстрел AMMO 8→7; смерть LIVES 3→2→0; победа LVL 8/8, SCORE 1200. `run-ui.json`, `02..09*.jpg` | PASS |
| A2. Подбор: живой подбор аммо/очков | живой прогон: уровень 3, коридор, отстрел walker'ов, прыжок в `(10,6)` | +500 score, тайл исчезает, HUD обновлён | score 400→900 (+500, не +100), `tileAt(10,6)` 330→0, behavior 54→0, ammo 4 без изменений; HUD `AMMO 4   SCORE 900`. Ammo-пикапов (105–109) нет ни в одном уровне — проверен score-пикап. `pickup-final.json`, `10-hud-score-pickup.jpg` | PASS |
| A3. `title` HUD не виден; `gameover`/`win` остаётся | живой прогон + display list | title: 0 объектов; gameover/win: HUD на месте | title `hud.objects=[]`, `bitmapAll=0` (`01`); gameover LIVES 0 (`06`,`07`); win LVL 8/8, SCORE 1200 (`08`,`09`); после рестарта/смены уровней дублей нет (всегда 3) | PASS |
| A4. `npm test`, typecheck, e2e, консоль чистая | команды AGENTS.md + console listener | зелёные, 0 ошибок | test 12 файлов/155 тестов; typecheck оба tsconfig; e2e 19/19 (28.6 s); console/pageerror: 0 ошибок и 0 warning'ов | PASS |
| A5. Ручная 1920×1080: читаемо, в панели, без обрезки; панель не спорит с героем | скриншоты 1:1 + замеры | текст внутри 680×120, глифы целые | canvas 1920×1080; строки 510/570 px от x=20 (край ≤590 < 680); 15..55 и 65..105 < 120; ink-поля глифов left 1 / top 2 / right 1 / bottom 3 px; герой ниже панели (`02-play-full.jpg`) | PASS |
| A6. Фраза о провенансе в стори/PR | чтение | одна фраза | `S17-hd-hud.md:70` — «нарисованы `ui-designer-agent` с нуля по авторским векторным путям…»; коммит `109406a` — «HD HUD panel and bitmap font with provenance note»; шапка `hud.xml` | PASS |
| A7. Провенанс (без трассировки/конвертации/стороннего арта) | декларация + осмотр | заявлено, не противоречит | `hud.xml:2-3`: «drawn from authored vector paths. No installed font, font conversion, tracing, or third-party art»; арт — `ui-designer-agent` (AGENTS.md). Форензика не проводилась | PASS |
| S1. Панель `hud.png` 680×120 | IHDR-декодер | 680×120 | RGBA8, 680×120; непрозрачность 96.5 %; прозрачное — кромка 8 px (2 853 px) + 8 AA-точек внутри; дыр нет | PASS |
| S2. Шрифт: ячейка 25×35, xadvance 30, lineHeight 40, глифы A–Z/0–9/space//, границы | XML + альфа-анализ | 38 глифов, метрики, ink в ячейке | PNG 250×140 (10×4); 38 `<char>`; size 35, lineHeight 40; у всех xadvance 30, offset 0, 25×35; обязательные глифы есть, space пуст; ink-поля ≥1 px; атлас не переполнен; `info spacing=5,5` Phaser игнорирует (xSpacing=0) — живые 30/40 (`assets.mjs`) | PASS |
| S3. Ключи `hud`/`hud-font`, загрузка BootScene | код + живой прогон | ровно эти ключи | `assets.ts:13-14`; `boot-scene.ts:29-30` (`load.image`, `load.bitmapFont`); живые `texture.key=hud`, `font=hud-font` | PASS |
| S4. `hud-view.ts`: строки, позиции, глубины, `scrollFactor(0)`; временный HUD удалён | diff + display list | как в стори | точные строки (3 пробела) без изменений; panel→текст; масштабирования нет; старые `Text`/`Rectangle`/`HUD_STYLE` удалены (`git show 109406a -- web/src/view/hud-view.ts`) | PASS |
| S5. `tests/content.test.ts`: манифест, размер, метрики, глифы, границы | vitest | тесты зелёные | `HUD art`: 6 тестов (ключи, 680×120, 25×35/30/40, набор глифов, границы, широкая строка); `content.test.ts` — 56/56 | PASS |
| S6. Публичный API | код + тесты | без изменений | `SPRITE_NAMES = ["hero","chunk1","chunk2"]`; строки/позиции прежние; панель 680×120, шрифт 25×35 | PASS |
| N1. Нет нижнего/полноэкранного HUD и новых элементов | display list | панель + 2 строки | всегда 3 объекта HUD (`bitmapAll=2`); новых счётчиков нет | PASS |
| N2. HUD без системного шрифта/`Text` | grep + display list | только `BitmapText` | `hud-view.ts` — `Image` + `BitmapText`; `Text` только в `MessageView` (GAME OVER/WIN, вне scope, depth 200) | PASS |
| N3. Не трогать `title1.png`, спрайты, `tiles.png`, `game.ts` | diff S17-части | без изменений | S17-дифф: `hud.png`, `fonts/hud.*`, `assets.ts` (+2), `boot-scene.ts` (+4), `hud-view.ts`, `content.test.ts` (только HUD); прочие правки — S11/S19 | PASS |
| N4. Без EGA и пиксель-арта | осмотр | HD-стиль | панель — HD-градиент/AA, костяные уголки, один красный акцент; шрифт — сглаженные векторные глифы | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `npm test` | PASS — 12 файлов, 155 тестов, 591 ms |
| `npm run typecheck` | PASS — оба tsconfig без ошибок |
| `npm run test:e2e` | PASS — 19/19, 8 workers, 28.6 s |
| `npm run build` | PASS; сервер 5173 (PID 21676, запущен до QA) отдаёт новый бандл, SHA-256 совпал с `build/bundle.js` (5 561 314 байт) |
| `npx vitest run tests/content.test.ts` | PASS — 56/56 |
| Живой сценарий (Playwright, 1920×1080): титул → Space → play → Digit3 (LVL 3/8) → выстрел (AMMO 7) → Digit4 → смерть×3 (LIVES 2, 0; GAME OVER) → Space → Digit8 → дверь (20,42) → WIN | PASS; консоль 0 ошибок; `run-ui.json`, `01..09` |
| Живой подбор: уровень 3, коридор с отстрелом walker'ов (score 400), прыжок в `(10,6)` | PASS; score 900, тайл 330→0, HUD `AMMO 4   SCORE 900`; `pickup-final.json`, `10-hud-score-pickup.jpg` |
| Title / gameover / win | PASS; title — 0 объектов HUD, gameover/win — HUD на месте |

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет — первый заход.

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| Playwright Chromium для живых сценариев (8 запусков) | да | каждый скрипт завершается `browser.close()`; процессов `ms-playwright\chromium` не осталось |
| `npm run test:e2e` (сервер Playwright на 4173) | да | Playwright поднял и остановил сам; 4173 свободен |
| `npm run build` | — | разовая сборка, процесс завершён |
| Dev-сервер 5173 (`node tools/serve.mjs`, PID 21676) | не мой | работал до QA, переиспользован по AGENTS.md; не останавливал |
| In-app browser | — | `browser.disconnected`; вкладок не открывал, UI-сценарий выполнен Playwright-скриптом |

Свидетельства сохранены в `.temp/qa-S17/` (10 JPEG + `assets.mjs`, `run-ui.json`, `pickup-final.json`, `pickup-log.json`).

## Некритичные

- Ammo-пикапов (behavior 105–109) нет ни в одном уровне: живой подбор аммо невозможен по контенту. HUD читает то же `player.ammo`, правило покрыто `tests/game.test.ts` («ammo pickups add a cartridge…»), живой подбор проверен score-пикапом (+500).
- В панели PNG 2 861 прозрачный и 721 полупрозрачный пиксель по кромке 8 px + 8 AA-пикселей внутри; в 1:1 и на скриншотах панель сплошная, артефактов нет.
- Скрытие HUD на title использует `withHud` в `phaser-view.ts`/`game-scene.ts` — вне папок S17, но это часть диффа S11 (`bug-report-S11.md`, D27: `hudPanelCreated=false` на title); S17-дифф ограничен заявленными файлами.
- `MessageView` по-прежнему рисует GAME OVER/WIN системным `Text` (depth 200, вне scope S17).
