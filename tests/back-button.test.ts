// 返回鍵（第 80 輪，D-212）：面板上點「返回／關閉／離開／完成／繼續」，有後果的按鈕（認輸離開、取／還）不點
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => {
  class Text {
    text: string; visible = true; alpha = 1; active = true; parentContainer: unknown = null; x = 0; y = 0;
    private h: Record<string, (() => void)[]> = {};
    constructor(text: string) { this.text = text; }
    on(e: string, f: () => void) { (this.h[e] ??= []).push(f); return this; }
    listenerCount(e: string) { return this.h[e]?.length ?? 0; }
    emit(e: string) { for (const f of this.h[e] ?? []) f(); return true; }
  }
  return { default: { Scenes: { Events: { SHUTDOWN: 'shutdown' } }, GameObjects: { Text } } };
});

const Phaser = (await import('phaser')).default as unknown as { GameObjects: { Text: new (t: string) => { on(e: string, f: () => void): unknown; visible: boolean } } };
const { clickBackButton, pressBack, setBackHandler, BACK_LABELS } = await import('../src/game/backButton');

function btn(label: string, hit: string[], visible = true) {
  const t = new Phaser.GameObjects.Text(label);
  t.visible = visible;
  t.on('pointerdown', () => hit.push(label));
  return t;
}

describe('返回鍵', () => {
  it('沒有場景登記時交給系統（離開）', () => {
    expect(pressBack()).toBe('exit');
  });

  it('場景登記的處理器會被呼叫、場景關掉後清掉', () => {
    let off: (() => void) | undefined;
    const scene = { events: { once: (_e: string, f: () => void) => { off = f; } } };
    setBackHandler(scene as never, () => 'handled');
    expect(pressBack()).toBe('handled');
    off!();
    expect(pressBack()).toBe('exit');
  });

  it('「返回」優先於「完成」；看不到的按鈕不點', () => {
    const hit: string[] = [];
    const ok = clickBackButton([btn('完成', hit), btn('返回', hit, false), btn('返回', hit)] as never);
    expect(ok).toBe(true);
    expect(hit).toEqual(['返回']);
  });

  it('抉擇（取／還）、認輸離開這種有後果的按鈕不會被返回鍵按到', () => {
    const hit: string[] = [];
    expect(clickBackButton([btn('取', hit), btn('還', hit), btn('就這麼做', hit), btn('認輸離開', hit)] as never)).toBe(false);
    expect(hit).toEqual([]);
    for (const l of BACK_LABELS) expect(['取', '還', '認輸離開', '就這麼做', '回標題', '重來']).not.toContain(l);
  });
});
