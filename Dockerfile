# ---- Étape 1 : build du front (Node n'est JAMAIS requis sur le PC) ----
FROM node:22-alpine AS front
WORKDIR /front
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- Étape 2 : image finale Python qui sert l'API + le front buildé ----
FROM python:3.12-slim AS app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
# ping : vrai ICMP vers le Raspberry Pi (repli TCP automatique s'il est indisponible)
RUN apt-get update && apt-get install -y --no-install-recommends iputils-ping && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY content ./content
COPY --from=front /front/dist ./static
RUN useradd -r -u 10001 cyber && mkdir /data && chown cyber /data
USER cyber
EXPOSE 8000
# Un seul process (hub WebSocket en mémoire) ; PAS de --proxy-headers : on garde l'IP réelle.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
