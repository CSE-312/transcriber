module.exports = {
    apps: [{
        name: 'trans',
        script: 'bun',
        args: 'src/index.ts',
        instances: 'max',
        exec_mode: 'cluster',
        watch: false,
        max_memory_restart: '1G',
        env: {
            NODE_ENV: 'development'
        },
        env_production: {
            NODE_ENV: 'production'
        },
        error_file: 'logs/err.log',
        out_file: 'logs/out.log',
        merge_logs: true,
        max_restarts: 10,
        restart_delay: 4000
    }]
};
