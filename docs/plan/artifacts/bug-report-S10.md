# Bug report S10

## Решение

**QA_PASS**

До срабатывания — статичные тайлы, после — `s_door.png` 3 кадра; `DoorState` read-only, очистка 2×3
внутри карты, завершение и `+1000` через 15 тиков; `DOOR_FRAMES` удалён. `npm test` (11 файлов /
138 тестов), typecheck, build, `npm run test:e2e` (10/10) зелёные; ручной сценарий с реальными
клавишами и все 8 уровней проверены. Блокеров нет; замечания — в «Некритичных».

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| A1 До срабатывания: тайловая дверь, спрайта нет | Браузер 1920×1080 (CSS 1:1), ур. 4: `game().door`, `DoorView.sprite`; тест «keeps the static door tiles until the trigger» | `door=null`, `visible=false`; тайлы не меняются | `door:null`, `visible:false`, `texture:"door"`, frame 0; `01-before-door.jpeg` — зелёная тайловая дверь; тест: 5 тиков выше двери — 0 патчей, `tileAt(2,11)=DOOR` | PASS |
| A2 Триггер центром в тайле behavior 1/2, без `onGround` | `tests/game.test.ts` + браузер | Открывается без опоры на землю | Тест «…without requiring ground contact»: `onGround:false`, `door={tx:2,ty:11,step:0,timer:0}`; 8/8 уровней — тот же переход | PASS |
| A3 Очистка 2×3 внутри карты + патчи | Юнит-тест + перехват `patchTiles` (ур. 4, 6) | 6 ячеек; вне карты не трогать | Ур. 4: `583,584,596,597,609,610→0`, 6 патчей; ур. 6 `(80,0)`: `(79,-1),(80,-1)` остались `-1`, 4 патча | PASS |
| A4 Шаги/15 тиков/+1000 | Юнит-тест + браузерные тики по 8 уровням | step 1 через 5, step 2 через 10, финал через 15 | `+4`→step0/4, `+1`→step1/0, `+4`→step1/4, `+1`→step2/0, `+4`→step2/4, `+1`→`door:null`; ур. 8: `levelComplete:true`, `score:1000`, `win`; `05-win.jpeg` | PASS |
| A5 View: позиция/origin/depth, play 1 раз, hide | Ревью + runtime + monkey-patch `play` | `(tx-1)*80,(ty-1)*80`, 160×240, origin 0,0, позади персонажей | `x:160,y:880` для `(3,12)`, `w:160,h:240`, origin 0,0, `depth:5` (tilemap 0, пули 10, враги 11, герой 12); `playCalls:["door-open"]`; после перехода/win `visible:false` | PASS |
| A6 Все 3 кадра видны | rAF-монитор `frame.name` + скриншоты на паузе | Кадры 0→1→2 отрисованы | frame 0 (step0/timer0), 1 (step1/timer1), 2 (step2/timer1); `02-frame0.jpeg`/`03-frame1.jpeg`/`04-frame2.jpeg` — закрыта/приоткрыта/открыта | PASS |
| A7 API: `DOOR_TEXTURE`, `door-open`, `Game.door` read-only, `DOOR_FRAMES` нет | Код, дескриптор, grep `src`/`bundle.js` | Геттер без сеттера; `DOOR_FRAMES` отсутствует | Дескриптор: `get:function`, `set:undefined`, присваивание игнорируется; `door` 480×240, frames `0,1,2`; `door-open` `[0,1,2]` 14 fps repeat 0; `DOOR_FRAMES` = 0 | PASS |
| A8 Дверные индексы/уровни/`tileinfo` не изменены | Скрипт по `tileinfo` + 8 уровням, сверка со списком, mtime | Все behavior 1/2 в списке 50 | Все дверные (`634,636,597,49,740,92`) в списке; спека 15.11 15:08, уровни/`tileinfo` 14.11 — до кода S10 (16:17–16:19) | PASS |
| A9 `s_door.png`: манифест, 480×240, 3 кадра, spritesheet | IHDR/декод, `content.test.ts`, runtime | 480×240 RGBA, 3×160×240 | IHDR 480×240, bit 8, colorType 6, interlace 0; alpha 0/255, bbox 4,6–155,238; diff кадров 16218/6550/17454; SHA256 `492653A3…` = `work/`=`public/`=`build/` | PASS |
| A10 Команды и чистая консоль | `npm test`, typecheck, build, e2e; e2e-тест консоли + MCP-консоль | Всё зелёное, 0 ошибок | 11/138; 4 файла/85; typecheck 0; build 0; e2e 10 passed (15.7 s); консоль 0, `<pre>`-оверлея нет; `s_door/tiles/tileinfo/level04` → 200 | PASS |
| A11 Нет старых кадров/Arcade/швов | grep, ревью, пиксельный кроп 1:1/2× | `DOOR_FRAMES`/Arcade нет; спрайт по сетке | `DOOR_FRAMES` только в спеке; Arcade-импортов нет; позиция кратна 80, scale 1; `06-seam-frame0-2x.jpeg`, `07-before-vs-frame0-2x.jpeg` — стык по сетке; поля 1–6 px (N2) | PASS (с N2) |
| A12 Провенанс | `validation.json`, `make-door.mjs`, SVG, стори | Фраза; арт оригинальный | «Drawn from scratch; no tracing…»; `make-door.mjs:1-2`; в SVG нет `<image>`/base64; стори — «оригинальный HD-арт … ui-designer-agent»; явная фраза в validation/отчёте Dev (N4) | PASS (с N4) |
| A13 D24: правка `animation-catalog.test.ts` | Ревью + прогон | `door-open` в ключах, исключён только из loop-проверки, отдельный тест; остальные не ослаблены | `EXPECTED_KEYS` с `door-open`; `continue` только для него; отдельный тест `{start:0,end:2,frameRate:14,repeat:0}`; остальные 14 — `repeat:-1`; 4 файла/85 | PASS |
| A14 D25: depth 5, `DOOR_W/H`, play 1, hide | Код + runtime | `DOOR_DEPTH=5`, 160/240; play 1; hide | `assets.ts` 160/240 в загрузчике/`content.test.ts`; runtime depth 5; play 1; `startLevel`/переход/win → `visible:false` | PASS |
| A15 Негативы: `game.ts` вне двери, `design.md`, 2 кадра | Ревью, mtime, suites, grep | Только дверь; 3 кадра | Дверной блок (`DoorState`, `openDoor`, `advanceDoor`, `interact`) не затрагивает физику/врагов/пули; suites физики/игрока/врагов зелёные; `design.md` 15:09 — до S10; 3 кадра (A6); VCS-диффа нет (N5) | PASS (с N5) |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `npm test` / узкие (`game, content, animation-catalog, architecture`) | 11 файлов / 138 тестов; 4 файла / 85 тестов — зелёные |
| `npm run typecheck` / `npm run build` | exit 0 / exit 0 |
| `npm run test:e2e` | сначала 8 failed / 2 passed (таймауты действий при загруженной машине, N1); `--workers=2` 10 passed (24.8 s); повтор `npm run test:e2e` — 10 passed (15.7 s) |
| M1. Playwright MCP, 1920×1080, DPR 1, CSS 1:1, dev-сервер 5173: клик → `Space` → `Digit4` → реальное удержание `ArrowLeft` до `(3,12)` | Дверь сработала, кадры 0/1/2 отрисованы; через 15 тиков ур. 5 (56×115), `door:null`, `visible:false`; консоль 0; сеть 200 |
| M2. Ур. 8 через dev-хук: `mkw.startLevel(7)`, центр тела в дверь `(20,42)`, 15 тиков | `door:null`, `levelComplete:true`, `score:1000`, `win`, спрайт скрыт; `05-win.jpeg` |
| M3. Все 8 уровней (dev-хук, 15 тиков) | 8/8: static-индекс → step 0→1→2 → `door:null`; ур. 1–7 переходят, ур. 8 — `win +1000` |
| M4. Изоляция view (dev-хук) | Ур. 4 — 6 патчей/6 нулей; ур. 6 — 4 патча, `y=-1` не тронуты; play 1 раз; геттер без сеттера |

Флаги: M1 — реальные клавиши, обычный режим; dev-хуки `mkw.startLevel/game/tick/getState`, перенос
тела к двери и `loop.sleep/wake/resetDelta` — только для быстрого ввода состояния, покадровых
скриншотов и изоляции view; данные/поведение не меняют. Скриншоты (JPEG, css) в `.temp/qa-S10/`:
`01-before-door`, `02-frame0`, `03-frame1`, `04-frame2`, `05-win`, `06-seam-frame0-2x`,
`07-before-vs-frame0-2x`; там же PNG, `browser-evidence.md`, `door-analysis.json`,
`levels-doors.txt`, `asset-hashes.txt`, скрипты и `e2e-1/2/3.log`.

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет (первый заход).

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| Dev-сервер 5173: `node tools/serve.mjs` PID 21676, `npm run dev` PID 56936 | Нет — работал до QA (с 16:12) | Переиспользован, второй не поднимал; 5173 запущен не мной |
| Playwright webServer 4173 | Да | LISTENING на 4173 нет, только TIME_WAIT |
| Playwright MCP браузер (M1–M4) | Да | `browser_close`: вкладок нет; тестовых chromium не осталось |
| `npm run build`, e2e-сборка | Да | `build/` пересобран; watchers/фоновых задач нет |
| Артефакты | — | `.temp/qa-S10/**`, `test-results/**` сохранены |

## Некритичные

- **N1. e2e-флейк при 8 воркерах.** Первый `npm run test:e2e` — 8 таймаутов действий при загруженной
  машине (57 процессов Chrome); `--workers=2` и повтор — 10/10. Ресурсная флейкость, не дефект S10.
- **N2. Прозрачные поля арта.** Поля 1–6 px (bbox 4,6–155,238) после очистки 2×3 дают тёмную рамку
  вокруг HD-двери. Это D9 + validation gutters, не смещение сетки; решение по арту/спеке, не код.
- **N3. Win-экран.** Спрайт скрыт (D25), но очищенный 2×3 остаётся чёрным прямоугольником за
  сообщением (`05-win.jpeg`); так было и со старым очищением, на ур. 1–7 маскируется переходом.
- **N4. Провенанс.** Явная фраза — в `validation.json`/отчёте Dev; в стори — «оригинальный HD-арт».
  Если Lead требует отдельную фразу в стори/PR — добавить при приёмке.
- **N5. Нет VCS-диффа.** Git-операции запрещены; «`game.ts` вне двери» доказано ревью, mtime и
  suites, а не диффом.
- **N6. Нет e2e на дверь** (покрытие — `game.test.ts` + M1–M4) и **N7. смена палитры** статичной
  тайловой двери на HD (`D9`, не регрессия S10) — приняты как есть.
