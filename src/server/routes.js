import express from "express";

const routes = express.Router();

routes.get("/health-check", (_, res) => {
  res.json({ status: "ok" });
});

export default routes;
