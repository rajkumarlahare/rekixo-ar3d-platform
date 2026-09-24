import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const nativeSetInterval = window.setInterval.bind(window);
    window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
      nativeSetInterval(
        handler,
        timeout === 20_000 ? 120 : timeout,
        ...args,
      )) as typeof window.setInterval;
  });
});

test("customer runtime boots once, opens cached gallery, and receives live status", async ({ page }) => {
  let publicDataRequests=0;
  let statusRequests=0;
  page.on("request",(request)=>{
    const url=new URL(request.url());
    if(url.pathname==="/api/public-data")publicDataRequests+=1;
    if(url.pathname==="/api/public-status")statusRequests+=1;
  });

  await page.goto("/project/index.html?projectId=browser-test&v=65");
  await expect(page.locator("html")).not.toHaveClass(/rekixo-project-loading/);
  await expect(page.locator(".brand b")).toContainText("BROWSER TEST PROJECT");
  await expect(page.locator("#countTotal")).toHaveText("1");

  await page.locator("#galleryBtn").click();
  await expect(page.locator("#galleryModal")).toHaveClass(/open/);
  await expect(page.locator("#clientGallery")).toContainText("Browser Site View");

  await expect.poll(()=>statusRequests).toBeGreaterThan(0);
  await expect(page.locator("#countSold")).toHaveText("1");
  expect(publicDataRequests).toBe(1);
});

test("paused public project renders intentional unavailable state", async ({ page }) => {
  await page.goto("/project/index.html?projectId=paused&v=65");
  await expect(page.locator("html")).toHaveClass(/rekixo-project-error/);
  await expect(page.locator("#rekixoBootErrorTitle")).toHaveText(
    "Project Temporarily Unavailable",
  );
  await expect(page.locator("#rekixoBootErrorText")).toContainText(
    "temporarily unavailable",
  );
});
