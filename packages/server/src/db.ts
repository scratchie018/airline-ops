import { PrismaClient } from "@prisma/client";

// Single shared Prisma client for the process - creating one per request exhausts
// the DB connection pool under load, which matters at the 500+ user scale this is
// meant to handle.
export const prisma = new PrismaClient();
