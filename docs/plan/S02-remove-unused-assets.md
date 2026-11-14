# S02 — Удалить неиспользуемые оригинальные ассеты

**Статус:** DONE

**Дорожка:** ассеты.

**Параллель:** S01, S03, S04 — по файлам. S06/S07 идут позже (зависят от S01), пересечения файлов с S02 нет.

**Зависит от:** нет.

**Разблокирует:** S07 (общие `web/src/assets.ts` и `tests/content.test.ts`); транзитивно —
S10.

## Цель

Убрать из репозитория неиспользуемые файлы старой игры и привести манифест ассетов в
соответствие коду.

## В scope

- Удалить:
  - `web/public/assets/PROGPIC.bin`
  - `web/public/assets/STARPIC.bin`
  - `web/public/assets/title2.png`
  - `web/public/assets/sprites/s_frank.png`
  - `web/public/assets/sprites/s_frank.json`
  - `web/public/assets/sprites/s_master.png`
  - `web/public/assets/sprites/s_master.json`
  - `web/public/assets/sprites/s_hero.json`
  - `web/public/assets/sprites/s_chunk1.json`
  - `web/public/assets/sprites/s_chunk2.json`
- `web/src/assets.ts`: `SPRITE_NAMES` → `["hero", "chunk1", "chunk2"]`.
- `tests/content.test.ts`: ожидаемый манифест без удалённых файлов; добавить проверку, что
  старые JSON-метаданные отсутствуют (код и тесты их не используют).
- Проверить, что в коде, тестах, HTML и документации не осталось ссылок на `frank`,
  `master`, `title2`, `PROGPIC`, `STARPIC`, `s_hero.json`, `s_chunk1.json`,
  `s_chunk2.json`.

## Вне scope

- Замена используемого арта (`tiles.png`, `title1.png`, `s_hero.png`, `s_chunk1.png`,
  `s_chunk2.png`) — S03/S05/S09.
- Уровни, `tileinfo.json`, структура JSON.

## Папки (только эти)

```
web/public/assets/  (только перечисленные файлы)
web/src/assets.ts
tests/content.test.ts
```

## Публичный API

`SPRITE_NAMES` теряет `frank` и `master`; BootScene больше не загружает эти текстуры.
Остальные ключи не меняются.

## Приёмка

- Перечисленных файлов нет в `web/public/assets/` и в `build/assets/` после сборки.
- `npm test`, `npm run typecheck`, `npm run test:e2e` проходят; консоль чистая.
- Поиск по репозиторию не находит ссылок на удалённые имена.
- Используемый арт и уровни не изменились.

## Не делать

- Не удалять и не переименовывать используемые текстуры.
- Не менять `tileinfo.json`, `levels/*.json`, `assets.ts` сверх `SPRITE_NAMES`.
- Не трогать бинарные файлы «на всякий случай».
