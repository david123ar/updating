const { MongoClient } = require("mongodb");
const axios = require("axios");

const mongoUri =
  "mongodb://root:Imperial_king2004@145.223.118.168:27017/?authSource=admin";
const dbName = "mydatabase";
const collectionName = "animeInfo";

const client = new MongoClient(mongoUri);

async function fetchInfoAPI(id) {
  let infoData;
  while (!infoData?.results?.data?.title) {
    try {
      const infoResponse = await axios.get(`https://vimal.animoon.me/api/info?id=${id}`);
      infoData = infoResponse.data;
      if (!infoData?.results?.data?.title) {
        console.log(`No title found in info API response for ID ${id}. Retrying...`);
      }
    } catch (error) {
      console.error("Error fetching info API:", error);
      break; // Break out of the loop if there is an error
    }
  }
  return infoData;
}

async function fetchEpisodesAPI(id) {
  let episodesData;
  while (!episodesData?.results?.episodes?.length) {
    try {
      const episodesResponse = await axios.get(`https://vimal.animoon.me/api/episodes/${id}`);
      episodesData = episodesResponse.data;
      if (!episodesData?.results?.episodes?.length) {
        console.log(`No episodes found in episodes API response for ID ${id}. Retrying...`);
      }
    } catch (error) {
      console.error("Error fetching episodes API:", error);
      break; // Break out of the loop if there is an error
    }
  }
  return episodesData;
}

async function getIdDocs() {
  try {
    await client.connect();
    console.log("Connected to the database.");

    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Step 1: Find documents that don't have either 'info.results.data.title' or 'episodes.results.episodes.title'
    const documents = await collection.find({
      $or: [
        { "info.results.data.title": { $exists: false } },
        { "episodes.results.episodes.title": { $exists: false } }
      ]
    }).toArray();

    console.log(`${documents.length} documents found that do not have 'info.results.data.title' or 'episodes.results.episodes.title'`);

    // Step 2: Loop through each document and fetch data from the APIs
    for (let doc of documents) {
      const id = doc._id;
      let updates = {};

      // If 'info.results.data.title' is missing, fetch the info API
      if (!doc.info?.results?.data?.title) {
        const infoData = await fetchInfoAPI(id);
        if (infoData?.results?.data?.title) {
          updates["info"] = infoData;
        }
      }

      // If 'episodes.results.episodes.title' is missing, fetch the episodes API
      if (!doc.episodes?.results?.episodes?.length) {
        const episodesData = await fetchEpisodesAPI(id);
        if (episodesData?.results?.episodes?.length) {
          updates["episodes"] = episodesData;
        }
      }

      // If both 'info' and 'episodes' titles are missing, fetch both
      if (!doc.info?.results?.data?.title && !doc.episodes?.results?.episodes?.length) {
        const infoData = await fetchInfoAPI(id);
        if (infoData?.results?.data?.title) {
          updates["info"] = infoData;
        }

        const episodesData = await fetchEpisodesAPI(id);
        if (episodesData?.results?.episodes?.length) {
          updates["episodes"] = episodesData;
        }
      }

      // If updates are found, apply them to the document
      if (Object.keys(updates).length > 0) {
        await collection.updateOne(
          { _id: id },
          { $set: updates }
        );
        console.log(`Document with ID ${id} updated.`);
      } else {
        console.log(`No relevant data to update for document ID ${id}`);
      }
    }

  } catch (error) {
    console.error("Error fetching or updating documents:", error);
  } finally {
    await client.close();
    console.log("Connection closed.");
  }
}

getIdDocs();
