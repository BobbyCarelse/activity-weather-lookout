import express from "express";
import rateLimit from "express-rate-limit";
import { createSchema, createYoga } from "graphql-yoga";
import { env } from "./config/env";
import { typeDefs } from "./graphql/schema";
import { resolvers } from "./graphql/resolvers";

const schema = createSchema({ typeDefs, resolvers });

const app = express();

app.use(
  rateLimit({
    windowMs: env.rateLimitWindowMs,
    limit: env.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

const yoga = createYoga({ schema });
app.use(yoga.graphqlEndpoint, yoga);

app.listen(env.port, () => {
  console.log(`Activity Weather Lookout listening on port ${env.port}`);
});
