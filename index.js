const express = require('express');
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 5000
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.set('port', (5000));
// middleware
app.use(cors())
app.use(express.json())


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    // bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'unauthorized access' })
        }
        req.decoded = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.USER_DB}:${process.env.USER_PASS}@cluster0.xwxepqp.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();

        //collections
        const instructorCollection = client.db('summerDb').collection('instructor')
        const instructorsCollection = client.db('summerDb').collection('instructors')
        const studentCollection = client.db('summerDb').collection('student')
        const cartCollection = client.db('summerDb').collection('carts')
        const paymentCollection = client.db('summerDb').collection('payments')


        // const verifyAdminInstructor = async (res, req, next) => {
        //     const email = req.decoded.email
        //     const query = { email: email }
        //     const user = await studentCollection.findOne(query)
        //     if (user?.role !== 'admin') {
        //         return res.status(403).send({ error: true, message: 'forbidden message' })
        //     }
        //     next()
        // }

        //jwt
        app.post('/jwt', (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([])
            }
            const query = { email: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)


        })

        app.get('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const result = await cartCollection.findOne(filter)
            res.send(result)


        })

        // TODO
        app.post('/carts', async (req, res) => {
            const item = req.body
            console.log(item)
            const query = { courseId: item.courseId }
            const existingClass = await cartCollection.findOne(query)
            if (existingClass) {
                return res.send({ message: 'Already selected' })
            }
            const result = await cartCollection.insertOne(item)
            res.send(result)

        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.deleteOne(query)
            res.send(result)
        })



        app.get('/instructors', async (req, res) => {
            let query = {}
            if (req.query?.text === "approved") {
                query = { status: "approved" }
            }
            const result = await instructorsCollection.find(query).toArray()
            res.send(result);
        })


        app.post('/instructors', async (req, res) => {
            const instructor = req.body
            const result = await instructorsCollection.insertOne(instructor)
            res.send(result)
        })



        // users related api
        app.get('/students', async (req, res) => {
            const result = await studentCollection.find().toArray()
            res.send(result);
        })

        app.post('/students', async (req, res) => {
            const student = req.body;
            const query = { email: student.email }
            const existingUser = await studentCollection.findOne(query)
            if (existingUser) {
                return res.send({ message: 'user already exist' })
            }
            const result = await studentCollection.insertOne(student)
            res.send(result)
        })

        // security layer: verifyJWT
        // email check
        // check admin and instructor
        app.get('/students/adminInstructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false, instructor: false });
            }

            try {
                const query = { email: email };
                const user = await studentCollection.findOne(query, { role: 1 });
                if (user) {
                    res.send({ admin: user.role === 'admin', instructor: user.role === 'instructor' });
                } else {
                    res.status(404).send('User not found');
                }
            } catch (error) {
                console.error(error);
                res.status(500).send('Error retrieving user roles');
            }
        });



        app.patch('/instructors/approveDeny/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const { status } = req.body; // Get the role from the request body

            const updateDoc = {
                $set: {}
            };

            if (status === 'approved' || status === 'denied') {
                updateDoc.$set.status = status; // Set the status as provided in the request body
            }

            try {
                const result = await instructorsCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send('Error updating user status');
            }
        });


        app.patch('/instructors/feedback/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const { feedback } = req.body; // Get the feedback from the request body

            const updateDoc = {
                $set: { feedback } // Update the feedback field with the new value
            };

            try {
                const result = await instructorsCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send('Error updating feedback');
            }
        });


        app.patch('/students/adminInstructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const { role } = req.body; // Get the role from the request body

            const updateDoc = {
                $set: {}
            };

            if (role === 'admin' || role === 'instructor') {
                updateDoc.$set.role = role; // Set the role as provided in the request body
            }

            try {
                const result = await studentCollection.updateOne(filter, updateDoc);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send('Error updating user role');
            }
        });



        app.get('/instructor', async (req, res) => {
            const query = {}
            const options = {
                sort: { "numStudent": -1 }
            }
            const result = await instructorCollection.find(query, options).toArray()
            res.send(result)


        })

        // create payment intent
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const { price } = req.body;
            if (price) {
                const amount = parseFloat(price) * 100
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                })

                res.send({
                    clientSecret: paymentIntent.client_secret
                })
            }

        })

        app.post('/payments', async (req, res) => {
            const payment = req.body
            const result = await paymentCollection.insertOne(payment)

            const query = { _id: new ObjectId(payment.cartItems) }
            const deleteResult = await cartCollection.deleteOne(query)
            res.send({ result, deleteResult })
        })




        //TODO
        app.get('/payments/:email', async (req, res) => {
            const email = req.params.email;
            console.log(email);
            const query = { email: email }
            const options = {
                sort: { "price": -1 }
            }
            const result = await paymentCollection.find(query, options).toArray()
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
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('summer camp running')

})

app.listen(port, () => {
    console.log(`summer camp server running on ${port}`);
})