// server.js
const express = require('express');
const cors = require('cors');
const {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} = require("@google/generative-ai");

const apiKey = "AIzaSyDhfeanHiRbyV0Vyrp7_YSgfvN5NTzY_PI";
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 8192,
  responseMimeType: "text/plain",
};

const app = express();
app.use(cors());
app.use(express.json());

app.post('/summarize', async (req, res) => {
  const { link } = req.body;
  // console.log(link)

  try {
    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [
            { text: `Here is the link to the article: ${link}. Summarize the article in one mid-sized paragraph, and add a good title, return as an array with first item being the title and second being the text.` },
          ],
        },
      ],
    });

    const result = await chatSession.sendMessage(link);
    // console.log(JSON.parse(result.response.text()))
    // console.log("stuff")
    res.json({ summary: result.response.text() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
