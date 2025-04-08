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
RUN groupadd -r hypha_agents && useradd -r -g hypha_agents hypha_agents

# Upgrade pip
RUN pip install --upgrade pip

# Set the working directory
WORKDIR /app/

# Copy only requirements first to leverage Docker cache
COPY requirements.txt requirements_test.txt ./

# Install Python requirements
RUN pip install -r requirements.txt

# Copy the entire repository to include README.md and all other files
COPY . .

# Now install the package in editable mode after README.md is available
RUN pip install -e .

# Create logs directory and set permissions
RUN mkdir -p /app/logs && \
    chmod 777 -R /app /app/logs && \
    chown -R hypha_agents:hypha_agents /app /app/logs

# Install frontend dependencies and build
RUN pnpm install

# Accept build argument for NODE_OPTIONS
ENV NODE_OPTIONS="--max_old_space_size=8192"

# Build the frontend with increased memory limit
RUN pnpm build

# Add /app to the list of safe directories for Git
RUN git config --global --add safe.directory /app

# Switch to the non-root user
USER hypha_agents

# Entry point for the application
CMD ["python", "-m", "hypha_agents", "serve"]