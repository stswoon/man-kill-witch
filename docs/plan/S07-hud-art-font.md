# S07 — Новый HUD: панель и bitmap-шрифт

**Статус:** CANCELLED

**Причина отмены:** требование заменено HD-направлением 2026-11-15. EGA-панель `136×24`,
bitmap-шрифт `5×7` и незакоммиченные правки S07 (`assets.ts`, `boot-scene.ts`,
`hud-view.ts`, `content.test.ts`) не входят в HD-ветку. HD-HUD делает `S17`.

**Дорожка:** HUD / UI.

**Параллель:** нет.

**Зависит от:** нет.

**Разблокирует:** нет; заменено на S17.

## Цель

~~Заменить системный `Phaser.GameObjects.Text` в HUD на оригинальную панель и bitmap-шрифт
`5×7`.~~ Отменено: HD-панель `680×120` и шрифт `25×35` делает `S17`.

## В scope

- ~~`hud.png` `136×24`, `fonts/hud.png` + `hud.xml`, ячейка `5×7`.~~
- ~~Размеры и строки HUD.~~

Актуальный контракт — `docs/spec/03-art.md` §2.

## Вне scope

- Код, титульный экран, спрайты, тайлсет, физика.

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

Не меняется: ключи `hud`, `hud-font`; состав строк HUD. HD-размеры — `S17`.

## Приёмка

Стори отменена; приёмка не проводится. HD-HUD принимается по `S17`.

## Не делать

- Не сливать EGA-панель, шрифт `5×7` и правки S07 в HD-ветку.
- Не менять строки и смысл HUD.
