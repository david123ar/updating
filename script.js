const { MongoClient } = require("mongodb");
const axios = require("axios");

const mongoUri =
  "mongodb://root:Imperial_king2004@145.223.118.168:27017/?authSource=admin";
const dbName = "mydatabase";
const episodesStreamCollectionName = "episodesStream";
const animeInfoCollectionName = "animeInfo";

const MAX_RETRIES = 3;

async function fetchWithRetries(url, maxRetries) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Attempt ${attempt} failed for URL: ${url}`);
      if (attempt === maxRetries)
        throw new Error(`Failed after ${maxRetries} attempts`);
    }
  }
}

(async () => {
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db(dbName);
    const episodesStreamCollection = db.collection(
      episodesStreamCollectionName
    );
    const animeInfoCollection = db.collection(animeInfoCollectionName);

    const episodes = await episodesStreamCollection.find().toArray();

    for (const episode of episodes) {
      const episodeId = episode._id.split("?")[0];
      const animeInfo = await animeInfoCollection.findOne({ _id: episodeId });

      if (!animeInfo) {
        console.log(`No anime info found for ID '${episodeId}'`);
        continue;
      }

      const tvInfo = animeInfo?.info?.results?.data?.animeInfo?.tvInfo;
      const sub = tvInfo?.sub ?? null;
      const dub = tvInfo?.dub ?? null;

      // Check for episode_no or number
      const episodeNo = episode.episode_no || episode.number;
      if (episodeNo === undefined) {
        console.log(
          `No valid episode number found for Episode ID '${episode._id}'`
        );
        continue;
      }

      console.log(`Processing Episode ID: ${episode._id}`);
      console.log(
        `Sub episodes available: ${sub}, Dub episodes available: ${dub}, Episode No: ${episodeNo}`
      );

      let subData = null;
      let dubData = null;
      let rawData = null;

      // Fetch sub category
      if (sub !== null && episodeNo <= sub) {
        const subUrl = `https://newgogo.animoon.me/api/data?episodeId=${episode._id}&category=sub`;
        try {
          subData = await fetchWithRetries(subUrl, MAX_RETRIES);

          if (
            !subData?.link?.file ||
            !subData?.tracks?.some((track) => track.file)
          ) {
            console.log(
              `Invalid sub data for Episode ID '${episode._id}', skipping sub`
            );
            subData = null;
          } else {
            console.log("SubUrl", subData.link.file);
            console.log("SubUrl", subData.track[0].file);
            await episodesStreamCollection.updateOne(
              { _id: episode._id },
              {
                $set: { "streams.sub.results.streamingLink": subData },
                $unset: {
                  "streams.sub.streamingLink": "",
                  'update': "",
                },
              }
            );
            console.log(`Updated streams.sub for Episode ID '${episode._id}'`);
          }
        } catch (error) {
          console.error(
            `Sub category failed for Episode ID '${episode._id}' after ${MAX_RETRIES} retries`
          );
        }
      }

      // Fetch dub category
      if (dub !== null && episodeNo <= dub) {
        const dubUrl = `https://newgogo.animoon.me/api/data?episodeId=${episode._id}&category=dub`;
        try {
          dubData = await fetchWithRetries(dubUrl, MAX_RETRIES);

          if (
            !dubData?.link?.file ||
            !dubData?.tracks?.some((track) => track.file)
          ) {
            console.log(
              `Invalid dub data for Episode ID '${episode._id}', skipping dub`
            );
            dubData = null;
          } else {
            console.log("DubUrl", dubData.link.file);
            console.log("DubUrl", dubData.track[0].file);
            await episodesStreamCollection.updateOne(
              { _id: episode._id },
              {
                $set: { "streams.dub.results.streamingLink": dubData },
                $unset: {
                  "streams.dub.streamingLink": "",
                  "update": "",
                },
              }
            );
            console.log(`Updated streams.dub for Episode ID '${episode._id}'`);
          }
        } catch (error) {
          console.error(
            `Dub category failed for Episode ID '${episode._id}' after ${MAX_RETRIES} retries`
          );
        }
      }

      // Fetch raw category if both sub and dub failed
      if (!subData && !dubData) {
        const rawUrl = `https://newgogo.animoon.me/api/data?episodeId=${episode._id}&category=raw`;
        try {
          rawData = await fetchWithRetries(rawUrl, MAX_RETRIES);

          if (
            !rawData?.link?.file ||
            !rawData?.tracks?.some((track) => track.file)
          ) {
            console.log(
              `Invalid raw data for Episode ID '${episode._id}', skipping raw`
            );
            rawData = null;
          } else {
            console.log("RawUrl", rawData.link.file);
            console.log("RawUrl", rawData.track[0].file);
            await episodesStreamCollection.updateOne(
              { _id: episode._id },
              {
                $set: { "streams.raw.results.streamingLink": rawData },
                $unset: {
                  "streams.raw.streamingLink": "",
                  "update": "",
                },
              }
            );
            console.log(`Updated streams.raw for Episode ID '${episode._id}'`);
          }
        } catch (error) {
          console.error(
            `Raw category failed for Episode ID '${episode._id}' after ${MAX_RETRIES} retries`
          );
        }
      }

      // Skip document if all categories fail
      if (!subData && !dubData && !rawData) {
        console.log(`No valid data for Episode ID '${episode._id}', skipping`);
        continue;
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.close();
    console.log("Disconnected from MongoDB");
  }
})();
