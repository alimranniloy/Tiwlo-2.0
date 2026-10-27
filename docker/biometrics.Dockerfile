FROM python:3.12-slim

WORKDIR /opt/openbiometrics

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 libglib2.0-0 && \
    rm -rf /var/lib/apt/lists/*

COPY client/src/verification/engine/ ./

RUN pip install --no-cache-dir -e './engine[liveness]' && \
    pip install --no-cache-dir -e ./api

ENV OPENBIOMETRICS_MODEL_DIR=/opt/openbiometrics/engine/models
ENV PYTHONUNBUFFERED=1
WORKDIR /opt/openbiometrics/api

CMD ["sh", "-c", "python ../download_models.py --models yunet sface antispoofing --models-dir \"$OPENBIOMETRICS_MODEL_DIR\" && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
