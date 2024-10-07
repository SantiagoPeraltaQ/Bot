module.exports = [
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                browser: true,
                commonjs: true,
                es2021: true,
                node: true,
            },
        },
        plugins: {
            'bot-whatsapp': require('eslint-plugin-bot-whatsapp'),
        },
        rules: {
            // Reglas personalizadas aquí
        },
    },
];