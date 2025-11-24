# TextFlow AI

TextFlow AI is a modular, node-based workflow editor designed for complex text generation and processing pipelines. Inspired by tools like **ComfyUI**, it allows users to chain together multiple AI agents—powered by Google's Gemini models—to create sophisticated content automation workflows.

Instead of a linear chat interface, TextFlow AI offers a canvas where you can orchestrate how data flows between different AI roles (Writers, Editors, Coders, Fact Checkers).

![App Screenshot](https://via.placeholder.com/800x450.png?text=TextFlow+AI+Screenshot)

## 🚀 Features

- **Node-Based Canvas**: Visual drag-and-drop interface to build complex logic chains.
- **Multi-Agent Orchestration**: Connect different AI personas (e.g., a "Blog Writer" feeding into an "SEO Optimizer" feeding into an "HTML Coder").
- **Workspaces**: Manage different projects or clients with isolated environments.
- **Global Context**: Define a "Company Voice" or "Brand Guide" that automatically influences every AI node in the workspace.
- **Image Support**: Import image URLs to be embedded into generated HTML content.
- **Customizable Nodes**: Fine-tune system instructions, choose specific Gemini models (Flash, Pro, Lite), and inject custom HTML templates.
- **Real-time Execution**: Watch the data flow through your nodes with visual status indicators.

## 🛠️ Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A Google Gemini API Key (Get one at [aistudio.google.com](https://aistudio.google.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/textflow-ai.git
   cd textflow-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root directory and add your API key:
   ```env
   API_KEY=your_google_gemini_api_key_here
   ```
   *Note: This application uses the `@google/genai` SDK and requires the key to be available in the environment.*

4. **Start the development server**
   ```bash
   npm start
   ```

## 📖 Usage Guide

### 1. The Canvas
- **Navigation**: Click and drag on the background to pan. Use the **Scroll Wheel** to zoom in/out (zooms to cursor).
- **Adding Nodes**: Right-click anywhere on the canvas or use the left sidebar to add nodes.
- **Connecting**: Drag from a node's **Right Handle (Output)** to another node's **Left Handle (Input)** to create a data flow.
- **Context Menu**: Right-click a node to Edit, Duplicate, or Delete it.

### 2. Node Types
- **Input**: The starting point for your prompt (e.g., "Top 10 trends in AI").
- **Brainstorm**: Generates topic ideas based solely on your Company Context (no input connection required).
- **Image**: Holds a list of image URLs to be passed to an HTML generator.
- **AI Writer/Optimizer/Fact Check**: Processing nodes that take text input and transform it using Gemini.
- **HTML Builder**: Specialized node for wrapping text in code. You can provide a custom HTML template in the sidebar settings.
- **Preview**: Renders the final HTML output.

### 3. Workspaces & Global Context
Click the **Settings (Gear Icon)** in the top right to access Workspace settings.
- **Global Context**: Enter your company description, tone of voice, or target audience here. This text is securely prepended to *every* AI request in the workspace, ensuring consistency across all generated content without repeating instructions in every node.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
