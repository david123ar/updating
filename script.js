const { MongoClient } = require("mongodb");
const axios = require("axios");

const mongoUri =
  "mongodb://root:Imperial_king2004@145.223.118.168:27017/?authSource=admin";
const dbName = "mydatabase";
const client = new MongoClient(mongoUri);

// Categories
const categories = ["raw", "sub", "dub"];

async function fetchDataAndUpdate() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);
    const collection = db.collection("episodesStream");

    // Start from id >= 30000
    const episodes = await collection.find({ id: { $gte: "30000" } }).toArray();

    console.log(`Total episodes to process: ${episodes.length}`);

    // Iterate over the episodes and update
    for (const [index, episode] of episodes.entries()) {
      const episodeId = episode.id;
      console.log(`Remaining IDs to process: ${episodes.length - index - 1}`);
      
      // Fetch the data from the API for each category one by one
      for (const category of categories) {
        try {
          console.log(`Fetching data for episodeId: ${episodeId} - Category: ${category}`);
          
          // Fetch the data from the API for the current category
          const response = await axios.get(
            `https://newgogo.animoon.me/api/data?episodeId=${episodeId}&category=${category}`
          );

          // Extract the full streamingLink object from the API response
          const streamingLink = response.data;

          // If streamingLink object exists, update the document in MongoDB
          if (streamingLink) {
            // Update the document for the respective category
            const updateResult = await collection.updateOne(
              { _id: episode._id },
              {
                $set: { [`streams.${category}.results.streamingLink`]: streamingLink },
                $unset: { changed: "" } // Remove the `changed` field
              }
            );

            console.log(`Updated streamingLink for episodeId: ${episodeId} - Category: ${category}`);
          }
        } catch (error) {
          console.error(`Error fetching data for episodeId: ${episodeId} - Category: ${category}`, error.message);
        }
      }

      // Log the updated ID
      console.log(`Updated episodeId: ${episodeId}`);
    }

    console.log("Update process completed.");
  } catch (error) {
    console.error("Error connecting to MongoDB", error.message);
  } finally {
    // Close MongoDB connection
    await client.close();
  }
}

// Run the function
fetchDataAndUpdate();
