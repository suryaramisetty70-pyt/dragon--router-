# 🐉 Dragon Router

Welcome to **Dragon Router**, the ultimate unified AI gateway. 

Dragon Router allows you to connect to over 200+ AI models (including OpenAI, Claude, Gemini, and open-source models) through a single, lightning-fast endpoint. It provides a beautiful dashboard, automatic failovers, cross-model memory, and advanced token analytics to supercharge your AI workflows.

## 🚀 Features

- **200+ Supported APIs**: One integration for every AI model.
- **Dragon Scales (Auto-Fallback)**: Never experience downtime again. If an API goes down, Dragon Router instantly routes your request to a backup model.
- **Dragon Personas**: Inject hyper-optimized system prompts into any request automatically.
- **Advanced Analytics**: Track exactly how many tokens you are burning and optimize your spend.
- **Local-First Design**: Keep your API keys securely on your own machine.

## 💻 Installation

To run Dragon Router on your local machine, simply use `npx`:

```bash
npx dragonrouter
```

Alternatively, if you've cloned this repository, you can start the development server using:

```bash
npm install
npm run dev
```

Then, open `http://localhost:20128` in your browser to access your personal AI dashboard.

## 📦 Deployment

You can deploy Dragon Router to any cloud provider that supports Docker (such as Render, Railway, or Fly.io). Because it uses SQLite by default, make sure to attach a persistent volume to `/app/data` to keep your settings saved across restarts.

## 📜 License

This project is licensed under the MIT License.
