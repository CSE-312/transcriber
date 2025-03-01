module.exports = {
    apps: [{
        name: 'transcriber',
        script: 'npm',
        args: 'start',
        instances: 'max',
        exec_mode: 'cluster',
        watch: false,
        max_memory_restart: '1G',
        merge_logs: true,
        max_restarts: 10,
        restart_delay: 4000,
        source_map_support: true,
        node_args: [
            '--enable-source-maps'
        ]
    }]
};
