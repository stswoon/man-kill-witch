# S11 — Arcade Physics: слой `arcade/*`, правила без Phaser

**Статус:** OPEN

**Дорожка:** физика / архитектура / тесты.

**Параллель:** S09 — по файлам (`tiles.png`). Не параллелить: S10 (`game.ts`, `game.test.ts`),
S06 (`view/characters`), S12 (`game.ts`/`game-scene.ts`/тесты).

**Зависит от:** S01 (`view`), S04 (`mkw.tick`, e2e-стенд), S06 (анимации/`CharacterView`),
S08 (`docs/design.md`, `README.md`), S10 (дверь в `game.ts`/`game.test.ts`).

**Разблокирует:** S12 (run state).

## Цель

Перевести физику на Arcade Physics, оставив `web/src/game.ts` Phaser-free слоем правил,
сохранив фиксированный шаг 1/70 и перенеся тесты движения в детерминированный e2e.

## В scope

- Новый `web/src/arcade/`:
  - `ArcadeSim` — единственный владелец Arcade-мира и тел игрока, врагов, пуль и
    tilemap-коллизий; создаётся `GameScene`;
  - `snapshot(): WorldSnapshot` — позиции/скорости/размеры, `onGround`, `blocked`, `dir`,
    `alive`, события столкновений;
  - `apply(commands: TickCommands)`, `applyTilePatches(patches)`, `step(dt)`;
  - `customUpdate: true`, ровно один шаг мира на тик `1/70`; `postUpdate` на каждом тике,
    чтобы не терять движение при нескольких тиках за рендер-кадр;
  - tilemap-слой переиспользуется из `LevelView`: `GameScene` передаёт его в `ArcadeSim`,
    отдельный скрытый слой не создаётся; `web/src/view/level-view.ts` входит в S11.
- `web/src/sim-contract.ts` — чистые типы `WorldSnapshot`, `TickCommands`, `PlayerIntent`,
  `EnemyIntent`, `PhysicsEvent`; без Phaser, импортируется и правилами, и Arcade.
- `TickCommands` включает `spawnBullet {id, x, y, vx, vy}`, `despawnBullet {id}`,
  `killEnemy`, `respawnPlayer`. `WorldSnapshot.bullets` содержит `id`; жизнь пули 40 тиков
  считает `game.ts`, Arcade только создаёт/удаляет тело.
- `web/src/game.ts`:
  - убрать `Body`, `moveBody`, `touchesGround`, физическое `Player.update`/`Enemy.update`;
  - оставить `Level`/tileinfo, очки, жизни, патроны, кулдаун, перезарядку, неуязвимость,
    дверь, камеру, `tilePatches`, `gameOver`/`levelComplete`, AI-намерения врагов;
  - семантику очков/жизней S11 **не меняет**; текущее владение остаётся в `Game`, S12
    выносит `RunState` в `GameScene`;
  - `update(dt, input, snapshot): TickCommands`; `Game` не импортирует Phaser, `arcade/*` и
    сцены; общие типы — только из `sim-contract.ts`.
- `web/src/scenes/game-scene.ts`:
  - владеет `Game` и `ArcadeSim`;
  - **фиксированный тик** (в цикле аккумулятора): `snapshot → game.update →
    arcade.apply → arcade.applyTilePatches → arcade.step`; без рендера и `endFrame`;
  - **рендер-кадр**: после цикла тиков применить накопленные `tilePatches` к `PhaserView`,
    затем один `view.render(...)` и один `controls.endFrame()`;
  - `mkw.tick(n)` — исключение стенда: на каждый тик `step + endFrame`, без рендера на
    каждый тик; `mkw.snapshot()` отдаёт `WorldSnapshot`.
- `web/src/view/*`: позиции игрока/врагов/пуль — из `WorldSnapshot`; анимации S06 и дверь S10
  сохраняются; view не меняет правила.
- Тесты:
  - `tests/architecture.test.ts` остаётся на `game.ts`, добавляет запрет импорта
    `arcade/*` (кроме чистого `sim-contract.ts`);
  - `tests/helpers.ts`: `tick(game, input)` заменяется на rules-tick с `WorldSnapshot`/
    `TickCommands`; добавляются фабрики фейкового снимка/команд; реальной физики в node нет;
  - `tests/player.test.ts`: движение/прыжок/стены/потолок/приземление → `e2e/physics.spec.ts`;
    перезарядка/патроны → rules-тесты на `WorldSnapshot`;
  - `tests/enemy.test.ts`: спавн-мэппинг/скорости/флаги остаются; террейн/полёт → e2e;
  - `tests/game.test.ts`: выстрел/кулдаун, подборы, дверь, очки, жизни, камера, жизнь пули
    40 тиков и `despawnBullet` — на фейковом `WorldSnapshot`/`TickCommands`; попадания и
    касания — события Arcade/e2e;
  - `tests/smoke.test.ts`: остаётся в node как rules-smoke на фейковом снимке (без реальной
    физики), 600 тиков; выживание/движение уровня 1 дополнительно проверяется в e2e;
  - `e2e/physics.spec.ts`: бег, прыжок (2 тайла, не 3), приземление, стены, враги,
    детерминизм повторного запуска;
  - `e2e/game.spec.ts`: `DebugApi`/`Snapshot` переводятся на `mkw.snapshot()` для позиций;
    ammo/score — из `mkw.game()`; boot/уровни/канвас остаются.
- Документация:
  - `AGENTS.md`: структура, правила 76–80/127, тесты, `mkw`;
  - `README.md`: таблица структуры;
  - `docs/design.md`: строка про физику (дверь уже исправлена S08; run state — S12).

## Вне scope

- Дверь (S10), тайлсет (S09), арт персонажей/HUD/титульный экран.
- Изменение чисел, скорости, урона, очков, уровней и правил.
- Новые враги, оружие, звук, диалоги.
- Сохранение run state между уровнями — S12, после S11.
- Отдельной стори для миграции тестов нет: она входит в S11; S12 — run state.

## Папки (только эти)

```
web/src/arcade/
web/src/sim-contract.ts
web/src/game.ts
web/src/scenes/game-scene.ts
web/src/view/level-view.ts
web/src/view/character-view.ts
web/src/phaser-view.ts
tests/architecture.test.ts
tests/helpers.ts
tests/player.test.ts
tests/enemy.test.ts
tests/game.test.ts
tests/smoke.test.ts
e2e/physics.spec.ts
e2e/game.spec.ts
AGENTS.md
README.md
docs/design.md
```

## Публичный API

- `ArcadeSim`, `WorldSnapshot`, `TickCommands`, `PlayerIntent`, `EnemyIntent`, `PhysicsEvent`;
- `TickCommands.spawnBullet/despawnBullet`, id пули в `WorldSnapshot`;
- `Game.update(dt, input, snapshot): TickCommands`; `Game` больше не интегрирует движение;
- `mkw.snapshot()`, `mkw.tick(n)` шагает физику и правила.

## Приёмка

- `game.ts` не импортирует Phaser, `phaser-view`, сцены, `arcade/*`; `tests/architecture.test.ts`
  зелёный.
- Один шаг Arcade-мира на тик `1/70`; фиксированный тик не делает `view.render`/`endFrame`;
  рендер-кадр делает их один раз после цикла. `mkw.tick` — тестовое исключение.
- Прыжок перекрывает 2 тайла и не достаёт 3; бег, трение, макс. падение, стены, края, пули
  (жизнь 40 тиков + `despawnBullet`) и враги соответствуют `02-gameplay.md`.
- `npm test` зелёный, включая `tests/smoke.test.ts` на фейковом снимке; `npm run typecheck`,
  `npm run test:e2e` проходят; e2e детерминирован и повторяем; консоль чистая.
- `AGENTS.md`, `README.md`, `docs/design.md` обновлены; `mkw.tick`/`mkw.snapshot`
  документированы.
- Дверь S10 и анимации S06 работают без регрессий; статичная дверь и `door-open` не ломаются.
- Никаких новых runtime-зависимостей.

## Не делать

- Не тянуть Phaser в `game.ts`; не переносить правила в `phaser-view.ts`/сцены.
- Не менять числа, правила, уровни, ассеты.
- Не оставлять физику в `game.ts` и не дублировать её фейком в production.
- Не делать run state: это S12 после S11.
