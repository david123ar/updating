const { MongoClient } = require("mongodb");
// const fetch = require('node-fetch'); // Ensure you have installed `node-fetch`

const mongoUri =
  "mongodb://root:Imperial_king2004@145.223.118.168:27017/?authSource=admin";
const dbName = "mydatabase"; // Change the database name as needed
const client = new MongoClient(mongoUri);

async function fetchStreamData(_id, type) {
  try {
    const response = await fetch(
      `https://vimal.animoon.me/api/stream?id=${_id}&server=hd-1&type=${type}`,
      {
        cache: "no-store",
      }
    );
    const data = await response.json();
    return {
      success: data.success || false,
      results: data.results || {},
    };
  } catch (error) {
    console.error(`Error fetching data for ID: ${_id}, type: ${type}`, error);
    return { success: false, results: {} };
  }
}

async function processBatch(batch, episodesCollection) {
  const streamsUpdatePromises = batch.map(async ({ _id }) => {
    console.log(`Processing ID: ${_id}`);

    // Check if the document already has update: true
    const existingDoc = await episodesCollection.findOne({ _id });
    if (existingDoc && existingDoc.update) {
      console.log(`Skipping ID: ${_id} because it's already updated.`);
      return null; // Skip if the update flag is already true
    }

    const types = ["raw", "sub", "dub"];
    const streamsData = {};

    // Fetch stream data for each type in parallel
    const fetchPromises = types.map((type) => fetchStreamData(_id, type));
    const results = await Promise.all(fetchPromises);

    // Check if any result is unsuccessful, skip the update if there's an error
    const hasError = results.some((result) => !result.success);

    if (hasError) {
      console.log(`Skipping update for ID: ${_id} due to fetch errors.`);
      return null; // Return null if there's an error
    }

    // Map results to streamsData
    types.forEach((type, index) => {
      streamsData[type] = results[index];
    });

    return { _id, streamsData };
  });

  const updates = await Promise.all(streamsUpdatePromises);

  // Filter out null values (errors or skipped updates)
  const validUpdates = updates.filter(update => update !== null);

  if (validUpdates.length > 0) {
    // Update each document in the database
    const updatePromises = validUpdates.map(async ({ _id, streamsData }) => {
      const updateResult = await episodesCollection.updateOne(
        { _id },
        {
          $set: {
            streams: streamsData,
            update: true, // Set the update flag to true
          },
        }
      );
      return { _id, modifiedCount: updateResult.modifiedCount };
    });

    const updateResults = await Promise.all(updatePromises);
    updateResults.forEach(({ _id, modifiedCount }) => {
      console.log(
        `Updated ID: ${_id}`,
        modifiedCount > 0 ? "Success" : "No changes made"
      );
    });
  }
}

(async () => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const episodesCollection = db.collection("episodesStream");

    // Fetch all IDs from the collection and reverse the order (start from the last)
    const cursor = episodesCollection.find({}, { projection: { _id: 1 } });
    const ids = await cursor.toArray();
    ids.reverse(); // Reverse to start from the last ID

    console.log(`Total IDs to process: ${ids.length}`);

    // Process IDs in batches of 10
    const batchSize = 10;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}, IDs ${
          i + 1
        }-${Math.min(i + batchSize, ids.length)}`
      );

      await processBatch(batch, episodesCollection);

      // Calculate and log remaining IDs
      const remainingCount = ids.length - (i + batchSize);
      console.log(`Remaining IDs in the collection: ${remainingCount}`);
    }

    console.log("Processing complete.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
})();
