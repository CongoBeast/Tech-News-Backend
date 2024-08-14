const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
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
const PORT = 3001;
app.use(express.json());

const JWT_SECRET = 'your_jwt_secret'; // Use a strong, secret key in production

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.post('/summarize-article', async (req, res) => {
  const { link } = req.body;
  // console.log(link)

  try {
    const chatSession = model.startChat({
      generationConfig,
      history: [
        {
          role: "user",
          parts: [
            { text: `Here is the link to the article: ${link}. Summarize the article in one mid-sized paragraph, and add a good short creative title, return as an array with first item being the title and second being the text.` },
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

app.post('/summarize-company', async (req, res) => {
  const { link } = req.body;

  try {
    const chatSession = model.startChat({
      generationConfig, // Ensure this is defined elsewhere in your code
      history: [
        {
          role: "user",
          parts: [
            { text: `i want a you to summarize what a company does based on their link in one not too long not too short paragraph, no citations. Return in a JSON format an array with the company name, the summary, and the careers page link. If there is none, provide a social media link.` },
          ],
        },
      ],
    });

    const result = await chatSession.sendMessage(link);
    res.json({ summary: result.response.text() });
    // console.log(res.json({ summary: JSON.parse(result.response.text()) }))
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const apiConfig = {
  method: 'post',
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Request-Headers': '*',
    'api-key': '4graSqucDumhuePX7lpf75s6TrTFkwYXU1KN2h6vN3j72edWz6oue9BBFYOHvfUC',
  },
  urlBase: 'https://ap-south-1.aws.data.mongodb-api.com/app/data-nmutxbv/endpoint/data/v1/action/'
};

const generateId = () => {
  return crypto.randomBytes(12).toString('hex'); // Generates a 24-character hexadecimal string
};

const generateToken = (userId) => {
  const secretKey = 'your-secret-key'; // Replace with your own secret key
  const expiresIn = '1h'; // Token expiration time, e.g., 1 hour
  const payload = { sub: userId,  iat: Math.floor(Date.now() / 1000), // Issued at time (current time in seconds)
  };
  return jwt.sign(payload, secretKey, { expiresIn });;
};

const axiosInstance = axios.create({
  baseURL: apiConfig.urlBase,
  headers: apiConfig.headers,
});

const registerUser = async (userData) => {
  try {
    // Check if the username exists
    let response = await axiosInstance.post('findOne', {
      dataSource: 'Cluster0', // Replace with your data source name
      database: 'thomastshuma43', // Replace with your database name
      collection: 'users', // Replace with your collection name
      filter: { username: userData.username },
    });

    if (response.data.document) {
      return { status: 400, message: 'Username already exists' };
    }

    // Check if the email exists
    response = await axiosInstance.post('findOne', {
      dataSource: 'Cluster0',
      database: 'thomastshuma43',
      collection: 'users',
      filter: { email: userData.email },
    });

    if (response.data.document) {
      return { status: 400, message: 'Email already registered' };
    }

    // Register the new user
    response = await axiosInstance.post('insertOne', {
      dataSource: 'Cluster0',
      database: 'thomastshuma43',
      collection: 'users',
      document: { ...userData, signupTimestamp: new Date() },
    });

    const token = generateToken() // Assume you have a function to generate tokens

    return { status: 200, token };
  } catch (error) {
    console.error('Error registering user:', error);
    return { status: 500, message: 'Internal server error' };
  }
};


// Register User
app.post('/register', async (req, res) => {
  const { username, password, email, userType } = req.body;

  const response = await registerUser({ username, password, email, userType });

  if (response.status === 200) {
    res.json({ token: response.token });
  } else {
    res.status(response.status).json({ message: response.message });
  }
});

// Login User
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  const data = JSON.stringify({
    "collection": "users",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": { username }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}findOne`, data })
    .then(response => {
      const user = response.data.document;
      if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

        // Update user's loggedOn status and loginTimestamp
        const loginTimestamp = new Date().toISOString();
        const updateData = JSON.stringify({
          "collection": "users",
          "database": "thomastshuma43",
          "dataSource": "Cluster0",
          "filter": { "_id": user._id },
          "update": { "$set": { isLoggedOn: true, loginTimestamp } }
        });

        axios({ ...apiConfig, url: `${apiConfig.urlBase}updateOne`, data: updateData })
          .then(() => res.json({ token }))
          .catch(error => res.status(500).send(error));

      } else {
        res.status(401).send('Invalid credentials');
      }
    })
    .catch(error => res.status(500).send(error));
});


// Your existing routes go here

app.post('/submit-article', (req, res) => {
  const articleData = req.body;
  if (!articleData._id) {
    articleData._id = generateId();
  }

  const data = JSON.stringify({
    "collection": "TechNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "document": articleData
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}insertOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.get('/get-articles', (req, res) => {

  const startOfMonth = moment().startOf('month').toISOString();
  const endOfMonth = moment().endOf('month').toISOString();
  
  const data = JSON.stringify({
    "collection": "TechNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": {
        // "$gte": { "$date": startOfMonth },
        // "$lt": { "$date": endOfMonth }
    }
    // "pipeline": [
    //   {
    //     "$match": {
    //       "date": {
    //         "$gte": { "$date": startOfMonth },
    //         "$lt": { "$date": endOfMonth }
    //       }
    //     }
    //   }
    // ]
  });

  // axios({ ...apiConfig, url: `${apiConfig.urlBase}find`, data })
  axios({ ...apiConfig, url: `${apiConfig.urlBase}aggregate`, data })
    .then(response => {
      res.json(response.data.documents);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.post('/update-article', (req, res) => {
  const articleData = req.body;

  const data = JSON.stringify({
    "collection": "TechNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": { "_id": articleData._id },
    "update": { "$set": articleData }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}updateOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.post('/delete-article', (req, res) => {
  const { _id } = req.body;

  const data = JSON.stringify({
    "collection": "TechNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": { "_id": _id }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}deleteOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.get('/get-stats', (req, res) => {
  const data = JSON.stringify({
    "collection": "TechNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": {}
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}find`, data })
    .then(response => {
      const articles = response.data.documents;
      const numberOfPosts = articles.filter(article => article.status === 'Posted').length;
      const numberOfDrafts = articles.filter(article => article.status === 'Draft').length;
      
      const currentDate = new Date();
      const startOfWeek = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
      const numberOfPostsThisWeek = articles.filter(article => {
        const articleDate = new Date(article.date);
        return article.status === 'Posted' && articleDate >= startOfWeek;
      }).length;
      
      res.json({ numberOfPosts, numberOfDrafts, numberOfPostsThisWeek });
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});


app.post('/submit-funding-news', (req, res) => {
  const fundingData = req.body;
  if (!fundingData._id) {
    fundingData._id = generateId();
  }

  const data = JSON.stringify({
    "collection": "FundingNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "document": fundingData
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}insertOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});


app.get('/funding-news', (req, res) => {
  const data = JSON.stringify({
    "collection": "FundingNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": {}
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}find`, data })
    .then(response => {
      res.json(response.data.documents);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});


app.post('/update-funding-entry', (req, res) => {
  const fundingData = req.body;

  const data = JSON.stringify({
    "collection": "FundingNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": { "_id": fundingData._id },
    "update": { "$set": fundingData }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}updateOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.post('/delete-funding-entry', (req, res) => {
  const { _id } = req.body;

  const data = JSON.stringify({
    "collection": "FundingNews",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": { "_id": _id }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}deleteOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.post('/submit-link', (req, res) => {
  // const { link } = req.body;
  const { link } = req.body;
  const linkDocument = {
    _id: generateId(),
    link
  };

  const data = JSON.stringify({
    "collection": "ArticleLinks",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "document": linkDocument
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}insertOne`, data })
    .then(response => {
      res.status(200).json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.get('/article-links', (req, res) => {
  const data = JSON.stringify({
    "collection": "ArticleLinks",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": {}
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}find`, data })
    .then(response => {
      res.json(response.data.documents);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.post('/delete-links', (req, res) => {
  const { _id } = req.body;

  const data = JSON.stringify({
    "collection": "ArticleLinks",
    "database": "thomastshuma43",
    "dataSource": "Cluster0",
    "filter": { "_id": _id }
  });

  axios({ ...apiConfig, url: `${apiConfig.urlBase}deleteOne`, data })
    .then(response => {
      res.json(response.data);
    })
    .catch(error => {
      console.error('Error:', error);
      res.status(500).send(error);
    });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
