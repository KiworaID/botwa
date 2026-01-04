import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const { DB_USER, DB_PASS, DB_HOST, DB_NAME } = process.env;
const databaseUrl = `mysql://${DB_USER}:${DB_PASS}@${DB_HOST}:3306/${DB_NAME}`;

const prisma = new PrismaClient({
    datasources: {
        db: {
            url: databaseUrl,
        },
    },
});

export default prisma;
