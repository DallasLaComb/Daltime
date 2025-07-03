# Shift Scheduler App - Dev Setup

## 📦 Backend Setup (AWS SAM + Supabase)

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) installed and running
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)
- Node.js (v18+ recommended)

### Setup Steps

1. **Install Dependencies**

   - Navigate into each backend function folder that contains a `package.json`:

     ```bash
     cd backend/auth/register
     npm install

     cd ../login
     npm install
     # Repeat for other function folders
     ```

2. **Build and Run Locally**

   - From the `/backend` directory:

     ```bash
     sam build
     sam local start-api
     ```

   - Make sure Docker is running before starting the local API server.

3. **Test APIs**

   - Once running, access endpoints like:

     - `POST http://localhost:3000/auth/register`
     - `POST http://localhost:3000/auth/login`

---

## 🖥️ Frontend Setup (Angular + Tailwind CSS)

### Prerequisites

- Node.js + npm
- Angular CLI (`npm install -g @angular/cli`)

### Setup Steps

1. **Install Dependencies**

   ```bash
   cd frontend
   npm install
   ```

2. **Run Dev Server**

   ```bash
   ng serve
   # or
   npm run start
   ```

3. **Access the app**

   - Open [http://localhost:4200](http://localhost:4200) in your browser.

---

## Notes

- Be sure to configure your `.env` files and avoid committing real secrets.
- Make sure your Supabase keys and project URL are wired correctly in your local SAM environment.
- Keep `template.yaml` in `.gitignore` if you have local-only overrides.

Let me know if you want example `.env` or Postman collections!
Testing pull request