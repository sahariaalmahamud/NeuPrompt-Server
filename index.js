const express = require("express");
const dotenv = require("dotenv");
const Stripe = require("stripe");
dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const app = express();
const cors = require("cors");
const {
    MongoClient,
    ServerApiVersion,
    ObjectId,
} = require("mongodb");
const { jwtVerify, createRemoteJWKSet } = require("jose-cjs");

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

const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
)

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization
    if (!authHeader) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    const token = authHeader.split(" ")[1]
    if (!token) {
        return res.status(401).json({ message: "Unauthorized" })
    }

    try {
        const { payload } = await jwtVerify(token, JWKS);
        req.user = payload;
        next();
    }
    catch (error) {
        return res.status(403).json({ message: "Forbidden" });
    }
}

const userVerify = (req, res, next) => {
    if (req.dbUser.role !== "user") {
        return res.status(403).json({
            message: "Forbidden",
        });
    }

    next();
};

const creatorVerify = (req, res, next) => {
    if (req.dbUser.role !== "creator") {
        return res.status(403).json({
            message: "Forbidden",
        });
    }

    next();
};

const adminVerify = (req, res, next) => {
    if (req.dbUser.role !== "admin") {
        return res.status(403).json({
            message: "Forbidden",
        });
    }

    next();
};

const premiumVerify = (req, res, next) => {
    if (req.dbUser.plan !== "premium") {
        return res.status(403).json({
            message: "Premium subscription required",
        });
    }

    next();
};


async function server() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("neuprompt_db");
        const usersCollection = database.collection("user");
        const promptsCollection = database.collection("prompts");
        const bookmarksCollection = database.collection("bookmarks");
        const reviewsCollection = database.collection("reviews");
        const reportsCollection = database.collection("reports");
        const transactionsCollection = database.collection("transactions");

        const verifyUser = async (req, res, next) => {
            const authUser = req.user;

            const dbUser = await usersCollection.findOne({
                _id: new ObjectId(authUser.id),
            });

            if (!dbUser) {
                return res.status(401).json({
                    message: "Unauthorized",
                });
            }

            req.dbUser = dbUser;

            next();
        };

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


        app.get("/api/prompts", async (req, res) => {
            const {
                search,
                category,
                aiTool,
                difficulty,
                sort,
                page = 1,
                limit = 9,
            } = req.query;

            const query = {
                status: "approved",
            };

            let sortQuery = {
                createdAt: -1, // Default: Latest
            };

            const currentPage = Math.max(1, parseInt(page) || 1);

            const perPage = Math.max(1, parseInt(limit) || 9);
            const skip = (currentPage - 1) * perPage;



            if (search) {
                query.$or = [
                    {
                        title: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                    {
                        aiTool: {
                            $regex: search,
                            $options: "i",
                        },
                    },
                    // {
                    //     category: {
                    //         $regex: search,
                    //         $options: "i",
                    //     },
                    // },
                    {
                        tags: {
                            $in: [new RegExp(search, "i")],
                        },
                    },
                ];
            }

            switch (sort) {
                case "Latest":
                    sortQuery = {
                        createdAt: -1,
                    };
                    break;

                case "Oldest":
                    sortQuery = {
                        createdAt: 1,
                    };
                    break;

                case "Most Popular":
                    sortQuery = {
                        copyCount: -1,
                    };
                    break;

                case "Most Copied":
                    sortQuery = {
                        copyCount: -1,
                    };
                    break;

                case "Highest Rated":
                    sortQuery = {
                        rating: -1,
                    };
                    break;

                default:
                    sortQuery = {
                        createdAt: -1,
                    };
            }

            if (category && category !== "All") {
                query.category = category;
            }

            if (aiTool && aiTool !== "All") {
                query.aiTool = aiTool;
            }


            if (difficulty && difficulty !== "All") {
                query.difficulty = difficulty;
            }

            const total = await promptsCollection.countDocuments(query);

            const result = await promptsCollection
                .find(query)
                .sort(sortQuery)
                .skip(skip)
                .limit(perPage)
                .toArray();


            res.send({
                prompts: result,
                total,
                currentPage,
                totalPages: Math.ceil(total / perPage),
            });
        });

        // Get single prompt for details page
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


        app.post("/api/reviews", async (req, res) => {
            try {
                const review = {
                    ...req.body,
                    rating: Number(req.body.rating),
                    createdAt: new Date(),
                };

                // Check duplicate review
                const existingReview = await reviewsCollection.findOne({
                    promptId: review.promptId,
                    userId: review.userId,
                });

                if (existingReview) {
                    return res.status(400).send({
                        success: false,
                        message: "You have already reviewed this prompt.",
                    });
                }

                // Insert review
                const result = await reviewsCollection.insertOne(review);

                console.log("Review PromptId:", review.promptId);

                // Get all reviews for this prompt
                const reviews = await reviewsCollection
                    .find({
                        promptId: review.promptId,
                    })
                    .toArray();

                console.log("Reviews:", reviews);

                const totalRatings = reviews.length;
                console.log("Total Ratings:", totalRatings);

                const totalStars = reviews.reduce(
                    (sum, item) => sum + Number(item.rating),
                    0
                );

                console.log("Total Stars:", totalStars);

                const averageRating = Number(
                    (totalStars / totalRatings).toFixed(1)
                );

                console.log("Average Rating:", averageRating);

                // Update prompt
                const updateResult = await promptsCollection.updateOne(
                    {
                        _id: new ObjectId(review.promptId),
                    },
                    {
                        $set: {
                            rating: averageRating,
                            totalRatings,
                        },
                    }
                );



                res.send({
                    success: true,
                    insertedId: result.insertedId,
                    rating: averageRating,
                    totalRatings,
                });

            } catch (error) {
                console.error("Review Error:", error);

                res.status(500).send({
                    success: false,
                    message: "Failed to submit review.",
                });
            }
        });

        // get reviews by promptId
        app.get("/api/reviews/:promptId", async (req, res) => {
            const promptId = req.params.promptId;

            const reviews = await reviewsCollection.find({ promptId }).sort({ createdAt: -1 }).toArray();

            res.send(reviews);
        });


        app.get("/api/reviews/my/:userId", async (req, res) => {
            try {
                const userId = req.params.userId;

                const reviews = await reviewsCollection.aggregate([
                    {
                        $match: {
                            userId,
                        },
                    },

                    {
                        $addFields: {
                            promptObjectId: {
                                $toObjectId: "$promptId",
                            },
                        },
                    },

                    {
                        $lookup: {
                            from: "prompts",
                            localField: "promptObjectId",
                            foreignField: "_id",
                            as: "prompt",
                        },
                    },

                    {
                        $unwind: "$prompt",
                    },

                    {
                        $project: {
                            _id: 1,
                            userId: 1,
                            userName: 1,
                            userImage: 1,
                            rating: 1,
                            comment: 1,
                            createdAt: 1,

                            prompt: {
                                _id: "$prompt._id",
                                title: "$prompt.title",
                                thumbnail: "$prompt.thumbnail",
                                category: "$prompt.category",
                                aiTool: "$prompt.aiTool",
                                difficulty: "$prompt.difficulty",
                                visibility: "$prompt.visibility",
                                creatorId: "$prompt.creatorId",
                                creatorName: "$prompt.creatorName",
                            },
                        },
                    },

                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },
                ]).toArray();

                res.send(reviews);

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to fetch reviews",
                });
            }
        });


        app.get("/api/reviews/received/:creatorId", async (req, res) => {
            try {
                const creatorId = req.params.creatorId;

                const reviews = await reviewsCollection.aggregate([
                    {
                        $addFields: {
                            promptObjectId: {
                                $toObjectId: "$promptId",
                            },
                        },
                    },
                    {
                        $lookup: {
                            from: "prompts",
                            localField: "promptObjectId",
                            foreignField: "_id",
                            as: "prompt",
                        },
                    },
                    {
                        $unwind: "$prompt",
                    },


                    {
                        $match: {
                            "prompt.creatorId": creatorId,
                        },
                    },

                    {
                        $project: {
                            _id: 1,
                            userId: 1,
                            userName: 1,
                            userImage: 1,
                            rating: 1,
                            comment: 1,
                            createdAt: 1,

                            prompt: {
                                _id: "$prompt._id",
                                title: "$prompt.title",
                                thumbnail: "$prompt.thumbnail",
                                category: "$prompt.category",
                                aiTool: "$prompt.aiTool",
                                difficulty: "$prompt.difficulty",
                                visibility: "$prompt.visibility",
                                creatorId: "$prompt.creatorId",
                            },
                        },
                    },

                    {
                        $sort: {
                            createdAt: -1,
                        },
                    },
                ]).toArray();

                res.send(reviews);

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to fetch received reviews",
                });
            }
        });

        app.patch("/api/reviews/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { userId, rating, comment } = req.body;

                const review = await reviewsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!review) {
                    return res.status(404).send({
                        success: false,
                        message: "Review not found",
                    });
                }

                if (review.userId !== userId) {
                    return res.status(403).send({
                        success: false,
                        message: "Unauthorized",
                    });
                }

                await reviewsCollection.updateOne(
                    {
                        _id: new ObjectId(id),
                    },
                    {
                        $set: {
                            rating,
                            comment,
                            updatedAt: new Date(),
                        },
                    }
                );

                res.send({
                    success: true,
                    message: "Review updated successfully",
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to update review",
                });
            }
        });

        app.delete("/api/reviews/:id", async (req, res) => {
            try {
                const { id } = req.params;
                const { userId } = req.body;

                const review = await reviewsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!review) {
                    return res.status(404).send({
                        success: false,
                        message: "Review not found",
                    });
                }

                if (review.userId !== userId) {
                    return res.status(403).send({
                        success: false,
                        message: "Unauthorized",
                    });
                }

                await reviewsCollection.deleteOne({
                    _id: new ObjectId(id),
                });

                res.send({
                    success: true,
                    message: "Review deleted successfully",
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to delete review",
                });
            }
        });

        //report post 
        app.post("/api/reports", async (req, res) => {
            const report = req.body;
            report.status = "pending";
            report.createdAt = new Date();
            const result = await reportsCollection.insertOne(report);

            res.send(result);
        });


        //get reports
        app.get("/api/reports", async (req, res) => {
            const reports = await reportsCollection.aggregate([
                // Prompt
                {
                    $lookup: {
                        from: "prompts",
                        let: {
                            promptId: {
                                $toObjectId: "$promptId"
                            }
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            "$_id",
                                            "$$promptId"
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "prompt"
                    }
                },

                {
                    $unwind: "$prompt"
                },

                // Reporter
                {
                    $lookup: {
                        from: "user",
                        let: {
                            reporterId: {
                                $toObjectId: "$reporterId"
                            }
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            "$_id",
                                            "$$reporterId"
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "reporter"
                    }
                },

                {
                    $unwind: "$reporter"
                },

                // Creator
                {
                    $lookup: {
                        from: "user",
                        let: {
                            creatorId: {
                                $toObjectId: "$creatorId"
                            }
                        },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: [
                                            "$_id",
                                            "$$creatorId"
                                        ]
                                    }
                                }
                            }
                        ],
                        as: "creator"
                    }
                },

                {
                    $unwind: "$creator"
                }

            ]).toArray();

            res.send(reports)
        });


        //post subscriptions
        app.post("/api/subscriptions", async (req, res) => {
            try {
                const { sessionId } = req.body;
                const session = await stripe.checkout.sessions.retrieve(
                    sessionId,
                    {
                        expand: ["payment_intent"],
                    }
                );


                // CHECK DUPLICATE PAYMENT
                const exists = await transactionsCollection.findOne({
                    stripeSessionId: session.id,
                });

                if (exists) {
                    return res.send({
                        success: true,
                        message:
                            "Subscription already processed.",
                    });
                }


                // CREATE TRANSACTION
                const transaction = {
                    userId: session.metadata.userId,
                    email: session.customer_details.email,
                    plan: session.metadata.plan,
                    amount: session.amount_total / 100,
                    currency: session.currency,
                    stripeSessionId: session.id,
                    stripePaymentIntentId: session.payment_intent?.id || null,
                    paymentStatus: session.payment_status,
                    createdAt: new Date(),
                };

                await transactionsCollection.insertOne(transaction);

                // UPDATE USER
                await usersCollection.updateOne(
                    {
                        _id: new ObjectId(session.metadata.userId),
                    },

                    {
                        $set: {
                            plan: "premium",
                        },
                    }
                );

                res.send({
                    success: true,
                    message:
                        "Premium activated successfully.",
                });
            }

            catch (error) {
                console.log(error);
                res.status(500).send({
                    success: false,
                    message:
                        "Something went wrong.",
                });
            }
        });


        //get subscription user 
        app.get("/api/subscriptions/:userId", async (req, res) => {
            const { userId } = req.params;

            const subscription = await transactionsCollection.findOne(
                {
                    userId,
                    paymentStatus: "paid",
                },

                {
                    sort: {
                        createdAt: -1,
                    }
                }
            );
            res.send(subscription);
        });


        app.get("/api/dashboard/creator-stats/:creatorId", async (req, res) => {
            try {
                const { creatorId } = req.params;

                const prompts = await promptsCollection
                    .find({ creatorId })
                    .toArray();

                const totalPrompts = prompts.length;

                const totalCopies = prompts.reduce(
                    (sum, prompt) => sum + (prompt.copyCount || 0),
                    0
                );

                const totalBookmarks = prompts.reduce(
                    (sum, prompt) => sum + (prompt.bookmarkCount || 0),
                    0
                );

                const totalRatings = prompts.reduce(
                    (sum, prompt) => sum + (prompt.totalRatings || 0),
                    0
                );

                const ratingSum = prompts.reduce(
                    (sum, prompt) =>
                        sum + (prompt.rating || 0) * (prompt.totalRatings || 0),
                    0
                );

                const averageRating =
                    totalRatings > 0
                        ? Number((ratingSum / totalRatings).toFixed(1))
                        : 0;

                res.send({
                    totalPrompts,
                    totalCopies,
                    totalBookmarks,
                    averageRating,
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to fetch creator analytics",
                });
            }
        });

        app.get("/api/dashboard/performance/:creatorId", async (req, res) => {
            try {
                const { creatorId } = req.params;

                const performance = await promptsCollection
                    .find(
                        { creatorId },
                        {
                            projection: {
                                title: 1,
                                copyCount: 1,
                                bookmarkCount: 1,
                            },
                        }
                    )
                    .sort({ copyCount: -1 })
                    .limit(10)
                    .toArray();

                res.send(performance);
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to fetch performance data",
                });
            }
        });

        app.get("/api/dashboard/growth/:creatorId", async (req, res) => {
            try {
                const { creatorId } = req.params;

                const growth = await promptsCollection.aggregate([
                    {
                        $match: {
                            creatorId,
                        },
                    },

                    {
                        $addFields: {
                            createdDate: {
                                $dateFromString: {
                                    dateString: "$createdAt",
                                },
                            },
                        },
                    },

                    {
                        $group: {
                            _id: {
                                year: { $year: "$createdDate" },
                                month: { $month: "$createdDate" },
                            },
                            prompts: {
                                $sum: 1,
                            },
                        },
                    },

                    {
                        $sort: {
                            "_id.year": 1,
                            "_id.month": 1,
                        },
                    },
                ]).toArray();

                const monthNames = [
                    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                ];

                const formattedGrowth = growth.map((item) => ({
                    name: `${monthNames[item._id.month - 1]} ${item._id.year}`,
                    prompts: item.prompts,
                }));

                res.send(formattedGrowth);

            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to fetch growth analytics",
                    error: error.message,
                });
            }
        });

        app.get("/api/dashboard/top-prompts/:creatorId", async (req, res) => {
            try {
                const { creatorId } = req.params;

                const [
                    mostCopied,
                    mostBookmarked,
                    highestRated,
                ] = await Promise.all([
                    promptsCollection.findOne(
                        { creatorId },
                        {
                            sort: { copyCount: -1 },
                        }
                    ),

                    promptsCollection.findOne(
                        { creatorId },
                        {
                            sort: { bookmarkCount: -1 },
                        }
                    ),

                    promptsCollection.findOne(
                        { creatorId },
                        {
                            sort: {
                                rating: -1,
                                totalRatings: -1,
                            },
                        }
                    ),
                ]);

                res.send({
                    mostCopied,
                    mostBookmarked,
                    highestRated,
                });
            } catch (error) {
                console.error(error);

                res.status(500).send({
                    success: false,
                    message: "Failed to fetch top prompts",
                });
            }
        });


        app.get("/api/admin/transactions", async (req, res) => {
            try {
                const transactions = await transactionsCollection
                    .find({})
                    .sort({ createdAt: -1 })
                    .toArray();

                res.status(200).json({
                    success: true,
                    total: transactions.length,
                    transactions,
                });
            } catch (error) {
                console.error(error);

                res.status(500).json({
                    success: false,
                    message: "Internal Server Error",
                });
            }
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