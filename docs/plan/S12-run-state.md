# S12 — Сохранение очков и жизней между уровнями

**Статус:** OPEN

**Дорожка:** правила / прохождение.

**Параллель:** S14, S15, S16, S17 — по файлам. Не параллелить: S11
(`game.ts`/`game-scene.ts`/тесты).

**Зависит от:** S11 (правила/`GameScene`/тесты после Arcade); `docs/design.md` — после
S08/S11.

**Разблокирует:** S18 (финальная приёмка).

## Цель

Сделать очки, оставшиеся жизни и порог дополнительной жизни частью прохождения, а не
уровня: они сохраняются между уровнями и сбрасываются только при новом прохождении.

## В scope

- `RunState { lives, score, nextExtraLife }` — чистая структура; владелец `GameScene`,
  передаётся в `Game`. Новое прохождение: `3 / 0 / 5000`.
- `GameScene`:
  - `startRun(levelIndex)` — новое прохождение; используется титулом, win, game over,
    цифрами 1–8 и `mkw.startLevel(n)`;
  - `advanceLevel(levelIndex)` — тот же `RunState`; используется дверью/переходом уровня;
  - `mkw.advanceLevel(n)` — отладочный переход с тем же run для e2e.
- `Game`:
  - принимает `RunState`, обновляет `lives`/`score`/`nextExtraLife` в нём;
  - дополнительная жизнь каждые 5000, `nextExtraLife += 5000`, перенос между уровнями;
  - смерть внутри уровня: `lives--`, очки/порог сохраняются; game over при 0.
- `docs/design.md` (раздел «Правила»): «очки/жизни сохраняются между уровнями; game over/win/
  титул/отладка начинают новое прохождение».
- `AGENTS.md`: отладочные методы `mkw.startLevel(n)` (новый run) и `mkw.advanceLevel(n)`
  (тот же run), как в `docs/spec/01-architecture.md` §6.
- Тесты:
  - `tests/game.test.ts`: старт 3/0/5000; extra life; смерть; game over;
  - `tests/helpers.ts`: `makeRun`/фабрика run;
  - `tests/smoke.test.ts`: rules-smoke с run state;
  - `e2e/game.spec.ts`: `mkw.advanceLevel` переносит score/lives; `mkw.startLevel` сбрасывает.

## Вне scope

- Arcade Physics, двери, тайлсет, арт, HUD.
- Числа очков/жизней/порога (кроме переноса).
- Диалоги/сохранение на диск/`localStorage`.

## Папки (только эти)

```
web/src/game.ts
web/src/scenes/game-scene.ts
tests/game.test.ts
tests/helpers.ts
tests/smoke.test.ts
e2e/game.spec.ts
docs/design.md
AGENTS.md
```

## Публичный API

- `RunState`; `Game` принимает/обновляет его;
- `GameScene.startRun` / `GameScene.advanceLevel`;
- `mkw.startLevel(n)` — новое прохождение; `mkw.advanceLevel(n)` — тот же run.

## Приёмка

- Старт: 3 жизни, 0 очков, `nextExtraLife = 5000`.
- Переход на следующий уровень: очки, оставшиеся жизни, `nextExtraLife` сохраняются.
- Смерть внутри уровня: `lives--`, очки/порог сохраняются; при 0 — game over.
- Game over: Space рестартует текущий уровень с 3/0/5000.
- Win: Space — уровень 1 с 3/0/5000; титул — то же.
- Цифры 1–8 / `mkw.startLevel(n)` — новое прохождение с уровня `n`, 3/0/5000.
- `mkw.advanceLevel(n)` переносит run.
- `npm test`, `npm run typecheck`, `npm run test:e2e` проходят; e2e перехода зелёный.
- `docs/design.md` (раздел «Правила») соответствует коду.
- `AGENTS.md` документирует `mkw.startLevel` (новый run) и `mkw.advanceLevel` (тот же run);
  формулировки совпадают с `docs/spec/01-architecture.md` §6.

## Не делать

- Не менять Arcade, двери, уровни, арт.
- Не сохранять прохождение на диск/сервер.
- Не менять числа очков/жизней/порога.
- Не трогать строку `docs/design.md` про дверь (S08) и про физику (S11).
