#!/bin/sh
set -e

echo "Restoring database from backup..."
pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl /backups/backup.sql
echo "Database restore completed."
