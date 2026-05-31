FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements-gcp.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-gcp.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini ./

ENV PYTHONUNBUFFERED=1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
