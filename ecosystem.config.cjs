module.exports = {
  apps: [
    {
      name: "trans",
      script: "src/index.ts", // Entry point of your application
      interpreter: "bun",
      instances: "max",
      exec_mode: "cluster",
      env: {
        PORT: 5000,
        NODE_ENV: "production",
      },
    },
  ],
};
