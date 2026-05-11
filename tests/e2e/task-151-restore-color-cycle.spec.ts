import { test, expect } from '@playwright/test';
import { launchTmax } from './fixtures/launch';

// TASK-151 regression: restoring a previously-closed pane (Ctrl+Shift+T)
// must participate in the new-tab color cycle when the snapshot has no
// saved tabColor. Before the fix, restorePaneFromSnapshot unconditionally
// overwrote the auto-cycled color with snap.tabColor (= undefined), so a
// pane closed while autoColorTabs was off would come back colorless even
// after the user re-enabled auto-color.
//
// Scenario the test exercises:
//   1. Default pane attaches (autoColorTabs defaults to true).
//   2. Disable autoColorTabs, create a 2nd pane (it gets no color).
//   3. Close the 2nd pane (snapshot pushed with tabColor = undefined).
//   4. Re-enable autoColorTabs.
//   5. Trigger restoreClosedTerminal; accept the confirm dialog.
//   6. Restored pane should now have a tabColor from the palette.

const PALETTE_HEX = [
  '#F25022', '#7FBA00', '#00A4EF', '#FFB900',
  '#6264A7', '#00B7C3', '#C239B3', '#D83B01',
  '#737373', '#323130',
];

test('restoreClosedTerminal cycles a fresh color when snapshot has none', async () => {
  const { window, close } = await launchTmax();

  try {
    // Default pane spawns on first launch.
    await window.waitForSelector('.terminal-panel', { timeout: 15_000 });
    await window.waitForFunction(
      () => (window as any).__terminalStore?.getState().terminals.size >= 1,
      null,
      { timeout: 15_000 },
    );

    // Step 1: turn off auto-color and remember the original pane id so we
    // can identify the *restored* pane afterward.
    const originalIds: string[] = await window.evaluate(() => {
      const store = (window as any).__terminalStore;
      store.setState({ autoColorTabs: false });
      return [...store.getState().terminals.keys()] as string[];
    });

    // Step 2: spawn a 2nd pane while auto-color is off → it has no color.
    await window.evaluate(async () => {
      await (window as any).__terminalStore.getState().createTerminal();
    });
    await window.waitForFunction(
      () => (window as any).__terminalStore.getState().terminals.size >= 2,
      null,
      { timeout: 15_000 },
    );

    // Capture the colorless pane's id, then sanity-check it really has no color.
    const colorlessId: string = await window.evaluate((known) => {
      const store = (window as any).__terminalStore;
      const all = [...store.getState().terminals.keys()] as string[];
      return all.find((id) => !known.includes(id))!;
    }, originalIds);
    expect(colorlessId).toBeTruthy();
    const colorlessTabColor = await window.evaluate((id) => {
      return (window as any).__terminalStore.getState().terminals.get(id)?.tabColor ?? null;
    }, colorlessId);
    expect(colorlessTabColor).toBeNull();

    // Step 3: close the colorless pane → snapshot pushed with tabColor=undefined.
    await window.evaluate(async (id) => {
      await (window as any).__terminalStore.getState().closeTerminal(id);
    }, colorlessId);
    await window.waitForFunction(
      () => (window as any).__terminalStore.getState().closedTerminals.length >= 1,
      null,
      { timeout: 5_000 },
    );

    // Step 4: re-enable auto-color (without triggering colorizeAllTabs side
    // effects on existing panes — we want to isolate the restore behavior).
    await window.evaluate(() => {
      (window as any).__terminalStore.setState({ autoColorTabs: true });
    });

    // Step 5: trigger restore and accept the confirm dialog.
    const restorePromise = window.evaluate(() => {
      return (window as any).__terminalStore.getState().restoreClosedTerminal();
    });
    // Click the confirm button explicitly — keyboard.press('Enter') is
    // unreliable here because the terminal panel may still own focus.
    await window.waitForSelector('.app-dialog-btn-confirm', { timeout: 5_000 });
    await window.click('.app-dialog-btn-confirm');
    await restorePromise;

    // Step 6: a new pane should appear and it should have a palette color.
    await window.waitForFunction(
      (known) => {
        const store = (window as any).__terminalStore;
        const all = [...store.getState().terminals.keys()] as string[];
        return all.some((id) => !known.includes(id));
      },
      [...originalIds, colorlessId],
      { timeout: 15_000 },
    );

    const restoredTabColor: string | null = await window.evaluate((known) => {
      const store = (window as any).__terminalStore;
      const all = [...store.getState().terminals.entries()] as [string, any][];
      const restored = all.find(([id]) => !known.includes(id));
      return restored?.[1]?.tabColor ?? null;
    }, [...originalIds, colorlessId]);

    // The actual regression assertion: restored pane has a palette color.
    expect(restoredTabColor).not.toBeNull();
    expect(PALETTE_HEX).toContain(restoredTabColor);
  } finally {
    await close();
  }
});
