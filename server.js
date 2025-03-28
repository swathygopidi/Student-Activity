const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require('path');
const cookieParser = require("cookie-parser");
const multer = require('multer');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());
app.use('/uploads', express.static('uploads')); // Serve uploaded images


const db = mysql.createConnection({
     host: "localhost",
    user: "root",
    password: "root",
    database: "student"
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});
db.connect((err) => {
  if (err) {
      console.error("Database connection failed: " + err.stack);
      return;
  }
  console.log("Connected to MySQL Database");
});

// Set up file upload using multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, './uploads/');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  const upload = multer({ storage });
  
  // Serve static files (uploads folder)
  app.use('/uploads', express.static('uploads'));

  // Middleware to check if the user is logged in
function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) {
      return next();
    } else {
      res.status(401).json({ message: 'You must be logged in to perform this action.' });
    }
  }
  
  // Route to handle seminar form submission
  app.post('/post-seminar', upload.fields([
    { name: 'brochure', maxCount: 1 },
    { name: 'seminar_image', maxCount: 1 }
  ]), (req, res) => {
    const { college_name, seminar_topic, seminar_category, seminar_date, seminar_venue } = req.body;
    const brochure = req.files['brochure'][0].filename; // Brochure PDF file
    const seminar_image = req.files['seminar_image'][0].filename; // Seminar Image file
  
    const checkDuplicateQuery = "SELECT * FROM seminars WHERE seminar_topic = ? AND seminar_date = ? AND college_name = ?";
    db.query(checkDuplicateQuery, [seminar_topic, seminar_date, college_name], (err, results) => {
        if (err) {
          console.error("Database error during duplicate check:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length > 0) {
            return res.json({ success: false, message: "A seminar with the same topic, date, and college has already been posted." });
        }

        const insertQuery = "INSERT INTO seminars (seminar_topic, seminar_date, college_name, seminar_venue, brochure, seminar_image, seminar_category) VALUES (?, ?, ?, ?, ?, ?, ?)";
        db.query(insertQuery, [seminar_topic, seminar_date, college_name, seminar_venue, brochure, seminar_image, seminar_category], (err) => {
            if (err) {
                console.error("Database error during seminar post:", err);
                return res.status(500).json({ success: false, message: "Database error" });
            }
            res.json({ success: true, message: "Seminar posted successfully!", redirect: "index.html" });
        });
    });
});
  // Endpoint to fetch all seminars sorted by date
app.get('/get-all-seminars', (req, res) => {
    const query = 'SELECT * FROM seminars ORDER BY seminar_date DESC';
  
    db.query(query, (err, result) => {
      if (err) {
        console.error('Error fetching seminars:', err);
        return res.status(500).json({ success: false });
      }
  
      res.json({ success: true, seminars: result });
    });
  });
  
  // Endpoint to fetch seminars by category
  app.get('/get-seminars-by-category', (req, res) => {
    const category = req.query.category;
  
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }
  
    const query = 'SELECT * FROM seminars WHERE seminar_category = ? ORDER BY seminar_date DESC';
    
    db.query(query, [category], (err, result) => {
      if (err) {
        console.error('Error fetching seminars by category:', err);
        return res.status(500).json({ success: false });
      }
  
      res.json({ success: true, seminars: result });
    });
  });
  

// 🔹 Login Route: Check if Customer Exists
app.post("/login_cust", (req, res) => {
    const { name, password } = req.body;

    if (!name || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const checkUserQuery = "SELECT * FROM users WHERE username = ? AND password = ?";
    db.query(checkUserQuery, [name, password], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });

        if (results.length > 0) {
         res.json({ success: true,
             message: "Login successful!", 
                redirect: "index.html" });
        } else {
            res.json({ success: false, message: "User not found. Redirecting to registration.", redirect: "signup.html" });
        }
    });
});
// 🔹 Registration Route: Insert New Customer and Redirect to custform.html
app.post("/register_cust", (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    
        const insertQuery = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
        db.query(insertQuery, [name, email, password], (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: "Database error" });
            }
            res.json({ success: true, message: "Registration successful!", redirect: "login.html" });
        });
    });
    
    app.post("/post_workshop", async (req, res) => {
      const { workshopName, workshopDate, college, venue, registrationLink, registrationAmount } = req.body;
  
      if (!workshopName || !workshopDate || !college || !venue || !registrationLink || !registrationAmount) {
          return res.status(400).json({ success: false, message: "All fields are required" });
      }
  
      const checkDuplicateQuery = "SELECT * FROM workshops WHERE workshopName = ? AND workshopDate = ? AND college = ?";
      db.query(checkDuplicateQuery, [workshopName, workshopDate, college], async (err, results) => {
          if (err) {
              console.error("Database error during duplicate check:", err);
              return res.status(500).json({ success: false, message: "Database error" });
          }
  
          if (results.length > 0) {
              return res.json({ success: false, message: "A workshop with the same name, date, and college has already been posted." });
          }
  
          const insertQuery = "INSERT INTO workshops (workshopName, workshopDate, college, venue, registrationLink, registrationAmount) VALUES (?, ?, ?, ?, ?, ?)";
          db.query(insertQuery, [workshopName, workshopDate, college, venue, registrationLink, registrationAmount], async (err) => {
              if (err) {
                  console.error("Database error during workshop post:", err);
                  return res.status(500).json({ success: false, message: "Database error" });
              }
  
              // Get userId by username
              const getUserIdQuery = "SELECT id FROM users WHERE username = ?";
              db.query(getUserIdQuery, [username], async (err, userIdResults) => {
                  if (err) {
                      console.error("Database error getting userId:", err);
                      return res.status(500).json({ success: false, message: "Database error getting userId" });
                  }
  
                  if (userIdResults.length > 0) {
                      const userId = userIdResults[0].id;
                      try {
                          const updatedRewards = await incrementRewards(userId, db);
                          res.json({ success: true, message: "Workshop posted successfully!", redirect: "index.html", rewards: updatedRewards });
                      } catch (incrementError) {
                          console.error("Error incrementing rewards:", incrementError);
                          res.status(500).json({ success: false, message: "Workshop posted, but rewards increment failed." });
                      }
                  } else {
                      res.status(404).json({ success: false, message: "User not found." });
                  }
              });
          });
      });
  });
  
  async function incrementRewards(userId, db) {
      return new Promise((resolve, reject) => {
          const updateQuery = "UPDATE users SET rewards = rewards + 1 WHERE id = ?";
          db.query(updateQuery, [userId], (err, results) => {
              if (err) {
                  console.error("Database error incrementing rewards:", err);
                  reject(err);
              } else {
                  const getRewardsQuery = "SELECT rewards FROM users WHERE id = ?";
                  db.query(getRewardsQuery, [userId], (err, rewardsResults) => {
                      if (err) {
                          console.error("Database error getting updated rewards:", err);
                          reject(err);
                      } else {
                          if (rewardsResults.length > 0 && rewardsResults[0].rewards !== undefined) {
                              resolve(rewardsResults[0].rewards);
                          } else {
                              reject("Could not retrieve rewards.");
                          }
                      }
                  });
              }
          });
      });
  }
  
/*
    app.post("/post_workshop", (req, res) => {
      const { workshopName, workshopDate, college, venue, registrationLink, registrationAmount } = req.body;
  
      if (!workshopName || !workshopDate || !college || !venue || !registrationLink || !registrationAmount) {
          return res.status(400).json({ success: false, message: "All fields are required" });
      }
      const checkDuplicateQuery = "SELECT * FROM workshops WHERE workshopName = ? AND workshopDate = ? AND college = ?";
      db.query(checkDuplicateQuery, [workshopName, workshopDate, college], (err, results) => {
          if (err) {
            console.error("Database error during duplicate check:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }

        if (results.length > 0) {
            return res.json({ success: false, message: "A workshop with the same name, date, and college has already been posted." });
        }

        const insertQuery = "INSERT INTO workshops (workshopName, workshopDate, college, venue, registrationLink, registrationAmount) VALUES (?, ?, ?, ?, ?, ?)";
        db.query(insertQuery, [workshopName, workshopDate, college, venue, registrationLink, registrationAmount], (err) => {
            if (err) {
                console.error("Database error during workshop post:", err);
                return res.status(500).json({ success: false, message: "Database error" });
            }
            res.json({ success: true, message: "Workshop posted successfully!", redirect: "index.html" });
        });
    });
});
  */   
  app.get("/get_workshops", (req, res) => {
    const getWorkshopsQuery = "SELECT * FROM workshops";
    db.query(getWorkshopsQuery, (err, results) => {
        if (err) {
            console.error("Database error fetching workshops:", err);
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, workshops: results });
      });
});

app.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});
