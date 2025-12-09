const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
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

      const userExists = await userCollection.findOne({email})

      if(userExists){
        return res.send({message:'user exists'})
      }


      const result = await userCollection.insertOne(user);
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

      const cursor = lessonsCollection.find(query).sort({createdAt: -1});
      const result = await cursor.toArray();
      res.send(result);
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
