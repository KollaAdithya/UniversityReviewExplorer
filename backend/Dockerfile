FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements-gcp.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-gcp.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

ENV PYTHONUNBUFFERED=1

CMD ["./docker-entrypoint.sh"]
