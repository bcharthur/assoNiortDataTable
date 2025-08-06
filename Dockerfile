# Dockerfile – image de l’application Flask
FROM python:3.12-slim

# libs système pour psycopg2 & psutil
RUN apt-get update \
 && apt-get install -y build-essential libpq-dev procps \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# On copie le code à la fin (cache build)
COPY . .

ENV PYTHONUNBUFFERED=1
ENV FLASK_ENV=production

CMD ["gunicorn", "-b", "0.0.0.0:8000", "app:app"]
