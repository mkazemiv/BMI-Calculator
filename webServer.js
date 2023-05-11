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

app.get("/", (request, response) => {
    /* renders the home page: index.ejs */
	response.render("index", {});
});

app.get("/insertData", (request, response) => {
    /* renders insert.ejs and passes form action */
	let formAction = `"http://localhost:${[portNumber]}/processedData"`;
	response.render("insert", { formAction });
});

app.post("/processedData", (request, response) => {
    /* renders processed.ejs and processes form data */
	let { name, email, unit, weight, height1, height2 } = request.body;
    weight = parseInt(weight)
    const data = { name, email, unit, weight, height1, height2 }
    
    let bmiData = calculateBMI(data)
    bmiData.then( function (result) {
        response.render("processed", result);
    })
});

app.get("/query", (request, response) => {
    /* renders review.ejs and passes form action */
	let action = `"http://localhost:${[portNumber]}/processQuery"`;
	response.render("review", { action });
});

app.post("/processQuery", async (request, response) => {
    /* renders queryResult.ejs and queries db */
	let { name, email } = request.body;
    let filter = { name: name, email: email };

    /* finding application by name & email in db using findOne() */
    try {
        await client.connect();
        const result = await client.db(databaseAndCollection.db)
                                   .collection(databaseAndCollection.collection)
                                   .findOne(filter);

        // /* retrieving properties from promise result */
        // console.log(result)
        // let { name, email, unit, weight, height, bmi } = result
        // if (bmi == bmi.toFixed(1))
        //     bmi = bmi.toFixed(1)
        // else
        //     bmi = bmi.toFixed(2)
        // /* putting variables together and passing to rendered page */
        // return { name, email, unit, weight, height, bmi };
        response.render("queryResult", result);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close()
    }
});

app.listen(portNumber);
console.log("Web server is running");

async function calculateBMI (data) {
    /* Using 'Body Mass Index (BMI) Calculator' from Rapid API */
    /* https://rapidapi.com/principalapis/api/body-mass-index-bmi-calculator/ */

    /* compute height depending on unit system */
    let height = parseInt(data.height1)*12 + parseInt(data.height2);
    if (data.unit === "metric")
        height = parseFloat(data.height1)/100;
    
    /* adjust 'data' object properties */
    delete data.height1;
    delete data.height2;
    data.height = height;

    /* API fetch request url and options for BMI calculation */
    let url = 
        `https://body-mass-index-bmi-calculator.p.rapidapi.com/${data.unit}?weight=${data.weight}&height=${data.height}`;
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': '02d54c8c17msh5b44485dc9353bcp1bdadejsndbf4c76be4b5',
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

            /* inserting data into db using insertOne() */
            await client.connect();
            await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .insertOne(data);
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

async function updateData (data) {    
    try {
        /* updating data in db w/ weightCategory using updateOne() */
        await client.connect();
        let update = { $set: { weightCategory: obj.weightCategory} }
        let filter = { name: data.name, email: data.email };
        await client.db(databaseAndCollection.db)
                    .collection(databaseAndCollection.collection)
                    .updateOne(filter, update);
    } catch (error) {
        console.error(error);
    } finally {
        await client.close()
    }

    return data;
}

/*
async function lookupData(data) {
    try {
        await client.connect();
        let filter = { name: data.name, email: data.email };
        const result = await client.db(databaseAndCollection.db)
                           .collection(databaseAndCollection.collection)
                           .findOne(filter);
        // retrieving properties from promise result /
        console.log(result)
        let { name, email, unit, weight, height, bmi } = result
        if (bmi == bmi.toFixed(1))
            bmi = bmi.toFixed(1)
        else
            bmi = bmi.toFixed(2)
        /* putting variables together and passing to rendered page /
        return { name, email, unit, weight, height, bmi };
    } catch (e) {
        console.error(e);
    } finally {
        await client.close()
    }
}*/
