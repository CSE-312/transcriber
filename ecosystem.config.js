module.exports = {
  apps: [
    {
      name: "trans",
      script: "bun",
      args: "start",
      instances: "max",
      exec_mode: "cluster",
      env: {
        PORT: 5000,
        NODE_ENV: "production",
      },
    },
  ],
};
