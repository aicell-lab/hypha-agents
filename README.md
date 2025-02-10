# Elia Platform

An enterprise-grade platform for building and deploying customizable AI agents specializing in telecom applications.

## 🎯 Overview

Elia Platform is a comprehensive solution for creating, managing, and deploying AI agents with deep telecom domain expertise. The platform provides:

- 🤖 **Customizable AI Agents**: Build specialized agents with telecom domain knowledge
- 📚 **Knowledge Integration**: Upload and manage domain-specific knowledge bases
- 🛠️ **Extensible Tools**: Create and share Python-based tools and workflows
- 🔄 **Real-time Communication**: Seamless WebSocket-based agent interactions

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- pnpm (v8 or higher)
- Python 3.9+

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/elia-platform.git
cd elia-platform

# Install frontend dependencies
cd frontend
pnpm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt

pip install -e .

# Start the development servers
pnpm dev
```

The application will be available at `http://localhost:3000`.

## 🛠️ Tech Stack

- **Frontend**
  - React 18 with TypeScript
  - TailwindCSS for styling
  - Hypha RPC for real-time communication
  - React Router for navigation

- **Backend**
  - Python-based microservices
  - schema-agents framework
  - Hypha for service orchestration
  - Artifact Manager for resource management

## 🏗️ Project Structure

```
elia-platform/
├── frontend/                # React + TypeScript frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/         # Page components
│   │   ├── services/      # Hypha service clients
│   │   └── types/         # TypeScript definitions
├── backend/
│   ├── services/          # Hypha services
│   ├── models/            # Pydantic models
│   └── utils/             # Shared utilities
└── agents/                # Agent definitions and configs
```

## 🧪 Development

### Available Scripts

- `pnpm dev`: Start development servers
- `pnpm build`: Build for production
- `pnpm test`: Run tests
- `pnpm lint`: Run linting

### Development Guidelines

- Follow TypeScript and Python type hints
- Write comprehensive documentation
- Include tests for critical functionality
- Follow established code style

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- The Hypha development team
- Our telecom industry partners
- All contributors and maintainers

---

<div align="center">
Made with ❤️ by the Elia Platform Team
</div>

# Elia Engine

Backend services for LLM and tool execution runtime for the Elia Platform.

## Setup Instructions

### Prerequisites

- Python 3.11 or higher
- pip or conda package manager

### Environment Setup

1. Create a new conda environment:
```bash
conda create -n elia-platform python=3.11
conda activate elia-platform
```

2. Install the package in development mode:
```bash
# Clone the repository (if you haven't already)
git clone <repository-url>
cd elia-engine

# Install in development mode
pip install -e .

# Install test dependencies (optional)
pip install -r requirements_test.txt
```

### Configuration

1. Create a `.env` file in the root directory:
```bash
touch .env
```

2. Add required environment variables to `.env`:
```env
# Required environment variables will be listed here
OPENAI_API_KEY=your_api_key_here
```

### Running the Engine

To start the engine:
```bash
# Using the CLI command
elia-engine

# Or using Python module
python -m elia_engine
```

### Running Tests

```bash
pytest tests/
```

## Development

The engine is structured as follows:
