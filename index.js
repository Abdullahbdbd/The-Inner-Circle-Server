const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 3000;

//middleware
app.use(express.json());
app.use(cors());

const uri = process.env.DB_URL;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("the_inner_circle_db");
    const userCollection = db.collection("user");
    const lessonsCollection = db.collection("lessons");
    const lessonsReportsCollection = db.collection("lessonReports");

    //users related apis
    // Get all users
    app.get("/users", async (req, res) => {
      try {
        const users = await userCollection
          .aggregate([
            {
              $lookup: {
                from: "lessons",
                localField: "email",
                foreignField: "creatorEmail",
                as: "userLessons",
              },
            },
            {
              $addFields: {
                totalLessons: { $size: "$userLessons" },
              },
            },
            {
              $project: {
                userLessons: 0,
              },
            },
          ])
          .toArray();

        res.send(users);
      } catch (error) {
        console.error("Error loading users:", error);
        res.status(500).send({ message: "Failed to load users" });
      }
    });

    //make admin
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const roleInfo = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: roleInfo.role,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    //add users
    app.post("/users", async (req, res) => {
      const user = req.body;
      user.role = "user";
      user.createdAt = new Date();
      user.isPremium = false;
      const email = user.email;

      const userExists = await userCollection.findOne({ email });

      if (userExists) {
        return res.send({ message: "user exists" });
      }

      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Get single user info
    app.get("/users/:email", async (req, res) => {
      const { email } = req.params;
      const user = await userCollection.findOne({ email });
      if (!user) return res.status(404).send({ message: "User not found" });
      res.send(user);
    });

    // Update user profile (name or photo)
    app.patch("/users/:email", async (req, res) => {
      const { email } = req.params;
      const { displayName, photoURL } = req.body;

      const result = await userCollection.updateOne(
        { email },
        { $set: { displayName, photoURL } }
      );

      res.send(result);
    });

    // get user role
    app.get("/users/:email/role", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const user = await userCollection.findOne(query);
      res.send({ role: user?.role || "user" });
    });

    //Lessons related apis
    app.get("/public-lessons", async (req, res) => {
      const { search, category, tone, sort } = req.query;
      const filter = {};

      if (search) filter.title = { $regex: search, $options: "i" };
      if (category) filter.category = category;
      if (tone) filter.tone = tone;

      const cursor = lessonsCollection.find(filter);
      let lessons = await cursor.toArray();

      if (sort === "mostSaved") {
        lessons.sort(
          (a, b) => (b.favoritesCount || 0) - (a.favoritesCount || 0)
        );
      } else {
        lessons.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      res.send(lessons);
    });

    // Dashboard related apis
    // dashboard Summary Route
    app.get("/summary/:email", async (req, res) => {
      const { email } = req.params;

      const user = await userCollection.findOne({ email });
      if (!user) return res.status(404).send({ message: "User not found" });

      const totalLessons = await lessonsCollection.countDocuments({
        creatorEmail: email,
      });

      const totalFavorites = await lessonsCollection.countDocuments({
        favorites: { $in: [email] },
      });

      const recentLessons = await lessonsCollection
        .find({ creatorEmail: email })
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();

      res.send({
        totalLessons,
        totalFavorites,
        recentLessons,
      });
    });

    // Analytics Route
    app.get("/analytics/:email", async (req, res) => {
      const { email } = req.params;

      try {
        const analytics = await lessonsCollection
          .aggregate([
            {
              $match: {
                creatorEmail: email,
                createdAt: { $exists: true },
              },
            },
            {
              $addFields: {
                createdAtDate: {
                  $toDate: "$createdAt",
                },
              },
            },
            {
              $group: {
                _id: {
                  month: { $month: "$createdAtDate" },
                  category: "$category",
                  tone: "$tone",
                },
                total: { $sum: 1 },
              },
            },
            { $sort: { "_id.month": 1 } },
          ])
          .toArray();

        res.send(analytics);
      } catch (error) {
        console.error("Analytics error:", error);
        res.status(500).send({ message: "Error fetching analytics" });
      }
    });

    // add lessons
    app.post("/add-lessons", async (req, res) => {
      const lessons = req.body;
      lessons.isFeatured = false;
      lessons.createdAt = new Date();

      const result = await lessonsCollection.insertOne(lessons);
      res.send(result);
    });

    // my lessons
    app.get("/my-lessons", async (req, res) => {
      const query = {};
      const { email } = req.query;

      if (email) {
        query.creatorEmail = email;
      }

      const cursor = lessonsCollection.find(query).sort({ createdAt: -1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    // favorite lessons
    app.get("/favorites/:email", async (req, res) => {
      try {
        const { email } = req.params;
        const favorites = await lessonsCollection
          .find({ favorites: email }) // email দিয়ে match করবে
          .toArray();
        res.send(favorites);
      } catch (error) {
        console.error("Favorites fetch error:", error);
        res.status(500).send({ message: "Failed to load favorites" });
      }
    });

    //delete lesson
    app.delete("/public-lessons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.deleteOne(query);
      res.send(result);
    });

    //Update Lesson
    app.put("/public-lessons/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const updatedLesson = req.body;

        const updateDoc = {
          $set: {
            title: updatedLesson.title,
            description: updatedLesson.description,
            category: updatedLesson.category,
            tone: updatedLesson.tone,
            image: updatedLesson.image,
            privacy: updatedLesson.privacy,
            accessLevel: updatedLesson.accessLevel,
            updatedAt: new Date(),
          },
        };

        const result = await lessonsCollection.updateOne(
          { _id: new ObjectId(id) },
          updateDoc
        );

        res.send(result);
      } catch (error) {
        console.error("Error updating lesson:", error);
        res.status(500).send({ message: "Failed to update lesson" });
      }
    });

    //payment related apis
    app.post("/create-checkout-session", async (req, res) => {
      const paymentInfo = req.body;
      console.log(paymentInfo);

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: "bdt",
              unit_amount: 1500 * 100,
              product_data: {
                name: "Digital Life Lessons Premium Plan",
                description: "Lifetime premium access",
              },
            },
            quantity: 1,
          },
        ],
        customer_email: paymentInfo.email,
        mode: "payment",
        metadata: {
          userId: paymentInfo._id,
        },
        success_url: `${process.env.SITE_DOMAIN}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.SITE_DOMAIN}/payment-cancelled`,
      });

      console.log(session);
      res.send({ url: session.url });
    });

    // update after payment
    app.patch("/payment-success", async (req, res) => {
      const sessionId = req.query.session_id;
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      console.log(session);

      if (session.payment_status === "paid") {
        const id = session.metadata.userId;
        const query = { _id: new ObjectId(id) };
        const update = {
          $set: {
            isPremium: true,
          },
        };

        const result = await userCollection.updateOne(query, update);
        res.send(result);
      }
      res.send({ success: false });
    });

    // Toggle featured status
    app.patch("/lessons/:id/feature", async (req, res) => {
      const { id } = req.params;
      const { isFeatured } = req.body;
      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isFeatured } }
      );
      res.send(result);
    });

    // Mark as reviewed
    app.patch("/lessons/:id/review", async (req, res) => {
      const { id } = req.params;
      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { reviewed: true } }
      );
      res.send(result);
    });

    // Get all reported lessons grouped by lessonId
    app.get("/reported-lessons", async (req, res) => {
      try {
        const reports = await lessonsReportsCollection
          .aggregate([
            {
              $group: {
                _id: "$lessonId",
                lessonId: { $first: "$lessonId" },
                title: { $first: "$title" },
                category: { $first: "$category" },
                reports: {
                  $push: {
                    reason: "$reason",
                    reporterEmail: "$reporterEmail",
                    timestamp: "$timestamp",
                  },
                },
                reportCount: { $sum: 1 },
              },
            },
            { $sort: { reportCount: -1 } },
          ])
          .toArray();

        res.send(reports);
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Failed to load reported lessons" });
      }
    });

    // Delete reports for a specific lesson
    app.delete("/reports/:lessonId", async (req, res) => {
      const { lessonId } = req.params;
      const result = await lessonsReportsCollection.deleteMany({ lessonId });
      res.send(result);
    });

    //Details Lessons related apis
    //get single lesson
    app.get("/public-lessons/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const lesson = await lessonsCollection.findOne(query);
      if (!lesson) return res.status(404).send({ message: "Lesson not found" });
      res.send(lesson);
    });

    // Toggle like for a lesson
    app.patch("/public-lessons/:id/like", async (req, res) => {
      const lessonId = req.params.id;
      const { userId } = req.body;

      const lesson = await lessonsCollection.findOne({
        _id: new ObjectId(lessonId),
      });
      if (!lesson) return res.status(404).send({ message: "Lesson not found" });

      const alreadyLiked = lesson.likes?.includes(userId);

      let updatedLesson;
      if (alreadyLiked) {
        updatedLesson = await lessonsCollection.updateOne(
          { _id: new ObjectId(lessonId) },
          { $pull: { likes: userId }, $inc: { likesCount: -1 } }
        );
      } else {
        updatedLesson = await lessonsCollection.updateOne(
          { _id: new ObjectId(lessonId) },
          { $addToSet: { likes: userId }, $inc: { likesCount: 1 } }
        );
      }

      const updated = await lessonsCollection.findOne({
        _id: new ObjectId(lessonId),
      });
      res.send(updated);
    });

    // Toggle favorite for a lesson
    app.patch("/public-lessons/:id/favorite", async (req, res) => {
      const { id } = req.params;
      const { userId } = req.body;

      const lesson = await lessonsCollection.findOne({ _id: new ObjectId(id) });
      if (!lesson) return res.status(404).send({ message: "Lesson not found" });

      const alreadyFavorited = lesson.favorites?.includes(userId);

      if (alreadyFavorited) {
        await lessonsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $pull: { favorites: userId }, $inc: { favoritesCount: -1 } }
        );
      } else {
        await lessonsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $addToSet: { favorites: userId }, $inc: { favoritesCount: 1 } }
        );
      }

      const updated = await lessonsCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(updated);
    });

    // Add new comment
    app.post("/public-lessons/:id/comment", async (req, res) => {
      const lessonId = req.params.id;
      const { userId, userName, userPhoto, text } = req.body;

      const comment = {
        userId,
        userName,
        userPhoto,
        text,
        time: new Date(),
      };

      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(lessonId) },
        { $push: { comments: comment } }
      );

      res.send(result);
    });

    // Get related lessons by category or tone
    app.get("/public-lessons/:id/related", async (req, res) => {
      const lessonId = req.params.id;
      const currentLesson = await lessonsCollection.findOne({
        _id: new ObjectId(lessonId),
      });

      if (!currentLesson)
        return res.status(404).send({ message: "Lesson not found" });

      const relatedLessons = await lessonsCollection
        .find({
          _id: { $ne: new ObjectId(lessonId) }, // exclude current lesson
          $or: [
            { category: currentLesson.category },
            { tone: currentLesson.tone },
          ],
          privacy: "Public",
        })
        .limit(6)
        .toArray();

      res.send(relatedLessons);
    });

    // Report a lesson
    app.post("/lessons/:id/report", async (req, res) => {
      const { id } = req.params;
      const { reporterEmail, reason, title } = req.body;

      const reportData = {
        title,
        lessonId: id,
        reporterEmail,
        reason,
        timestamp: new Date(),
      };

      try {
        const result = await lessonsReportsCollection.insertOne(reportData);
        res.send(result);
      } catch (error) {
        console.error("Error reporting lesson:", error);
        res.status(500).send({ message: "Failed to report lesson" });
      }
    });

    // Admin Dashboard Summary API
    app.get("/admin-summary", async (req, res) => {
      try {
        // total users
        const totalUsers = await userCollection.estimatedDocumentCount();

        // total public lessons
        const totalPublicLessons = await lessonsCollection.countDocuments({
          privacy: "Public",
        });

        // total reported lessons
        const totalReports =
          await lessonsReportsCollection.estimatedDocumentCount();

        // most active contributors (top 3 users by lesson count)
        const topContributors = await lessonsCollection
          .aggregate([
            {
              $group: {
                _id: "$creatorEmail",
                totalLessons: { $sum: 1 },
                creatorName: { $first: "$creatorName" },
                creatorPhoto: { $first: "$creatorPhoto" },
              },
            },
            { $sort: { totalLessons: -1 } },
            { $limit: 3 },
          ])
          .toArray();

        // today's new lessons
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaysLessons = await lessonsCollection.countDocuments({
          createdAt: { $gte: today },
        });

        // growth analytics (monthly)
        const monthlyGrowth = await lessonsCollection
          .aggregate([
            {
              $group: {
                _id: { month: { $month: "$createdAt" } },
                lessons: { $sum: 1 },
              },
            },
            { $sort: { "_id.month": 1 } },
          ])
          .toArray();

        const userGrowth = await userCollection
          .aggregate([
            {
              $group: {
                _id: { month: { $month: "$createdAt" } },
                users: { $sum: 1 },
              },
            },
            { $sort: { "_id.month": 1 } },
          ])
          .toArray();

        res.send({
          totalUsers,
          totalPublicLessons,
          totalReports,
          topContributors,
          todaysLessons,
          monthlyGrowth,
          userGrowth,
        });
      } catch (error) {
        console.error("Error in admin summary:", error);
        res.status(500).send({ message: "Failed to load admin summary" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
