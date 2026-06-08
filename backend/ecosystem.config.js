module.exports = {
  apps: [
    {
      name: 'leiloes2026-api',
      script: './dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 8500,
      },
    },
  ],
};
