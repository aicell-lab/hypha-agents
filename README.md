# Hypha Agents

An open source platform for building and deploying customizable AI agents.

## 🎯 Overview

Hypha Agents is a comprehensive solution for creating, managing, and deploying AI agents. The platform provides:

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
git clone https://github.com/aicell-lab/hypha-agents.git
cd hypha-agents

# Create and activate conda environment
conda create -n hypha-agents python=3.11
conda activate hypha-agents

# Install Python dependencies
pip install -e .
pip install -r requirements_test.txt

# Install frontend dependencies
pnpm install
```

### Configuration

1. Copy the example `.env` file:
```bash
cp .env.example .env
```

1. Fill out the `.env` file variables with your configuration settings.

### Running the Application

```bash
# Start the hypha engine using the CLI command
hypha-agents serve

# Or using Python module
python -m hypha_agents serve

# In another terminal, start the frontend
pnpm start
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
hypha-agents/
├── src/                  # React + TypeScript frontend
│   ├── components/      # React components
│   └── types/          # TypeScript definitions
├── hypha_agents/         # Core engine implementation
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
- `pnpm lint`: Run linting

### Development Guidelines

- Use Python type hints and TypeScript types
- Write comprehensive documentation
- Include tests for critical functionality
- Follow PEP 8 and React/TypeScript style guidelines

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- The Hypha development team
- All contributors and maintainers

---

<div align="center">
Made with ❤️ by the Hypha Agents Team
</div>