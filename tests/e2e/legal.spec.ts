import { expect, test } from "@playwright/test";

test.describe.configure({ timeout: 120_000 });

test.describe("legal pages and health", () => {
  test("Privacy notice and Terms are reachable from Welcome, sign-up and Settings, say what the app does, and show Draft until reviewed", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Privacy notice" }).click();
    await expect(page.getByRole("heading", { name: "Privacy notice", level: 1 })).toBeVisible();
    await expect(page.getByTestId("legal-draft")).toContainText("has not been reviewed by a lawyer");
    await expect(page.getByText("We never ask for your Social Security number, A-Number, USCIS password, ID documents or answers to the N-400.")).toBeVisible();
    await expect(page.getByText("your voice may be sent to the company that makes it")).toBeVisible();
    await expect(page.getByText("OathSteps does not record or keep your audio")).toBeVisible();
    await expect(page.getByText("including the IP address and browser type used to sign in")).toBeVisible();
    await expect(page.getByText("The operator has not published a contact address")).toBeVisible();

    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: "Terms of use", level: 1 })).toBeVisible();
    await expect(page.getByText("It does not give legal advice, and using it does not create an attorney-client relationship.")).toBeVisible();
    const legalHelp = page.getByRole("link", { name: /Find legal services at USCIS/ });
    await expect(legalHelp).toHaveAttribute("href", "https://www.uscis.gov/avoid-scams/find-legal-services");
    await expect(legalHelp).toHaveAttribute("target", "_blank");

    await page.goto("/account");
    await expect(page.getByText("By creating an account you accept")).toContainText("Terms");
    await page.getByRole("link", { name: "Privacy notice" }).click();
    await expect(page).toHaveURL(/\/privacy$/);

    await page.goto("/settings");
    await expect(page.getByRole("link", { name: "Privacy notice" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Terms of use" })).toBeVisible();
  });

  test("the health endpoint reports ok without leaking anything else", async ({ request }) => {
    const r = await request.get("/api/health");
    expect(r.status()).toBe(200);
    expect(await r.json()).toEqual({ status: "ok" });
    expect(r.headers()["cache-control"]).toContain("no-store");
  });
});
