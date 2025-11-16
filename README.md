# Tech Haven - E-commerce Platform

[![Deploy to Firebase](https://github.com/[your-username]/[your-repo]/actions/workflows/firebase-hosting-merge.yml/badge.svg)](https://github.com/[your-username]/[your-repo]/actions/workflows/firebase-hosting-merge.yml)
[![CI Tests](https://github.com/[your-username]/[your-repo]/actions/workflows/ci-tests.yml/badge.svg)](https://github.com/[your-username]/[your-repo]/actions/workflows/ci-tests.yml)

## 🚀 Tech Stack

- **Frontend**: EJS, Vanilla JavaScript, CSS
- **Backend**: Node.js, Express.js
- **Database**: Firebase Firestore
- **Search**: Elasticsearch (Elastic Cloud Serverless)
- **Authentication**: Firebase Auth
- **Hosting**: Firebase Hosting
- **CI/CD**: GitHub Actions

## 🌐 Live Demo

**Production**: [https://tech-haven-5368b.web.app/](https://tech-haven-5368b.web.app/)

## 📋 Features

- ✅ E-commerce product catalog
- ✅ Shopping cart & checkout
- ✅ User authentication (Email, Google OAuth)
- ✅ Admin dashboard
- ✅ Order management
- ✅ Elasticsearch integration (sub-10ms search)
- ✅ AI Chat Assistant (Gemini API)
- ✅ Responsive design
- ✅ SEO optimized
- ✅ Real-time updates

## 🔄 CI/CD Pipeline

This project uses **GitHub Actions** for automated deployment:

### Workflows:
1. **Deploy to Production** - Auto-deploy on push to `main`
2. **Preview Deployments** - Auto-preview for Pull Requests
3. **CI Tests** - Linting, security scans, build tests

### Setup Guide:
See [CI/CD Setup Guide](.github/CICD-SETUP-GUIDE.md) for detailed instructions.

## 🛠️ Local Development

### Prerequisites:
- Node.js 20+
- Firebase CLI
- npm or yarn

### Installation:

```bash
# Clone repository
git clone [your-repo-url]
cd tech-haven

# Install dependencies
npm install
cd functions
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your credentials

# Start local server
npm start
```

### Firebase Emulators:

```bash
firebase emulators:start
```

## 📦 Deployment

### Manual Deployment:
```bash
firebase deploy
```

### Automated Deployment (CI/CD):
```bash
# Simply push to main branch
git push origin main

# GitHub Actions will automatically:
# 1. Run tests
# 2. Build project
# 3. Deploy to Firebase
```

## 🧪 Testing

```bash
# Run linting
npm run lint

# Run all tests
npm test

# Test Elasticsearch
npm run test:elasticsearch
```

## 📁 Project Structure

```
tech-haven/
├── .github/
│   └── workflows/          # GitHub Actions workflows
├── functions/              # Firebase Functions
│   ├── public/            # Static assets
│   ├── views/             # EJS templates
│   ├── elasticsearch-*.js # Elasticsearch modules
│   └── index.js           # Express server
├── firebase.json          # Firebase configuration
└── package.json
```

## 🔐 Environment Variables

Required secrets in GitHub Actions:
- `FIREBASE_SERVICE_ACCOUNT_TECH_HAVEN_5368B`
- `ELASTICSEARCH_NODE` (optional)
- `ELASTICSEARCH_API_KEY` (optional)

## 👥 Contributors

- Developer: [Your Name]

## 📄 License

This project is developed for educational purposes.

---

**Deployment Status**: ✅ Live on Firebase
**Last Deploy**: Auto-deployed via GitHub Actions
