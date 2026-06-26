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
        const bookmarksCollection = database.collection("bookmarks");
        const reviewsCollection = database.collection("reviews");

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


        // Admin Approved prompt post 
        app.patch('/api/admin/prompts/:id/approve', async (req, res) => {
            const id = req.params.id;
            const result =
                await promptsCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    {
                        $set: {
                            status: "approved"
                        }
                    }
                );

            res.send(result);
        })


        //Admin Rejected Prompt Post
        app.patch('/api/admin/prompts/:id/reject', async (req, res) => {
            const id = req.params.id;
            const {
                rejectionNote
            } = req.body;

            const result =
                await promptsCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    {
                        $set: {
                            status: "rejected",
                            rejectionNote
                        }
                    }
                );

            res.send(result);
        })


        // Home page featured section control by Admin
        app.patch('/api/admin/prompts/:id/feature', async (req, res) => {
            const id = req.params.id;
            const result =
                await promptsCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    {
                        $set: {
                            featured: true
                        }
                    }
                );

            res.send(result);
        })


        // Home featured prompt
        app.get('/api/featured-prompts', async (req, res) => {
            const result = await promptsCollection.find({
                featured: true,
                status: "approved"
            }).limit(6).toArray();

            res.send(result);
        })


        // Delete prompt by admin
        app.delete('/api/admin/prompts/:id', async (req, res) => {
            const id = req.params.id;

            const result = await promptsCollection.deleteOne({
                _id: new ObjectId(id)
            });

            if (result.deletedCount === 0) {
                return res.status(404).send({
                    success: false,
                    message: "Prompt not found"
                });
            }

            res.send({
                success: true,
                message: "Prompt deleted successfully"
            });
        });


        // Copy prompt
        app.patch('/api/prompts/:id/copy', async (req, res) => {
            const id = req.params.id;
            const result =
                await promptsCollection.updateOne(
                    {
                        _id: new ObjectId(id)
                    },
                    {
                        $inc: {
                            copyCount: 1
                        }
                    }
                );

            res.send(result);
        })


        // Bookmark post base on prompt 
        app.post('/api/bookmarks', async (req, res) => {

            const bookmark = req.body;

            const exists =
                await bookmarksCollection.findOne({
                    userId: bookmark.userId,
                    promptId: bookmark.promptId
                });

            if (exists) {
                return res.send({
                    success: false,
                    message: "Already bookmarked"
                });
            }

            await bookmarksCollection.insertOne({
                ...bookmark,
                createdAt: new Date()
            });

            await promptsCollection.updateOne(
                {
                    _id: new ObjectId(bookmark.promptId)
                },
                {
                    $inc: {
                        bookmarkCount: 1
                    }
                }
            );

            res.send({
                success: true,
                message: "Bookmarked successfully"
            });

        });

        //Disable Duplicate Bookmark
        app.get('/api/bookmarks/check/:userId/:promptId', async (req, res) => {
            const { userId, promptId } = req.params;
            const bookmark =
                await bookmarksCollection.findOne({
                    userId,
                    promptId
                });

            res.send({
                bookmarked: !!bookmark
            });
        });


        // Remove Bookmark
        app.delete('/api/bookmarks', async (req, res) => {
            const { userId, promptId } = req.body;

            await bookmarksCollection.deleteOne({
                userId,
                promptId
            });

            await promptsCollection.updateOne(
                {
                    _id: new ObjectId(promptId)
                },
                {
                    $inc: {
                        bookmarkCount: -1
                    }
                }
            );

            res.json({
                success: true
            });
        });


        //Saved bookmarks Prompts as userId
        app.get('/api/bookmarks/:userId', async (req, res) => {
            const userId = req.params.userId;

            const result = await bookmarksCollection.aggregate([

                {
                    $match: {
                        userId
                    }
                },

                {
                    $addFields: {
                        promptObjectId: {
                            $toObjectId: "$promptId"
                        }
                    }
                },

                {
                    $lookup: {
                        from: "prompts",
                        localField: "promptObjectId",
                        foreignField: "_id",
                        as: "prompt"
                    }
                },

                {
                    $unwind: "$prompt"
                }

            ]).toArray();

            res.send(result);
        });


        // post reviews
        app.post("/api/reviews", async (req, res) => {
            const review = {
                ...req.body,
                createdAt: new Date()
            };

            const result = await reviewsCollection.insertOne(review);

            res.send({
                success: true,
                insertedId: result.insertedId
            });
        });

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