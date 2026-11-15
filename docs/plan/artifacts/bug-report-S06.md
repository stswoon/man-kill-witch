# Bug report S06

## Решение

**QA_PASS**

## Матрица приёмки

| ID / пункт | Способ | Ожидание | Факт / свидетельство | Результат |
|---|---|---|---|---|
| A1 Герой idle/run/jump | Рантайм Phaser (Chromium, `localhost:5173`), чтение `playerSprite.anims`/`frame`, скриншоты | idle 0; run 1–6 при `abs(vx)>8`; jump 13; текстура `hero` | idle/0 (vx 0) → run/frames 1–6 (vx 132) → jump/13 (onGround false) → после посадки idle/0; `.temp/qa-S06/01-idle.jpeg`, `02-run-right.jpeg`, `03-jump.jpeg`, `probe-result.json` | PASS |
| A2 Все варианты врагов `enemy-2`…`enemy-12` | 8 уровней `mkw.startLevel`, 495 снимков живых врагов: ключ/текстура/кадр/flip/visible/playing | 2–8 → `chunk1` 0–4…30–34; 9–12 → `chunk2` 0–4…15–19 | Все 11 id, 0 расхождений; примеры кадров: 2→0–4, 3→6–9, 6→22/24, 9→1–4, 12→17; `04-level3-enemies.jpeg`, `05-level8-enemies.jpeg`, `probe-result.json` | PASS |
| A3 Смена направления без «дёрганья» | right→left (85 рендеров) + разворот врага | `flipX = facing>0`/`dir>0`, один переворот, без смены текстуры/рестарта | Герой: ровно 1 изменение flip, текстура всегда `hero`, видим 85/85; idle только при `abs(vx)<=8` (спека §3). Враг: dir −1 → flipX false, ключ `enemy-4` тот же, 0 `startAnimation`; `probe3/6-result.json` | PASS |
| A4 В `view` нет выбора кадров по `tick` | `grep` `web/src` (`tick\|setTexture`) + чтение | нет `Math.floor(tick/5)`, `Math.floor(tick/8)`, `setTexture(key,frame)` | В `view/*` и `phaser-view.ts` нет `tick`/`setTexture`; `phaser-view.ts:53-55` — `characters.render(player, enemies, bullets)`; `game-scene.ts:73` передаёт `(sim, levelIndex)`; `tick` остался только в отладочном API | PASS |
| A5 Анимации не перезапускаются каждый кадр | Счётчик `startAnimation` + трассировка кадров | `play(key, true)` не рестартует тот же ключ | Свободный бег: 49 рендеров → **2** старта, кадры `1,2,3,4,5,6,1,…`; враг: **0** стартов на 180 рендеров (3 с); `probe3/4/5-result.json` | PASS |
| A6 Старый и новый арт | Новый — рантайм; старый — спека 05 §2 + старый tick-view | одинаковая раскладка в обоих | Новый арт: все 14 ключей играют. Старый tick-view (`.temp/qa-s01/head-now-phaser-view.ts`): hero 0 / `1+floor(tick/5)%6` / 13, враги `(sprite-2)*5`, `chunk1<35` иначе `chunk2` — те же кадры; раскладка `336×32`/`168×160`/`120×160` идентична; код зависит только от номеров кадров и `frameWidth/Height 24/32`. Старые PNG в дереве нет — эмпирический прогон невозможен (S05-QA подтвердил совместимость) | PASS |
| A7 `npm test`, `typecheck`, `test:e2e`; консоль без предупреждений Phaser | Прогоны + захват `console`/`pageerror` с загрузки | всё зелёное; 0 `Animation key…` | `npm test` 9 файлов/**123 passed**; `typecheck` exit 0; `test:e2e` **10 passed**; консоль — 0 сообщений Phaser/pageerror (только WebGL-драйвер, см. «Некритичные»). Restart GameScene: `anims.size` 14 до/после, затем play — без warning'ов; `probe-result.json`, `probe2-result.json` | PASS |
| A8 `tests/animation-catalog.test.ts`; fps 14 / 8.75 | Узкий прогон + замер интервалов кадров | 10 тестов; hero ≈14, враги ≈8.75 | `npx vitest run tests/animation-catalog.test.ts` — **1 файл/10 passed** (123 мс); hero-run **72.2 мс → 13.86 fps**, свободный бег **71.7 → 13.95**; enemy-12 **114.7 мс → 8.72 fps**; idle/jump статичны; `probe-result.json`, `probe4-result.json` | PASS |
| D16 `frameRate: 1` у однокадровых | Каталог, рантайм-дефиниции, тест `fps>0` | 1 с комментарием | `animation-catalog.ts:26,29,31` — `STILL_FPS = 1` + комментарий; в живом менеджере idle/jump `frameRate=1`, frames `[0]`/`[13]`; тест «frame ranges…» (`frameRate>0`) зелёный | PASS |
| API `ANIMATIONS`/`AnimationSpec`/`registerAnimations` | Чтение экспортов | контракт на месте, Phaser только в `animations.ts` | Каталог экспортирует `AnimationSpec`, `ANIMATIONS` (14, без Phaser); `animations.ts` — `registerAnimations(scene)` (`import type Phaser`) с `anims.exists`; используется в `character-view.ts` | PASS |
| N1 `game.ts`/`Enemy.sprite`/`SPRITE_BY_ID` не изменены | Чтение, спека 05 §5, тесты | маппинг и поведение те же | `game.ts` mtime 14.11 19:31 (до S06); `SPRITE_BY_ID` (`game.ts:28-31`) совпадает с 05 §5; `enemy.test.ts` (entity 1→2, 6→5, 14→9) и `architecture.test.ts` зелёные | PASS |
| N2 Арт/имена текстур/`SPRITE_NAMES` не тронуты S06 | mtime + чтение | только `hero`/`chunk1`/`chunk2` | `assets.ts:13` без изменений; каталог/вью используют эти имена; PNG — S05 (23:39), S06-файлы 23:24–23:31; ссылок на пиксели/размеры листа нет | PASS |
| N3 Физика/правила/двери/очки/уровни не изменены | `design.md`, e2e | константы те же | `game.ts` 980/132/1400/1800/300/520/380 = `design.md:38-45`; `physics.spec.ts` 8/8; в анимациях нет игровых событий | PASS |
| N4 HUD/тайлсет не тронуты S06 | Чтение S06-файлов | нет ссылок | S06-файлы не ссылаются на HUD/тайлы; `phaser-view.ts` изменён только в `render`; `hud-view.ts`/`assets.ts`/`boot-scene.ts` — S07, `tiles.png` — S09 | PASS |
| N5 Анимации без игровых событий, каталог без Phaser | Чтение + тест чистоты | только данные | Записи `readonly` (ключ/текстура/кадры/fps/repeat), без колбэков; тест «stays pure data» зелёный; события остались в `game.ts` | PASS |
| N6 Нет `door-open` (S10) | Рантайм-ключи | 14 ключей | В AnimationManager ровно 14: hero 3 + `enemy-2…12`; `door-open` отсутствует | PASS |
| N7 Только разрешённые файлы | mtime/содержимое | 5 файлов S06 | S06: каталог/`animations.ts`/`phaser-view.ts` (23:24), тест (23:25), `character-view.ts` (23:31). Новее — S05 PNG+тест (23:39), S07 (23:27), S09 `tiles.png` (11:45); git-операций нет | PASS |

## Команды и ручные сценарии

| Проверка | Результат |
|---|---|
| `npm test` | 9 файлов / **123 passed**, 370 мс, exit 0 |
| `npx vitest run tests/animation-catalog.test.ts` | 1 файл / **10 passed**, 123 мс |
| `npm run typecheck` / `npm run build` | exit 0 / exit 0; бандл содержит `registerAnimations`, `hero-run`, `enemy-12` |
| `npm run test:e2e` | **10 passed** (4.0 с); Playwright сам поднял и остановил 4173 |
| Ручной UI (Chromium, pre-existing dev server 5173, PID 43528): титул → Space → уровень 1 → ArrowRight → ArrowLeft → Space → посадка → `mkw.startLevel(1…7)` → restart GameScene → Space | Пройден: idle/run/jump, flip, все группы врагов; 0 pageerror, 0 сообщений Phaser; fps 13.86/8.72 |
| Dev-флаги | Только `mkw.startLevel(n)` (уровни 2–8) и `scene.restart`; уровень 1 — клавиатурой; данные не подменялись; счётчик `startAnimation` — обёртка для замера |
| Свидетельства | `.temp/qa-S06/probe-result.json` + `probe2…7-result.json`, `probe*.mjs`; скриншоты: `01-idle.jpeg`, `02-run-right.jpeg`, `03-jump.jpeg`, `04-level3-enemies.jpeg`, `05-level8-enemies.jpeg` (JPEG, кроп canvas) |

## Блокеры

Нет.

## Исправленные блокеры прошлых прогонов

Нет (первый заход).

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| Браузеры Playwright (probe 1–7) | да | `browser.close()` в каждом; новых chrome-процессов нет |
| `npm run test:e2e` (webServer 4173) | да | Playwright остановил; 4173 свободен |
| `npm run build` | — | разовая сборка; процессов не осталось |
| `npm test`/`typecheck`/узкий vitest | — | завершились, фоновых задач нет |
| Сервер 5173 (PID 43528) | не трогал | существовал до проверки (14.11 20:23), переиспользован |

## Некритичные

- При удержании направления в стену `vx` сбрасывается коллизией каждый тик → чередование `hero-idle`/первый кадр `hero-run`. Это правило спеки §3 (`abs(vx)>8`), как и в старом tick-view; на свободном беге чередования нет (уровень 2 — только `hero-run`).
- Старый арт (до S05) в дереве отсутствует: совместимость доказана раскладкой/номерами кадров и старым tick-view, а не прогоном на старых PNG.
- Предупреждения `GPU stall due to ReadPixels` — от headless-браузера при скриншотах, не от игры/Phaser.
