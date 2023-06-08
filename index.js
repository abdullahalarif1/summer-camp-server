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