const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'loan_system',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000, // 10 seconds
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Convert pool.promise() to use promises
const promisePool = pool.promise();

// Test the connection
promisePool.query('SELECT 1')
    .then(() => {
        console.log('Successfully connected to MySQL database');
    })
    .catch((err) => {
        console.error('Error connecting to MySQL database:', err);
        console.log('Please make sure:');
        console.log('1. MySQL server is running');
        console.log('2. Database credentials are correct');
        console.log('3. Database "loan_system" exists');
    });

module.exports = promisePool; 