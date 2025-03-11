// Import with `import * as Sentry from "@sentry/node"` if you are using ESM
import * as Sentry from "@sentry/node";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

if (process.env.SENTRY_DSN) {
    console.log("Initing Sentry");
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
    });
}