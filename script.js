const { MongoClient } = require("mongodb");

const mongoUri =
  "mongodb://root:Imperial_king2004@145.223.118.168:27017/?authSource=admin";
const dbName = "mydatabase";
const client = new MongoClient(mongoUri);

async function fetchStreamData(_id, type) {
  try {
    const response = await fetch(
      `https://vimal.animoon.me/api/stream?id=${_id}&server=hd-1&type=${type}`,
      { cache: "no-store" }
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

async function processDocument(_id, episodesCollection, updatedCount, remainingIds) {
  console.log(`Processing ID: ${_id}`);

  // Check if the document has already been updated
  const existingDoc = await episodesCollection.findOne({ _id, changed: true });
  if (existingDoc) {
    console.log(`Skipping ID: ${_id}, already updated.`);
    remainingIds.delete(_id);
    return updatedCount;
  }

  const types = ["raw", "sub", "dub"];
  const streamsData = {};

  // Fetch stream data for each type
  for (const type of types) {
    const result = await fetchStreamData(_id, type);
    if (!result.success) {
      console.log(`Skipping ID: ${_id} due to fetch error for type: ${type}`);
      return updatedCount; // Skip the current document if any fetch fails
    }
    streamsData[type] = result;
  }

  // Update the document in the database
  const updateResult = await episodesCollection.updateOne(
    { _id },
    {
      $set: {
        streams: streamsData,
        update: true, // Mark as updated
        changed: true, // Add the `changed` field
      },
    }
  );

  if (updateResult.modifiedCount > 0) {
    console.log(`Updated ID: ${_id} successfully.`);
    updatedCount++;
  } else {
    console.log(`No changes made for ID: ${_id}.`);
  }

  remainingIds.delete(_id);
  return updatedCount;
}

(async () => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const episodesCollection = db.collection("episodesStream");

    // Fetch all IDs from the collection
    const cursor = episodesCollection.find({}, { projection: { _id: 1 } });
    const ids = await cursor.toArray();
    ids.reverse(); // Reverse to start from the last ID

    console.log(`Total IDs to process: ${ids.length}`);

    // Initialize counters
    let updatedCount = 0;
    const remainingIds = new Set(ids.map(({ _id }) => _id));

    // Process each ID one by one
    for (const { _id } of ids) {
      updatedCount = await processDocument(_id, episodesCollection, updatedCount, remainingIds);

      // Log remaining IDs and updated count periodically
      console.log(`Remaining IDs: ${remainingIds.size}`);
      console.log(`Total updated IDs so far: ${updatedCount}`);
    }

    console.log("Processing complete.");
    console.log(`Final count of updated IDs: ${updatedCount}`);
    console.log(`Remaining IDs: ${Array.from(remainingIds)}`);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
  }
})();
