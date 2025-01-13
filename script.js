const { MongoClient } = require('mongodb');
const axios = require('axios');

const mongoUri = "mongodb://root:Imperial_king2004@145.223.118.168:27017/?authSource=admin";
const dbName = "mydatabase";
const client = new MongoClient(mongoUri);

async function fetchAndUpdateAnimeData() {
  try {
    // Connect to the MongoDB database
    await client.connect();
    const db = client.db(dbName);
    const episodesCollection = db.collection("animeInfo");

    // Fetch all anime documents
    const animeData = await episodesCollection.find({}).toArray();

    for (const anime of animeData) {
      const animeId = anime._id;

      // Fetch episode data
      const episodeResponse = await axios.get(`https://vimal.animoon.me/api/episodes/${animeId}`);
      const episodeData = episodeResponse.data;

      // Fetch additional info
      const infoResponse = await axios.get(`https://vimal.animoon.me/api/info?id=${animeId}`);
      const infoData = infoResponse.data;

      // Prepare the updated anime document with info first and episodes at the bottom
      const updatedAnime = {
        _id: animeId,
        info: infoData, // info first
        episodes: episodeData, // episodes at the bottom
      };

      // Replace the document with the updated one
      await episodesCollection.replaceOne(
        { _id: animeId }, // Find the document with the given _id
        updatedAnime, // Replace it with the updated document
        { upsert: false } // Set upsert to false to avoid creating a new document if not found
      );

      console.log(`Replaced anime with ID: ${animeId}`);
    }
  } catch (error) {
    console.error("Error fetching or updating anime data:", error);
  } finally {
    await client.close();
  }
}

fetchAndUpdateAnimeData();
