import { test, expect, type Page } from "@playwright/test";
async function nativeMock(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.isTauri = true;
    const snapshot = {
      deviceName: "My desktop",
      peerName: "My Android",
      connected: true,
      addresses: ["192.168.1.10"],
      history: [],
      autoCopy: true,
      notifications: true,
      startup: false,
      error: null,
    };
    w.testState = { snapshot, calls: [], fail: false, delay: 0 };
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => 1,
      invoke: async (cmd: string, args: any) => {
        w.testState.calls.push({ cmd, args });
        if (cmd === "snapshot") return JSON.parse(JSON.stringify(snapshot));
        if (cmd === "send_text") {
          await new Promise((r) => setTimeout(r, w.testState.delay));
          if (w.testState.fail)
            throw new Error(
              "Receipt unconfirmed. Retry from transfer history.",
            );
          snapshot.history.unshift({
            id: args.id,
            text: args.text,
            createdAt: Date.now(),
            direction: "sent",
            status: "delivered",
            peer: "My Android",
          } as never);
          return;
        }
        if (cmd === "plugin:clipboard-manager|read_text")
          return "From my clipboard";
        if (cmd === "plugin:event|listen") return 1;
        return;
      },
    };
    w.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  });
}
async function go(page: Page, name: string) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
}
test("browser preview keeps the draft and is honest about native connectivity", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Quanta text" })
    .fill("A thought worth keeping");
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Quanta text" })).toHaveValue(
    "A thought worth keeping",
  );
  await expect(
    page.getByText("BROWSER PREVIEW", { exact: false }),
  ).toBeVisible();
  await expect(page.locator(".tunnel-button")).toBeDisabled();
});
test("desktop Tunnel button sends once and history defaults to Received", async ({
  page,
}) => {
  await nativeMock(page);
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Quanta text" })
    .fill("Hello through the barrier 🌀");
  await page.locator(".tunnel-button").click();
  await expect(page.getByRole("textbox", { name: "Quanta text" })).toHaveValue(
    "",
  );
  expect(
    await page.evaluate(
      () =>
        (window as any).testState.calls.filter(
          (c: any) => c.cmd === "send_text",
        ).length,
    ),
  ).toBe(1);
  await go(page, "Transfer history");
  await expect(
    page.getByRole("button", { name: "Received", exact: true }),
  ).toHaveClass(/selected/);
  await page.getByRole("button", { name: "Sent", exact: true }).click();
  await expect(page.locator(".history-item")).toContainText(
    "Hello through the barrier 🌀",
  );
});
test("clipboard paste appends and failed sends preserve text", async ({
  page,
}) => {
  await nativeMock(page);
  await page.goto("/");
  const input = page.getByRole("textbox", { name: "Quanta text" });
  await input.fill("Existing thought");
  await page.getByRole("button", { name: "Paste from clipboard" }).click();
  await expect(input).toHaveValue("Existing thought\nFrom my clipboard");
  await page.evaluate(() => {
    (window as any).testState.fail = true;
  });
  await input.press("Control+Enter");
  await expect(page.getByRole("status")).toContainText("Receipt unconfirmed");
  await expect(input).toHaveValue("Existing thought\nFrom my clipboard");
});
test("theme switches persist and preserve an in-flight draft", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "Quanta text" })
    .fill("Preserve my thought");
  await go(page, "Appearance & settings");
  await page.getByRole("button", { name: "Dune", exact: true }).click();
  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await page.reload();
  await go(page, "Appearance & settings");
  await expect(page.getByLabel("Appearance", { exact: true })).toHaveValue(
    "dark",
  );
  await expect(
    page.getByRole("button", { name: "Dune", exact: true }),
  ).toHaveClass(/selected/);
  await go(page, "Tunnel");
  await expect(page.getByRole("textbox", { name: "Quanta text" })).toHaveValue(
    "Preserve my thought",
  );
});
test("desktop and narrow preview layouts have no horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  for (const size of [
    { width: 1140, height: 850 },
    { width: 404, height: 880 },
  ]) {
    await page.setViewportSize(size);
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `artifacts/${size.width === 404 ? "phone-layout" : "desktop-preview"}.png`,
      fullPage: true,
    });
  }
});
