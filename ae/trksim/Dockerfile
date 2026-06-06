FROM python:3.12-slim

RUN apt update && apt install -y curl

WORKDIR /app

RUN pip install --no-cache-dir flask

COPY app.py /app/app.py
COPY index.html /app/index.html

EXPOSE 80

ENTRYPOINT ["python", "app.py"]
