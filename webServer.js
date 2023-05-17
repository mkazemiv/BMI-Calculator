/* Team members:
        Fatima Chariwala
        Mohammad A. Kazemivarnamkhasti
*/
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const path = require("path");
const express = require("express");
const app = express(); /* app is a request handler function */
const bodyParser = require("body-parser"); /* handles post parameters */
app.use(bodyParser.urlencoded({extended:false}));
app.set("views", path.resolve(__dirname, "templates")); /* ejs templates dir */
app.set("view engine", "ejs"); /* view/templating engine */
require("dotenv").config({ path: path.resolve(__dirname, '.env') })
const portNumber = 5000;
const username = process.env.MONGO_DB_USERNAME;
const password = process.env.MONGO_DB_PASSWORD;
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${username}:${password}@cluster0.abikxxc.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const siteUrl = "https://bmi-calculator-6i9h.onrender.com";

app.get("/", (request, response) => {
    /* renders the home page: index.ejs */
	response.render("index", {});
});

app.get("/insertData", (request, response) => {
    /* renders insert.ejs and passes form action */
	let formAction = `${siteUrl}/processedData`;
	response.render("insert", { formAction });
});

app.post("/processedData", (request, response) => {
    /* renders processed.ejs and processes form data */
	let { name, email, unit, weight, height1, height2, flag } = request.body;
    weight = parseInt(weight)
    const data = { name, email, unit, weight, height1, height2 }
    
    let bmiData = calculateBMI(data)
    bmiData.then( function (result) {
        if (flag === "newProfile")
            addtoDB(result);
        else if (flag === "update")
            updateProfile(result)
        response.render("processed", result);
    })
});

app.get("/query", (request, response) => {
    /* renders lookup.ejs and passes form action */
	let formAction = `${siteUrl}/queryResult`;
	response.render("lookup", { formAction });
});

app.post("/queryResult", async (request, response) => {
    /* renders profile.ejs and queries db */
	let { qName, qEmail } = request.body;
    let filter = { name: qName, email: qEmail };

    /* finding application by name & email in db */
    try {
        await client.connect();
        const result = await client.db(databaseAndCollection.db)
                                   .collection(databaseAndCollection.collection)
                                   .findOne(filter);
        if (!result)
            /* if no result was found then render error.ejs */
            response.render("error", {});
        else {
            /* otherwise, render profile.ejs with the user's info and formAction in case of update */
            if (result.bmi == result.bmi.toFixed(1))
                result.bmi = result.bmi.toFixed(1)
            else
                result.bmi = result.bmi.toFixed(2)
            /* adding formAction for processedData endpoint, used in case of update */
            result.formAction = `${siteUrl}/processedData`;
            response.render("profile", result);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await client.close()
    }
});

app.listen(portNumber);
console.log(`Web server is running at ${siteUrl}/`);

async function calculateBMI (data) {
    /* Using 'Body Mass Index (BMI) Calculator' from Rapid API */
    /* https://rapidapi.com/principalapis/api/body-mass-index-bmi-calculator/ */

    /* compute height depending on unit system */
    let height = parseInt(data.height1)*12 + parseInt(data.height2);
    if (data.unit === "metric") {
        height = parseFloat(data.height1)/100;
        console.log(data.height2)
    }
    
    /* add 'height' property to data */
    data.height = height;

    /* API fetch request url and options for BMI calculation */
    let url = 
        `https://body-mass-index-bmi-calculator.p.rapidapi.com/${data.unit}?weight=${data.weight}&height=${data.height}`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': '4d23b1b5damsh2668f2d8f36a6b7p120e88jsn4bc679857bfd',
            'X-RapidAPI-Host': 'body-mass-index-bmi-calculator.p.rapidapi.com'
        }
    }

    try {
        /* fetch BMI calculation result from API, adding BMI to data */
        const response = await fetch(url, options);
        const result = await response.text();
        const obj = JSON.parse(result.toString());
        data.bmi = +obj.bmi.toFixed(2);
        
        try {
            /* adjust url to fetch weight category (based on BMI) from API, add weight category to data */
            url = `https://body-mass-index-bmi-calculator.p.rapidapi.com/weight-category?bmi=${data.bmi}`;
            const response = await fetch(url, options);
            const result = await response.text();
            const obj = JSON.parse(result.toString());
            data.weightCategory = obj.weightCategory;
        } catch (e) {
            console.error(e);
        } finally {
            await client.close()
        }
    } catch (error) {
        console.error(error);
    }

    return data;
}

async function addtoDB(data) {
    try {
        /* inserting data into db */
        await client.connect();
        await client.db(databaseAndCollection.db)
                    .collection(databaseAndCollection.collection)
                    .insertOne(data);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

async function updateProfile (data) {
    try {
        /* updating profile in db with new data */
        await client.connect();
        let update = { $set: data }
        let filter = { name: data.name, email: data.email };
        await client.db(databaseAndCollection.db)
                    .collection(databaseAndCollection.collection)
                    .updateOne(filter, update);
    } catch (error) {
        console.error(error);
    } finally {
        await client.close()
    }
}
