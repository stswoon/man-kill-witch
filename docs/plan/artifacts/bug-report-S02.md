# Bug report S02

## Решение

**QA_PASS**

Проверено: стори `docs/plan/S02-remove-unused-assets.md`, решение D12, отчёт Dev. Прогон сделан на текущем
worktree с незакоммиченными изменениями параллельных S01/S03/S04; на пути S02 они не влияют (детали — «Некритичные»).

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| A1. 10 удалённых файлов отсутствуют в `web/public/assets` | `Test-Path` по каждому пути + `git status --porcelain -- web/public/assets` | Все 10 отсутствуют | `build=False public=False` для всех 10; в porcelain ровно 10 строк ` D` (PROGPIC.bin, STARPIC.bin, title2.png, sprites/s_frank.{png,json}, s_master.{png,json}, s_hero.json, s_chunk1.json, s_chunk2.json) | PASS |
| A2. Тех же файлов нет в `build/assets` после сборки | `npm run build` (exit 0) + листинг + `Test-Path` | Нет ни одного | `build/assets` — 14 файлов (tileinfo, tiles, title1, levels/01..08, 3 спрайта), все 10 удалённых `build=False`; повторено после внешней пересборки 23:00:09 — тот же результат | PASS |
| A3. `npm test` проходит | `cmd /c npm test` | Зелёный | `Test Files 7 passed (7)`, `Tests 101 passed (101)`, 347 ms | PASS |
| A4. `npm run typecheck` проходит | `cmd /c npm run typecheck` | exit 0 | `tsc -p tsconfig.json && tsc -p tsconfig.test.json`, `EXIT=0` | PASS |
| A5. `npm run test:e2e` проходит | `cmd /c npm run test:e2e` (сам собирает build, поднимает 4173 `--strict`) | Все зелёные | `10 passed (4.0s)`: 4 из `e2e/game.spec.ts` (boot без ошибок консоли, run/shoot, Digit-переключение, масштаб) + 6 из `e2e/physics.spec.ts` (S04, внешние) | PASS |
| A6. Консоль чистая | e2e-тест «boots to the title screen without console errors» + ручной прогон: `browser_console_messages` (уровень debug, `all: true`) | 0 ошибок/warning | `Total messages: 0 (Errors: 0, Warnings: 0)`; boot-ошибок `<pre>` нет (`bootError: null`) | PASS |
| A7. Поиск не находит ссылок на удалённые имена (границы D12) | `grep -i` по `web/` и `e2e/`; `Select-String` по `build/bundle.js`, `build/index.html` | 0 совпадений в runtime | `web/` — 0, `e2e/` — 0, `build/bundle.js` — 0, `build/index.html` — 0. Совпадения только в `tests/content.test.ts:20-29`, `docs/spec/03-art.md:60-72`, `docs/plan/*` — D12 разрешает | PASS |
| A8. Используемый арт не изменился | `git status --porcelain -- web/public/assets`, `git diff --stat` | S02 не трогает используемый арт | В диффе S02 только 10 deletions; `tiles.png`, `tileinfo.json`, `levels/*`, `sprites/s_*.png` — без `M`/`D`. Появившийся в 23:00:09 `M title1.png` — параллельная S03 (её scope), к S02 не относится | PASS |
| A9. Уровни не изменились | git-статус + SHA256 `levels/*.json`, `tileinfo.json` ↔ `build/assets` | Без изменений | `levels/*.json` и `tileinfo.json` не в `git status`; 8/8 уровней совпали по хешу, `tileinfo equal: True` | PASS |
| A10. `SPRITE_NAMES` → `["hero","chunk1","chunk2"]`; BootScene грузит только 3 текстуры | `git diff web/src/assets.ts`; сеть и `phaser.textures.list` в браузере | Ровно 3 имени | Диff — одна строка `SPRITE_NAMES`; загружены `s_hero/s_chunk1/s_chunk2.png` (200), текстуры `title,tiles,hero,chunk1,chunk2,bullet`, `frank`/`master` отсутствуют | PASS |
| A11. `tests/content.test.ts`: манифест без удалённых + тест на отсутствие | `npx vitest run tests/content.test.ts --reporter=verbose`; чтение кода | 2 теста манифеста зелёные, новый тест перечисляет 10 путей | `✓ asset manifest > contains every file BootScene loads`; `✓ asset manifest > does not contain the removed legacy files`; `REMOVED_ASSETS` (строки 19–30) = 10 путей, проверка `existsSync === false` (130–134) | PASS |
| A12. Scope-дисциплина (файлы/папки) | `git diff --stat` по путям S02 | Только перечисленные файлы | Изменены `web/src/assets.ts` (1 строка), `tests/content.test.ts` (+20 строк), удалены ровно 10 файлов в `web/public/assets`; `tileinfo.json`, `levels/*.json`, остальные текстуры не тронуты | PASS |
| A13 (D12). «Поиск по репозиторию» = runtime-части | Проверка по границам D12: `web/src`, `web/index.html`, `web/public/assets`, `build`, `e2e` | 0 runtime-ссылок; `docs/spec`, `docs/plan`, сам тест — допустимы | Runtime-части: 0 (A7). Разрешённые упоминания — `docs/spec/03-art.md:60-72`, `docs/plan/S02`, `docs/plan/S03:53`, `tests/content.test.ts:20-29`. Сеть: 14 ассетных запросов, все 200, ни одного удалённого имени | PASS |
| A14. Негатив: используемые текстуры не удалены/не переименованы; бинарники вне списка не тронуты | `git status` по `web/public/assets` | 0 удалений/`M` используемых | Удалены только 10 файлов из списка; `tiles.png`, `title1.png`, `s_hero.png`, `s_chunk1.png`, `s_chunk2.png`, `tileinfo.json`, `levels/*` присутствуют, без `D` | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `cmd /c npm test` | 7 файлов / 101 тест, все passed |
| `cmd /c npm run typecheck` | exit 0 |
| `cmd /c npm run build` | exit 0; `build/assets` — 14 файлов, без удалённых |
| `cmd /c npm run test:e2e` | 10 passed (4.0 s), Playwright сам собрал build и поднял 4173 |
| `npx vitest run tests/content.test.ts --reporter=verbose` | 45 тестов файла passed, оба теста `asset manifest` видны |
| `grep -i` по `web/`, `e2e/`; `Select-String` по `build/bundle.js`, `build/index.html` | runtime — 0 совпадений |
| HTTP-проверка dev-сервера: `/` → 200; `/assets/sprites/s_frank.png`, `/assets/title2.png`, `/assets/PROGPIC.bin` → 404 | Удалённые ассеты не раздаются |
| Ручной UI-сценарий (Playwright MCP, Chromium, `localhost:5173`, обычный режим, без dev-флагов) | title → Space → `play`, `x=66, y=536.8, ammo=8, lives=3`; ArrowRight 500 мс: `x 66 → 128.57`; Control: ammo `8 → 7`; Digit1…8 переключают уровни, размеры совпали с JSON (64×57 … 24×47), HUD «LVL n/8»; консоль 0; сеть: 16 HTTP-запросов (index.html, bundle.js, 14 ассетов) — все 200 плюс 5 `blob:`, к удалённым файлам запросов нет |
| Скриншоты | `.temp/qa-S02/01-title.jpg`, `.temp/qa-S02/02-play-level1.jpg`, `.temp/qa-S02/03-level8.jpg` |
| Регрессия архитектуры (`game.ts` без Phaser) | `web/src/game.ts` — единственный импорт `./assets`; S02 его не менял |

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет (первый заход).

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| Playwright MCP браузер (Chromium) для UI-сценария | Да | `browser_close` → «No open tabs», страница и контекст закрыты |
| Playwright e2e-сервер (порт 4173) | Да | Playwright останавливает `webServer` сам; после прогона `Get-NetTCPConnection -LocalPort 4173` пуст |
| `npm run build` (запись в `build/`) | n/a | Сборка одноразовая, фоновых процессов не осталось; `build/` в `.gitignore` |
| Dev-сервер `http://localhost:5173`, PID 43528 | Нет | Запущен Dev до QA (и до меня), переиспользован; второй сервер не поднимал, чужой процесс не останавливаю |
| Watchers / фоновые задачи | Нет | Не запускал |
| `.temp/qa-S02/` (3 JPEG) | Не удалял | Свидетельства |
| `.temp/playwright/*.yml` (снапшоты MCP), `test-results/.last-run.json` | Не удалял | Созданы инструментами, оба пути в `.gitignore` |

## Некритичные

1. Защитный тест проверяет отсутствие только в `web/public/assets`; `build/assets` проверен вручную сборкой (каталог
   генерируемый).
2. `REMOVED_ASSETS` дублирует перечень из `docs/spec/03-art.md` и стори — при переименовании синхронизировать три
   места; `docs/spec/03-art.md:56-72` сохраняет старые имена, что разрешено D12.
3. Во время QA параллельная S03 перезаписала `web/public/assets/title1.png` (mtime 23:00:09, 9050 → 4413 байт) и
   внешняя сборка обновила `build/assets`; это вне scope S02, проверки отсутствия удалённых файлов перепрогнаны —
   чисто. Скриншот титульного экрана снят до замены (старый временный арт).
4. e2e-набор включает 6 тестов S04 — число прогонов изменится при откате S04, S02 от этого не зависит.
