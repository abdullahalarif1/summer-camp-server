const express = require('express');
const cors = require('cors');
const app = express()
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 5000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


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
        await client.connect();


        const instructorCollection = client.db('summerDb').collection('instructor')
        const studentCollection = client.db('summerDb').collection('student')

        //jwt
        app.post('/jwt', (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
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




        app.get('/instructors/', async (req, res) => {
            const query = {}
            const options = {
                sort: { "numStudent": -1 }
            }
            const result = await instructorCollection.find(query, options).toArray()
            res.send(result)


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