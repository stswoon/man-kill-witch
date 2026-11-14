# S06 — Анимации персонажей и врагов на this.anims

**Статус:** OPEN

**Дорожка:** анимации.

**Параллель:** S05, S07, S08, S09 — по файлам. Не параллелить: S10 (каталог анимаций), S11 (`view/characters` / `game.ts`).

**Зависит от:** S01 (`web/src/view/character-view.ts`).

**Разблокирует:** S10 (каталог/`door-open`), S11 (`view/characters`).

## Цель

Перевести анимации героя и врагов на Phaser AnimationManager и убрать ручной выбор кадров
по `game.tick`, не меняя арт и правила.

## В scope

- `web/src/animation-catalog.ts` — чистые данные `ANIMATIONS` без импорта Phaser:
  - `hero-idle` (hero, кадр 0), `hero-run` (1–6, 14 fps), `hero-jump` (13);
  - `enemy-2`…`enemy-12` — по одной анимации на `Enemy.sprite`, группы из
    `docs/spec/05-animation.md`; 8.75 fps, repeat `-1`.
- `web/src/animations.ts` — `registerAnimations(scene)` с защитой от повторной регистрации.
- `web/src/view/character-view.ts`:
  - `play(key, true)` для игрока и врагов;
  - выбор `hero-idle / hero-run / hero-jump` по `onGround` и `abs(vx) > 8`;
  - `flipX = facing > 0`; у врагов `flipX = dir > 0` и ключ `enemy-<Enemy.sprite>`;
  - flip-логику **не менять**: старый и новый арт смотрят влево;
  - создать спрайт врага с текстурой по `Enemy.sprite` (2–8 — `chunk1`, 9–12 — `chunk2`);
  - удалить `Math.floor(tick / 5)`, `Math.floor(tick / 8)`, `setTexture(key, frame)`.
- `tests/animation-catalog.test.ts` — ключи, текстуры, диапазоны, fps, repeat.

## Вне scope

- Новый арт (S05), HUD, тайлсет, титульный экран, дверь.
- `game.ts`, `Enemy.sprite`, `SPRITE_BY_ID`, `tests/enemy.test.ts`: визуальные варианты и
  поведение не меняются.
- Arcade Physics, изменение чисел и правил.

## Папки (только эти)

```
web/src/animation-catalog.ts
web/src/animations.ts
web/src/view/character-view.ts
web/src/phaser-view.ts        (только композиция/импорты, если нужно)
tests/animation-catalog.test.ts
```

## Публичный API

`ANIMATIONS`, `AnimationSpec`, `registerAnimations(scene)`. `Enemy.sprite` и
`SPRITE_BY_ID` не меняются.

## Приёмка

- Герой: idle/run/jump; все визуальные варианты врагов (`enemy-2`…`enemy-12`) играют свои
  группы; смена направления без «дёрганья».
- В `view` нет выбора кадров по `tick`; анимации не перезапускаются каждый кадр.
- Работает и со старым артом (до S05), и с новым (после S05).
- `npm test`, `npm run typecheck`, `npm run test:e2e` проходят; консоль без предупреждений
  Phaser о повторной регистрации.
- `tests/animation-catalog.test.ts` зелёный; ручная проверка fps 14 / 8.75.

## Не делать

- Не менять арт, имена текстур, `SPRITE_BY_ID` и `Enemy.sprite`.
- Не переносить игровые события в анимации.
- Не менять физику, скорости, урон, двери, очки и уровни.
- Не трогать HUD и тайлсет.
