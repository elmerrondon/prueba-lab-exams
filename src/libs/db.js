import mysql from 'mysql2/promise';

let pool;

/**
 * Configuración del Pool de Conexiones.
 * Lee las credenciales de la base de datos desde las variables de entorno.
 */
const config = {
    // Credenciales leídas desde el archivo .env
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT, 

    // Opciones estándar para un pool eficiente
    waitForConnections: true,
    connectionLimit: 10, // Límite de conexiones simultáneas en el pool
    queueLimit: 0,
    
    ssl: {
        rejectUnauthorized: true
    }
};

if (process.env.NODE_ENV === 'production') {
    // En producción, simplemente se crea el pool de conexiones.
    pool = mysql.createPool(config);
} else {
    // En desarrollo, usamos 'global' para asegurar que solo exista un pool 
    // y evitar problemas de duplicación de conexiones debido al Hot Reloading de Next.js.
    if (!global.mysqlPool) {
        global.mysqlPool = mysql.createPool(config);
    }
    pool = global.mysqlPool;
}

export default pool;
