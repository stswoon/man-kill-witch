# Bug report S04

## Решение

**QA_PASS**

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| A1 `npm run test:e2e` проходит; новые тесты стабильны | полный прогон + повтор | все тесты зелёные, физика не флакует | `npm run test:e2e` — 10/10 за 4.3 с (6 physics + 4 game); `npx playwright test e2e/physics.spec.ts --repeat-each=5` — 30/30 за 11.4 с; порт 4173 перед прогонами свободен | PASS |
| A2 Тесты не зависят от fps: после `keyboard.press/down` шагает только `mkw.tick` | код + рантайм-проба | в `boot()` loop остановлен до ввода; вне `mkw.tick` состояние не меняется | `e2e/physics.spec.ts:32-39` — `mkw.phaser.loop.sleep()` после клика; в спеке нет `waitForTimeout`/`Date`/`poll`; проба: `loop.running: true→false`, после `startLevel+tick(30)` за 500 мс реального времени x/y без изменений (148.857 → 148.857) | PASS |
| A3 `npm test` | `npm test` | зелёный | 7 файлов / 101 тест passed, 380 мс | PASS |
| A4 `npm run typecheck` | `npm run typecheck` | без ошибок | `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.test.json`, вывода нет, exit 0 | PASS |
| A5 Поведение игры в браузере не изменилось; консоль чистая | ручной сценарий в Chromium на http://127.0.0.1:5173 (pre-existing dev-сервер, PID 43528) | title→play, ходьба, прыжок ~46 px, выстрел, рендер, чистая консоль | Space: title→play. Ходьба: x 66→115.37 за 400 мс, `vx=132`. Прыжок с площадки спавна: rise **43.8 px**, приземление `onGround=true`, y=536.886, `vy=0`. Выстрел: ammo 8→7. Рендер на месте (скриншоты 02/03, HUD LVL 1/8, AMMO 8→7). `mkw.tick(5)` в живом цикле не ломает его: затем x 119.29→148.78. Console/pageerror за загрузку, игру, прыжок, `tick` — **0 сообщений** | PASS |
| A6 `AGENTS.md` документирует `mkw.tick` | чтение файла | метод в списке `window.mkw` рядом с `step` | `AGENTS.md:119-123`: `mkw.tick(n, dt?)`, «ровно n фиксированных шагов без рендера», «сбрасывает одиночные нажатия после каждого шага», «только для e2e», «обычный цикл он не меняет» | PASS |
| A7 Публичный API: `tick(count, dt?)` есть, `step(dt)` сохранён | код | оба в `window.mkw` | `game-scene.ts:19,60-61`: `step` без изменений, `tick: (count, dt?) => this.tick(count, dt ?? DT)`; `typeof mkw.tick === "function"` в браузере; `mkw.step` использован в пробах и работает | PASS |
| A8 `mkw.tick`: ровно count шагов `step`, после каждого `endFrame`, без рендера, обычный цикл не тронут | код + рантайм | контракт scope стори | `game-scene.ts:100-106`; рендера в методе нет; `update()` (66-75) по-прежнему `render`+`endFrame` раз за кадр. Проба: monkey-patch `mkw.renderer.render` → `mkw.tick(5)` дал **0** вызовов рендера | PASS |
| A9 5 сценариев в `e2e/physics.spec.ts` | чтение спека | прыжок 40–50 px и 2–3 тайла; нет 2-го прыжка; vx=132 за 10 тиков; приземление без провала; повторяемость | `physics.spec.ts:66,96,120,136,150,178`: прыжок 43.8 px (2.74 тайла); `vx=132` ровно; `onGround` и ступни в пределах 1 px от пола; повторный прогон — те же x/y/vx/vy; всё зелёное 5× | PASS |
| N1 Нет тестовых веток в `game.ts` | grep + mtime | `game.ts` не менялся под e2e | В `web/src/game.ts` нет `mkw`/`e2e`/`debug`/тестовых проверок; mtime 15:31Z — раньше правок S04 (19:00Z) | PASS |
| N2 `GRAVITY`, `RUN_SPEED`, `JUMP_SPEED` и др. не менялись | сверка констант со спекой | 980 / 132 / 300 и др. | `game.ts:11-17`: 980, 132, 1400, 1800, 300, 520, 380 — совпадает с `docs/spec/01-architecture.md:109`; `game.ts` в S04 не тронут | PASS |
| N3 Нет `Math.random` в ожиданиях теста | grep `e2e/` | отсутствует | В `e2e/*.ts` нет `Math.random` (и `waitForTimeout`, `Date.now`, `setTimeout`, `performance.now`); `Math.random` есть только в `game.ts:199` (phase флаера, pre-existing и вне зоны S04) | PASS |
| N4 Нет зависимости от реального времени/рендера | чтение спека + проба | шаги только через `mkw.tick` | После `keyboard.press/down` спек вызывает только `mkw.tick` (внутри `page.evaluate`), без ожиданий симуляции; замороженный loop не двигает состояние (A2) | PASS |
| N5 Папки S04: только `game-scene.ts`, `e2e/`, `AGENTS.md` | mtime/содержимое | вне scope не правилось | S04-следы только в этих трёх путях; `tests/*` не новее 16:10Z, в `game.ts`/`input.ts`/`phaser-view.ts` S04-маркеров нет (правки `phaser-view.ts`/`assets.ts` — параллельные S01–S03) | PASS |
| D13 Заморозка Phaser-loop в `boot()` через существующий `mkw.phaser.loop.sleep()` | код + рантайм | loop остановлен, production API не расширен | `e2e/physics.spec.ts:36-38`; в браузере `typeof loop.sleep === "function"`, `loop.running` true→false; после заморозки `startLevel`/`tick` работают, дрейфа нет. Новых production-методов нет (только `mkw.tick` по стори) | PASS |
| D14 `count` нормализуется `Math.max(0, Math.floor(count))` | код + рантайм с движением | дробное вниз, отрицательное → 0 | Loop заморожен, ArrowRight удерживается: после 30 тиков (x=117.257, vx=132) `tick(2.9)` → x=**121.028571**; `tick(2)` → x=**121.028571** (равно); `tick(0)+tick(-5)+tick(-100)` → x без изменений; `tick(30)` (dt по умолчанию) == `tick(30, 1/70)` → x=148.857142 в обоих | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `npm test` | 7 файлов, 101 тест passed, 380 мс |
| `npm run typecheck` | exit 0, без ошибок |
| `npm run test:e2e` (порт 4173 свободен) | 10 passed (4.3 с) |
| `npx playwright test e2e/physics.spec.ts --repeat-each=5` | 30 passed (11.4 с) |
| Мутационная чувствительность без правки production: 1×Space + 70× `mkw.step(1/70)` (без `endFrame`) | y=492.914 (43.9 px над полом), `vy=22`, `onGround=false` — тест «single Space press» упал бы (`abs(Δy)>1`) |
| То же, но 70× `mkw.tick(1)` | y=536.886, `vy=0`, `onGround=true` — тест проходит; подтверждает, что ассерт ловит отсутствие `endFrame` |
| Ручной UI-сценарий (Playwright MCP, chromium, 127.0.0.1:5173): title → Space → ходьба вправо 400 мс → прыжок → Ctrl-выстрел → `mkw.tick(5)` → ещё ходьба | title→play; dx=49.37, vx=132; jump rise=43.8, приземление; ammo 8→7; после `tick` игра двигается и рендерится; 0 console/pageerror |
| Консоль (все типы сообщений, загрузка+игра+ввод) | 0 сообщений |
| Скриншоты | `.temp/qa-S04/01-title.jpeg`, `.temp/qa-S04/02-play.jpeg`, `.temp/qa-S04/03-after-actions.jpeg` (JPEG, кроп канваса) |

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет (первый заход).

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| `npm run test:e2e` / `npx playwright test --repeat-each=5` | да | Playwright сам поднял и остановил webServer; после прогонов 4173 свободен |
| Playwright MCP вкладка (http://127.0.0.1:5173) | да | вкладка закрыта, остался `about:blank`; лишний page из пробы закрыт в сценарии |
| Dev-сервер 5173 (PID 43528, `npm run dev` с 20:23) | не трогал | существовал до меня; переиспользован, не останавливал |
| Свои фоновые процессы/watchers | нет | не запускал |

## Некритичные

- `mkw.tick(Infinity)` зациклится (`Math.floor(Infinity)=Infinity`); D14 покрывает только дробные/отрицательные, метод отладочный — на блокер не тянет.
- У Phaser 4 у TimeStep нет свойства `sleeping` (оно `undefined`); признак остановки — `loop.running === false`. На D13 не влияет: `loop.sleep()` работает.
- Наблюдение для будущих QA: прыжок после захода под дверную раму (x≈7, ряд 33) ограничен потолком и даёт rise ≈8 px; тест прыгает со спавна (x=66), где 43.8 px — это геометрия уровня, не дефект.
- A/B-контроль в тесте «Space in the air…» перезапускает уровень в воздухе; это безопасно (создаётся новый `Game`), стабильность подтверждена 5 повторами.
