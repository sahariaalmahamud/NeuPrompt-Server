const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const cors = require("cors");
const {
    MongoClient,
    ServerApiVersion,
} = require("mongodb");

app.use(cors());
app.use(express.json());
const port = process.env.PORT;

app.get('/', (req, res) => {
    res.send('Hello World!');
});

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function server() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("neuprompt_db");
        const promptsCollection = database.collection("prompts");

        // Prompts 
        app.post('/api/prompts', async (req, res) => {
            const prompt = req.body;
            const result = await promptsCollection.insertOne(prompt);
            res.send(result);
        })


        app.get('/api/my-prompts/:id', async (req, res) => {
            const id = req.params.id;
            const result = await promptsCollection
                .find({
                    creatorId: id
                })
                .toArray();
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
server().catch(console.dir);

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
});