# Bug report S12

## Решение

**QA_PASS**

Первый заход. Блокеров нет; все пункты приёмки закрыты свидетельствами, включая ручной
сценарий GAME OVER → Space. Решений `D…` по S12 нет; допущений и нестыковок не осталось.

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| A1. Старт | `createRun()` + `GameScene.startRun`; unit `Run state`; ручной титул → Space | 3 / 0 / 5000 | `game.ts:45-47`; `tests/game.test.ts:62-71`; ручной Playwright: `title → Space` → `state=play, lives=3, score=0, nextExtraLife=5000`, уровень 1 `5120×4560` | PASS |
| A2. Переход уровня сохраняет run | Реальная дверь уровня 4 (индекс 3) → уровень 5; unit «the next level continues the same run»; e2e `advanceLevel carries the run` | очки, жизни, порог переносятся | Ручной: preset `2 / 1200 / 10000` → после двери `lives=2, score=2200` (1200 + бонус 1000), `nextExtraLife=10000`, уровень 5 `4480×9200`; `tests/game.test.ts:126-136`; `e2e/game.spec.ts:105-143` | PASS |
| A3. Смерть внутри уровня | unit `death costs a life…`, `the last death ends the run…`; ручной GAME OVER от врага | `lives--`, очки/порог целы; при 0 — game over | `tests/game.test.ts:96-124`: `2/3000/10000` → `1/3000/10000`, respawn; `1/1234/5000` → `0/1234/5000`, `gameOver=true`; ручной: контакт с walker при `lives=1` → `state=gameover, lives=0` | PASS |
| A4. Game over → Space | Ручной UI: уровень 4, `run.lives=1`, реальная смерть от walker, затем Space | текущий уровень, 3 / 0 / 5000 | `02-gameover.jpg` (LVL 4/8, LIVES 0, GAME OVER/PRESS SPACE) → Space → `state=play`, LVL 4/8 `1920×1360` (текущий), `lives=3, score=0, next=5000`; `03-gameover-restart.jpg` | PASS |
| A5. Win / титул | Ручной win на уровне 8 → Space; титул → Space; e2e `win restarts level 1 with a fresh run` | уровень 1, 3 / 0 / 5000 | Win-экран держит run `4/4321/10000` (`04-win.jpg`); Space → уровень 1 `5120×4560`, `3/0/5000`; титул → Space → уровень 1 `3/0/5000`; `e2e/game.spec.ts:145-196` | PASS |
| A6. Цифры 1–8 / `mkw.startLevel(n)` | Ручной `Digit3` и `mkw.startLevel(2)`; e2e reset-часть `advanceLevel carries the run and startLevel resets it` | новое прохождение с уровня `n`, 3 / 0 / 5000 | После preset `2/777/10000` `Digit3` → уровень 3 `4800×6400`, `3/0/5000`; `mkw.startLevel(2)` → `3/0/5000`; `e2e/game.spec.ts:135-142` | PASS |
| A7. `mkw.advanceLevel(n)` переносит run | e2e + ручной | те же lives/score/nextExtraLife | e2e: `2/4321/10000` → `2/4321/10000`; ручной: `advanceLevel(1)` → уровень 2 `6400×3200`, `2/4321/10000`; `game-scene.ts:84-85,131-133` | PASS |
| A8. Команды | `npm test`, `npm run typecheck`, `npm run test:e2e`, `npm run build` | всё зелёное; e2e перехода зелёный | 12 файлов / 164 теста; typecheck без вывода (exit 0); Playwright 24 passed (38.7s), в т.ч. `advanceLevel carries…`, `win restarts…`; build exit 0 | PASS |
| A9. `docs/design.md` «Правила» | Сверка текста с кодом | соответствует | `design.md:66-69` (run 3/0/5000, перенос, смерть/game over, +100/+1000, каждые 5000) и `77-79` (источники нового прохождения, `mkw.startLevel`/`advanceLevel`) = `game.ts:45-47,294-297,452-456`, `game-scene.ts:122-133,192-198,225,237` | PASS |
| A10. `AGENTS.md` | Сверка с `docs/spec/01-architecture.md` §6 | `startLevel` — новый run, `advanceLevel` — тот же run | `AGENTS.md:179-182`: «`mkw.startLevel(n)` — перезапуск уровня `n` (0-based) с новым прохождением; `mkw.advanceLevel(n)` — переход на уровень `n` с тем же `RunState` (для e2e)» — совпадает со спекой §6 (строки 208-209); владелец `RunState` добавлен в таблицу структуры | PASS |

### Негативные требования и архитектура

| Проверка | Факт / свидетельство | Результат |
|---|---|---|
| Не менять Arcade, двери, уровни, арт | `git diff` S12: только `game.ts`, `game-scene.ts`, `tests/*`, `e2e/game.spec.ts`, `AGENTS.md`; `interact/openDoor/advanceDoor`, `arcade/*`, `levels/*`, спрайты не изменены | PASS |
| Нет сохранения на диск/localStorage | В `game.ts`/`game-scene.ts` нет `localStorage`/`sessionStorage`/`indexedDB`/`fetch`/`fs`; run живёт в поле `GameScene.run` и теряется при reload (`createRun()` в `create`) | PASS |
| Числа очков/жизней/порога не изменены | `START_LIVES=3`, `EXTRA_LIFE_SCORE=5000`, +100/+1000 и +250/+500 не тронуты; diff — только перенос в `RunState` | PASS |
| Строки `design.md` про дверь (S08) и физику (S11) не тронуты | `design.md` в рабочем дереве не изменён; blame: дверь — `e881bdfc`, таблица физики — базовая ревизия | PASS |
| Слои | `tests/architecture.test.ts` (в составе 164) — `game.ts` без Phaser/сцен/arcade/DOM; run-структура без дублей: `lives`/`score` — геттеры/сеттеры в `run`, отдельного порога в `Game` нет | PASS |
| HUD/бот не сломаны | `hud-view.ts:41-42` читает `game.lives`/`game.score` через сохранившийся API; скриншоты показывают LIVES/SCORE; bot-smoke и `bot-api.spec.ts` зелёные | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `npm test` | 12 файлов, 164 теста — passed |
| `npm run typecheck` | exit 0, ошибок нет |
| `npm run test:e2e` | 24 passed (workers=1, 38.7s); сервер 4173 переиспользован (PID 36036, запущен до меня) |
| `npm run build` | exit 0 |
| Ручной UI (Playwright Chromium, обычный цикл x1, без `setSpeed`) | титул, реальная дверь, `Digit3`, `advanceLevel`, `startLevel`, extra life, GAME OVER → Space, win → Space — значения выше; console/pageerror: 0 |

Ускорение состояния (dev-флаги): `mkw.startLevel`, `mkw.advanceLevel`, preset `run.lives/score/nextExtraLife`,
`game.levelComplete` для win; смерть и переход через дверь — реальные (x1). Скриншоты:
`.temp/qa-S12/01-title.jpg`, `02-gameover.jpg`, `03-gameover-restart.jpg`, `04-win.jpg`.

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет (первый заход).

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| `npm run test:e2e` (Playwright) | да | прогон завершён, воркеры/браузеры Playwright закрыты; webServer не поднимал — переиспользован существующий |
| Playwright MCP Chromium (ручной UI) | да | вкладка `127.0.0.1:4173` закрыта, `browser_close` выполнен; Chrome-процессы 20:15–20:17 завершены |
| In-app browser (вкладка для UI) | да | вкладка `tab_7431…` закрыта, других вкладок не осталось |
| `npm run build` | n/a | сборка завершилась, фоновых процессов не оставляет |
| `tools/serve.mjs` PID 36036, порт 4173 | нет | запущен до меня (20:02), не мой; переиспользован для e2e/ручного UI |
| `tools/serve.mjs` PID 15192, порт 5173 | нет | запущен до меня (20:06), не мой; не использовался |
| git-операции/коммиты | — | не выполнялись; дерево не мутировал |

## Некритичные

1. `docs/design.md:66-68,77-79` (текст про run) уже лежит в HEAD-коммите `e6e331a` (S20), а не в
   рабочем diff S12: содержимое верное и совпадает с кодом, но Lead стоит учесть это в учёте
   коммитов.
2. `Game` конструктор по умолчанию создаёт `createRun()`, если run не передан: удобно для тестов,
   но забытый аргумент на новом call-site молча даст новое прохождение вместо ошибки компиляции.
   Сейчас единственный production call-site — `GameScene.loadLevel`.
3. `tests/helpers.ts:106-108` дублирует дефолты 3/0/5000 вместо `createRun()` — возможен дрейф
   чисел между helper и правилами.
4. Инструментальная заметка: in-app browser на `127.0.0.1:4173` поднял канвас и загрузил ассеты,
   но `window.mkw` не появлялся (console пуст); тот же URL в Chromium Playwright (среда e2e)
   работает — воспроизведено как особенность in-app браузера, не дефект игры.
