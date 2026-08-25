import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";

function buildApp(max: number) {
  const app = express();
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: max,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.get("/graphql", (_req, res) => res.status(200).send("ok"));
  return app;
}

describe("rate limiter", () => {
  it("allows requests up to the configured limit", async () => {
    const app = buildApp(3);
    for (let i = 0; i < 3; i++) {
      const response = await request(app).get("/graphql");
      expect(response.status).toBe(200);
    }
  });

  it("rejects the request after the limit is exceeded, with a 429", async () => {
    const app = buildApp(3);
    for (let i = 0; i < 3; i++) {
      await request(app).get("/graphql");
    }
    const response = await request(app).get("/graphql");
    expect(response.status).toBe(429);
  });
});
