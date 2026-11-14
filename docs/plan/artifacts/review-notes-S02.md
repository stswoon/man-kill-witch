# Review notes S02

**Решение: LEAD_PASS**

## Гейт QA

`docs/plan/artifacts/bug-report-S02.md`: `QA_PASS` с матрицей A1–A14 (строка на каждый пункт приёмки и D12), фактическими
свидетельствами (команды, git-статус, хеши уровней, HTTP 404 на удалённые ассеты, сеть браузера), полным прогоном
test/typecheck/build/e2e, обязательным ручным UI-сценарием на `localhost:5173` (title → play, ходьба, выстрел, уровни
1–8) и заполненной «Уборкой». Формального прохода нет.

## Независимая проверка

- Diff по путям S02: ровно 10 удалений в `web/public/assets`, одна строка в `web/src/assets.ts`
  (`SPRITE_NAMES = ["hero", "chunk1", "chunk2"]`), +20 строк в `tests/content.test.ts` (`REMOVED_ASSETS` и тест
  `does not contain the removed legacy files`). Других изменений S02 не вносил.
- `SPRITE_NAMES` в коде используется только `boot-scene.ts` (загрузка) и `tests/content.test.ts` (манифест);
  `web/src/view/character-view.ts` ссылается только на `hero`/`chunk1`/`chunk2`. `frank`/`master` не используются.
- Runtime-поиск: 0 совпадений в `web/src`, `web/index.html`, `e2e`; в `build/bundle.js` и `build/index.html` — 0 по
  `frank|title2|PROGPIC|STARPIC|s_master.*|s_hero.json|s_chunk1.json|s_chunk2.json`. Прочие упоминания — только
  `docs/spec/03-art.md` §4, `docs/plan/*` и guard-тест, что разрешено D12.
- `tools/build.mjs` перед копированием делает `rm(build)` и копирует `web/public`; после прогона в `build/assets`
  14 файлов, ни одного удалённого.
- Сам прогнал: `npm test` — 7 файлов / 101 тест passed; `npm run typecheck` — exit 0; `npm run test:e2e` — 10 passed
  (4 `game.spec.ts` + 6 `physics.spec.ts` S04). Порт 4173 был свободен, конфликта не было.
- Используемый арт и уровни: `git status`/`diff` чист по `levels/*.json`, `tileinfo.json`, `tiles.png`,
  `s_hero.png`, `s_chunk1.png`, `s_chunk2.png`. `M title1.png` — параллельная S03 (её эксклюзивный путь), к S02
  не относится.
- D12: выполнен — код и тесты соответствуют границам решения, спека §4 прямо перечисляет удалённые файлы, имена
  текстур `hero/chunk1/chunk2` сохранены (spec §2). Расхождения со спекой нет.

## Замечания по severity

**Блокеры:** нет.

**Расхождения со спекой:** нет.

**Замечания (info, действий не требуют):**

1. Буквальный grep токена `master` по `build/bundle.js` даёт совпадения Phaser (license URL `.../blob/master/...`,
   `masterMuteNode`/`masterVolumeNode`) — это не ссылки на `s_master`; при повторном аудите искать
   `s_master`, `frank`, `title2`, `PROGPIC`, `STARPIC`.
2. Guard-тест проверяет отсутствие только в `web/public/assets`; `build/assets` генерируется с полной очисткой
   `build/` — проверено сборкой, регрессии не будет.
3. `REMOVED_ASSETS` дублирует перечень из спеки/стори — синхронизировать три места при будущих переименованиях.
4. В QA-отчёте A4 команда указана без `--noEmit` (фактический script — с `--noEmit`); exit 0 воспроизведён, на
   вывод не влияет.

## Следующий шаг для Dev

Нет — `LEAD_PASS`, оркестратор может поставить S02 `DONE`.

## Уборка

| Что запускал | Остановлено | Комментарий |
|---|---|---|
| `npm test`, `npm run typecheck` | n/a | Короткие процессы, завершились сами |
| `npm run test:e2e` | Да | Playwright собрал `build/` и остановил свой сервер; после прогона `Get-NetTCPConnection -LocalPort 4173` пуст |
| Чтение файлов / grep | n/a | Только чтение |

Замеченный до меня dev-сервер на 5173 и процессы параллельных стори не трогал. Дерево не мутировал, `git`-операций и
коммитов не делал, статусы стори не менял.
