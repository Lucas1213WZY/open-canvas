import { Client } from "@langchain/langgraph-sdk";

export const createClient = () => {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== "undefined"
      ? `${window.location.origin}/api`
      : "http://localhost:3000/api");
  return new Client({
    apiUrl,
  });
};
