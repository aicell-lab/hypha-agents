# Use an image with Python 3.11
FROM python:3.11-slim

# Install git and other system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    jq \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN npm install -g pnpm@8

# Create a non-root user
RUN groupadd -r hypha_agent_platform && useradd -r -g hypha_agent_platform hypha_agent_platform

# Upgrade pip
RUN pip install --upgrade pip

# Set the working directory
WORKDIR /app/

# Copy only requirements first to leverage Docker cache
COPY requirements.txt requirements_test.txt pyproject.toml setup.py ./

# Install the required Python packages
RUN pip install -r requirements.txt
RUN pip install -e .

# Copy the rest of the repository to the image
COPY . .

# Create logs directory and set permissions
RUN mkdir -p /app/logs && \
    chmod 777 -R /app /app/logs && \
    chown -R hypha_agent_platform:hypha_agent_platform /app /app/logs

# Install frontend dependencies and build
RUN pnpm install
RUN pnpm build

# Add /app to the list of safe directories for Git
RUN git config --global --add safe.directory /app

# Switch to the non-root user
USER hypha_agent_platform

# Entry point for the application
CMD ["python", "-m", "hypha_agent_engine", "serve"]