
#⚙️ Digital Life Lessons Server

**Base URL:** [https://the-inner-circle-server.vercel.app/]  
**Architecture:** RESTful API with Node.js, Express, and MongoDB.

---

## 🛠️ Backend Core Logic

Digital Life Lessons Server handles complex data relationships, secure role-based access, and financial transactions.

### 🔐 Security & Authentication
-   **Firebase Admin SDK:** Server-side token verification to protect private routes.
-   **JWT & Token Validation:** Ensuring only lesson owners or admins can perform sensitive actions (Delete/Edit).
-   **Environment Protection:** All MongoDB, Stripe, and Firebase keys are strictly managed via `dotenv`.

### ⚡ Main Backend Features
-   **Plan Synchronization:** Every protected request verifies the user's plan status directly from MongoDB (Single Source of Truth).
-   **Stripe Webhook Integration:** Automates the upgrade process by listening for successful Stripe checkout events to update `isPremium: true`.
-   **Lesson Moderation System:** Complex MongoDB aggregation for reporting counts and flagged content management.
-   **Search & Pagination:** Efficient server-side pagination for Public Lessons to ensure fast load times.
-   **Engagement Logic:** Optimized endpoints for managing the `likes[]` array and incrementing view counts.

## 📂 Database Collections
-   `users`: Stores profile info, roles (user/admin), and premium status.
-   `lessons`: Main content repository with metadata (visibility, accessLevel, tone).
-   `favorites`: Maps user IDs to lesson IDs for saved content.
-   `lessonsReports`: Tracks community flags with reporter info and reasons.
-   `comments`: Nested or linked comments for each lesson.

## 🚀 Dependencies
-   `express`, `mongodb`, `stripe`, `firebase-admin`, `dotenv`, `cors`.

---

## 🛰️ API Endpoints Preview

| Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/lessons` | Create a new life lesson | Private |
| `GET` | `/lessons` | Get public lessons (with Search/Filter) | Public |
| `POST` | `/create-checkout-session` | Initialize Stripe Payment | Premium Only |
| `GET` | `/admin/summary` | Get system analytics | Admin Only |
| `DELETE` | `/admin/lesson/:id` | Remove inappropriate content | Admin Only |

---

## 🛠️ Setup Guide
1. `git clone [https://github.com/Abdullahbdbd/The-Inner-Circle-Server?tab=readme-ov-file]`
2. `npm install`
3. Configure `.env`:
   ```env
   DB_USER=your_db_user
   DB_PASS=your_db_password
   STRIPE_SECRET_KEY=your_stripe_secret
   FIREBASE_SERVICE_ACCOUNT=your_service_account_json