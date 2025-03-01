module.exports = {
    apps: [{
        name: 'transcriber',
        script: './dist/index.js',
        instances: 'max',
        exec_mode: 'cluster',
        source_map_support: true,
        node_args: [
            '--enable-source-maps'
        ]
    }]
};
