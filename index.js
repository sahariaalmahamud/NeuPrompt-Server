const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const cors = require("cors");
const {
    MongoClient,
    ServerApiVersion,
    ObjectId,
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

        // Post Prompts 
        app.post('/api/prompts', async (req, res) => {
            const prompt = req.body;
            const result = await promptsCollection.insertOne(prompt);

            res.send(result);
        })


        //Get prompt by user id
        app.get('/api/my-prompts/:id', async (req, res) => {
            const id = req.params.id;
            const result = await promptsCollection
                .find({
                    creatorId: id
                })
                .toArray();

            res.send(result);
        })


        app.get('/api/prompts', async (req, res) => {
            const result = await promptsCollection
                .find({
                    status: "approved"
                })
                .toArray();

            res.send(result);
        })


        // Get single prompt
        app.get('/api/prompts/:id', async (req, res) => {
            const id = req.params.id;
            const result =
                await promptsCollection.findOne({
                    _id: new ObjectId(id)
                });

            res.send(result);
        })


        //Update prompt by user
        app.patch('/api/prompts/:id', async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;
            const result =
                await promptsCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    {
                        $set: updatedData
                    }
                );

            res.send(result);
        })


        // Delete prompt
        app.delete('/api/prompts/:id', async (req, res) => {
            const id = req.params.id;
            const result =
                await promptsCollection.deleteOne({
                    _id: new ObjectId(id)
                });

            res.json(result);
        })


        // Get Admin All Prompts
        app.get('/api/admin/prompts', async (req, res) => {
            const result =
                await promptsCollection
                    .find()
                    .sort({
                        createdAt: -1
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