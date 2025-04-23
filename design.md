# AgentLab Design Document

## Overview

AgentLab is a comprehensive environment for creating, editing, and interacting with AI agents. It provides a notebook-based interface that combines code execution, chat interactions, and agent configuration in a single unified experience. This document outlines the key components, data flow, and interaction patterns of the AgentLab.

## Core Components

### 1. Main Interface Components

- **NotebookHeader**: Contains controls for notebook operations (save, download, run all cells), kernel management, and agent editing.
- **Sidebar**: Provides access to notebooks and projects, allowing users to navigate between different agents and chats.
- **NotebookContent**: Displays and manages notebook cells, including code cells, markdown cells, and chat interactions.
- **NotebookFooter**: Contains the chat input interface and buttons for model settings and agent editing.
- **CanvasPanel**: A sliding panel that hosts various windows like agent configuration and model settings.
- **WelcomeScreen**: Displayed when no notebook is loaded, providing options to create new chats or load existing agents.

### 2. Agent Management Components

- **EditAgentCanvasContent**: A form-based interface for configuring agent properties such as name, description, version, license, welcome message, and system prompt.
- **ModelSettingsCanvasContent**: A separate interface for configuring model settings like model name, temperature, and other generation parameters.

### 3. Notebook Management

- **CellManager**: Core class that manages notebook cells, their execution, and state.
- **NotebookCell**: Represents a single cell in the notebook, with properties for content, type, execution state, and metadata.

## Data Flow

### 1. Notebook Data Structure

```typescript
interface NotebookData {
  nbformat: number;
  nbformat_minor: number;
  metadata: NotebookMetadata;
  cells: NotebookCell[];
}

interface NotebookMetadata {
  title: string;
  description?: string;
  created: string;
  modified: string;
  filePath?: string;
  projectId?: string;
  agentArtifact?: AgentArtifactMetadata;
  // Model settings are stored in localStorage, not in notebook metadata
}
```

### 2. Agent Configuration

- **Agent Configuration**: Stored in notebook metadata as `agentArtifact`
- **Model Settings**: Stored in localStorage, separate from notebook metadata

## Interaction Flow

### 1. Startup and Initialization

1. AgentLab initializes and checks URL parameters
2. If URL contains `edit=workspace/agent-id`, it show a new button in the welcome screen for edit the agent for editing; if the user click edit the agent, then a new chat notebook (with a fixed name "chat-[agent-id].ipynb") is created from the agent template, and the edit agent window is opened in the canvas panel.
3. If URL contains `file=path/to/notebook.ipynb`, it loads the specified notebook; optionally, if `project=project-id` is also provided, it loads the notebook from the specified project.
4. Otherwise, it displays the welcome screen, user can start a new chat or load an existing agent.

### 2. Chat Interaction Flow

1. From the welcome screen, user click start chat (either from a default agent template, or a selected agent template), a new chat notebook is created.
2. The notebook will be loaded, and a jupyter kernel (thebe) will be started
3. when user send a message, the agent will respond
4. in the left side bar, user can double click on a file and load as the current chat.

### 2. Agent Editing

1. In the chat interface, user clicks "Edit Agent" button
2. EditAgentCanvasContent opens in the canvas panel
3. User configures agent properties (name, description, etc.)
4. User clicks "Save Settings to Notebook" to store configuration in notebook metadata
5. User clicks "Publish Agent" to publish the agent to the Hypha platform
6. If the user switch to another notebook, the agent configuration will be refreshed from the new notebook metadata

### 3. Model Settings Management

1. User clicks the model settings button
2. ModelSettingsCanvasContent opens in the canvas panel
3. User configures model settings (model, temperature, etc.)
4. User can save settings to localStorage or create/load presets (not saved in the notebook)
5. Model settings are applied to chat interactions but not stored in notebook metadata

### 4. Chat Interaction

1. User types a message in the chat input
2. Message is added as a user cell to the notebook
3. Agent processes the message using the configured model settings
4. Response is added as an assistant cell to the notebook

## Key Design Decisions

### 1. Separation of Agent Configuration and Model Settings

- **Agent Configuration**: Stored in notebook metadata, specific to the agent's identity and behavior
- **Model Settings**: Stored in localStorage, allowing users to maintain consistent model settings across different agents

### 2. Canvas-based Windows vs. Dialogs

- Model settings and agent configuration are displayed in canvas windows rather than modal dialogs
- This allows users to keep these interfaces open while interacting with the notebook
- Canvas windows can be resized and positioned as needed

### 3. Notebook-based Agent Development

- Agents are developed and tested in a notebook environment
- System prompts are stored as code cells with the "system" role
- Chat history is preserved in the notebook for future reference and iteration

### 4. URL Parameter Support

- AgentLab supports URL parameters for direct access to specific notebooks and agents
- Parameters are preserved in the URL during navigation, allowing for sharing and bookmarking

## Implementation Notes

### 1. State Management

- React hooks and context are used for state management
- Key state includes:
  - Notebook cells and metadata
  - Agent settings and model configuration
  - UI state (sidebar visibility, canvas panel visibility, etc.)

### 2. Persistence

- Notebooks are saved as .ipynb files in the selected project
- Agent configurations are published to the Hypha platform
- Model settings are stored in localStorage for persistence across sessions

### 3. Error Handling

- Errors during notebook loading, saving, and execution are captured and displayed to the user
- Network errors during agent publishing are handled with appropriate feedback

## Future Enhancements

1. Enhanced collaboration features for team-based agent development
2. Version control and history for agent configurations
3. Advanced testing and evaluation tools for agent performance
4. Integration with external tools and services via the canvas panel
