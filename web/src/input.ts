export class Input {
  private down = new Set<string>();
  private hits = new Set<string>();

  constructor(target: EventTarget = window) {
    target.addEventListener("keydown", (e) => {
      const ev = e as KeyboardEvent;
      if (!ev.repeat && !this.down.has(ev.code)) this.hits.add(ev.code);
      this.down.add(ev.code);
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(ev.code)) {
        ev.preventDefault();
      }
    });
    target.addEventListener("keyup", (e) => {
      const ev = e as KeyboardEvent;
      this.down.delete(ev.code);
    });
    window.addEventListener("blur", () => this.down.clear());
  }

  isDown(...codes: string[]): boolean {
    return codes.some((c) => this.down.has(c));
  }

  wasPressed(...codes: string[]): boolean {
    return codes.some((c) => this.hits.has(c));
  }

  endFrame(): void {
    this.hits.clear();
  }
}
