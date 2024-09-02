// db.js
const postgres = require('postgres');

const pgExecute = postgres({
    host: process.env.DB_HOST,            // Postgres ip address[s] or domain name[s]
    port: process.env.DB_PORT,          // Postgres server port[s]
    database: process.env.DB_DB,            // Name of database to connect to
    username: process.env.DB_USER,            // Username of database user
    password: process.env.DB_PW,            // Password of database user
});

module.exports = pgExecute;