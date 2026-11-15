# Man Kill Witch

Ретро-платформер: могильщик **Сайлас Грив** идёт с дробовиком через проклятый лес, болото,
избушку и склеп к ведьме, укравшей имена с надгробий Холлоумира. Он идёт не за расплатой,
а чтобы закопать ведьму по всем правилам.

Phaser 4 + TypeScript, фиксированный шаг логики **1/70 с**. Имя, предыстория и облик героя —
[`docs/spec/04-hero.md`](docs/spec/04-hero.md).

## Статус

Ранний прототип. Графика, уровни и звук в `web/public/assets` — временные и будут
заменены оригинальными. Игровой код постепенно переводится на собственный формат
данных. В публичный репозиторий входит только собственный код; файлы оригинальной игры
и дампы декомпиляции исключены.

Дизайн и параметры ощущения — `docs/design.md`.

## Запуск

```bash
npm install
npm run dev        # сборка в build/ + сервер на http://localhost:5173
npm run build      # только сборка в build/
npm test           # vitest: юнит-тесты логики и данных
npm run test:e2e   # playwright: браузерные сценарии
npm run typecheck  # tsc --noEmit
```

Перед первым запуском браузерных тестов: `npx playwright install chromium`.
Playwright сам собирает `build/` и поднимает статический сервер на 4173.

Управление: ←/→ ходьба, ↑/↓ прицел, Space прыжок, Ctrl выстрел, 1–8 — переключение уровня.

## Бот-игрок (по запросу)

`agent-bot` — LLM-агент, который играет в игру **по данным движка**, без пикселей. Это
диагностический инструмент, а не обязательный гейт: запускай его после правок уровней,
перед релизом или по жалобе «уровень не проходится».

```js
mkw.bot.reset(0, { seed: 1, render: true }) // observation; Phaser loop sleeps
mkw.bot.act("right", 20)                    // observation; walk 20 fixed ticks
mkw.bot.status()                            // PASS / FAIL / IN_PROGRESS / CANCELLED
mkw.bot.log()                               // replayable action log
mkw.bot.stop()
mkw.setSpeed(4)                             // normal loop x1..x8
```

`act` — единственный способ двигать героя; он шагает правила и Arcade ровно на `1/70` за тик
и возвращает тайлы, героя, врагов, двери, предметы, окно 21×13 и minimap. Вердикт считает
harness: behavior 2 — выход, fallback behavior 1, выход ближе 2 тайлов к спавну — `FAIL`
(уровни 4/6/7). Полный LLM-прогон не входит в `npm test`/`test:e2e`; `e2e/bot-api.spec.ts` —
детерминированный smoke API.

## Структура

| Путь | Что это |
|---|---|
| `web/src/scenes/boot-scene.ts` | загрузка ассетов через Phaser Loader |
| `web/src/scenes/game-scene.ts` | состояния `title / play / gameover / win`, фиксированный тик, отладка `window.mkw` |
| `web/src/sim-contract.ts` | контракт правил и Arcade: снимок мира, команды тика, числа |
| `web/src/game.ts` | правила: уровни, очки, жизни, патроны, таймеры, двери, предметы, камера |
| `web/src/arcade/arcade-sim.ts` | Arcade-мир: тела игрока, врагов и пуль, tilemap-коллизии |
| `web/src/bot/` | LLM-пилот: `observe/act`, виртуальный ввод, окно/minimap, выходы и вердикт |
| `web/src/phaser-view.ts`, `web/src/view/*` | отрисовка: tilemap, спрайты, камера, HUD, сообщения |
| `web/src/assets.ts` | константы, типы и имена текстур |
| `web/src/input.ts`, `sfx.ts` | клавиатура, синтезированные звуки |
| `web/src/main.ts` | boot Phaser, конфиг рендера |
| `web/public/assets/` | временные ассеты: тайлсет, уровни, атласы спрайтов |
| `build/` | собранная игра: `bundle.js`, `index.html`, `assets/` (не коммитится) |
| `tools/serve.mjs`, `tools/build.mjs` | статический сервер и сборка в `build/` |
| `tests/` | юнит-тесты vitest: правила на фейковом снимке, враги, данные уровней |
| `e2e/` | браузерные тесты Playwright: boot, управление, физика, уровни, канвас |
| `docs/design.md` | дизайн: правила, ощущение, враги, уровни |
