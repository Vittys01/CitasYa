-- Add OWNER to Role enum (must be in its own migration so it is committed before use)
ALTER TYPE "Role" ADD VALUE 'OWNER';
