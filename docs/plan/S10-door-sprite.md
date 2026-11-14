# S10 — Дверь: статичные тайлы + спрайт открытия

**Статус:** OPEN

**Дорожка:** дверь / анимации.

**Параллель:** S09 — по файлам. Не параллелить: S11 (`game.ts`, `game.test.ts`).

**Зависит от:** S01 (`view`), S06 (каталог анимаций/`CharacterView`), S07 (`assets.ts`,
`boot-scene.ts`, `content.test.ts`; S02 — транзитивно через S07).

**Разблокирует:** S11 (контракт двери в `game.ts`/`game.test.ts`).

## Цель

Оставить статичную дверь тайлами уровня, а открытие перевести на спрайтовую анимацию
`door-open`; убрать `DOOR_FRAMES` и показывать все 3 кадра.

## В scope

- `web/public/assets/sprites/s_door.png` — `32×48`, 3 кадра, оригинальный арт.
- `web/src/assets.ts`: `DOOR_TEXTURE = "door"`; `web/src/scenes/boot-scene.ts`: загрузка
  `s_door.png` как spritesheet `32×48`.
- `web/src/animation-catalog.ts`: `door-open` — 3 кадра, 14 fps, `repeat: 0`.
- `web/src/game.ts`:
  - удалить `DOOR_FRAMES`;
  - `Game.door` — публичное read-only состояние `{tx, ty, step, timer}`;
  - при попадании **центра игрока** в тайл behavior `1`/`2` (без проверки `onGround`)
    очищать все внутрикартные ячейки области `2×3` до `0` и добавлять их в `tilePatches`;
    вне карты не трогать;
  - каждый следующий тик `timer++`; через 5 тиков `step++`; на `step = 3` —
    `levelComplete = true`, `+1000`, `door = null`; всего 15 тиков;
  - статичная дверь до срабатывания не меняется; уровни и `tileinfo.json` не трогаются.
- `web/src/view/door-view.ts` (или отдельный view в `web/src/view/`): спрайт в
  `(tx-1)*16, (ty-1)*16`, origin `0,0`, глубина позади персонажей; `play("door-open", true)`;
  скрыть при завершении/смене уровня; `PhaserView` делегирует.
- `tests/game.test.ts`: вместо 12 патчей — состояние двери и 6 очищенных ячеек (тестовая
  арена), `step = 1` через 5 тиков, `step = 2` через 10, завершение/+1000 через 15.
- `tests/content.test.ts`: `s_door.png` в манифесте, размеры `32×48`, 3 кадра.

## Вне scope

- Arcade Physics, `game.ts`-физика (S11).
- Тайлсет, статичные дверные индексы и уровни (S09).
- HUD, персонажи, титульный экран.
- `docs/design.md` — строку про дверь правит S08.

## Папки (только эти)

```
web/public/assets/sprites/s_door.png
web/src/assets.ts
web/src/scenes/boot-scene.ts
web/src/animation-catalog.ts
web/src/game.ts               (только дверь / DOOR_FRAMES)
web/src/view/door-view.ts
web/src/phaser-view.ts        (только композиция)
tests/game.test.ts            (только дверь)
tests/content.test.ts         (только s_door.png)
```

## Публичный API

- `DOOR_TEXTURE = "door"`; анимация `door-open`;
- `Game.door: { tx, ty, step, timer } | null` — read-only для view;
- `DOOR_FRAMES` удалён.

## Приёмка

- До срабатывания видна статичная дверь из тайлов; спрайта нет.
- После срабатывания статичные тайлы области `2×3` очищены, играет `door-open`; видны все
  3 кадра; к 15-му тику уровень завершён и `+1000`.
- Статичные дверные индексы из `docs/spec/02-gameplay.md` не изменены; уровни и
  `tileinfo.json` не тронуты.
- `tests/game.test.ts`, `tests/content.test.ts`, `npm test`, `npm run typecheck`,
  `npm run test:e2e` проходят; консоль чистая.
- `DOOR_FRAMES` и старые кадры открытия не используются; швов спрайта с тайлмапом нет.
- В стори/PR одна фраза о провенансе дверного арта.

## Не делать

- Не менять статичные дверные тайлы, уровни и `tileinfo.json`.
- Не трогать `game.ts` вне двери; не переводить дверь на Arcade.
- Не использовать старые `DOOR_FRAMES` и не показывать только 2 кадра.
- Не трогать `docs/design.md` (S08).
