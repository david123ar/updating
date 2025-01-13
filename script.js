const { MongoClient } = require('mongodb');
// const fetch = require('node-fetch'); // Ensure you have installed `node-fetch`

(async () => {
  const mongoUri = "mongodb://root:Imperial_king2004@145.223.118.168:27017/?authSource=admin";
  const dbName = "mydatabase"; // Change the database name as needed
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const episodesCollection = db.collection("episodesStream");

    // Fetch all IDs from the collection
    const cursor = episodesCollection.find({}, { projection: { _id: 1 } });
    const ids = await cursor.toArray();

    for (const { _id } of ids) {
      console.log(`Processing ID: ${_id}`);
      
      // Initialize an object to store updated streams data
      const streamsData = {};

      // Fetch data for 'raw', 'sub', and 'dub'
      const types = ['raw', 'sub', 'dub'];
      for (const type of types) {
        try {
          const response = await fetch(`https://vimal.animoon.me/api/stream?id=${_id}&server=hd-1&type=${type}`, {
            cache: "no-store",
          });
          const data = await response.json();
          streamsData[type] = {
            success: data.success || false,
            results: data.results || {},
          };
        } catch (error) {
          console.error(`Error fetching data for ID: ${_id}, type: ${type}`, error);
          streamsData[type] = { success: false, results: {} };
        }
      }

      // Update the document in the database
      const updateResult = await episodesCollection.updateOne(
        { _id },
        {
          $set: {
            streams: streamsData,
          },
        }
      );

      console.log(`Updated ID: ${_id}`, updateResult.modifiedCount > 0 ? 'Success' : 'No changes made');
    }

    console.log('Processing complete.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
})();
