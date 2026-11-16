module.exports = {
  apps: [
    {
      name: 'tiwlo-backend',
      script: './server/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_restarts: 20,
      min_uptime: '5s',
      restart_delay: 2000,
      exp_backoff_restart_delay: 500,
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000
      }
    }
  ]
};
