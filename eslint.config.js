module.exports = [
    {
        files: ["**/*.js"], // Archivos a los que se aplicarán las reglas
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module', // Si estás usando módulos ES (import/export)
            globals: {
                browser: true,
                commonjs: true,
                es2021: true,
                node: true, // Define las variables globales de Node.js
            },
        },
        plugins: {
            'bot-whatsapp': require('eslint-plugin-bot-whatsapp'), // Debes asegurarte de cargar los plugins correctamente
        },
        rules: {
            // Puedes agregar reglas personalizadas aquí si es necesario
        },
    },
];
