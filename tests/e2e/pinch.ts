import type { Page } from "@playwright/test";

export async function pinchZoom(page: Page, selector = ".elevation-scroll", factor = 2.5) {
  const area = page.locator(selector);
  await area.scrollIntoViewIfNeeded();
  const box = (await area.boundingBox())!;
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const session = await page.context().newCDPSession(page);
  const send = (type: "touchStart" | "touchMove" | "touchEnd", distance: number) =>
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [
        { x: mid.x - distance, y: mid.y, id: 1 },
        { x: mid.x + distance, y: mid.y, id: 2 },
      ],
    });
  await send("touchStart", 30);
  for (let i = 1; i <= 8; i++) {
    await send("touchMove", 30 * (1 + (factor - 1) * i / 8));
    await page.waitForTimeout(20);
  }
  await send("touchEnd", 0);
  await session.detach();
}
