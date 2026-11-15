# Bug report S11

## Решение

QA_PASS

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
| --- | --- | --- | --- | --- |
| A1. `game.ts` без Phaser / `phaser-view` / сцен / `arcade/*`; `architecture.test.ts` зелёный | чтение файла, grep, vitest | только `assets` + `sim-contract`; запреты в тесте | импорты `game.ts`: `./assets`, `./sim-contract`; `npx vitest run` по 6 S11-файлам — 64/64; тест содержит оба запрета; `arcade/arcade-sim` импортирует только `game-scene.ts` | PASS |
| A2. Один шаг Arcade на тик `1/70`; тик без `view.render`/`endFrame`; рендер-кадр — один `render` + один `endFrame`; `mkw.tick` — исключение | чтение `game-scene.ts`, живая инструментация на 5174 | steps == rules ticks; renders == endFrame == кадры; `mkw.tick` не рендерит | 1200 мс обычного цикла: frames 72, renders 72, endFrame 72, worldstep 84, ticks 84; `mkw.tick(10)` → worldstep 10, renders 0, endFrame 10; `dx=9.428571` = 660/70; postUpdate 84 = тиков | PASS |
| A3. Прыжок 2 тайла и не 3, подъём 200–250; бег 660, трение 9000, макс. падение 2600, стены/края | стенд `mkw.tick` на level 1/4/8 + e2e | числа `02-gameplay.md` §3 | прыжок: rise 219 px, apex 21-й тик (0.30 с), земля на 42-м; бег 660 за 10 тиков; трение шаг 128.571=9000/70, 0 за 6 тиков; падение 2600; стена 740 `blocked.right`, слева 160 (e2e); bounds: x=-50→0 `blocked.left`, y>карты→4440=4560-120 `blocked.down` | PASS |
| A4. Пули: 1900, жизнь 40 тиков + `despawnBullet` | стенд + `tests/game.test.ts` + ручной выстрел | тело 15×10, скорость 1900, жизнь 40, удаление | body 15×10, vx 1900; исчезает на 40-м тике (39 опроса); тест `despawnBullet`; реальное попадание в walker level 4: +100, ammo 7; о стену гаснет | PASS |
| A5. Враги 130/150/200/170, тела 60×60 | стенд по всем 8 уровням + e2e | скорости и размеры `02-gameplay.md` §5 | по уровням встречены все четыре скорости; `walkerVx` 130/150/200, `flyerVx` 170; размеры только 60×60; e2e: разворот у стены level 4, скорость 150; юнит: ledge/стены/flyer-пробы | PASS |
| A6. `npm test`, typecheck, `test:e2e`, детерминизм, консоль, канвас | команды из AGENTS | всё зелёное | `npm test`: 11 файлов/148 тестов на S11-дереве, на текущем 12/155; `npm run typecheck` — pass; `npm run build` — pass; e2e 17/17 (S11), полный текущий 19/19; replay-тест детерминизма; консоль 0 error/0 warning; canvas 1920×1080, 16:9 | PASS |
| A7. `AGENTS.md`, `README.md`, `docs/design.md` обновлены; `mkw.tick`/`mkw.snapshot` документированы | diff | структура, правила, тесты, `mkw` | diff: `AGENTS.md` — структура, правила Arcade, тесты, `mkw.tick/snapshot`; `README.md` — таблица структуры; `docs/design.md` — строка про Phaser Arcade Physics (S11, D8) | PASS |
| A8. Дверь S10 и анимации S06 без регрессий; статичная дверь и `door-open` | ручной UI + e2e | статичный блок до триггера, 2×3 очистка, спрайт, 15 тиков, переход | level 4: статичная дверь видна (03-damage.jpeg); триггер `{3,12,0,0}`, тайл 597→0, спрайт `(160,880)` anim `door-open`; через 15 тиков level 5 `4480`; e2e S10 зелёный; `hero-idle/run/jump` наблюдались | PASS |
| A9. Никаких новых runtime-зависимостей | `package.json`, git status | только Phaser/esbuild/TS | `package.json` не изменён: dependencies `esbuild`, `phaser`, `typescript` | PASS |
| D27. Числа в `sim-contract.ts`; HUD не на титуле; `lives` clamp 0 и урон после `gameOver` игнорируется; flyer без tile-коллизий; `TILE_BIAS=80`; фабрики `TickCommands` нет | чтение + стенд + тесты | решение D27 | числа 4900/660/7000/9000/1500/2600/1900/40/8/26/8 и тела 60×120/60×60/15×10 — совпадают с `02-gameplay.md`; на титуле `hudPanelCreated=false` (скриншот 01), в play HUD есть; `lives=Math.max(0,…)`, guard `!gameOver`, тесты «ends the game…»/«ignores further touches…»; flyer `gravity=false,bounds=false`, tile-коллизии пропускаются; runtime `TILE_BIAS=80`; фабрики команд в `helpers.ts` нет — единственный источник `Game.update` | PASS |
| D28. Arcade world bounds, rules-телепорт не возвращать | чтение + стенд | игрок/наземные враги не покидают карту; `y=2*TILE` нет | world bounds 5120×4560; player body `collideWorldBounds=true`; стенд: x=-50→0 `blocked.left`, y>карты→4440 `blocked.down`; в `game.ts` нет `clampPlayer`/`2*TILE`; текст `02-gameplay.md` §3 синхронизирует analyst (по D28), код S11 не меняется | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
| --- | --- |
| `npm test` (S11-дерево) | 11 файлов / 148 тестов, pass |
| `npm test` (текущее дерево с S19) | 12 файлов / 155 тестов, pass |
| `npx vitest run tests/architecture.test.ts tests/player.test.ts tests/enemy.test.ts tests/game.test.ts tests/smoke.test.ts tests/level.test.ts` | 6 файлов / 64 теста, pass |
| `npm run typecheck`; `npm run build` | pass (текущее дерево) |
| `npm run test:e2e` (8 workers) | 1-й прогон 17/17; 2-й под нагрузкой 16/17 (timeout 30 s `game.spec.ts:64`); серийный повтор и `--workers=2` — зелёный |
| `npx playwright test e2e/game.spec.ts --workers=1 --repeat-each=3` | 12/12 pass |
| `npx playwright test e2e/physics.spec.ts e2e/game.spec.ts --workers=2` | до S19 17/17; после S19 16/17 из-за артефактного `browserContext.close ENOENT …recording.network` (без провала проверок), серийно `physics` 13/13 + `game` 4/4 |
| `npx playwright test --workers=2` (полный, текущее дерево) | 19/19 pass (17 S11 + 2 S19 bot-api) |
| Живая инструментация цикла на 5174 | frames 72 / renders 72 / endFrame 72 / worldstep 84 / tick 84 за 1200 мс; `mkw.tick(10)` — 10 worldstep, 0 render, 10 endFrame |
| Ручной UI (`npm run dev`, 5174, обычный цикл): титул → Space → play; бег/прыжок/приземление/выстрел; level 4 урон и дверь; цифры 1–8 | все сценарии прошли; canvas 1920×1080; консоль 0 error/0 warning |
| Свидетельства | `.temp/qa-S11/01-title.jpeg`…`05-level1-hud.jpeg`, `server.log`, `e2e-run2.log` (JPEG, css scale) |

Скриншот двери снят с паузой `mkw.phaser.loop.sleep()` на `step 0` (15 тиков ≈ 0.21 с иначе не поймать), после `wake()` обычный цикл сам довёл переход до level 5; остальные ручные проверки — без паузы и ускорения. Порты: 5173 был занят до QA (PID 21676) — не трогал; свой сервер поднял на 5174, 4173 освобождал перед e2e. Ручной сценарий снят на S11-сборке (S16/S17 в дереве); после появления параллельной S19 S11-тесты и полный набор перепрогнаны на текущем дереве.

## Блокеры

| ID | Приёмка / TC | Шаги | Ожидание | Факт |
| --- | --- | --- | --- | --- |
| — | — | — | — | нет |

## Исправленные блокеры прошлых прогонов

Первый прогон S11, блокеров не было.

## Уборка

| Что запускал | Остановлено | Комментарий |
| --- | --- | --- |
| `npm run dev` (build + serve), 5174 (PID 33056, npm 35708) | да, `Stop-Process`; порт 5174 свободен | запускал только я; 5173 не трогал |
| Playwright webServer на 4173 | да, автоматически после прогонов; порт свободен | все e2e завершены |
| Playwright MCP browser tab | да, закрыт (`browser_tabs close`) | скриншоты и замеры сохранены |
| Фоновые shell-задачи (dev; e2e run2) | завершены/остановлены | процессов `@playwright/test` и serve/watch не осталось |
| Сервер 5173 (PID 21676) | не мой, не останавливал | был занят до QA и слушает на финальной проверке; я его не запускал и не трогал |
| `.temp/qa-S11/` | сохранено | логи и 5 JPEG-скриншотов |

## Некритичные

1. `docs/spec/02-gameplay.md` §4 всё ещё говорит «проверка по центру пули», а Arcade проверяет AABB 15×10; документационная синхронизация (преамбула спеки: при расхождении прав код), на числа/приёмку не влияет. Кандидат analyst'у вместе с D28.
2. `LevelView.patch` для `index>0` вызывает `putTileAt`, а Phaser `PutTileAt` сбрасывает collision-флаги, выставленные `ArcadeSim`. Сейчас `game.ts` порождает только `index:0`, поведение недостижимо; поправить до первого ненулевого патча.
3. На нагруженной машине e2e с 8 workers дал timeout и артефактный `ENOENT`; серийно и `--workers=2` стабильно зелёный. Для локальных прогонов рекомендую `--workers=2`.
4. Параллельно в дереве появилась S19 (`web/src/bot/*`, `mkw.bot`, bot-api e2e, AGENTS-раздел). S11-матрица на неё не опирается; на текущем дереве S11-тесты и полный набор зелёные, S19 отдельно не ревьюил.

Бюджет: отчёт 11.0 КБ — плотная матрица из 11 строк с числовыми свидетельствами; длинных полотен и встроенных изображений нет, они в `.temp/qa-S11/`.
