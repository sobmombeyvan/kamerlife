/**
 * City editor — Stage D.
 * Stub keeps a clear integration point without claiming editor features work yet.
 */
export class EditorStub {
  private active = false;

  isActive(): boolean {
    return this.active;
  }

  /** Toggle reserved for Stage D UI button. */
  setActive(active: boolean): void {
    this.active = active;
    if (active) {
      console.info('[Editor] Mode reserved for Stage D — not implemented yet.');
    }
  }
}
