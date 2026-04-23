# 🍽️ SmartMessManagement — Deployment Guide

A full-stack mess management system built with **React (Vite)**, **Flask (SocketIO)**, and **MongoDB**.

---

## 🚀 Quick Deploy with Docker (Recommended)

> **Requirements:** [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your server.

### Step 1 — Clone the repo

```bash
git clone <your-repo-url> SmartMessManagement
cd SmartMessManagement
```

### Step 2 — Set environment variables

Create `backend/.env` with your MongoDB URI and secret key:

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/mess
JWT_SECRET=your_super_secret_key_here
```

> ⚠️ **Never commit .env to git.** The app reads these at startup.

### Step 3 — Build and run

```bash
docker-compose up -d --build
```

That's it! The application is now live:
- 🌐 **Frontend** → http://your-server-ip (port 80)
- 🔌 **Backend API** → proxied internally via Nginx on `/api/`
- 🔁 **WebSockets** → proxied via Nginx on `/socket.io/`

### Stop the application

```bash
docker-compose down
```

### View logs

```bash
docker-compose logs -f backend   # Flask logs
docker-compose logs -f frontend  # Nginx logs
```

---

## 🛠 Local Development (Without Docker)

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> The Vite dev server proxies `/api` and `/socket.io` to `http://localhost:5000` automatically.

---

## 📁 Project Structure

```
SmartMessManagement/
├── backend/                 # Flask API
│   ├── app.py               # Main Flask application
│   ├── routes/              # API route blueprints
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Backend Docker image
│   └── .env                 # Environment variables (not committed)
├── frontend/                # React (Vite) app
│   ├── src/
│   │   ├── pages/           # AdminDashboard, StudentDashboard, etc.
│   │   ├── components/      # Reusable UI components
│   │   └── index.css        # Global styles + responsive rules
│   ├── nginx.conf           # Production Nginx config
│   └── Dockerfile           # Multi-stage build → Nginx
├── docker-compose.yml       # Orchestrates both services
└── README.md                # This file
```

---

## 🌍 Deploy to a Cloud Server (e.g. AWS EC2, DigitalOcean)

1. SSH into your server
2. Install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER
   ```
3. Install Docker Compose:
   ```bash
   sudo apt install docker-compose-plugin -y
   ```
4. Clone & deploy:
   ```bash
   git clone <your-repo-url> && cd SmartMessManagement
   # Add your backend/.env file
   docker-compose up -d --build
   ```

### Optional: Free HTTPS with Nginx + Certbot

Install Certbot and obtain an SSL certificate for your domain. Update `frontend/nginx.conf` to listen on port 443 and redirect port 80 → 443.

---

## 📱 Mobile Responsiveness

The app is fully mobile-responsive with:
- **Sliding sidebar drawer** (hamburger menu) on screens ≤ 992px
- **Single-column layouts** for all grids on ≤ 768px
- **Scrollable tab bars** for dashboard navigation on small phones
- **Stacked forms** (Signup Name/ID fields) on ≤ 480px
- **QR Scanner** camera + results list stacks vertically on mobile
- **Fluid typography** using `clamp()` across all headings

---

## 👥 Default Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@mess.com | admin123 |
| Employee | employee@mess.com | emp123 |
| Store Manager | store@mess.com | store123 |

> Students sign up at `/signup`

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, SocketIO Client |
| Styling | Vanilla CSS, Inter font |
| Backend | Flask, Flask-SocketIO, Gunicorn+Eventlet |
| Database | MongoDB Atlas (cloud) or local MongoDB |
| Serving | Nginx (prod) / Vite dev server (dev) |
| Container | Docker + Docker Compose |
