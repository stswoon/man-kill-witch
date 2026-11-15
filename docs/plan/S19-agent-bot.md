# S19 — LLM-пилот и проверка проходимости уровней

**Статус:** IN_PROGRESS

**Дорожка:** QA / отладочный инструмент.

**Параллель:** нет; не гейт и не обязательный шаг пайплайна.

**Зависит от:** S11 (контракт `WorldSnapshot`/`TickCommands`, Arcade), S12 — только по
файлу `web/src/scenes/game-scene.ts` (бот встраивается в текущий владелец `Game`/`ArcadeSim`).

**Разблокирует:** —

## Цель

Дать LLM-агенту `agent-bot` возможность играть в игру по данным движка: читать тайлы,
тела, двери и предметы через `window.mkw.bot`, выбирать макродействия и проверять, что
уровень проходим. Бот вызывается **по запросу** (после правок уровней, перед релизом, по
жалобе «уровень не проходится»), а не в каждом прогоне и не как CI-гейт.

## В scope

- `web/src/bot/` — Phaser-free слой:
  - `types.ts` — `BotAction`, observation, status, route log;
  - `bot-random.ts` — seeded `Math.random` для повторяемых прогонов (только фазы flyer);
  - `bot-exits.ts` — группировка дверей, выбор выхода (behavior 2 → fallback 1),
    `exitNextToSpawn` (2 тайла), `noExit2`;
  - `bot-input.ts` — виртуальный `InputState` (`isDown`/`wasPressed`);
  - `bot-observe.ts` — окно 21×13, minimap 4×4, враги/пули, легенда;
  - `bot-session.ts` — `settle`, `act`, `observe`, `status`, `log`, счётчики смертей/тиков.
- `web/src/scenes/game-scene.ts`:
  - `mkw.bot.reset(level, {seed, render, maxActions, maxTicks})`, `observe`, `act`,
    `status`, `log`, `replay`, `stop`;
  - `mkw.setSpeed(n)` для обычного цикла (x1..x8);
  - сон Phaser-цикла на время бота, рендер один раз после действия;
  - запрет авто-перехода уровня, пока активен бот: harness должен зафиксировать дверь.
- `web/src/scenes/game-scene.ts` + `bot-random.ts`: seed передаётся в `Game` через
  временный seeded `Math.random`; `game.ts` не меняется.
- `tests/bot-report.test.ts` — группировка дверей и политика выхода на реальных JSON.
- `e2e/bot-api.spec.ts` — детерминированный smoke API: reset → walk → jump → wait,
  `status`/`log`, `exitNextToSpawn` для 4/6/7, fallback для 2.
- `.opencode/agents/agent-bot.md` — профиль LLM-пилота (subagent).
- `AGENTS.md`, `README.md`, этот стори, строка в `docs/plan/README.md`.

## Вне scope

- Детерминированный A* или автопрохождение вместо LLM. LLM — пилот, код — руки.
- Правки уровней, `tileinfo.json`, ассетов, физики, правил, дверей.
- Ключи и инвентарь: их в игре пока нет.
- CI-гейт и обязательный `npm run test:levels`. Бот — диагностика по запросу.
- Полный LLM-прогон всех 8 уровней в этой итерации: проверяется API и профиль.

## Файлы

```
web/src/bot/types.ts
web/src/bot/bot-random.ts
web/src/bot/bot-exits.ts
web/src/bot/bot-input.ts
web/src/bot/bot-observe.ts
web/src/bot/bot-session.ts
web/src/scenes/game-scene.ts
tests/bot-report.test.ts
tests/architecture.test.ts
e2e/bot-api.spec.ts
.opencode/agents/agent-bot.md
AGENTS.md
README.md
docs/plan/README.md
docs/plan/S19-agent-bot.md
```

## Публичный API

```js
mkw.bot.reset(level, { seed: 1, render: true }) // observation
mkw.bot.observe()
mkw.bot.act("right", 20)                        // observation
mkw.bot.status()                                // harness verdict
mkw.bot.log()                                   // replayable route
mkw.bot.replay(route, { render: false })        // status
mkw.bot.stop()
mkw.setSpeed(4)
```

Правила:
- `act` — единственный способ двигать героя; observation не меняет состояние;
- вердикт `PASS/FAIL/IN_PROGRESS/CANCELLED` считает harness, LLM не может объявить PASS;
- `exitNextToSpawn` (behavior 2, либо fallback behavior 1, ближе 2 тайлов к спавну) — FAIL;
- `noExit2` — warning, цель — дальняя behavior-1;
- `earlyExit` — достигнута другая дверь раньше предложенной цели;
- `seed` повторяет фазы flyer; action log можно проиграть через `replay`.

## Приёмка

- `npm run typecheck` и `npm run build` проходят.
- `npx vitest run tests/bot-report.test.ts tests/architecture.test.ts` зелёный.
- `npx playwright test e2e/bot-api.spec.ts` зелёный: reset, walk, jump, wait, status, log,
  `exitNextToSpawn` для 4/6/7, fallback для 2.
- `web/src/bot/*` не импортирует Phaser и `phaser-view` (архитектурный тест).
- `mkw.bot` двигает героя только через `InputState`; в `Game`/`Level`/`ArcadeSim` напрямую
  ничего не пишется.
- `game.ts` остаётся Phaser-free; `bot/*` не тянет Phaser.
- `agent-bot` — subagent, запускается по запросу, не блокирует пайплайн.
- Документация: `AGENTS.md`, `README.md`, `docs/plan/README.md`.
- Известные данные: уровни 4/6/7 дают `FAIL` с `exit-next-to-spawn`; уровень 2 — warning
  `noExit2`; это findings, а не баг бота.
- `e2e/bot-api.spec.ts` — детерминированный smoke API, входит в `npm run test:e2e`;
  полный LLM-прогон уровней в обязательный цикл не входит и гейтом не является.

## Не делать

- Не делать бота обязательным гейтом и не запускать полный LLM-прогон в каждом коммите.
- Не чинить уровни 4/6/7 в этой стори: сначала отчёт, решение — за владельцем.
- Не переносить правила в `bot/*` и не тянуть Phaser в `web/src/bot`.
- Не добавлять новых runtime-зависимостей.
- Не менять `game.ts`, `sim-contract.ts`, `arcade/*` ради бота (seed — только через сцену).
- Не вызывать `startLevel`/`step`/`tick` из бота; только `mkw.bot.*`.

## Заметки

- Бот намеренно не автоматизирует маршрут: LLM выбирает макродействия, harness шагает
  1/70 и судит результат. Это позволяет использовать его как исследовательский инструмент,
  а не как хрупкий скрипт.
- Replay — необязательный: успешный `log` можно сохранить в `work/bot-routes/` и проиграть
  после правок уровня; в CI он не входит.
- `docs/plan/README.md` и `AGENTS.md` фиксируют правило: проверка ботом — по запросу.
