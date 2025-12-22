# ⚙️ Digital Life Lessons Server | API Documentation

This is the robust backend powering the Digital Life Lessons platform. Built with Node.js and Express, it handles secure authentication, payment processing, and complex data relationships between users, lessons, and reports.

## 🔑 Core Functionality

-   **Role-Based Access Control (RBAC):** Secure routes using **Firebase Admin SDK** to verify tokens and differentiate between Admin and Regular users.
-   **Stripe Integration:** Server-side handling of checkout sessions and secure payment verification for Premium upgrades.
-   **Content Management:** Robust CRUD operations for lessons, including complex filtering, pagination, and reporting logic.
-   **Security:** Environment variable protection for MongoDB and Firebase credentials to ensure zero data leakage.
-   **Analytics API:** Custom endpoints for Admin Dashboard to track platform growth, reporting counts, and user activity.

## 🛠️ Backend Tech Stack

-   **Environment:** Node.js, Express.js
-   **Database:** MongoDB
-   **Security/Auth:** Firebase Admin SDK, CORS, Dotenv
-   **Payments:** Stripe API

## 🛰️ API Endpoints Preview

-   `GET /lessons` - Get all public lessons (Supports search/filter/pagination)
-   `POST /create-checkout-session` - Initialize Stripe payment
-   `GET /admin/stats` - Platform-wide analytics for admins
-   `PATCH /users/role` - Update user roles (Admin Only)

## 📦 Local Development

1.  Clone the repository:
    ```bash
    git clone [https://github.com/your-username/digital-life-lessons-server.git](https://github.com/your-username/digital-life-lessons-server.git)
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Configure `.env` file:
    ```env
    DB_USER=your_db_user
    DB_PASS=your_db_password
    STRIPE_SECRET_KEY=your_stripe_key
    FIREBASE_SERVICE_ACCOUNT_JSON=your_json_path
    ```
4.  Run the server:
    ```bash
    index.js // or npm start
    ```

## 📜 Dependencies
`express`, `mongodb`, `stripe`, `firebase-admin`, `dotenv`, `cors`.