# Use the official Python 3.12 image (Hugging Face recommends 3.10+, we match your local env)
FROM python:3.12-slim

# Set up a new user named "user" with user ID 1000
# Hugging Face Spaces require the app to run as a non-root user
RUN useradd -m -u 1000 user

# Set the working directory
WORKDIR /app

# Switch to the non-root user
USER user

# Set environment variables for Hugging Face
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1

# Copy the requirements file into the container
COPY --chown=user:user requirements.txt .

# Install dependencies
# We use --no-cache-dir to keep the image size small
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy the rest of the backend application code
COPY --chown=user:user . .

# Hugging Face Spaces expose port 7860 by default
EXPOSE 7860

# Command to run the FastAPI application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]