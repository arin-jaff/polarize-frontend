# Polarize

Customizable AI-powered training app to track fitness and tailor training towards a certain discipline.

## Quick Start

### Prerequisites

```bash
# macOS (using Homebrew)
brew tap mongodb/brew
brew install mongodb-community ollama
brew services start mongodb-community
```

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### AI Coach (Optional)

```bash
ollama serve &
ollama pull llama3.2
```

## Access

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs
