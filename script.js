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

    // Process episodes in batches of 30
    const batchSize = 30;
    for (let i = 0; i < episodes.length; i += batchSize) {
      const batch = episodes.slice(i, i + batchSize);
      
      // Fetch and update the episodes in parallel
      const promises = batch.map(async (episode) => {
        const episodeId = episode.id;
        console.log(`Fetching data for episodeId: ${episodeId}`);
        
        // Fetch the data for each category in parallel
        const categoryPromises = categories.map(async (category) => {
          try {
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
                  $set: { [`streams.${category}.results.streamingLink`]: streamingLink }
                }
              );

              console.log(`Updated streamingLink for episodeId: ${episodeId} - Category: ${category}`);
            }
          } catch (error) {
            console.error(`Error fetching data for episodeId: ${episodeId} - Category: ${category}`, error.message);
          }
        });

        // Wait for all category promises to finish
        await Promise.all(categoryPromises);
        console.log(`Updated episodeId: ${episodeId}`);
      });

      // Wait for all episode promises to finish in this batch
      await Promise.all(promises);

      // Log remaining episodes
      console.log(`Remaining episodes: ${episodes.length - (i + batchSize)}`);
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
