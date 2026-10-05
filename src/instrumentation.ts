/** Runs once when the server starts. A bad production configuration stops the server here instead of failing later. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertConfig } = await import("./server/config");
    assertConfig();
  }
}
