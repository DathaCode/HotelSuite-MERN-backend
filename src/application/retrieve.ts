import { Request, Response, NextFunction } from "express";
import Hotel from "../infrastructure/schemas/Hotel";
import mongoose from "mongoose";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";

export const retrieve = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Destructure the incoming query parameters
    const { query, location, minPrice, maxPrice, sort } = req.query;

    // If no explicit search query is provided, use filters
    if (!query || query === "") {
      // Build filter object for MongoDB
      let filter: any = {};

      // Apply country (location) filter if provided and not "ALL"
      if (location && location !== "ALL") {
        filter.location = {
          $regex: new RegExp(location.toString(), "i"),
        };
      }

      // Apply price range filter if provided; assumes Hotel.price is stored as a number
      if (minPrice || maxPrice) {
        filter.price = {};
        if (minPrice) {
          filter.price.$gte = parseInt(minPrice.toString(), 10);
        }
        if (maxPrice) {
          filter.price.$lte = parseInt(maxPrice.toString(), 10);
        }
      }

      // Determine sort order for price: ascending by default, descending if sort=desc
      const sortOption: any = {};
      if (sort && sort.toString() === "desc") {
        sortOption.price = -1;
      } else {
        sortOption.price = 1;
      }

      // Query the database using the built filter & sort options
      const hotels = await Hotel.find(filter).sort(sortOption);

      // Wrap each hotel inside an object with a default "confidence" of 1
      const resultHotels = hotels.map((hotel) => ({
        hotel,
        confidence: 1,
      }));

      res.status(200).json(resultHotels);
      return;
    }

    // Otherwise, if a search query IS provided, use the similarity search
    const embeddingsModel = new OpenAIEmbeddings({
      model: "text-embedding-ada-002",
      apiKey: process.env.OPENAI_API_KEY,
    });

    const vectorIndex = new MongoDBAtlasVectorSearch(embeddingsModel, {
      collection: mongoose.connection.collection("hotelVectors"),
      indexName: "vector_index",
    });

    const results = await vectorIndex.similaritySearchWithScore(query.toString());
    console.log("Similarity search results:", results);

    const matchedHotels = await Promise.all(
      results.map(async (result) => {
        const hotel = await Hotel.findById(result[0].metadata._id);
        return { hotel, confidence: result[1] };
      })
    );

    res
      .status(200)
      .json(
        matchedHotels.length > 3 ? matchedHotels.slice(0, 4) : matchedHotels
      );
    return;
  } catch (error) {
    next(error);
  }
};
