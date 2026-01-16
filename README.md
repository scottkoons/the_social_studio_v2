# The Social Studio

A bulk social media scheduling tool for restaurants, built with Next.js 16, Firebase, and Tailwind CSS.

## Features

- **Planning**: Create posting schedules with AI-optimized timing
- **Input**: Add images and starter text to posts
- **Review**: Generate AI captions for Facebook and Instagram
- **Calendar**: Visual overview of your schedule
- **Export**: Download Buffer-compatible CSV files

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Database**: Firebase Firestore
- **Storage**: Firebase Storage
- **Auth**: Firebase Authentication (Google Sign-in)
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4 (via Cloud Functions)

---

## Firebase Setup (Required)

This project requires Firebase for authentication, database, and storage. **The app will not run without proper Firebase configuration.**

### Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" and follow the setup wizard
3. Enable Google Analytics (optional)

### Step 2: Enable Firebase Services

In your Firebase project:

1. **Authentication**:
   - Go to Build → Authentication → Get Started
   - Enable "Google" sign-in provider

2. **Firestore Database**:
   - Go to Build → Firestore Database → Create Database
   - Start in test mode (you'll add security rules later)

3. **Storage**:
   - Go to Build → Storage → Get Started
   - Start in test mode

### Step 3: Get Firebase Config

1. Go to Project Settings (gear icon ⚙️)
2. Scroll to "Your apps" section
3. Click the web icon `</>` to add a web app (or select existing)
4. Register your app with a nickname
5. Copy the `firebaseConfig` values

### Step 4: Create Environment File

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit .env.local with your Firebase credentials
```

Your `.env.local` should look like this (with your actual values):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyC...your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abc123
```

### Step 5: Restart Dev Server

> ⚠️ **IMPORTANT**: Next.js only reads environment variables at startup.
> After creating or modifying `.env.local`, you **MUST** restart the dev server:

```bash
# Stop the dev server (Ctrl+C), then:
npm run dev
```

### Troubleshooting

**Error: "Missing required environment variables"**
- Check that `.env.local` exists in the project root
- Verify all 6 `NEXT_PUBLIC_FIREBASE_*` variables are set
- Make sure there are no typos in variable names
- Restart the dev server after any changes

**Error: "auth/invalid-api-key"**
- Your API key is incorrect or malformed
- Copy the API key directly from Firebase Console
- Ensure no extra spaces or quotes around the value

---

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
src/
├── app/                 # Next.js App Router pages
│   ├── page.tsx         # Dashboard
│   ├── planning/        # Schedule creation
│   ├── input/           # Content management
│   ├── review/          # AI caption generation
│   ├── calendar/        # Calendar view
│   ├── export/          # CSV export
│   └── settings/        # User settings
├── components/
│   ├── layout/          # Navbar, AuthGuard
│   └── ui/              # Reusable UI components
├── contexts/            # React contexts (Auth, Theme)
├── hooks/               # Custom React hooks
├── lib/                 # Utilities and services
│   ├── firebase.ts      # Firebase initialization
│   ├── services/        # Firestore CRUD operations
│   ├── scheduling.ts    # AI scheduling algorithm
│   └── export.ts        # CSV generation
└── types/               # TypeScript type definitions
```

## License

Private - All rights reserved
