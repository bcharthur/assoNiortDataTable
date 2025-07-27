# Dockerfile
FROM python:3.12-slim

# Dépendances système pour psycopg2 + client postgres (pg_isready)
RUN apt-get update \
 && apt-get install -y gcc libpq-dev postgresql-client \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=app.py
ENV FLASK_ENV=development
EXPOSE 5000

# Petit script d’attente Postgres
CMD bash -c '\
  echo "⏳ waiting for postgres..." ; \
  until pg_isready -h db -p 5432 -U astroweb ; do sleep 1 ; done ; \
  echo "✅ postgres is ready" ; \
  flask db upgrade ; \
  exec flask run --host=0.0.0.0'
