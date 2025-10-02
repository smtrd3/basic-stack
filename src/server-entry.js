import { Hono } from "hono";
const app = new Hono();

app.get("/api/health-check", async (c) => {
  await new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, 2000);
  });

  return c.json({
    status: "Live",
  });
});

export default {
  fetch: app.fetch,
  router: app.router,
  port: process.env.PORT || 3000,
};
