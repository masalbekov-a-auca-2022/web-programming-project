FROM python:3.9-slim

WORKDIR /app

# Install system dependencies needed for numpy and other packages
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements file first for better caching
COPY requirements.txt .

# Install dependencies in the correct order
RUN pip install --no-cache-dir numpy==1.23.5 && \
    pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make the Flask app accessible from outside the container
ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0

# Expose the port the app runs on
EXPOSE 5000

# Run the application
CMD ["python", "app.py"]