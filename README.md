# Hypha Agent Platform

An enterprise-grade platform for building and deploying customizable AI agents.

## 🎯 Overview

Hypha Agent Platform is a comprehensive solution for creating, managing, and deploying AI agents. The platform provides:

- 🤖 **Customizable AI Agents**: Build specialized agents with domain knowledge
- 📚 **Knowledge Integration**: Upload and manage domain-specific knowledge bases
- 🛠️ **Extensible Tools**: Create and share Python-based tools and workflows
- 🔄 **Real-time Communication**: Seamless WebSocket-based agent interactions

## 🚀 Quick Start

### Prerequisites

- Python 3.11 or higher
- conda package manager
- pnpm (v8 or higher)
- Node.js (v18 or higher recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hypha-agent-platform.git
cd hypha-agent-platform

# Create and activate conda environment
conda create -n hypha-agent-platform python=3.11
conda activate hypha-agent-platform

# Install Python dependencies
pip install -e .
pip install -r requirements_test.txt

# Install frontend dependencies
pnpm install

# Start the hypha engine
python -m hypha_agent_engine serve

# In another terminal, start the frontend
pnpm start
```

## 🛠️ Tech Stack

- **Frontend**
  - React 18 with TypeScript
  - TailwindCSS for styling
  - Hypha RPC for real-time communication
  - React Router for navigation

- **Engine**
  - Python-based microservices
  - schema-agents framework
  - Hypha for service orchestration
  - Artifact Manager for resource management

## 🏗️ Project Structure

```
hypha-agent-platform/
├── src/                  # React frontend source
│   ├── components/      # React components
│   └── types/          # TypeScript definitions
├── hypha_agent_engine/         # Core engine implementation
│   ├── services/       # Hypha services
│   ├── models/        # Pydantic models
│   └── utils/         # Shared utilities
├── resources/          # Resource files and examples
├── tests/             # Test suite
└── agents/            # Agent definitions and configs
```

## 🧪 Development

### Available Scripts

- `pnpm start`: Start the development server
- `pnpm build`: Build for production
- `pnpm test`: Run tests
- `pnpm eject`: Eject from create-react-app

### Development Guidelines

- Use Python type hints and TypeScript types
- Write comprehensive documentation
- Include tests for critical functionality
- Follow PEP 8 and React/TypeScript style guidelines

## Configuration

1. Create a `.env` file in the root directory:
```bash
touch .env
```

2. Add required environment variables to `.env`:
```env
# Required environment variables will be listed here
OPENAI_API_KEY=your_api_key_here
```

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
Made with ❤️ by the Hypha Agent Platform Team
</div>

# Hypha Engine

Backend services for LLM and tool execution runtime for the Hypha Agent Platform.

## Configuration

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
hypha-agent-engine serve

# Or using Python module
python -m hypha_agent_engine serve
```

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
hypha-agent-platform/
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
Made with ❤️ by the Hypha Agent Platform Team
</div>