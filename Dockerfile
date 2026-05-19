# ── Build stage ───────────────────────────────────────────────────────────────
# Uses a slim Python image to keep the final container small.
# The app runs in --server mode: it reads the pre-built DB from the repo
# and never downloads or rebuilds data at runtime.
# ──────────────────────────────────────────────────────────────────────────────

FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies first (layer is cached unless requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the project
COPY . .

# Hugging Face Spaces routes external traffic to port 7860
ENV PORT=7860

EXPOSE 7860

CMD ["python", "main.py", "--server"]
