# S07 — Новый HUD: панель и bitmap-шрифт

**Статус:** OPEN

**Дорожка:** HUD / UI.

**Параллель:** S05, S06, S08 — по файлам; S09 (тайлсет) — по файлам. Не параллелить: S02
(общие `assets.ts` / `content.test.ts`) — S02 идёт раньше.

**Зависит от:** S01 (`web/src/view/hud-view.ts`), S02 (общие `web/src/assets.ts` и
`tests/content.test.ts`).

**Разблокирует:** S10 (текстура двери, `assets.ts`, `boot-scene.ts`, `content.test.ts`).

## Цель

Заменить системный `Phaser.GameObjects.Text` в HUD на оригинальную панель и bitmap-шрифт,
сохранив состав и расположение строк.

## В scope

- `web/public/assets/hud.png` — оригинальная панель `136×24`, EGA, без сглаживания.
- `web/public/assets/fonts/hud.png` + `hud.xml` — оригинальный моноширинный bitmap-шрифт:
  глифы `A–Z`, `0–9`, пробел, `/`; ячейка глифа `5×7`, `xadvance = 6`, `lineHeight = 8`.
- `web/src/assets.ts`: константы `HUD_TEXTURE = "hud"`, `HUD_FONT = "hud-font"`.
- `web/src/scenes/boot-scene.ts`: `load.image(HUD_TEXTURE, ...)`,
  `load.bitmapFont(HUD_FONT, png, xml)`.
- `web/src/view/hud-view.ts`: панель + `BitmapText`; те же строки:
  - `LVL {n}/8   LIVES {lives}`
  - `AMMO {ammo}   SCORE {score}`
  Позиции: панель `(0,0)`, строки `(4,3)` и `(4,13)`, `scrollFactor(0)`, глубины как
  раньше (панель 100, текст 101).
- `tests/content.test.ts`: добавить файлы в манифест; проверить размеры PNG и наличие
  обязательных глифов в XML.

## Вне scope

- Изменение состава/смысла HUD, локализация, новые счётчики.
- Титульный экран, сообщения `GAME OVER`/`WIN`, спрайты, тайлсет, физика.
- Системный шрифт, `Phaser.GameObjects.Text` для HUD.

## Папки (только эти)

```
web/public/assets/hud.png
web/public/assets/fonts/hud.png
web/public/assets/fonts/hud.xml
web/src/assets.ts
web/src/scenes/boot-scene.ts
web/src/view/hud-view.ts
tests/content.test.ts
```

## Публичный API

Новые текстуры/ключи `hud`, `hud-font`; `SPRITE_NAMES` не меняется; строки HUD не меняются.

## Приёмка

- В `play` видна новая панель и bitmap-шрифт; значения обновляются на уровне, при выстреле,
  подборе и смерти.
- На `title` HUD не виден; на `gameover`/`win` остаётся как раньше.
- `npm test` (включая манифест и глифы), `npm run typecheck`, `npm run test:e2e` проходят;
  консоль чистая.
- Ручная проверка: все строки читаемы, не выходят за панель, нет обрезки глифов.
- В стори/PR одна фраза о провенансе шрифта и панели.

## Не делать

- Не менять строки, порядок и смысл HUD.
- Не добавлять нижний/полноэкранный HUD и новые элементы.
- Не трогать `title1.png`, спрайты, `tiles.png`, `game.ts`.
