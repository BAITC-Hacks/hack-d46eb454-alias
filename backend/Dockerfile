FROM python:3.14-slim

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend /app/backend
COPY tests /app/tests
COPY contracts /app/contracts

ENV PYTHONUNBUFFERED=1 \
    HACKALEM_DATA_DIR=/data

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
