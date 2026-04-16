import time, os, sys
import psycopg2

url = os.getenv("DATABASE_URL", "postgresql://budget_user:budget_password@db:5432/budget_app")

for attempt in range(30):
    try:
        conn = psycopg2.connect(url)
        conn.close()
        print("Database ready.")
        sys.exit(0)
    except psycopg2.OperationalError:
        print(f"Waiting for database... ({attempt + 1}/30)")
        time.sleep(2)

print("Database not reachable after 60s. Exiting.")
sys.exit(1)
