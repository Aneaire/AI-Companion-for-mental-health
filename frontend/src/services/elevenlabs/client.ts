import axios from "axios";

const client = axios.create({
  baseURL: "https://api.elevenlabs.io/",
  headers: {
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
    "xi-api-key": import.meta.env.VITE_ELEVENLABS_API_KEY || "",
  },
});

export default client;