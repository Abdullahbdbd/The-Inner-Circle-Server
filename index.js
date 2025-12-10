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

    //users related apis
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

    //get single user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    //Lessons related apis
    //get lessons
    app.get("/public-lessons", async (req, res) => {
      const cursor = lessonsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
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

    //delete lesson
    app.delete("/public-lessons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await lessonsCollection.deleteOne(query);
      res.send(result);
    });

    //update lesson
    app.patch("/public-lessons/:id", async (req, res) => {
      const { id } = req.params;
      const updateData = req.body;

      const result = await lessonsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: updateData }
      );

      res.send(result);
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
    app.patch('/payment-success', async(req,res)=>{
        const sessionId = req.query.session_id;
        const session = await stripe.checkout.sessions.retrieve(sessionId)
        console.log(session);
        
        if(session.payment_status==='paid'){
          const id = session.metadata.userId;
          const query = {_id: new ObjectId(id)}
          const update={
            $set:{
                isPremium: true
            }
          }

          const result = await userCollection.updateOne(query, update);
          res.send(result)
        }
        res.send({success: false })
    })

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
