module.exports = [
    {
        files: ["**/*.js"], // Archivos a los que se aplicarán las reglas
        env: {
            browser: true,
            commonjs: true,
            es2021: true,
            node: true, // Se añade directamente el entorno de Node.js
        },
        parserOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module', // Se ajusta si estás usando módulos ES (import/export)
        },
        plugins: ['bot-whatsapp'],
        extends: ['plugin:bot-whatsapp/recommended'],
        rules: {
            // Puedes agregar reglas personalizadas aquí si es necesario
        },
    },
];