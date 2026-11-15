# Review notes S06

**Решение: LEAD_PASS** (2026-11-15; независимо проверены код, тесты, e2e и свидетельства QA)

## Блокеры

Нет.

## Расхождение со спекой

Нет. Каталог совпадает со `docs/spec/05-animation.md` §3 построчно: `hero-idle` кадр 0,
`hero-run` 1–6 @14 fps, `hero-jump` 13, `enemy-2`…`enemy-12` по 5 кадров (2–8 — `chunk1`,
9–12 — `chunk2`) @8.75 fps, у всех `repeat: -1`; `door-open` отсутствует (S10). §4 выполнен:
`registerAnimations` с `anims.exists`, `play(key, true)`, текстура врага по `Enemy.sprite`,
`flipX = facing > 0` / `dir > 0`, мёртвый — `setVisible(false)` + `anims.stop()`,
во view нет `Math.floor(tick / N)` и `setTexture(key, frame)`. D16 выполнен: `STILL_FPS = 1`
с комментарием (`web/src/animation-catalog.ts:25-31`), в живом менеджере idle/jump — `frameRate 1`,
frames `[0]`/`[13]`.

## Замечания (не блокеры)

- **Низкая.** `game.tick` после S06 только инкрементируется (`web/src/game.ts:266,325`), читателей
  в `web/src`, `tests/`, `e2e/` нет. Файл вне scope S06 — кандидат на уборку в S11.
- **Низкая.** `tests/animation-catalog.test.ts` проверяет §7 общим `frameRate > 0` и не фиксирует
  D16 отдельно: замена 1 на 14 у idle/jump тестом не поймается (код и рантайм при этом верны).
- **Информационная.** A6 («старый арт») доказана аналитически: старых PNG в дереве нет, но индексы
  кадров, сплит `chunk1 → chunk2` по 35 и flip совпадают со старым tick-view
  (`.temp/qa-s01/head-now-phaser-view.ts`), а S06 не зависит от пикселей. Принято.
- **Информационная.** Старые guard'ы `frameCount === 0` (отрисовка без листов) не перенесены; спека §4
  исходит из того, что BootScene уже загрузил текстуры. Рабочие сценарии не затронуты.

## Что проверено независимо

- Код: прочитаны все 5 файлов S06 целиком; `game.ts` (mtime 14.11 19:31), `SPRITE_BY_ID`,
  `Enemy.sprite`, `SPRITE_NAMES` не менялись; `registerAnimations` вызывается только из
  `CharacterView`; flip-логика сверена со старым tick-view — идентична.
- Тесты: узкий vitest — **10 passed**; `npm test` — 9 файлов / **124 passed** (на 1 больше отчёта
  QA: S05 правил `tests/art-assets.test.ts` в 12:02, уже после S06-QA); `npm run typecheck` — exit 0.
- E2E: `npm run test:e2e` — **10 passed**; Playwright собрал `build/` (в бандле `registerAnimations`,
  `hero-run`, `enemy-12`) и остановил 4173.
- Свидетельства QA (`.temp/qa-S06/*.json`, пересчитал сам): 14 дефиниций совпадают с каталогом;
  8 уровней / **495 снимков** / все 11 `sprite` id / **0 расхождений** ключа, текстуры, кадра, flip,
  visible, playing; restart — `anims.size` 14; пул врагов переключает `chunk1↔chunk2` через анимацию;
  интервалы кадров 71.7 мс (≈13.9 fps) и 114.7 мс (≈8.7 fps); консоль — только WebGL `ReadPixels`.
- QA-гейт: строка на каждый пункт приёмки (A1–A8), негативные N1–N7, D16, API; факты со ссылками на
  файлы, полный прогон, ручной UI-сценарий и «Уборка» на месте. Формальных пробелов нет.

## Следующий шаг для Dev

Нет: доработка не требуется, стори можно ставить `DONE`.

## Уборка

| Что запускал | Итог |
|---|---|
| `npm test`, узкий vitest, `npm run typecheck` | завершились, фоновых задач нет |
| `npm run test:e2e` | Playwright собрал `build/`, поднял и остановил 4173; после прогона 4173 свободен (только TIME_WAIT) |
| Сервер 5173 (PID 43528, существовал до ревью) | не трогал |
| git | операций не было, дерево не менял |
