# Review notes S12

**Решение: LEAD_PASS** (первый заход, независимое ревью 2026-11-15).

## Блокеры

Нет.

## Расхождение со спекой

Нет. `RunState {lives, score, nextExtraLife}` принадлежит `GameScene` и передаётся в `Game`
(`game.ts:29-47,175-220,294-297,451-459`; `game-scene.ts:51,122-143`), `docs/spec/02-gameplay.md:155-174`
(D11) выполнен: старт 3/0/5000, перенос дверью, `lives--` при смерти, game over/win/титул/цифры/
`mkw.startLevel` — новое прохождение, `mkw.advanceLevel` — тот же run. Числа (`3`, `5000`, +100/+1000)
и слой Arcade/двери/уровни не менялись. `localStorage`/сеть/диск отсутствуют — run живёт в поле сцены.

## Независимая проверка

- Прочитан diff S12: `game.ts`, `game-scene.ts`, `tests/game.test.ts`, `tests/helpers.ts`,
  `tests/smoke.test.ts`, `e2e/game.spec.ts`, `AGENTS.md`; в `docs/design.md` строка run и источники
  нового прохождения (`64-79`) сверены с кодом — совпадают. AGENTS `179-182` дословно совпадает
  с `docs/spec/01-architecture.md:208-209`.
- `npm test` — 12 файлов / 164 теста, pass (снимок 20:21, до чужой правки ниже).
- `npm run typecheck` — exit 0 (20:21 и повтор 20:24).
- `npx playwright test --workers=1` — **24 passed (38.4 s)**, включая `advanceLevel carries the run
  and startLevel resets it` и `win restarts level 1 with a fresh run`; отдельно `e2e/game.spec.ts` —
  6/6. Сервер 4173 не поднимал: переиспользован существующий PID 36036; `build/bundle.js` (20:16)
  содержит `nextExtraLife` и `advanceLevel`.
- Свидетельства QA: `.temp/qa-S12/01-04.jpg` существуют; `02-gameover.jpg` — LVL 4/8, LIVES 0,
  SCORE 0, GAME OVER / PRESS SPACE, консоль/`pageerror` по отчёту 0. Матрица A1-A10 закрыта,
  «Уборка» заполнена — QA-гейт пройден.

## Замечания (не блокируют)

- **Minor.** `Game` конструктор по умолчанию создаёт `createRun()`, если run не передан
  (`game.ts:193`). Единственный production call-site (`loadLevel`) передаёт `this.run`, но забытый
  аргумент на новом месте молча начнёт новое прохождение. На будущее — сделать параметр обязательным.
- **Minor.** `tests/helpers.ts:106-108` дублирует 3/0/5000 вместо `createRun()`, поэтому unit-тест
  «starts with 3 lives…» проверяет helper, а не production-инициализатор. Поведение `createRun`
  реально закрыто e2e `startLevel resets it`; дрейф чисел поймает e2e, но не unit. Лучше
  `makeRun = { ...createRun(), ...overrides }` + прямая проверка `createRun()`.
- **Minor (аудит QA).** Утверждение QA «`git diff` S12: только game.ts/game-scene/tests/e2e/AGENTS»
  неточно: в общем дереве есть незакоммиченные правки вне S12 — `README.md` (текст S20),
  `playwright.config.ts` (`workers: 1`, `timeout: 60_000`), `.opencode/agents/music-agent.md`,
  `docs/plan/S12` (статус ставил оркестратор). Это не код S12, в коммит стори их включать нельзя;
  правку `playwright.config.ts` нужно оформить отдельно или откатить (на неё опирался прогон QA
  с `workers=1`).
- **Info.** Текст run-блока `docs/design.md` уже лежит в HEAD-коммите `e6e331a` (S20), в рабочем
  diff S12 его нет. Содержимое верное и совпадает с кодом — приёмка по докам выполнена, но S12-коммит
  его не покажет; учесть при коммите/приёмке.
- **Важно оркестратору.** После QA (20:22+) в тех же файлах появилась **чужая** правка: вход в дверь
  прыжком изменяет `game.ts`, `tests/game.test.ts`, `docs/design.md` (строка двери S08) и
  `docs/spec/02-gameplay.md`. S12-хаки при этом не тронуты (run/extra life/гейттеры в диффе те же);
  текущее дерево: 165/165 и typecheck 0, но QA-свидетельство A2 (реальная дверь) относится к прежнему
  поведению двери. Не смешивать эту правку с S12 и не включать в коммит S12; она должна пройти свой
  QA/Lead.

## Следующий шаг

Dev ничего не делает: блокеров и расхождений нет. Оркестратор может поставить S12 `DONE`, не включая
в коммит `playwright.config.ts`, `README.md`, `music-agent.md` и конкурентную правку двери; нестыковку
с дверью решать отдельной стори/решением.

## Уборка

- Мои прогоны: `npm test` (20:21, 20:24), `npm run typecheck`, `npx playwright test --workers=1`
  (полный и `e2e/game.spec.ts`). Playwright воркеры/браузеры закрыты; собственного `webServer` не
  поднимал — порт 4173 (PID 36036) занят до меня, переиспользован; новых процессов не оставил.
- Git-операции только чтение (`status/diff/show/log`); дерево не мутировал, статусы в `docs/plan`
  не менял, коммитов нет.
