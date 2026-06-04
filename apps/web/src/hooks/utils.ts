import { Client } from "@langchain/langgraph-sdk";

export const createClient = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api";
  return new Client({
    apiUrl,
  });
};
