# 🧠 Mental Health AI Chat Assistant

<div align="center">

![Mental Health AI Chat](frontend/public/logo2.png)

[![Bun](https://img.shields.io/badge/Bun-1.1.29-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)

</div>

## 🌟 Features

- 🤖 AI-powered mental health chat assistance
- 💬 Real-time conversation interface
- 🔒 Secure user authentication with Clerk
- 🎨 Modern, responsive UI design
- 📱 Mobile-friendly interface
- 🔄 Real-time updates and notifications
- 🎯 Personalized user experience
- 📊 User progress tracking

## 🛠️ Tech Stack

### Frontend

- React with TypeScript
- Vite for blazing fast development
- Tailwind CSS for styling
- Clerk for authentication
- TanStack Query for data fetching
- Shadcn UI components

### Backend

- Bun runtime
- TypeScript
- Express.js
- Drizzle ORM
- PostgreSQL database

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.1.29 or higher)
- Node.js (v16 or higher)
- PostgreSQL

### Installation

1. Clone the repository

```bash
git clone https://github.com/yourusername/mental-health-ai-chat.git
cd mental-health-ai-chat
```

2. Install dependencies

```bash
# Install root dependencies
bun install

# Install frontend dependencies
cd frontend
bun install

# Install server dependencies
cd ../server
bun install
```

3. Set up environment variables

```bash
# Root directory
cp .env.example .env

# Frontend
cd frontend
cp .env.example .env

# Server
cd ../server
cp .env.example .env
```

4. Start the development servers

```bash
# Start the backend server
bun run server

# In a new terminal, start the frontend
cd frontend
bun run dev
```

## 📝 Project Structure

```
├── frontend/           # React frontend application
│   ├── src/           # Source files
│   ├── public/        # Static assets
│   └── ...
├── server/            # Backend server
│   ├── routes/        # API routes
│   ├── db/           # Database configuration
│   └── ...
└── drizzle/          # Database migrations
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all contributors who have helped shape this project
- Special thanks to the open-source community for their amazing tools and libraries

---

<div align="center">
Made with ❤️ by [Your Name]
</div>
